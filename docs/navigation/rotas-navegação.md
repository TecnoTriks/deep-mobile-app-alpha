# Arquitetura de navegação

## Provider tree (`App.tsx`)

```
SafeAreaProvider
└─ NetworkProvider
   └─ SQLiteProvider
      └─ QueryClientProvider
         └─ AuthProvider
            └─ NavigationContainer (ref + linking)
               └─ RootNavigator
```

## RootNavigator

- Exibe `LoadingScreen` enquanto `AuthContext.isLoading`.
- Registra dois grupos fixos: `Auth` e `App`.
- Um `useEffect` observa sessão, equipe, grupo, `isOfflineReady` e `forceFullRefresh`; quando mudam, dispara `navigationRef.reset` para a rota correta (`authRouteResolver.ts`).
- Modais globais permanecem aqui: `AlertModal` (refresh de dados) e `ReauthModal`.

## AuthNavigator

| Rota | Tela |
|---|---|
| `Login` | `LoginScreen` |
| `JoinTeam` | `JoinTeamScreen` |
| `NoGroup` | `NoGroupScreen` |
| `Preparation` | `OfflinePreparationScreen` |

## AppStackNavigator + AppShell

Substitui `AuthenticatedLayout` + `AppNavContext`.

| Rota | Tela |
|---|---|
| `Home` | `HomeScreen` |
| `Overview` | `OverviewScreen` |
| `Sync` | `SyncScreen` |
| `Team` | `TeamScreen` |
| `Records` | `RecordsNavigator` (stack aninhado) |

O `AppShell` renderiza header e drawer; o conteúdo é o `AppStack.Navigator` filho.

## RecordsNavigator

| Rota | Tela | Params |
|---|---|---|
| `List` | `RecordsScreen` | — |
| `Fill` | `FillRecordScreen` (via wrapper) | `{ recordGuid: string }` |

`RecordsListContext` guarda `localState` para atualização otimista da lista após salvar rascunho.

## Navegação programática

```ts
import { useAppNavigation } from '@/navigation/hooks';

const navigation = useAppNavigation();
navigation.navigate('Records');
```

```ts
import { useRecordsNavigation } from '@/navigation/hooks';

const navigation = useRecordsNavigation();
navigation.navigate('Fill', { recordGuid: '...' });
```

Reset de sessão é automático via `RootNavigator`; não é necessário chamar navegação em `signOut`.

## Deep links (opcional)

Config em `src/navigation/linking.ts`. Prefixo `deepagente://`. Para ativar em build nativo, adicionar `"scheme": "deepagente"` em `app.json` (ainda não configurado).

## Equivalência com o plano Expo Router

| Conceito Expo Router | React Navigation |
|---|---|
| `app/(auth)/login` | `Auth > Login` |
| `app/(app)/` | `App > Home` |
| `app/(app)/records` | `App > Records > List` |
| `app/(app)/records/[id]` | `App > Records > Fill` |
