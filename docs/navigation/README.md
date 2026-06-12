# Navegação e documentação atualizada

**Fonte de verdade** para navegação e para o comportamento atual do app após a migração para stacks aninhados do React Navigation.

Os arquivos em `docs/` (raiz) são legados e **não foram alterados**. As versões atualizadas estão nesta pasta.

## Mapa rápido de rotas

```
RootNavigator
├── Auth → Login | JoinTeam | NoGroup | Preparation
└── App  → Home | Overview | Sync | Team | Records
                              └── List | Fill(:recordGuid)
```

## Índice

### Navegação

| Documento | Conteúdo |
|---|---|
| [arquitetura.md](./arquitetura.md) | Árvore de navigators, tipos, hooks, deep links |
| [sqlite-crash-na-home.md](./sqlite-crash-na-home.md) | Crash `expo-sqlite` + FTS e correções |

### Documentação de features (atualizada)

| Documento | Conteúdo |
|---|---|
| [00-arquitetura.md](./00-arquitetura.md) | Mapa do projeto, princípios, débitos |
| [01-fluxo-autenticacao.md](./01-fluxo-autenticacao.md) | AuthContext, RootNavigator, reauth 401 |
| [04-tela-registros.md](./04-tela-registros.md) | Lista, FTS, `useRecords`, RecordsNavigator |
| [05-formulario-dinamico.md](./05-formulario-dinamico.md) | Formulário dinâmico, rascunho |
| [06-tela-visao-geral.md](./06-tela-visao-geral.md) | Overview, reset de dados |
| [07-banco-dados.md](./07-banco-dados.md) | SQLite, migrações, provider options |
| [08-api-http.md](./08-api-http.md) | axios, 401, endpoints |
| [09-layout-autenticado.md](./09-layout-autenticado.md) | AppShell, drawer, stack App |
| [10-build-config.md](./10-build-config.md) | `.env`, providers, build |

### Legado (ainda em `docs/`)

Telas sem cópia atualizada nesta pasta — paths podem referir `features/offline/` em vez de `consolidated-data/`:

| Documento legado | Conteúdo |
|---|---|
| `docs/02-tela-login.md` | Login, CPF/senha, modais |
| `docs/03-preparacao-offline.md` | Preparação offline (verificar paths) |

## Arquivos principais de código

| Arquivo | Responsabilidade |
|---|---|
| `src/navigation/RootNavigator.tsx` | Gate auth/app + modais globais |
| `src/navigation/AuthNavigator.tsx` | Stack pré-autenticado |
| `src/navigation/AppStackNavigator.tsx` | Stack logado + `AppShell` |
| `src/navigation/RecordsNavigator.tsx` | Lista → preenchimento |
| `src/navigation/components/AppShell.tsx` | Header + drawer |
| `src/navigation/types.ts` | ParamLists tipadas |
| `src/navigation/navigationRef.ts` | Reset global |
| `src/navigation/hooks.ts` | `useAppNavigation`, `useRecordsNavigation` |
