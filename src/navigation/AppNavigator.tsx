import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ReauthModal } from '../features/auth/components/ReauthModal';
import { useAuth } from '../features/auth/context/AuthContext';
import { JoinTeamScreen } from '../features/auth/screens/JoinTeamScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { NoGroupScreen } from '../features/auth/screens/NoGroupScreen';
import { HomeScreen } from '../features/home/screens/HomeScreen';
import { OfflinePreparationScreen } from '../features/consolidated-data/screens/OfflinePreparationScreen';
import { AlertModal } from '../shared/components/AlertModal';
import { AuthenticatedLayout } from '../shared/components/AuthenticatedLayout';
import { LoadingScreen } from '../shared/components/LoadingScreen';

export type RootStackParamList = {
  Home: undefined;
  JoinTeam: undefined;
  Login: undefined;
  NoGroup: undefined;
  Preparation: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const {
    clearForceFullRefresh,
    dismissDataRefreshPrompt,
    forceFullRefresh,
    isLoading,
    isOfflineReady,
    markOfflineReady,
    requestFullRefresh,
    session,
    shouldPromptDataRefresh,
  } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  // != null (loose) catches both null and undefined — a field that is either
  // means the API confirmed no value. A present string means the user has it.
  const hasTeam = !session
    || session.agent.equipe_guid != null
    || session.agent.equipe_id != null;
  const hasGroup = !session || session.agent.grupo_equipe_guid != null;

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen component={LoginScreen} name="Login" />
        ) : !hasTeam ? (
          <Stack.Screen component={JoinTeamScreen} name="JoinTeam" />
        ) : !hasGroup ? (
          <Stack.Screen component={NoGroupScreen} name="NoGroup" />
        ) : !isOfflineReady || forceFullRefresh ? (
          <Stack.Screen name="Preparation">
            {() => (
              <OfflinePreparationScreen
                forceFullRefresh={forceFullRefresh}
                onAdvance={() => {
                  markOfflineReady();
                  clearForceFullRefresh();
                }}
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Home">
            {() => (
              <AuthenticatedLayout>
                <HomeScreen />
              </AuthenticatedLayout>
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
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
