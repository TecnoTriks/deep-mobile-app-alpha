import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import type { NavigationState, PartialState } from '@react-navigation/native';

import { HomeScreen } from '../features/home/screens/HomeScreen';
import { OverviewScreen } from '../features/overview/screens/OverviewScreen';
import { SyncScreen } from '../features/sync/screens/SyncScreen';
import { TeamScreen } from '../features/team/screens/TeamScreen';
import { AppShell } from './components/AppShell';
import { navigateToAppScreen, navigateToRecordsList } from './navigationState';
import { RecordsNavigator } from './RecordsNavigator';
import { APP_SCREEN_TITLES, type AppStackParamList } from './types';

const AppStack = createNativeStackNavigator<AppStackParamList>();

function getRecordsFocusedRoute(
  recordsRoute: { state?: NavigationState | PartialState<NavigationState> } | undefined,
): 'List' | 'Fill' | null {
  if (!recordsRoute?.state) return 'List';
  const focused = recordsRoute.state.routes[recordsRoute.state.index ?? 0];
  return focused.name === 'Fill' ? 'Fill' : 'List';
}

export function AppStackNavigator() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<keyof AppStackParamList>('Home');
  const [recordsFocusedRoute, setRecordsFocusedRoute] = useState<'List' | 'Fill' | null>(null);

  const pageTitle = useMemo(() => {
    if (activeRoute === 'Records' && recordsFocusedRoute === 'Fill') {
      return 'Preenchimento de Formulario';
    }
    return APP_SCREEN_TITLES[activeRoute];
  }, [activeRoute, recordsFocusedRoute]);

  const handleNavigate = useCallback(
    (screen: keyof AppStackParamList) => {
      if (screen === 'Records' && activeRoute === 'Records' && recordsFocusedRoute === 'Fill') {
        navigateToRecordsList();
        return;
      }
      navigateToAppScreen(screen);
    },
    [activeRoute, recordsFocusedRoute],
  );

  const handleStateChange = useCallback((state: NavigationState | PartialState<NavigationState> | undefined) => {
    if (!state) return;
    const route = state.routes[state.index ?? 0];
    if (route.name in APP_SCREEN_TITLES) {
      setActiveRoute(route.name as keyof AppStackParamList);
    }
    setRecordsFocusedRoute(route.name === 'Records' ? getRecordsFocusedRoute(route) : null);
  }, []);

  return (
    <AppShell
      activeRoute={activeRoute}
      isMenuOpen={isMenuOpen}
      isRecordsFilling={activeRoute === 'Records' && recordsFocusedRoute === 'Fill'}
      onCloseMenu={() => setIsMenuOpen(false)}
      onNavigate={handleNavigate}
      onOpenMenu={() => setIsMenuOpen(true)}
      pageTitle={pageTitle}
    >
      <AppStack.Navigator
        screenOptions={{ animation: 'fade', headerShown: false }}
        screenListeners={{
          state: (event) => handleStateChange(event.data.state),
        }}
      >
        <AppStack.Screen component={HomeScreen} name="Home" />
        <AppStack.Screen component={OverviewScreen} name="Overview" />
        <AppStack.Screen component={SyncScreen} name="Sync" />
        <AppStack.Screen component={TeamScreen} name="Team" />
        <AppStack.Screen component={RecordsNavigator} name="Records" />
      </AppStack.Navigator>
    </AppShell>
  );
}
