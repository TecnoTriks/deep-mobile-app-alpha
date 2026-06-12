# Tela "Visão Geral"

> Versão atualizada em `docs/navigation/`. O arquivo legado em `docs/06-tela-visao-geral.md` pode estar desatualizado.

Arquivo: `src/features/overview/screens/OverviewScreen.tsx`

Acessada via menu lateral do `AppShell` (item "Visão Geral") → rota `App > Overview`.

## Estrutura

- **Card 1 — Dados sincronizados** (lê de `agent_profiles`, `offline_forms`, `offline_sync_state`):
  - Equipe
  - Grupo
  - Formulário
  - Registros de campo (badge verde com count)
- **Card 2 — Registros por situação de backoffice** (`getRecordsByBackofficeStatus`): só se `data.backofficeGroups.length > 0`.
  - Badge: `bg-blue-100` (Disponível), `bg-amber-100` (aguardo backoffice), `bg-zinc-100` (outros).
- **Rodapé**: `lastSyncAt`.
- **Botão fixo**: "Resetar tudo" com modal de confirmação.

## Dados

`OverviewData` em `src/features/consolidated-data/types/offline.ts` montado por `getOverviewData` (`offlineQueries.ts`).

## Resetar tudo

`handleReset`:

1. `clearAllOfflineData(database, session.agent.guid)`.
2. `signOut()` → `RootNavigator` reseta para `Auth > Login`.

> Botão disabled enquanto `resetting=true`; erro no `catch` só libera o spinner.

## Animações

- Fade + slide ao entrar (após `loading` false).
- Modal de confirmação: `animationType="fade"`.

## Buscas comuns

- "Card 2 não aparece" → `backofficeGroups` vazio; conferir `getRecordsByBackofficeStatus`.
- "Reset não apaga X" → tabelas em `clearAllOfflineData` (`offlineQueries.ts`).
- "Contador errado" → `offline_sync_state.records_count` na preparação.
