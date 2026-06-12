# Fluxo de Autenticação

> Versão atualizada em `docs/navigation/`. O arquivo legado em `docs/01-fluxo-autenticacao.md` pode estar desatualizado.

Cobre: `AuthContext`, `RootNavigator`, ciclo login → equipe → grupo → preparação → home, logout, reautenticação em 401.

## Componentes

| Arquivo | Responsabilidade |
|---|---|
| `src/features/auth/context/AuthContext.tsx` | Estado de sessão, bootstrap, login/logout, reauth, gating offline |
| `src/features/auth/services/authService.ts` | HTTP de login/verificação/primeiro acesso |
| `src/features/auth/services/sessionStorage.ts` | Persistência de 1 linha em `auth_session` (SQLite) |
| `src/features/auth/types/auth.ts` | Tipos `AuthSession`, `AuthenticatedAgent`, requests/responses |
| `src/features/auth/components/ReauthModal.tsx` | Modal de senha quando a API retorna 401 |
| `src/navigation/RootNavigator.tsx` | Gate auth/app + modais globais |
| `src/navigation/authRouteResolver.ts` | Resolve rota alvo a partir do estado de sessão |
| `src/navigation/navigationState.ts` | `resetToAuthScreen`, `resetToAppScreen` via `navigationRef` |

## Estado exposto por `useAuth()`

```ts
{
  isLoading: boolean,
  isOfflineReady: boolean,
  session: AuthSession | null,
  forceFullRefresh: boolean,
  shouldPromptDataRefresh: boolean,
  isReauthVisible: boolean,
  isReauthLoading: boolean,
  reauthError: string | null,
  signIn: (session) => Promise<void>,
  signOut: () => Promise<void>,
  markOfflineReady: () => void,
  clearOfflineReady: () => void,
  requestFullRefresh: () => void,
  clearForceFullRefresh: () => void,
  dismissDataRefreshPrompt: () => void,
  refreshSession: (update) => Promise<void>,
  cancelReauth: () => void,
  submitReauth: (senha) => Promise<void>,
}
```

## Máquina de estados (RootNavigator + authRouteResolver)

```
[bootstrap] isLoading=true → LoadingScreen (fora do stack)

session=null                    → Auth > Login
session + sem equipe            → Auth > JoinTeam
session + sem grupo             → Auth > NoGroup
session + !isOfflineReady       → Auth > Preparation
session + forceFullRefresh      → Auth > Preparation
session + offline pronto        → App > Home (reset)

signOut() → limpa sessão + dados offline do agente → Auth > Login
```

Resolução em `resolveAuthRoute()` (`authRouteResolver.ts`):

```ts
if (!session) return 'Login';
if (!hasTeam) return 'JoinTeam';
if (!hasGroup) return 'NoGroup';
if (!isOfflineReady || forceFullRefresh) return 'Preparation';
return 'App';
```

O `RootNavigator` observa sessão, equipe, grupo, `isOfflineReady` e `forceFullRefresh`. Quando a chave de rota muda, chama `navigationRef.reset` (`resetToAuthScreen` ou `resetToAppScreen`).

Detalhes:
- **Não existe `prepDone`** em memória. O gating usa `isOfflineReady` (memória) + `offline_sync_state.status = 'ready'` (SQLite via `isOfflineDataReady`).
- `hasTeam` = `equipe_guid` ou `equipe_id` presentes na sessão.
- `hasGroup` = `grupo_equipe_guid` presente na sessão.

## Bootstrap (efeito único ao montar)

`AuthContext.tsx`:

1. `loadSession(database)` → lê `auth_session WHERE id=1`.
2. Se houver: `setApiAccessToken` + `setSession` + `isOfflineDataReady` → `setIsOfflineReady`.
3. `setIsLoading(false)`.

> **Não há ping** em `/campo-agentes/{guid}` no bootstrap. Sessão expirada é tratada em runtime via interceptor 401 + `ReauthModal` (ou `signOut` se o usuário cancelar).

## Login

`signIn(session)` faz: `saveSession` → `setApiAccessToken` → `isOfflineDataReady` → `setIsOfflineReady` → `setShouldPromptDataRefresh` (se já havia dados) → `setSession`.

## Logout

`signOut()` faz:

1. `clearAllOfflineData(database, agentGuid)` — apaga dados offline do agente.
2. `clearSession` → `setApiAccessToken(null)` → reseta flags de offline/refresh/reauth → `setSession(null)`.
3. `RootNavigator` detecta `session=null` e reseta para `Auth > Login`.

## Reautenticação (401)

`apiClient` registra interceptor de resposta. Em 401 (exceto rotas `/auth/*`), chama `setSessionExpiredHandler` → `requestReauth()` no `AuthContext`:

- Abre `ReauthModal`.
- `submitReauth(senha)` chama `login` com CPF da sessão atual e **atualiza só o token** (preserva equipe/grupo).
- `cancelReauth()` fecha o modal e chama `signOut()`.
- Requisição original é reenviada com o novo token se o usuário confirmar.

## AuthNavigator — rotas

| Rota | Tela |
|---|---|
| `Login` | `LoginScreen` |
| `JoinTeam` | `JoinTeamScreen` |
| `NoGroup` | `NoGroupScreen` |
| `Preparation` | `OfflinePreparationScreen` |

## Endpoints consumidos

| Rota | authService.ts | Notas |
|---|---|---|
| `POST /auth/verificar-acesso` | `verificarAcesso` | Pré-checagem por CPF |
| `POST /auth/primeiro-acesso/{guid}?navegador=true` | `primeiroAcesso` | Primeiro acesso |
| `POST /auth/login` | `login` | Retorna `{ token, agente }` |

O interceptor adiciona `?app_service=v2&mobile=true` automaticamente. Bearer via `setApiAccessToken`.

## Modal de atualização de dados

Quando `shouldPromptDataRefresh` e o usuário já está em `App` com offline pronto, `RootNavigator` exibe `AlertModal` "Atualizar dados gerais?". Confirmar chama `requestFullRefresh()` → volta para `Preparation`.

## Buscas comuns

- "Login não funciona" → `docs/02-tela-login.md` + `ALLOWED_AGENT_TYPE` em `LoginScreen`.
- "Após login vai para JoinTeam/NoGroup" → conferir campos `equipe_*` e `grupo_equipe_guid` na sessão.
- "Fica preso em Preparation" → `offline_sync_state` e `markOfflineReady` em `OfflinePreparationScreen`.
- "401 não abre modal" → `setSessionExpiredHandler` em `AuthContext` e interceptor em `apiClient.ts`.
- "Reauth manda para NoGroup" → `submitReauth` deve mesclar sessão, não substituir agente inteiro pelo retorno de `login`.
