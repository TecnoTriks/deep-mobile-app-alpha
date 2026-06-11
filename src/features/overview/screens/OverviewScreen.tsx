import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/context/AuthContext';
import { clearAllOfflineData, getOverviewData, getPendingDraftsCount } from '../../consolidated-data/services/offlineQueries';
import type { OverviewData } from '../../consolidated-data/types/offline';
import { useNetwork } from '../../../shared/context/NetworkContext';

export function OverviewScreen() {
  const database = useSQLiteContext();
  const { session, signOut } = useAuth();
  const { isOnline } = useNetwork();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState(0);

  type PermissionKey = 'location' | 'camera' | 'media';
  type PermissionStatus = { key: PermissionKey; label: string; detail: string; ok: boolean };
  const [permissions, setPermissions] = useState<PermissionStatus[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  const modalWidth = Math.min(width - 48, 420);

  const loadPermissions = useCallback(async () => {
    // getBackgroundPermissionsAsync can throw on devices where background
    // location is not available — treat as not granted if it rejects.
    const [locFg, locBg, camera, media] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync().catch(() => ({ granted: false })),
      ImagePicker.getCameraPermissionsAsync(),
      ImagePicker.getMediaLibraryPermissionsAsync(),
    ]);

    const androidAccuracy = (locFg as Location.LocationPermissionResponse).android?.accuracy;
    const accuracyLabel = androidAccuracy === 'fine' ? 'Alta (GPS)'
      : androidAccuracy === 'coarse' ? 'Aproximada'
      : androidAccuracy === 'none' ? 'Desativada'
      : '—';

    const mediaDetail = media.accessPrivileges === 'all' ? 'Acesso total'
      : media.accessPrivileges === 'limited' ? 'Acesso parcial'
      : 'Negado';

    setPermissions([
      {
        key: 'location',
        label: 'Localização',
        detail: locFg.granted
          ? `Concedida · Precisão ${accuracyLabel}${locBg.granted ? ' · Segundo plano' : ''}`
          : 'Toque para conceder',
        ok: locFg.granted,
      },
      {
        key: 'camera',
        label: 'Câmera',
        detail: camera.granted ? 'Concedida' : 'Toque para conceder',
        ok: camera.granted,
      },
      {
        key: 'media',
        label: 'Galeria',
        detail: media.granted ? mediaDetail : 'Toque para conceder',
        ok: media.granted,
      },
    ]);
  }, []);

  const requestPermission = useCallback(async (key: PermissionKey) => {
    if (key === 'location') {
      await Location.requestForegroundPermissionsAsync();
    } else if (key === 'camera') {
      await ImagePicker.requestCameraPermissionsAsync();
    } else if (key === 'media') {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    await loadPermissions();
  }, [loadPermissions]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [d, pending] = await Promise.all([
      getOverviewData(database, session.agent.guid),
      getPendingDraftsCount(database),
    ]);
    setData(d);
    setPendingDrafts(pending);
    setLoading(false);
    void loadPermissions();
  }, [database, loadPermissions, session]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!loading && data) {
      Animated.parallel([
        Animated.timing(fadeAnim, { duration: 300, toValue: 1, useNativeDriver: true }),
        Animated.timing(slideAnim, { duration: 300, toValue: 0, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, data, fadeAnim, slideAnim]);

  const handleReset = async () => {
    if (!session) return;
    setResetting(true);
    setShowConfirm(false);
    try {
      await clearAllOfflineData(database, session.agent.guid);
      await signOut();
    } catch {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-primary-50">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center bg-primary-50 px-6">
        <Text className="text-center text-base text-zinc-500">Nenhum dado offline encontrado.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-primary-50">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-6">
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text className="mb-6 text-2xl font-bold text-zinc-950">Visão geral</Text>

          <View className="mb-6 rounded-3xl border border-zinc-200 bg-white p-5">
            <Text className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary-600">
              Dados sincronizados
            </Text>

            <View className="mb-3 flex-row items-center rounded-2xl bg-zinc-50 px-4 py-3">
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-100">
                <Text className="text-sm font-bold text-primary-600">E</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-zinc-400">Equipe</Text>
                <Text className="text-sm font-medium text-zinc-950">{data.teamName}</Text>
              </View>
            </View>

            <View className="mb-3 flex-row items-center rounded-2xl bg-zinc-50 px-4 py-3">
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-100">
                <Text className="text-sm font-bold text-primary-600">G</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-zinc-400">Grupo</Text>
                <Text className="text-sm font-medium text-zinc-950">{data.groupName}</Text>
              </View>
            </View>

            <View className="mb-3 flex-row items-center rounded-2xl bg-zinc-50 px-4 py-3">
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-100">
                <Text className="text-sm font-bold text-primary-600">F</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-zinc-400">Formulario</Text>
                <Text className="text-sm font-medium text-zinc-950">{data.formName}</Text>
              </View>
            </View>

            <View className="flex-row items-center rounded-2xl bg-zinc-50 px-4 py-3">
              <View className="mr-3 h-9 min-w-[60px] items-center justify-center rounded-full bg-green-100 px-2">
                <Text className="text-sm font-bold text-green-600" numberOfLines={1}>
                  {data.recordsCount}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-zinc-400">Registros de campo</Text>
                <Text className="text-sm font-medium text-zinc-950">{data.recordsCount} registros salvos</Text>
              </View>
            </View>
          </View>

          {data.backofficeGroups.length > 0 ? (
            <View className="mb-6 rounded-3xl border border-zinc-200 bg-white p-5">
              <Text className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary-600">
                Registros por situacao de backoffice
              </Text>

              {data.backofficeGroups.map((group, index) => {
                const isAvailable = group.statusGuid === '';
                const isPending = group.statusName === 'Ja preenchendo, aguardo backoffice';
                const badgeBg = isAvailable
                  ? 'bg-blue-100'
                  : isPending
                    ? 'bg-amber-100'
                    : 'bg-zinc-100';
                const badgeText = isAvailable
                  ? 'text-blue-600'
                  : isPending
                    ? 'text-amber-600'
                    : 'text-zinc-600';

                return (
                  <View
                    className={`flex-row items-center rounded-2xl bg-zinc-50 px-4 py-3 ${index < data.backofficeGroups.length - 1 ? 'mb-3' : ''}`}
                    key={group.statusGuid || 'available'}
                  >
                    <View className={`mr-3 h-9 min-w-[60px] items-center justify-center rounded-full px-2 ${badgeBg}`}>
                      <Text className={`text-sm font-bold ${badgeText}`} numberOfLines={1}>
                        {group.count}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-zinc-400">Situacao</Text>
                      <Text className="text-sm font-medium text-zinc-950" numberOfLines={1}>
                        {group.statusName}
                      </Text>
                    </View>
                    {group.statusColor ? (
                      <View
                        className="ml-3 h-4 w-4 rounded-full"
                        style={{ backgroundColor: group.statusColor }}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {permissions.length > 0 ? (
            <View className="mb-6 rounded-3xl border border-zinc-200 bg-white p-5">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary-600">
                Permissões do aplicativo
              </Text>
              {permissions.map((perm, index) => (
                <Pressable
                  className={`flex-row items-center rounded-2xl px-4 py-3 ${index < permissions.length - 1 ? 'mb-3' : ''} ${perm.ok ? 'bg-zinc-50' : 'bg-red-50 active:bg-red-100'}`}
                  disabled={perm.ok}
                  key={perm.key}
                  onPress={() => { void requestPermission(perm.key); }}
                >
                  <View
                    className={`mr-3 h-9 w-9 items-center justify-center rounded-full ${perm.ok ? 'bg-green-100' : 'bg-red-100'}`}
                  >
                    <Text className={`text-sm font-bold ${perm.ok ? 'text-green-600' : 'text-red-600'}`}>
                      {perm.ok ? '✓' : '✕'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-zinc-400">{perm.label}</Text>
                    <Text className={`text-sm font-medium ${perm.ok ? 'text-zinc-950' : 'text-red-700'}`}>
                      {perm.detail}
                    </Text>
                  </View>
                  {!perm.ok ? (
                    <Text className="ml-2 text-xs font-semibold text-red-500">›</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          {data.lastSyncAt ? (
            <Text className="text-center text-xs text-zinc-400">
              Ultima sincronizacao: {new Date(data.lastSyncAt).toLocaleString('pt-BR')}
            </Text>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View
        className="border-t border-zinc-200 bg-white px-4 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {!isOnline ? (
          <View className="mb-3 flex-row items-center rounded-2xl bg-amber-50 px-4 py-2.5">
            <Text className="flex-1 text-xs font-medium text-amber-800">
              Sem conexão — conecte-se à internet para resetar.
            </Text>
          </View>
        ) : pendingDrafts > 0 ? (
          <View className="mb-3 flex-row items-center rounded-2xl bg-amber-50 px-4 py-2.5">
            <Text className="flex-1 text-xs font-medium text-amber-800">
              {pendingDrafts} preenchimento{pendingDrafts === 1 ? '' : 's'} aguardando sincronização — sincronize antes de resetar.
            </Text>
          </View>
        ) : null}
        <Pressable
          className="min-h-14 items-center justify-center rounded-2xl bg-red-500 px-4 active:bg-red-600 disabled:opacity-50"
          disabled={resetting || !isOnline || pendingDrafts > 0}
          onPress={() => setShowConfirm(true)}
        >
          {resetting ? (
            <ActivityIndicator color="#ffffff" />
          ) : !isOnline ? (
            <Text className="text-base font-semibold text-white">Resetar tudo · Sem conexão</Text>
          ) : pendingDrafts > 0 ? (
            <Text className="text-base font-semibold text-white">
              Resetar tudo · {pendingDrafts} pendente{pendingDrafts === 1 ? '' : 's'}
            </Text>
          ) : (
            <Text className="text-base font-semibold text-white">Resetar tudo</Text>
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
            <Text className="mt-4 text-center text-xl font-semibold text-zinc-950">Resetar tudo</Text>
            <Text className="mt-2 text-center text-sm leading-5 text-zinc-600">
              Isso vai limpar todos os dados offline e encerrar sua sessao.
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
                onPress={handleReset}
              >
                <Text className="font-semibold text-white">Resetar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
