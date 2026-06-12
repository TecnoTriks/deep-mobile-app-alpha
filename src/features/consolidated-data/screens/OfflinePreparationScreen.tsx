import { useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiClient } from '../../../shared/api/apiClient';
import { useAuth } from '../../auth/context/AuthContext';
import { getSummaryData, isOfflineDataReady } from '../services/offlineQueries';
import { prepareOfflineData } from '../services/offlineSync';
import type { PreparationProgress, PreparationStep, SummaryData } from '../types/offline';

type Props = {
  forceFullRefresh?: boolean;
  onAdvance: () => void;
};

const steps: { key: PreparationStep; label: string }[] = [
  { key: 'agent', label: 'Dados do seu perfil' },
  { key: 'download', label: 'Dados da sua area' },
  { key: 'structures', label: 'Equipe e formulario' },
  { key: 'records', label: 'Registros para uso offline' },
  { key: 'situacoes', label: 'Situacoes de campo e backoffice' },
  { key: 'finish', label: 'Preparacao concluida' },
];

function getStepIndex(step: PreparationStep) {
  return steps.findIndex((item) => item.key === step);
}

export function OfflinePreparationScreen({ forceFullRefresh = false, onAdvance }: Props) {
  const database = useSQLiteContext();
  const { session, markOfflineReady } = useAuth();
  const [progress, setProgress] = useState<PreparationProgress>({ step: 'agent', message: 'Preparando o inicio' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const summaryFade = useRef(new Animated.Value(0)).current;

  const runPreparation = async () => {
    if (!session || isRunning) return;

    setIsRunning(true);
    setErrorMessage(null);

    try {
      const alreadyReady = await isOfflineDataReady(database, session.agent.guid);

      if (alreadyReady && !forceFullRefresh) {
        setProgress({ step: 'situacoes', message: 'Atualizando situacoes de campo e backoffice' });
        await new Promise((resolve) => setTimeout(resolve, 600));

        const [campoRes, backofficeRes] = await Promise.all([
          apiClient.get('/situacao-campo', { timeout: 30_000 }),
          apiClient.get('/situacao-backoffice', { timeout: 30_000 }),
        ]);

        const updatedAt = new Date().toISOString();
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS offline_situacoes_campo (
            guid TEXT PRIMARY KEY NOT NULL, nome TEXT NOT NULL, cor TEXT,
            raw_json TEXT NOT NULL, updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS offline_situacoes_backoffice (
            guid TEXT PRIMARY KEY NOT NULL, nome TEXT NOT NULL, cor TEXT,
            raw_json TEXT NOT NULL, updated_at TEXT NOT NULL
          );
        `);
        if (campoRes.data?.data) {
          await database.runAsync('DELETE FROM offline_situacoes_campo');
          for (const item of campoRes.data.data) {
            await database.runAsync(
              'INSERT OR REPLACE INTO offline_situacoes_campo (guid, nome, cor, raw_json, updated_at) VALUES (?, ?, ?, ?, ?)',
              item.guid, item.nome, item.cor ?? null, JSON.stringify(item), updatedAt,
            );
          }
        }
        if (backofficeRes.data?.data) {
          await database.runAsync('DELETE FROM offline_situacoes_backoffice');
          for (const item of backofficeRes.data.data) {
            await database.runAsync(
              'INSERT OR REPLACE INTO offline_situacoes_backoffice (guid, nome, cor, raw_json, updated_at) VALUES (?, ?, ?, ?, ?)',
              item.guid, item.nome, item.cor ?? null, JSON.stringify(item), updatedAt,
            );
          }
        }

        setProgress({ step: 'finish', message: 'Dados ja estavam prontos. Situacoes atualizadas.' });
      } else {
        await prepareOfflineData(database, session.agent.guid, setProgress);
      }

      const data = await getSummaryData(database, session.agent.guid);
      setSummary(data);
      await new Promise((resolve) => setTimeout(resolve, 400));
      setShowSummary(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel preparar os dados.');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runPreparation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showSummary) {
      Animated.timing(summaryFade, {
        duration: 400,
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [showSummary, summaryFade]);

  const currentStepIndex = getStepIndex(progress.step);
  const recordProgress = progress.total ? (progress.current ?? 0) / progress.total : 0;
  const overallProgress = Math.min(1, (currentStepIndex + recordProgress) / steps.length);

  useEffect(() => {
    Animated.timing(animatedProgress, {
      duration: 240,
      toValue: overallProgress,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, overallProgress]);

  if (showSummary) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ScrollView contentContainerClassName="flex-grow" contentContainerStyle={{ paddingBottom: 24 }}>
          <Animated.View className="flex-1 px-6 pt-12" style={{ opacity: summaryFade }}>
            <View className="items-center">
              <View className="h-24 w-24 items-center justify-center rounded-full bg-green-100">
                <Text className="text-5xl text-green-600" style={{ lineHeight: 56 }}>✓</Text>
              </View>

              <Text className="mt-6 text-center text-2xl font-bold text-zinc-950">
                Tudo pronto!
              </Text>
              <Text className="mt-2 text-center text-base leading-6 text-zinc-500">
                Seus dados estao salvos neste aparelho. Bons trabalhos em campo!
              </Text>

              <View className="mt-8 w-full rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                <Text className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-primary-600">
                  Resumo da preparacao
                </Text>

                <View className="mb-3 flex-row items-center rounded-2xl bg-white px-4 py-3">
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-100">
                    <Text className="text-sm font-bold text-primary-600">E</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-zinc-400">Equipe</Text>
                    <Text className="text-sm font-medium text-zinc-950">{summary?.teamName}</Text>
                  </View>
                </View>

                <View className="mb-3 flex-row items-center rounded-2xl bg-white px-4 py-3">
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-100">
                    <Text className="text-sm font-bold text-primary-600">G</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-zinc-400">Grupo</Text>
                    <Text className="text-sm font-medium text-zinc-950">{summary?.groupName}</Text>
                  </View>
                </View>

                <View className="mb-3 flex-row items-center rounded-2xl bg-white px-4 py-3">
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-100">
                    <Text className="text-sm font-bold text-primary-600">F</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-zinc-400">Formulario</Text>
                    <Text className="text-sm font-medium text-zinc-950">{summary?.formName}</Text>
                  </View>
                </View>

                <View className="flex-row items-center rounded-2xl bg-white px-4 py-3">
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-primary-100">
                    <Text className="text-sm font-bold text-primary-600">R</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-zinc-400">Registros</Text>
                    <Text className="text-sm font-medium text-zinc-950">
                      {summary
                        ? !summary.formBaseDados
                          ? 'Sem base'
                          : summary.recordsCount === 0
                            ? 'Nenhum registro'
                            : `${summary.recordsCount} registros`
                        : '—'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="mt-10 px-4">
              <Pressable
                className="min-h-14 items-center justify-center rounded-2xl bg-primary-500 px-4 active:bg-primary-600"
                onPress={() => {
                  markOfflineReady();
                  onAdvance();
                }}
              >
                <Text className="text-base font-semibold text-white">Avançar</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerClassName="flex-grow" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}>

        {/* Error banner — shown at top so it's immediately visible */}
        {errorMessage ? (
          <View className="mb-6 rounded-3xl bg-red-50 p-5">
            <Text className="text-lg font-semibold text-red-700">Precisamos da sua atenção</Text>
            <Text className="mt-2 text-sm leading-5 text-red-600">{errorMessage}</Text>
            <Pressable
              className="mt-5 min-h-12 items-center justify-center rounded-2xl bg-primary-500 px-4"
              disabled={isRunning}
              onPress={runPreparation}
            >
              <Text className="font-semibold text-white">Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}

        <View>
          <View className="self-start rounded-full bg-primary-100 px-3 py-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-primary-700">Primeira preparacao</Text>
          </View>

          <Text className="mt-8 text-4xl font-bold leading-tight text-zinc-950">Deixando tudo pronto para o campo.</Text>
          <Text className="mt-3 text-base leading-6 text-zinc-500">
            Estamos salvando suas informacoes neste aparelho para que o trabalho continue mesmo sem internet.
          </Text>

          <View className="mt-8 h-2 overflow-hidden rounded-full bg-zinc-200">
            <Animated.View
              className="h-full rounded-full bg-primary-500"
              style={{
                width: animatedProgress.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] }),
              }}
            />
          </View>

          {isRunning && progress.step === 'finish' ? (
            <View className="mt-8 items-center">
              <ActivityIndicator color="#8b5cf6" size="large" />
              <Text className="mt-4 text-center text-sm text-zinc-500">Finalizando...</Text>
            </View>
          ) : (
            <View className="mt-8">
              {steps.map((item, index) => {
                const isComplete = (index < currentStepIndex || (index === currentStepIndex && progress.step === 'finish')) && !showSummary;
                const isCurrent = index === currentStepIndex && progress.step !== 'finish' && !showSummary;

                return (
                  <View className="mb-3 flex-row items-center rounded-2xl bg-zinc-100 px-4 py-4" key={item.key}>
                    <View
                      className={`h-9 w-9 items-center justify-center rounded-full ${
                        isComplete ? 'bg-green-500' : isCurrent ? 'bg-primary-500' : 'bg-zinc-300'
                      }`}
                    >
                      <Text className="text-center font-bold text-white" style={{ lineHeight: undefined }}>
                        {isComplete ? '✓' : `${index + 1}`}
                      </Text>
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className={`font-medium ${isCurrent || isComplete ? 'text-zinc-950' : 'text-zinc-400'}`}>
                        {item.label}
                      </Text>
                      {isCurrent ? (
                        <Text className="mt-1 text-xs leading-4 text-zinc-500">
                          {progress.step === 'records' && progress.total
                            ? `${progress.message} · ${progress.current ?? 0} de ${progress.total}`
                            : progress.message}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {!errorMessage ? (
            <Text className="mt-6 text-center text-xs leading-5 text-zinc-400">
              Mantenha o aplicativo aberto durante esta primeira preparacao.
            </Text>
          ) : null}
        </View>
     </ScrollView>
    </SafeAreaView>
  );
}

