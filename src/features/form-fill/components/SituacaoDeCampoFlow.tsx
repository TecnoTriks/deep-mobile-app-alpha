import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saveSituacaoDeCampo } from '../services/fillRecordService';
import type { FillRecordLocalStatus } from '../types/form';

type Situacao = {
  guid: string;
  nome: string;
  cor: string | null;
};

type Phase = 'list' | 'preview' | 'saved';

type Props = {
  formGuid: string;
  onLocalStateSaved: (recordGuid: string, status: FillRecordLocalStatus) => void;
  onBack: () => void;
  recordGuid: string;
};

export function SituacaoDeCampoFlow({ formGuid, onBack, onLocalStateSaved, recordGuid }: Props) {
  const database = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [situacoes, setSituacoes] = useState<Situacao[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<Situacao | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('list');
  const [saving, setSaving] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    database
      .getAllAsync<{ guid: string; nome: string; cor: string | null }>(
        'SELECT guid, nome, cor FROM offline_situacoes_campo ORDER BY nome ASC',
      )
      .then(setSituacoes)
      .catch(() => setSituacoes([]))
      .finally(() => setLoadingList(false));
  }, [database]);

  const handleSelect = async (situacao: Situacao) => {
    setCaptureError(null);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setCaptureError('Permissão de câmera negada. Ative nas configurações do dispositivo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: 'images',
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    setSelected(situacao);
    setPhotoUri(result.assets[0].uri);
    setPhase('preview');
  };

  const handleSave = async () => {
    if (!selected || !photoUri) return;
    setSaving(true);
    try {
      await saveSituacaoDeCampo(database, recordGuid, formGuid, { guid: selected.guid, titulo: selected.nome }, photoUri);
      onLocalStateSaved(recordGuid, 'Preenchendo offline');
      setPhase('saved');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a situação de campo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = async () => {
    if (!selected) return;
    await handleSelect(selected);
  };

  if (phase === 'saved') {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
          <Text className="text-3xl">✓</Text>
        </View>
        <Text className="mt-4 text-center text-lg font-bold text-zinc-900">Situação registrada</Text>
        <Text className="mt-1.5 text-center text-sm text-zinc-500">
          {selected?.nome} salvo offline. Sincronize para enviar.
        </Text>
        <Pressable
          className="mt-6 min-h-12 items-center justify-center rounded-xl bg-primary-500 px-8 active:bg-primary-600"
          onPress={onBack}
        >
          <Text className="text-base font-semibold text-white">Concluir</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'preview' && selected && photoUri) {
    const imageSize = screenWidth - 32;
    return (
      <View className="flex-1 bg-zinc-50" style={{ paddingBottom: insets.bottom + 16 }}>
        <View
          className="mx-4 mt-4 overflow-hidden rounded-xl bg-zinc-200"
          style={{ height: imageSize * 0.75 }}
        >
          <Image
            resizeMode="cover"
            source={{ uri: photoUri }}
            style={{ width: imageSize, height: imageSize * 0.75 }}
          />
        </View>

        <View className="mx-4 mt-3 flex-row items-center rounded-xl bg-white px-4 py-3.5" style={{ elevation: 1 }}>
          {selected.cor ? (
            <View className="mr-3 h-4 w-4 rounded-full" style={{ backgroundColor: selected.cor }} />
          ) : null}
          <View className="flex-1">
            <Text className="text-xs text-zinc-400">Situação selecionada</Text>
            <Text className="text-sm font-semibold text-zinc-900">{selected.nome}</Text>
          </View>
        </View>

        <View className="mx-4 mt-3 flex-row gap-3">
          <Pressable
            className="min-h-12 flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 active:bg-zinc-50"
            onPress={handleRetake}
          >
            <Text className="text-sm font-semibold text-zinc-700">Tirar outra</Text>
          </Pressable>
          <Pressable
            className="min-h-12 flex-1 items-center justify-center rounded-xl bg-primary-500 px-4 active:bg-primary-600 disabled:opacity-50"
            disabled={saving}
            onPress={handleSave}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-sm font-semibold text-white">Salvar offline</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-50">
      <View className="border-b border-zinc-200 bg-white px-4 py-3.5">
        <Text className="text-base font-bold text-zinc-900">Situações de Campo</Text>
        <Text className="mt-0.5 text-xs text-zinc-500">Selecione uma situação e fotografe</Text>
      </View>

      {captureError ? (
        <View className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-3">
          <Text className="text-sm text-red-700">{captureError}</Text>
        </View>
      ) : null}

      {loadingList ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#8b5cf6" />
        </View>
      ) : situacoes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-zinc-400">
            Nenhuma situação de campo disponível.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 10 }}>
          {situacoes.map((situacao) => (
            <Pressable
              className="flex-row items-center rounded-xl bg-white px-4 py-4 active:bg-zinc-50"
              key={situacao.guid}
              onPress={() => handleSelect(situacao)}
              style={{ elevation: 1 }}
            >
              {situacao.cor ? (
                <View
                  className="mr-3 h-5 w-5 rounded-full"
                  style={{ backgroundColor: situacao.cor }}
                />
              ) : (
                <View className="mr-3 h-5 w-5 rounded-full bg-zinc-200" />
              )}
              <Text className="flex-1 text-sm font-medium text-zinc-900">{situacao.nome}</Text>
              <Text className="text-lg text-zinc-400">›</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
