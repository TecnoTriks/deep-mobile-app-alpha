# API / HTTP

> Versão atualizada em `docs/navigation/`. O arquivo legado em `docs/08-api-http.md` pode estar desatualizado.

Cliente único: `src/shared/api/apiClient.ts` (axios).

## Configuração

- `baseURL`: `env.apiUrl` (`app.config.ts` → `.env`).
- `params.default`: `{ app_service: 'v2', mobile: true }` em toda requisição.
- `headers.default.Content-Type`: `application/json`.
- `timeout.default`: `15s` (endpoints pesados sobrescrevem).

## Rede offline

`NetworkProvider` atualiza `setApiNetworkOnline`. Interceptor de **request** rejeita chamadas quando offline (`isNetworkError: true`).

## Auth

`setApiAccessToken(token | null)`:

- Token → `Authorization: Bearer <token>`.
- Null → remove header.

Chamado por `AuthContext` em bootstrap, `signIn`, `signOut` e `submitReauth`.

## Sessão expirada (401)

Interceptor de **response** em `apiClient.ts`:

- 401 em rotas não-auth → `sessionExpiredHandler` (registrado pelo `AuthContext`).
- Abre `ReauthModal`; em sucesso reenvia a requisição com novo token.
- Rotas ignoradas: `/auth/login`, `/auth/verificar-acesso`, `/auth/primeiro-acesso`.
- Múltiplos 401 simultâneos compartilham uma única `pendingReauth`.

Cancelar reauth → `signOut()` → `RootNavigator` volta para Login.

## Contrato comum das respostas

```ts
{
  code: number,      // 200 = OK
  status: boolean,
  message: string,
  data: T,
}
```

Sempre conferir `code === 200 && status === true` antes de usar `data`.

## Endpoints em uso

| Método | Endpoint | Onde | Timeout |
|---|---|---|---|
| POST | `/auth/verificar-acesso` | `authService` | 15s |
| POST | `/auth/primeiro-acesso/{guid}` | `authService` | 15s |
| POST | `/auth/login` | `authService` | 15s |
| GET | `/campo-agentes/{guid}` | `offlineApi.fetchAgentWorkData` | 60s |
| GET | `/mobile/dados-consolidados/{groupGuid}` | `offlineApi` | 300s |
| GET | `/situacao-campo` | `offlineApi` | 30s |
| GET | `/situacao-backoffice` | `offlineApi` | 30s |

## Tratamento de erro

`src/shared/utils/getErrorMessage.ts`:

- Axios → `response.data.message` ou fallback de conexão.
- `Error` → `message`.

## Buscas comuns

- "Token não vai no header" → `setApiAccessToken` após `signIn`.
- "401 não abre modal" → `setSessionExpiredHandler` no `AuthContext`.
- "Offline mas tenta API" → `NetworkProvider` e `cachedIsOnline`.
- "Param extra sumiu" → params do request sobrescrevem defaults.
