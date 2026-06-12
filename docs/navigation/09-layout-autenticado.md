# Layout Autenticado (Header + Drawer)

> Versão atualizada em `docs/navigation/`. O arquivo legado em `docs/09-layout-autenticado.md` pode estar desatualizado.

Substitui o antigo `AuthenticatedLayout.tsx` (removido).

| Arquivo | Responsabilidade |
|---|---|
| `src/navigation/components/AppShell.tsx` | Header, drawer, avatar, menu |
| `src/navigation/AppStackNavigator.tsx` | Stack de telas + estado de rota/título |

O `AppShell` envolve o `AppStack.Navigator` e é renderizado para **toda a área logada** (`App`).

## Rotas do stack (`AppStackParamList`)

| Rota | Tela | Título no header |
|---|---|---|
| `Home` | `HomeScreen` | Inicio |
| `Records` | `RecordsNavigator` | Preenchimentos / Preenchimento de Formulario |
| `Sync` | `SyncScreen` | Sincronização |
| `Overview` | `OverviewScreen` | Visão Geral |
| `Team` | `TeamScreen` | Equipe |

Títulos definidos em `APP_SCREEN_TITLES` (`types.ts`). Em `Records > Fill`, o título muda para "Preenchimento de Formulario".

## Estado no AppStackNavigator

| Estado | Função |
|---|---|
| `activeRoute` | Rota focada do stack (via `screenListeners.state`) |
| `recordsFocusedRoute` | `List` ou `Fill` dentro de `Records` |
| `isMenuOpen` | Drawer visível |
| `pageTitle` | Derivado de `activeRoute` + `recordsFocusedRoute` |

Navegação do menu chama `navigateToAppScreen` / `navigateToRecordsList` (`navigationState.ts`).

## Header

- Esquerda: botão menu (`MenuIcon`, `bg-primary-500`).
- Centro: nome do agente + tipo.
- Direita: `pageTitle`.

## Drawer (menu lateral)

- Largura: `Math.min(width * 0.88, 360)`.
- Animações `useNativeDriver` (slide + overlay).
- Itens:
  - Inicio → `Home`
  - Preenchimentos → `Records` (se já em `Fill`, volta para `List`)
  - Sincronização → `Sync`
  - Visão Geral → `Overview`
  - Equipe → `Team`
- Rodapé: "Sair deste aparelho" → `signOut()`.
- Fecha: overlay, botão X, seleção de item, `onRequestClose` (Android back).

## Conteúdo

Cada tela é uma rota nativa do stack — **não há** `currentScreen` com `useState` nem `children` injetado na Home.

```tsx
<AppShell ...>
  <AppStack.Navigator>
    <AppStack.Screen name="Home" component={HomeScreen} />
    <AppStack.Screen name="Overview" component={OverviewScreen} />
    {/* Sync, Team, Records */}
  </AppStack.Navigator>
</AppShell>
```

## Records e preservação de estado

- Stack `Records` monta ao navegar para Preenchimentos (não na Home).
- Ao ir `List` → `Fill` → `goBack`, a lista permanece montada no stack.
- `RecordsScreen` usa `useIsFocused` + ref de scroll para restaurar posição.
- `useRecords(isFocused)` suspende queries fora de foco.

## Navegação programática

```ts
import { useAppNavigation } from '@/navigation/hooks';

const navigation = useAppNavigation();
navigation.navigate('Records');
```

Hooks em `src/navigation/hooks.ts`. Tipos em `src/navigation/types.ts`.

## Componentes auxiliares

- `MenuIcon` — `src/shared/components/MenuIcon.tsx`
- `MenuItem` — `src/shared/components/MenuItem.tsx`

## Avatar (iniciais)

Primeiras letras de até 2 palavras do `session.agent.nome`, uppercase.

## Buscas comuns

- "Drawer não fecha" → `onRequestClose` e animações `menuTranslate`/`overlayOpacity`.
- "Título não muda no formulário" → `getRecordsFocusedRoute` em `AppStackNavigator`.
- "Item de menu marcado errado" → `activeRoute` e `isRecordsFilling` no `AppShell`.
- "Sair não funciona" → `signOut` no `AuthContext`; reset automático no `RootNavigator`.
