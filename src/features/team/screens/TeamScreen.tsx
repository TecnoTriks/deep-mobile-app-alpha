import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/context/AuthContext';
import { getAgentProfile, leaveTeam } from '../../auth/services/authService';
import { clearAllOfflineData } from '../../../features/consolidated-data/services/offlineQueries';
import { getErrorMessage } from '../../../shared/utils/getErrorMessage';

type TeamInfo = {
  teamName: string;
  groupName: string;
};

export function TeamScreen() {
  const database = useSQLiteContext();
  const { session, refreshSession, clearOfflineReady, requestFullRefresh } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [info, setInfo] = useState<TeamInfo | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalWidth = Math.min(width - 48, 420);

  useEffect(() => {
    if (!session) return;
    database
      .getFirstAsync<{ team_name: string; group_name: string }>(
        'SELECT team_name, group_name FROM agent_profiles WHERE guid = ?',
        session.agent.guid,
      )
      .then((row) => {
        if (row) setInfo({ teamName: row.team_name ?? '—', groupName: row.group_name ?? '—' });
      })
      .catch(() => undefined);
  }, [database, session]);

  const handleLeave = async () => {
    if (!session || isLeaving) return;
    setIsLeaving(true);
    setError(null);
    setShowConfirm(false);
    try {
      await leaveTeam(session.agent.guid);
      // Fetch the authoritative post-leave state from the server before updating
      // local session. This ensures equipe_guid/grupo_equipe_guid reflect exactly
      // what the server stored (nulls), even if reauth happened mid-request.
      const updatedAgent = await getAgentProfile(session.agent.guid);
      // Clear offline data that belonged to the old team before refreshing the
      // session — AppNavigator will route to JoinTeam as soon as session updates.
      await clearAllOfflineData(database, session.agent.guid);
      clearOfflineReady();
      await refreshSession(updatedAgent);
      // No navigation call needed: AppNavigator sees equipe_guid = null → JoinTeam.
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível sair da equipe.'));
      setIsLeaving(false);
    }
    // Do NOT reset isLeaving on success — the component will unmount as AppNavigator
    // transitions away; resetting it would cause a brief state flicker.
  };

  return (
    <View className="flex-1 bg-primary-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <Text className="mb-5 text-2xl font-bold text-zinc-950">Equipe</Text>

        <View className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary-600">
            Dados da equipe
          </Text>

          <View className="mb-3 flex-row items-center rounded-xl bg-zinc-50 px-4 py-3">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-100">
              <Text className="text-sm font-bold text-primary-600">E</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-zinc-400">Equipe</Text>
              {info ? (
                <Text className="text-sm font-semibold text-zinc-950">{info.teamName}</Text>
              ) : (
                <ActivityIndicator color="#8b5cf6" size="small" style={{ alignSelf: 'flex-start', marginTop: 2 }} />
              )}
            </View>
          </View>

          <View className="flex-row items-center rounded-xl bg-zinc-50 px-4 py-3">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-100">
              <Text className="text-sm font-bold text-primary-600">G</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-zinc-400">Grupo</Text>
              {info ? (
                <Text className="text-sm font-semibold text-zinc-950">{info.groupName}</Text>
              ) : (
                <ActivityIndicator color="#8b5cf6" size="small" style={{ alignSelf: 'flex-start', marginTop: 2 }} />
              )}
            </View>
          </View>
        </View>

        {error ? (
          <View className="mb-4 rounded-xl bg-red-50 px-4 py-3">
            <Text className="text-sm leading-5 text-red-700">{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        className="border-t border-zinc-200 bg-white px-4 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          className="min-h-14 items-center justify-center rounded-2xl bg-red-500 px-4 active:bg-red-600 disabled:opacity-50"
          disabled={isLeaving}
          onPress={() => setShowConfirm(true)}
        >
          {isLeaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Sair da equipe</Text>
          )}
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
        statusBarTranslucent={Platform.OS === 'android'}
        transparent
        visible={showConfirm}
      >
        <View
          className="flex-1 items-center justify-center bg-black/50 px-6"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <View className="items-center rounded-3xl bg-white p-6" style={{ width: modalWidth }}>
            <View className="h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <Text className="text-2xl font-bold text-red-600">!</Text>
            </View>
            <Text className="mt-4 text-center text-xl font-semibold text-zinc-950">Sair da equipe</Text>
            <Text className="mt-2 text-center text-sm leading-5 text-zinc-600">
              Você será desvinculado da equipe e terá que ser adicionado novamente pelo coordenador.
            </Text>
            <View className="mt-6 w-full flex-row gap-3">
              <Pressable
                className="min-h-12 flex-1 items-center justify-center rounded-2xl border border-zinc-300 bg-white px-4"
                onPress={() => setShowConfirm(false)}
              >
                <Text className="font-semibold text-zinc-700">Cancelar</Text>
              </Pressable>
              <Pressable
                className="min-h-12 flex-1 items-center justify-center rounded-2xl bg-red-500 px-4 active:bg-red-600"
                onPress={handleLeave}
              >
                <Text className="font-semibold text-white">Sair</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
