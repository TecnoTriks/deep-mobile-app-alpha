import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';

import { ReauthModal } from '../features/auth/components/ReauthModal';
import { useAuth } from '../features/auth/context/AuthContext';
import { AlertModal } from '../shared/components/AlertModal';
import { LoadingScreen } from '../shared/components/LoadingScreen';
import { AuthNavigator } from './AuthNavigator';
import { buildAuthRouteKey, resolveAuthRoute } from './authRouteResolver';
import { resetToAppScreen, resetToAuthScreen } from './navigationState';
import { AppStackNavigator } from './AppStackNavigator';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const {
    clearForceFullRefresh,
    dismissDataRefreshPrompt,
    forceFullRefresh,
    isLoading,
    isOfflineReady,
    requestFullRefresh,
    session,
    shouldPromptDataRefresh,
  } = useAuth();

  const routeKeyRef = useRef<string | null>(null);

  const hasTeam = Boolean(
    session && (session.agent.equipe_guid != null || session.agent.equipe_id != null),
  );
  const hasGroup = Boolean(session && session.agent.grupo_equipe_guid != null);

  useEffect(() => {
    if (isLoading) return;

    const routeKey = buildAuthRouteKey({
      forceFullRefresh,
      hasGroup,
      hasTeam,
      isOfflineReady,
      session,
    });

    if (routeKeyRef.current === routeKey) return;
    routeKeyRef.current = routeKey;

    const target = resolveAuthRoute({
      forceFullRefresh,
      hasGroup,
      hasTeam,
      isOfflineReady,
      session,
    });

    if (target === 'App') {
      resetToAppScreen('Home');
      return;
    }

    resetToAuthScreen(target);
  }, [forceFullRefresh, hasGroup, hasTeam, isLoading, isOfflineReady, session]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen component={AuthNavigator} name="Auth" />
        <RootStack.Screen component={AppStackNavigator} name="App" />
      </RootStack.Navigator>
      <AlertModal
        cancelLabel="Agora nao"
        confirmLabel="Buscar novamente"
        description="Os dados gerais deste aparelho ja estao disponiveis. Deseja baixa-los novamente agora?"
        onCancel={dismissDataRefreshPrompt}
        onClose={dismissDataRefreshPrompt}
        onConfirm={() => {
          dismissDataRefreshPrompt();
          requestFullRefresh();
        }}
        title="Atualizar dados gerais?"
        visible={Boolean(session && hasTeam && hasGroup && isOfflineReady && shouldPromptDataRefresh && !forceFullRefresh)}
      />
      <ReauthModal />
    </>
  );
}
