# Tela de Registros (lista, busca, filtro)

> Versão atualizada em `docs/navigation/`. O arquivo legado em `docs/04-tela-registros.md` pode estar desatualizado.

Caminho: `App > Records > List` — menu "Preenchimentos" ou botão na Home.

## Componentes

| Arquivo | Responsabilidade |
|---|---|
| `src/navigation/RecordsNavigator.tsx` | Stack `List` / `Fill` + `RecordsListProvider` |
| `src/navigation/RecordsListContext.tsx` | Estado otimista `localState` após salvar rascunho |
| `src/features/records/screens/records/RecordsScreen.tsx` | UI da lista (toolbar, flatlist, modal de filtro) |
| `src/features/records/hooks/useRecords.ts` | Estado, paginação, debounce, mapeamento de filtros |
| `src/features/records/components/RecordsToolbar.tsx` | Input de busca + botão "Filtro" |
| `src/features/records/components/FilterModal.tsx` | Modal com lista de status |
| `src/features/records/components/RecordCardItem.tsx` | Card de cada registro (memoizado) |
| `src/features/records/components/StatusBadge.tsx` | Badge colorido por status |
| `src/features/records/types/records.ts` | `StatusFilter` e GUIDs-sentença |
| `src/features/consolidated-data/services/offlineQueries.ts` | `getRecordsWithFilter`, `getBackofficeStatuses` |
| `src/features/consolidated-data/types/offline.ts` | `RecordCard` |

## Fluxo

```
AppStackNavigator
  └─ RecordsNavigator
       ├─ List → RecordsScreen
       │           ├─ useRecords(isFocused)
       │           ├─ Toolbar (busca + filtro)
       │           ├─ FlatList de RecordCardItem
       │           └─ FilterModal
       └─ Fill → FillRecordScreen (recordGuid)
                    └─ goBack() → volta para List
```

- `RecordsScreen` navega com `useRecordsNavigation().navigate('Fill', { recordGuid })`.
- Título do header ("Preenchimentos" vs "Preenchimento de Formulario") vem de `AppStackNavigator` ao observar o stack interno de `Records`.
- `RecordsListContext` repassa `localState` para `markOfflineDraft` ao voltar do formulário.

## Montagem e SQLite

- O stack `Records` **só monta** quando o usuário navega para Preenchimentos (não na abertura da Home).
- `useRecords(enabled)` — `RecordsScreen` passa `useIsFocused()` como `enabled`. Queries e FTS **não rodam** fora de foco.
- Ver [sqlite-crash-na-home.md](./sqlite-crash-na-home.md) para o workaround do `SQLiteProvider`.

## `useRecords` — ponto-chave de manutenção

`src/features/records/hooks/useRecords.ts`:

- **`enabled`**: todos os `useEffect` de carga retornam cedo se `!enabled`.
- **`requestId` ref**: ignora respostas atrasadas em trocas rápidas de filtro/busca.
- **refs de loading** (`isLoadingRef`, `isLoadingMoreRef`, `hasMoreRef`): evitam chamadas duplicadas.
- **Mapeamento de filtro**: converte GUIDs especiais para sentinelas internas (`__available__`, etc.) antes de `getRecordsWithFilter`.
- **Debounce**: 250ms só se `search` não-vazio.
- **`resetToken`**: bump força re-fetch (`clearFilters`).
- **`markOfflineDraft`**: atualização otimista; remove card se filtro incompatível.
- **`loadMore`**: append com `nextCursor`.

### Status cards derivados

- `hasOfflineDraft` + status local → cores fixas (`#f59e0b` / `#71717a`).
- `canFill` decide botão "Preencher/Continuar".
- "Ja preenchendo, aguardo backoffice" quando backoffice = "Pendente" sem rascunho.

## Busca (FTS5)

- Tabela virtual `offline_records_fts` (migração v6).
- `createRecordsSearchQuery` em `offlineQueries.ts` monta `MATCH` com tokens Unicode.
- Busca em `name`, `address`, `street`, `customer_code`.
- Triggers em `migrations.ts` e `offlineSync.ts`.
- Case-insensitive, sem acentos (`unicode61 remove_diacritics`).

## Paginação

- Cursor = `offline_records.rowid`. `pageSize = 40`.
- `onEndReachedThreshold = 0.5`.

## UI

- ActivityIndicator em tela cheia só na primeira carga.
- `scrollOffset` em ref; restaurado ao voltar do `Fill` via `useIsFocused`.
- `removeClippedSubviews` forçado `true` no Android.
- `FilterModal`: "Limpar" e "Fechar".

## Buscas comuns

- "Busca não acha nada" → `offline_records_fts` existe? Tokens vazios em `createRecordsSearchQuery`.
- "Filtro não filtra" → mapeamento em `useRecords.ts` e sentinelas em `records.ts`.
- "Card some ao salvar rascunho" → `markOfflineDraft` com filtro incompatível (esperado).
- "Lista vazia" → `offline_records` populado na preparação (`saveRecords` em `offlineSync.ts`).
- "Crash ao abrir Home" → não é esta tela; ver [sqlite-crash-na-home.md](./sqlite-crash-na-home.md).
