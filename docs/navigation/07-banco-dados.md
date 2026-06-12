# Banco de Dados (SQLite)

> Versão atualizada em `docs/navigation/`. O arquivo legado em `docs/07-banco-dados.md` pode estar desatualizado.

Provider: `expo-sqlite`. Database: `deep-agente.db`. Migrações em `src/shared/database/migrations.ts`.

## Configuração do provider (`App.tsx`)

```tsx
<SQLiteProvider
  databaseName="deep-agente.db"
  onInit={migrateDatabase}
  options={{ finalizeUnusedStatementsBeforeClosing: false }}
>
```

A opção `finalizeUnusedStatementsBeforeClosing: false` é **obrigatória** com FTS5 neste projeto — workaround para crash nativo em `sqlite3_close`. Detalhes em [sqlite-crash-na-home.md](./sqlite-crash-na-home.md).

## Versão atual: **9**

| Versão | Mudança |
|---|---|
| 1 | `sync_queue` |
| 2 | `auth_session` (1 linha, `id=1`) |
| 3 | Tabelas offline principais + índices |
| 4 | `offline_situacoes_campo`, `offline_situacoes_backoffice` |
| 5 | Índices em colunas de busca de `offline_records` |
| 6 | FTS5 `offline_records_fts` + triggers + rebuild |
| 7 | `offline_form_drafts` |
| 8 | Colunas extras em drafts + backfill |
| 9 | Índice `idx_offline_form_drafts_status_record` |

## Pragma global

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

## Tabelas principais (resumo)

- `auth_session` — token + agente (1 linha).
- `agent_profiles` — perfil + `team_guid`, `group_guid`, `contract_guid`.
- `offline_sync_state` — `status` (`preparing`/`ready`/`error`), `records_count`.
- `offline_records` + `offline_backoffice` — registros e eventos.
- `offline_records_fts` (FTS5) — busca na lista de registros.
- `offline_form_drafts` — rascunhos de preenchimento.
- `sync_queue` — estrutura para fila de sync (consumo parcial).

## Triggers de FTS

`ensureRecordsSearchTriggers` em `migrations.ts` e SQL inline em `offlineSync.ts`. `suspendRecordsSearchIndex` / `rebuildRecordsSearchIndex` durante import em batch.

## Como adicionar migração

1. Incrementar `DATABASE_VERSION` em `migrations.ts`.
2. Bloco `if (currentVersion < N) { ... }` idempotente quando possível.
3. `ensureRecordsSearchTriggers` no fim do bootstrap.
4. Atualizar este documento.

## Consumidores importantes

- `consolidated-data/services/offlineSync.ts` — escrita na preparação.
- `consolidated-data/services/offlineQueries.ts` — leitura (lista, overview, home dashboard).
- `form-fill/services/fillRecordService.ts` — rascunhos.
- `auth/services/sessionStorage.ts` — sessão.

## Carga SQLite e navegação

- **Home**: `getHomeDashboardData` — sem FTS de registros na montagem inicial.
- **Records**: FTS só quando `App > Records > List` está em foco (`useRecords(isFocused)`).
- Evitar muitas queries paralelas pesadas na mesma montagem de tela.

## Buscas comuns

- "Crash ao abrir app logado" → [sqlite-crash-na-home.md](./sqlite-crash-na-home.md).
- "Busca não retorna" → rebuild FTS: `INSERT INTO offline_records_fts(offline_records_fts) VALUES ('rebuild');`
- "Erro de migração" → `PRAGMA user_version`; em dev, limpar storage do app.
- "Insert travando" → `busy_timeout=5000`; transação aberta?
