# Correção: crash nativo do SQLite ao entrar na Home

Documenta o problema observado em desenvolvimento (Expo Go e dev build `com.triks.deepagente`), a causa identificada no logcat e as alterações aplicadas no projeto.

## Sintoma

- App fechava por completo (~3s após o bundle JS iniciar, coincidindo com o fim do splash e entrada na área autenticada).
- Nenhuma tela vermelha do React; crash **nativo** (`SIGABRT`).
- Logcat apontava `libexpo-sqlite.so` em `sqlite3_close()` / `NativeDatabaseBinding`.

```
F DEBUG: ... libexpo-sqlite.so
  expo::NativeDatabaseBinding::sqlite3_close()
Force finishing activity com.triks.deepagente/.MainActivity
```

## Causa

Combinação de fatores:

1. **FTS5** — o app usa busca full-text em `offline_records_fts` (`src/shared/database/migrations.ts`, migração v6). Há relatos de crash no `expo-sqlite` ao fechar conexão ou finalizar statements quando FTS está em uso ([expo/expo#38168](https://github.com/expo/expo/issues/38168)).

2. **Pico de carga SQLite na Home** — ao montar a área logada, várias operações disparavam juntas:
   - `HomeScreen` → `getHomeDashboardData` (várias queries em paralelo)
   - Lista de registros → `getRecordsWithFilter` com **FTS**
   - Isso pressionava o módulo nativo na thread `DefaultDispatch` e podia abortar em `sqlite3_close`.

## Alterações aplicadas

### 1. Opção do `SQLiteProvider` (`App.tsx`)

Desliga a finalização automática agressiva de prepared statements ao fechar o banco — workaround recomendado para FTS no `expo-sqlite`:

```tsx
<SQLiteProvider
  databaseName="deep-agente.db"
  onInit={migrateDatabase}
  options={{ finalizeUnusedStatementsBeforeClosing: false }}
>
```

| Arquivo | Linha de referência |
|---|---|
| `App.tsx` | prop `options` do `SQLiteProvider` |

Opção documentada em `expo-sqlite` (`SQLiteOpenOptions.finalizeUnusedStatementsBeforeClosing`, default `true`).

**Não remover** sem testar em dispositivo real com dados offline preparados e navegação até Registros com busca FTS.

---

### 2. Queries de registros só com tela em foco (`useRecords`)

O hook aceita `enabled` e só executa `getFormBaseDados`, `getBackofficeStatuses` e `getRecordsWithFilter` quando `enabled === true`:

```ts
export function useRecords(enabled = true) {
  // ...
  useEffect(() => {
    if (!enabled) return;
    // carrega registros
  }, [enabled, ...]);
}
```

`RecordsScreen` passa `useIsFocused()`:

```ts
const isFocused = useIsFocused();
const { ... } = useRecords(isFocused);
```

| Arquivo | Responsabilidade |
|---|---|
| `src/features/records/hooks/useRecords.ts` | parâmetro `enabled` nos efeitos |
| `src/features/records/screens/records/RecordsScreen.tsx` | `useRecords(isFocused)` |

---

### 3. Registros não carregam na abertura da Home (navegação)

Antes, `RecordsFlow` montava (mesmo oculto) junto com a Home e disparava FTS na hora.

Com a navegação em stacks (`docs/navigation/arquitetura.md`):

- A rota `App > Records` só é visitada quando o usuário abre **Preenchimentos** (menu ou botão na Home).
- Na primeira entrada na Home, roda principalmente `HomeScreen` + queries do dashboard — **sem** lista/FTS de registros.

| Arquivo | Comportamento |
|---|---|
| `src/navigation/AppStackNavigator.tsx` | `Records` é screen do stack, não montada até navegação |
| `src/navigation/RecordsNavigator.tsx` | stack `List` / `Fill` |

---

## O que não foi alterado

- Schema SQLite / migrações (`src/shared/database/migrations.ts`) — FTS permanece necessário para busca na lista.
- Nome do banco: `deep-agente.db`.
- `migrateDatabase` no `onInit` do provider.

## Se o crash voltar

1. **Limpar dados do app** no dispositivo (Settings → Apps → Deep Agente → Clear storage) — descarta banco corrompido de testes anteriores.
2. Confirmar que `finalizeUnusedStatementsBeforeClosing: false` ainda está em `App.tsx`.
3. Capturar log completo:
   ```bash
   adb logcat -b crash -d
   ```
4. Verificar se alguma tela nova dispara muitas queries SQLite em paralelo na montagem (mesmo padrão do problema original).

## Relação com docs legadas

| Doc legado | Situação |
|---|---|
| `docs/07-banco-dados.md` | Não menciona `finalizeUnusedStatementsBeforeClosing` nem FTS + crash — **atualizar no futuro** |
| `docs/10-build-config.md` | Cita `SQLiteProvider` sem `options` — **atualizar no futuro** |
| `docs/09-layout-autenticado.md` | Citava `RecordsFlow` sempre montado com `hidden` — padrão **substituído** por stack lazy |

Ver também [divergencias-com-docs-legadas.md](./divergencias-com-docs-legadas.md).

## Resumo

| Medida | Objetivo |
|---|---|
| `finalizeUnusedStatementsBeforeClosing: false` | Evitar abort nativo em `sqlite3_close` com FTS |
| `useRecords(isFocused)` | Evitar FTS fora da tela de registros |
| Stack `Records` sob demanda | Reduzir carga SQLite ao abrir a Home |
