import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../features/auth/context/AuthContext';
import { JoinTeamScreen } from '../features/auth/screens/JoinTeamScreen';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { NoGroupScreen } from '../features/auth/screens/NoGroupScreen';
import { OfflinePreparationScreen } from '../features/consolidated-data/screens/OfflinePreparationScreen';
import type { AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function PreparationScreen() {
  const { clearForceFullRefresh, forceFullRefresh, markOfflineReady } = useAuth();

  return (
    <OfflinePreparationScreen
      forceFullRefresh={forceFullRefresh}
      onAdvance={() => {
        markOfflineReady();
        clearForceFullRefresh();
      }}
    />
  );
}

export function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen component={LoginScreen} name="Login" />
      <AuthStack.Screen component={JoinTeamScreen} name="JoinTeam" />
      <AuthStack.Screen component={NoGroupScreen} name="NoGroup" />
      <AuthStack.Screen component={PreparationScreen} name="Preparation" />
    </AuthStack.Navigator>
  );
}
