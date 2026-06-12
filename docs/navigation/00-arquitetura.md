# Arquitetura · Documentação Estratégica

> Versão atualizada em `docs/navigation/`. O arquivo legado em `docs/00-arquitetura.md` pode estar desatualizado.

Documentação focada em **encontrar rápido o que precisa para corrigir, ajustar ou melhorar**. Estruturada por feature, com referências cruzadas por arquivo e termos de busca.

> **Regra**: Antes de escrever código, leia `AGENTS.md` (Expo v56).

## Índice de leitura por intenção

| Você quer… | Vá para |
|---|---|
| Entender navegação e rotas | [arquitetura.md](./arquitetura.md) |
| Entender como o app liga e desliga | [01-fluxo-autenticacao.md](./01-fluxo-autenticacao.md) |
| Corrigir/ajustar tela de login | `docs/02-tela-login.md` (legado) |
| Mexer na preparação offline / sync | `docs/03-preparacao-offline.md` (legado; paths em `consolidated-data/`) |
| Ajustar lista de registros | [04-tela-registros.md](./04-tela-registros.md) |
| Formulário dinâmico | [05-formulario-dinamico.md](./05-formulario-dinamico.md) |
| Visão geral | [06-tela-visao-geral.md](./06-tela-visao-geral.md) |
| Banco SQLite | [07-banco-dados.md](./07-banco-dados.md) |
| API/HTTP | [08-api-http.md](./08-api-http.md) |
| Header + drawer | [09-layout-autenticado.md](./09-layout-autenticado.md) |
| Build e `.env` | [10-build-config.md](./10-build-config.md) |
| Crash SQLite na Home | [sqlite-crash-na-home.md](./sqlite-crash-na-home.md) |

## Mapa de features

```
src/
├── features/
│   ├── auth/              → Login, sessão, JoinTeam, NoGroup, ReauthModal
│   ├── home/              → HomeScreen (dashboard com React Query)
│   ├── consolidated-data/ → Preparação offline, tipos e queries de registros
│   ├── overview/          → Visão geral (dados sincronizados)
│   ├── records/           → Listagem, busca, filtro de registros
│   ├── form-fill/         → Formulário dinâmico (campos, validação, rascunho)
│   ├── sync/              → Tela de sincronização
│   └── team/              → Tela de equipe
├── navigation/            → Root, Auth, App e Records navigators
│   └── components/        → AppShell (header + drawer)
└── shared/
    ├── api/               → axios + token bearer + interceptor 401
    ├── components/        → UI genérica (modais, ícones SVG)
    ├── config/            → env (lê .env via expo-constants)
    ├── context/           → NetworkProvider
    ├── database/          → Migrações SQLite + fila de sync
    ├── notifications/     → Push (Expo) — opcional
    ├── query/             → React Query client
    └── utils/             → Helpers puros (CPF, mensagens de erro)
```

## Navegação (resumo)

```
RootNavigator
├── Auth → Login | JoinTeam | NoGroup | Preparation
└── App  → Home | Overview | Sync | Team | Records
                              └── List | Fill(:recordGuid)
```

Detalhes em [arquitetura.md](./arquitetura.md).

## Princípios arquiteturais

1. **Estado de sessão fica no `AuthContext`**. Toda tela que precisa de agente/token consome `useAuth()`. Token é injetado no `apiClient` via `setApiAccessToken`.
2. **Persistência local é a fonte de verdade em runtime**. Registros, formulários, rascunhos e estruturas ficam em SQLite (`expo-sqlite`). O backend é usado para baixar e sincronizar.
3. **Tipos de domínio residem em `features/*/types/*.ts`**. Não duplique tipos em componentes.
4. **Campos do formulário são dinâmicos** — lidos de `offline_forms.raw_json`. Engine em `features/form-fill/engine/formEngine.ts`.
5. **Filtros especiais** (Rascunho, Preenchendo offline, Disponível) usam GUIDs-sentença em `features/records/types/records.ts` e são traduzidos no hook `useRecords`.
6. **Rotas tipadas** em `src/navigation/types.ts`. Navegação programática via `useAppNavigation()` e `useRecordsNavigation()`.

## Estado atual conhecido (gaps, débitos)

- `sync_queue` está criado mas o consumidor de envio ainda é parcial (`sync/` em evolução).
- `notificationService` existe mas **não é chamado** em lugar algum do app.
- `HomeScreen` usa React Query (`useQuery`) para o dashboard; demais telas ainda usam `await` direto na maioria dos casos.
- Enums `FILLABLE_STATUS_GUIDS` em `consolidated-data/services/offlineQueries.ts` estão hard-coded.
- `ALLOWED_AGENT_TYPE` no login está hard-coded; trocar por config quando disponível.
- Deep link: `linking.ts` preparado; falta `"scheme": "deepagente"` em `app.json` para build nativo.

## Como rodar

- `npm start` — Expo dev server
- `npm run android` — build/run nativo Android
- `npm run typecheck` — `tsc --noEmit` (rode antes de PR)
- `npm run build:apk` — build EAS remoto (perfil `apk` em `eas.json`)
- `npm run build:apk:local` — `expo prebuild` + gradle local
