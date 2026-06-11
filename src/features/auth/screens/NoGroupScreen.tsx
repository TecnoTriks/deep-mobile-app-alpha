import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { getAgentProfile } from '../services/authService';
import { clearAllOfflineData } from '../../consolidated-data/services/offlineQueries';
import { getErrorMessage } from '../../../shared/utils/getErrorMessage';

export function NoGroupScreen() {
  const database = useSQLiteContext();
  const { session, refreshSession, clearOfflineReady, requestFullRefresh, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (isLoading || !session) return;
    setIsLoading(true);
    setError(null);
    try {
      const updatedAgent = await getAgentProfile(session.agent.guid);
      if (!updatedAgent.grupo_equipe_guid) {
        setError('Ainda sem grupo vinculado. Aguarde o coordenador vincular seu perfil.');
        return;
      }
      await clearAllOfflineData(database, session.agent.guid);
      clearOfflineReady();
      await refreshSession(updatedAgent);
      requestFullRefresh();
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível verificar os dados.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut().catch(() => undefined);
  };

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-6" edges={['top', 'bottom']}>
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
        <Text className="text-3xl">⏳</Text>
      </View>
      <Text className="mt-5 text-center text-2xl font-bold text-zinc-950">Sem grupo vinculado</Text>
      <Text className="mt-3 text-center text-base leading-6 text-zinc-500">
        Seu perfil ainda não foi vinculado a um grupo de trabalho. Aguarde o coordenador ou toque em
        verificar novamente.
      </Text>

      {error ? (
        <View className="mt-5 w-full rounded-2xl bg-red-50 px-4 py-3">
          <Text className="text-center text-sm leading-5 text-red-700">{error}</Text>
        </View>
      ) : null}

      <Pressable
        className="mt-8 min-h-14 w-full items-center justify-center rounded-2xl bg-primary-500 px-6 active:bg-primary-600 disabled:opacity-50"
        disabled={isLoading}
        onPress={handleRefresh}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">Verificar novamente</Text>
        )}
      </Pressable>

      <Pressable className="mt-4 py-2" onPress={handleSignOut}>
        <Text className="text-sm text-zinc-400 underline">Sair e usar outra conta</Text>
      </Pressable>
    </SafeAreaView>
  );
}
