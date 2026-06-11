import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { getAgentProfile, joinTeam } from '../services/authService';
import { clearAllOfflineData } from '../../consolidated-data/services/offlineQueries';
import { getErrorMessage } from '../../../shared/utils/getErrorMessage';

export function JoinTeamScreen() {
  const database = useSQLiteContext();
  const { session, refreshSession, clearOfflineReady, requestFullRefresh, signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const digits = pin.split('');

  const handleSubmit = async () => {
    if (pin.length !== 4 || isLoading || !session) return;
    setIsLoading(true);
    setError(null);
    try {
      await joinTeam(session.agent.guid, pin);
      const updatedAgent = await getAgentProfile(session.agent.guid);
      // Clear stale offline data before refreshing session so AppNavigator
      // routes correctly to Preparation (forceFullRefresh = true).
      await clearAllOfflineData(database, session.agent.guid);
      clearOfflineReady();
      await refreshSession(updatedAgent);
      requestFullRefresh();
    } catch (err) {
      setError(getErrorMessage(err, 'Código inválido ou equipe não encontrada.'));
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut().catch(() => undefined);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
          keyboardShouldPersistTaps="handled"
        >
        <View className="mb-10">
          <Text className="text-3xl font-bold text-zinc-950">Ingressar na equipe</Text>
          <Text className="mt-3 text-base leading-6 text-zinc-500">
            Digite o código de 4 dígitos fornecido pelo coordenador da equipe.
          </Text>
        </View>

        {/* Hidden input captures keyboard — visible boxes show digits */}
        <TextInput
          ref={inputRef}
          autoFocus
          caretHidden
          className="absolute h-0 w-0 opacity-0"
          editable={!isLoading}
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={(text) => {
            setPin(text.replace(/\D/g, '').slice(0, 4));
            setError(null);
          }}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
          value={pin}
        />

        {/* PIN display — tapping anywhere refocuses the hidden input */}
        <Pressable
          className="flex-row justify-center gap-4"
          onPress={() => inputRef.current?.focus()}
        >
          {[0, 1, 2, 3].map((i) => {
            const filled = i < digits.length;
            const active = i === digits.length && !isLoading;
            return (
              <View
                key={i}
                className={`h-16 w-16 items-center justify-center rounded-2xl border-2 ${
                  active
                    ? 'border-primary-500 bg-primary-50'
                    : filled
                      ? 'border-primary-400 bg-white'
                      : 'border-zinc-200 bg-zinc-50'
                }`}
                style={{ elevation: active ? 2 : 0 }}
              >
                <Text className="text-3xl font-bold text-zinc-950">
                  {digits[i] ?? ''}
                </Text>
              </View>
            );
          })}
        </Pressable>

        <Pressable
          className="mt-8 min-h-14 items-center justify-center rounded-2xl bg-primary-500 px-6 active:bg-primary-600 disabled:opacity-40"
          disabled={pin.length !== 4 || isLoading}
          onPress={handleSubmit}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Confirmar código</Text>
          )}
        </Pressable>

        {error ? (
          <View className="mt-4 flex-row items-start rounded-2xl bg-red-50 px-4 py-3">
            <View className="mr-3 mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-red-100">
              <Text className="text-xs font-bold text-red-600">!</Text>
            </View>
            <Text className="flex-1 text-sm leading-5 text-red-700">{error}</Text>
          </View>
        ) : null}

        <Pressable className="mt-8 self-center py-2" onPress={handleSignOut}>
          <Text className="text-sm text-zinc-400 underline">Sair e usar outra conta</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
