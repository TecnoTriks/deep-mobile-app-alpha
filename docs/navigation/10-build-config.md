# Build, Configuração e Ambiente

> Versão atualizada em `docs/navigation/`. O arquivo legado em `docs/10-build-config.md` pode estar desatualizado.

## Variáveis de ambiente

Lidas em `src/shared/config/env.ts` via `expo-constants.extra`:

```ts
const apiUrl = Constants.expoConfig?.extra?.apiUrl;
if (typeof apiUrl !== 'string' || apiUrl.length === 0) {
  throw new Error('API_URL nao foi configurada no arquivo .env.');
}
```

`.env`:

```
API_URL=https://sua.api
```

Lido por `app.config.ts` e exposto em `expoConfig.extra`. App não inicia sem `API_URL`.

## Scripts (`package.json`)

| Script | Função |
|---|---|
| `npm start` | Expo dev server |
| `npm run android` | Build + run nativo Android |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build:apk` | EAS build remoto, perfil `apk` |
| `npm run build:apk:local` | `expo prebuild` + gradle local |

## Provider tree (`App.tsx`)

```
SafeAreaProvider
└─ NetworkProvider
   └─ SQLiteProvider (deep-agente.db, onInit=migrateDatabase,
   │                   options.finalizeUnusedStatementsBeforeClosing=false)
      └─ QueryClientProvider (queryClient)
         └─ AuthProvider
            └─ NavigationContainer (ref=navigationRef, linking=linking)
               └─ RootNavigator
            └─ CustomSplash (overlay até fade, fora do NavigationContainer)
```

Ordem importa:

- SQLite antes de `AuthProvider` (`useSQLiteContext`).
- `navigationRef` para reset global de rotas (`signOut`, troca de sessão).
- `linking` em `src/navigation/linking.ts` (prefixo `deepagente://`).

Ver [07-banco-dados.md](./07-banco-dados.md) e [sqlite-crash-na-home.md](./sqlite-crash-na-home.md) para opções do SQLite.

## Navegação

- **React Navigation 7** — `@react-navigation/native-stack`, stacks aninhados.
- Entry: `RootNavigator` (não `AppNavigator`).
- Detalhes: [arquitetura.md](./arquitetura.md).

## Estilização

- **NativeWind** (Tailwind no RN).
- Paleta: `primary-*`, `zinc-*`, `green-*`, `red-*`, `amber-*`.
- Tokens em `tailwind.config.js`.

## Stack e libs principais

- React 19 / React Native 0.85 / Expo ~56.
- TanStack Query 5 — usado em `HomeScreen`; demais telas majoritariamente SQLite direto.
- axios, expo-sqlite, expo-file-system, expo-image-picker, expo-location, react-native-svg.

> Leia `docs/AGENTS.md` antes de APIs Expo novas.

## Pontos de atenção

- **Expo Go**: push notifications limitadas; dev build para notificações reais.
- **Build Android local**: `gradlew` conforme SO; timeout do Gradle wrapper pode exigir retry ou aumento de `networkTimeout`.
- **Deep links**: adicionar `"scheme": "deepagente"` em `app.json` para ativar em build nativo.
- **Typecheck**: `npm run typecheck` — sem ESLint/Prettier configurado.

## Buscas comuns

- "App não abre" → `API_URL` ausente.
- "Tela branca após splash" → ordem dos providers; crash SQLite (ver sqlite-crash doc).
- "Build local falha no Gradle" → `expo prebuild --clean`; timeout de download do wrapper.
