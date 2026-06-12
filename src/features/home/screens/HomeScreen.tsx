import { useQuery } from '@tanstack/react-query';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/context/AuthContext';
import { getHomeDashboardData } from '../../consolidated-data/services/offlineQueries';

import type { AppStackParamList } from '../../../navigation/types';

// ─── animation helper ─────────────────────────────────────────────────────────

function useStagger(count: number, stepMs = 70) {
  const anims = useRef(
    Array.from({ length: count }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(20),
    })),
  ).current;

  const run = useCallback(() => {
    Animated.stagger(
      stepMs,
      anims.map(({ opacity, translateY }) =>
        Animated.parallel([
          Animated.timing(opacity, { duration: 280, toValue: 1, useNativeDriver: true }),
          Animated.timing(translateY, { duration: 280, toValue: 0, useNativeDriver: true }),
        ]),
      ),
    ).start();
  }, [anims, stepMs]);

  return {
    run,
    style: (i: number) => ({
      opacity: anims[i].opacity,
      transform: [{ translateY: anims[i].translateY }],
    }),
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  accent,
  ringColor,
}: {
  label: string;
  value: number;
  accent?: boolean;
  ringColor?: string;
}) {
  return (
    <View
      className={`flex-1 items-center justify-center rounded-xl py-4 ${accent ? 'bg-primary-500' : 'bg-white'}`}
      style={{
        ...(ringColor ? { borderWidth: 2, borderColor: ringColor } : {}),
      }}
    >
      <Text className={`text-lg font-bold ${accent ? 'text-white' : 'text-zinc-900'}`}>
        {value.toLocaleString('pt-BR')}
      </Text>
      <Text
        className={`mt-0.5 px-2 text-center text-[10px] leading-3 ${accent ? 'text-primary-100' : 'text-zinc-400'}`}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View
      className="items-center justify-center rounded-2xl bg-white px-6 py-5"
      style={{ minWidth: 120, borderLeftWidth: 3, borderLeftColor: color }}
    >
      <Text className="text-3xl font-bold text-zinc-900">
        {value.toLocaleString('pt-BR')}
      </Text>
      <Text className="mt-1.5 text-center text-xs font-medium text-zinc-400" numberOfLines={2} style={{ maxWidth: 96 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── screen ───────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const database = useSQLiteContext();
  const { session } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const agentGuid = session?.agent.guid;

  // 6 staggered zones: header, context strip, stats row, cta, alert, carousel
  const stagger = useStagger(6);

  // Os contadores ficam em cache (react-query): ao voltar para a Home os ultimos numeros
  // aparecem na hora (sem spinner) enquanto um refetch em segundo plano atualiza os dados.
  // Com staleTime 0 o refetch acontece a cada montagem, garantindo numeros sempre frescos
  // apos preencher/sincronizar — sem recalculo bloqueante a cada abertura.
  const { data, isLoading, refetch } = useQuery({
    enabled: Boolean(agentGuid),
    queryFn: () => getHomeDashboardData(database, agentGuid!),
    queryKey: ['home-dashboard', agentGuid],
    staleTime: 0,
  });

  const load = useCallback(() => { void refetch(); }, [refetch]);

  useEffect(() => {
    if (data) stagger.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-50">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-50 px-6">
        <Text className="text-center text-sm text-zinc-400">Sem dados offline disponíveis.</Text>
        <Pressable className="mt-4 min-h-11 items-center justify-center rounded-2xl bg-primary-500 px-6" onPress={load}>
          <Text className="text-sm font-semibold text-white">Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  const lastSyncLabel = data.lastSyncAt
    ? new Date(data.lastSyncAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  const metricCards = [
    { label: 'Com retorno backoffice', value: data.backofficeReturnCount, color: '#fff9ee' },
    { label: 'Situações de Campo', value: data.situacaoDeCampoCount, color: '#fff9ee' },
    { label: 'Pendente de sincronização', value: data.pendingSyncCount, color: '#fff9ee' },
  ];

  return (
    <ScrollView
      className="flex-1 bg-zinc-50"
      contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >

      {/* ── 1. Cabeçalho com identidade operacional ─────────────────────── */}
      <Animated.View style={stagger.style(0)}>
        <View className="rounded-b-[12px] bg-primary-500 px-5 pb-12 pt-6">
          <Text
            className="text-xs font-semibold uppercase tracking-[3px] text-primary-200"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {data.teamName}
          </Text>
          <Text
            className="mt-2 text-[26px] font-bold leading-8 text-white"
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {data.groupName}
          </Text>

          {/* meta strip */}
          <View className="mt-4 flex-row flex-wrap items-center gap-2">
            <View className="rounded-lg bg-white/20 px-3 py-1">
              <Text className="text-xs font-semibold text-white">
                {data.formBaseDados ? 'Com base' : 'Sem base'}
              </Text>
            </View>
            <View className="max-w-[180px] rounded-lg bg-white/20 px-3 py-1">
              <Text className="text-xs font-semibold text-white" numberOfLines={1} ellipsizeMode="tail">
                {data.formName}
              </Text>
            </View>
            {lastSyncLabel ? (
              <View className="rounded-lg bg-white/15 px-3 py-1">
                <Text className="text-xs text-primary-100">Atualizado {lastSyncLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>

      </Animated.View>

      {/* ── 2. Stats rápidas (3 chips) ──────────────────────────────────── */}
      <Animated.View className="mx-4 -mt-3 flex-row gap-2.5" style={stagger.style(1)}>
        <StatChip accent label="Registros" ringColor="#fafafa" value={data.recordsCount} />
        <StatChip label="Disponíveis" value={data.availableCount} />
        <StatChip label="Aguardando backoffice" value={data.waitingBackofficeCount} />
      </Animated.View>

      {/* ── 3. Botão principal ──────────────────────────────────────────── */}
      <Animated.View className="mx-4 mt-5" style={stagger.style(2)}>
        <Pressable
          className="min-h-[68px] flex-row items-center justify-between rounded-2xl bg-zinc-900 px-6 active:bg-zinc-800"
          onPress={() => navigation.navigate({ name: 'Records', params: { screen: 'List' } })}
          style={{
            elevation: 6,
          }}
        >
          <View>
            <Text className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Registros disponíveis
            </Text>
            <Text className="mt-0.5 text-lg font-bold text-white">Iniciar Preenchimentos</Text>
          </View>
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary-500">
            <Text className="text-lg font-bold text-white">›</Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* ── 4. Alerta de backoffice (só se houver) ──────────────────────── */}
      {data.backofficeReturnCount > 0 ? (
        <Animated.View className="mx-4 mt-4" style={stagger.style(3)}>
          <Pressable
            className="flex-row items-center overflow-hidden rounded-xl bg-amber-500 px-4 py-4 active:bg-amber-600"
            onPress={() => navigation.navigate({ name: 'Records', params: { screen: 'List' } })}
          >
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-white/25">
              <Text className="text-sm font-bold text-white">⚠</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-white">
                {data.backofficeReturnCount} registro{data.backofficeReturnCount === 1 ? '' : 's'} com retorno do backoffice
              </Text>
              <Text className="mt-0.5 text-xs text-amber-100">
                Toque para verificar os campos aguardando revisão
              </Text>
            </View>
            <Text className="ml-2 text-lg font-bold text-white/60">›</Text>
          </Pressable>
        </Animated.View>
      ) : (
        // placeholder para manter o índice dos stagger correto
        <Animated.View style={stagger.style(3)} />
      )}

      {/* ── 5. Divisor de seção ─────────────────────────────────────────── */}
      <Animated.View className="mx-5 mt-6 flex-row items-center gap-3" style={stagger.style(4)}>
        <View className="h-px flex-1 bg-zinc-200" />
        <Text className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Resumo
        </Text>
        <View className="h-px flex-1 bg-zinc-200" />
      </Animated.View>

      {/* ── 6. Carrossel de métricas ─────────────────────────────────────── */}
      <Animated.View className="mt-4" style={stagger.style(5)}>
        <ScrollView
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {metricCards.map((card) => (
            <View key={card.label} style={{ marginRight: 8 }}>
              <MetricCard color={card.color} label={card.label} value={card.value} />
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* ── spacer ──────────────────────────────────────────────────────── */}
      <View className="flex-1" />

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <View className="items-center pb-2">
        <Image
          resizeMode="contain"
          source={require('../../../../assets/deep/logo.jpg')}
          style={{ height: 36, width: 120, opacity: 0.45 }}
        />
      </View>

    </ScrollView>
  );
}
