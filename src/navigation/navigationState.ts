import type { NavigationState, PartialState } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';

import { navigationRef } from './navigationRef';
import type { AppStackParamList, AuthStackParamList } from './types';

type AuthRouteState = {
  index: number;
  routes: { name: keyof AuthStackParamList }[];
};

type AppRouteState = {
  index: number;
  routes: { name: keyof AppStackParamList }[];
};

export function getFocusedRouteName(state: NavigationState | PartialState<NavigationState> | undefined) {
  if (!state) return undefined;
  const route = state.routes[state.index ?? 0];
  if (route.state) {
    return getFocusedRouteName(route.state as NavigationState);
  }
  return route.name;
}

export function resetToAuthScreen(screen: keyof AuthStackParamList) {
  if (!navigationRef.isReady()) return;

  const authState: AuthRouteState = {
    index: 0,
    routes: [{ name: screen }],
  };

  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'Auth', state: authState }],
    }),
  );
}

export function resetToAppScreen(screen: keyof AppStackParamList = 'Home') {
  if (!navigationRef.isReady()) return;

  const appState: AppRouteState = {
    index: 0,
    routes: [{ name: screen }],
  };

  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'App', state: appState }],
    }),
  );
}

export function navigateToAppScreen(screen: keyof AppStackParamList) {
  if (!navigationRef.isReady()) return;
  if (screen === 'Records') {
    navigationRef.navigate('App', { screen: 'Records', params: { screen: 'List' } });
    return;
  }
  navigationRef.navigate('App', { screen });
}

export function navigateToRecordsList() {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('App', { screen: 'Records', params: { screen: 'List' } });
}
