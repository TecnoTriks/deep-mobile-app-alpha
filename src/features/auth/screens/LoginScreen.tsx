import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordDefinedModal } from '../components/PasswordDefinedModal';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { type AuthStep, StepIndicator } from '../components/StepIndicator';
import { useAuth } from '../context/AuthContext';
import { getAgentProfile, login, primeiroAcesso, verificarAcesso } from '../services/authService';
import { setApiAccessToken } from '../../../shared/api/apiClient';
import { useAuthLayout } from '../utils/useAuthLayout';
import { getErrorMessage } from '../../../shared/utils/getErrorMessage';
import { formatCpf } from '../../../shared/utils/formatCpf';

export function LoginScreen() {
  const { contentWidth, insets } = useAuthLayout();
  const { signIn } = useAuth();
  const [step, setStep] = useState<AuthStep>('cpf');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [agentGuid, setAgentGuid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordDefinedModalVisible, setIsPasswordDefinedModalVisible] = useState(false);
  const fieldOpacity = useRef(new Animated.Value(1)).current;
  const fieldOffset = useRef(new Animated.Value(0)).current;
  const isCpfStep = step === 'cpf';
  const isCpfComplete = cpf.length === 11;
  const isSubmitDisabled = isLoading || (isCpfStep && !isCpfComplete);

  useEffect(() => {
    fieldOpacity.setValue(0);
    fieldOffset.setValue(18);

    Animated.parallel([
      Animated.timing(fieldOpacity, { duration: 260, toValue: 1, useNativeDriver: true }),
      Animated.timing(fieldOffset, { duration: 260, toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [fieldOffset, fieldOpacity, step]);

  const resetFlow = () => {
    setStep('cpf');
    setCpf('');
    setPassword('');
    setAgentGuid(null);
    setErrorMessage(null);
  };

  const checkAccess = async () => {
    if (isLoading) return;
    if (!isCpfComplete) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const access = await verificarAcesso(cpf);

      setAgentGuid(access.guid);
      setPassword('');
      setStep(access.liberado ? 'password' : 'reset-password');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Nao foi possivel verificar o acesso.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isCpfStep && isCpfComplete && !isLoading && !errorMessage) {
      checkAccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCpfComplete]);

  const authenticate = async () => {
    if (isLoading) return;
    if (!password) {
      setErrorMessage('Informe a senha.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (step === 'reset-password') {
        if (!agentGuid) throw new Error('Identificacao do agente nao encontrada.');
        await primeiroAcesso(agentGuid, { senha: password });
        setIsPasswordDefinedModalVisible(true);
        return;
      }

      const session = await login({ cpf, senha: password });

      // Login returns equipe but NOT grupo. If the user has a team, fetch
      // group membership before signIn so AppNavigator has complete data.
      // Token must be set first — getAgentProfile is an authenticated endpoint.
      const hasTeam = session.agent.equipe_guid != null || session.agent.equipe_id != null;
      if (hasTeam) {
        setApiAccessToken(session.token);
        try {
          const profile = await getAgentProfile(session.agent.guid);
          Object.assign(session.agent, profile);
        } catch (profileErr) {
          setApiAccessToken(null);
          throw profileErr;
        }
      }
      await signIn(session);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          step === 'reset-password' ? 'Nao foi possivel redefinir a senha.' : 'Nao foi possivel realizar o login.',
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (isLoading) return;
    submit();
  };

  const submit = isCpfStep ? checkAccess : authenticate;
  const title = isCpfStep ? 'Dados de acesso.' : step === 'reset-password' ? 'Crie sua senha.' : 'Bem-vindo de volta.';
  const description = isCpfStep
    ? 'Digite o CPF vinculado ao seu perfil de agente.'
    : step === 'reset-password'
      ? 'Escolha uma senha segura para os proximos acessos.'
      : 'Confirme sua senha para continuar.';

  const inputRef = useRef<TextInput>(null);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <PasswordDefinedModal
          onConfirm={() => {
            setIsPasswordDefinedModalVisible(false);
            setPassword('');
            setErrorMessage(null);
            setStep('password');
          }}
          visible={isPasswordDefinedModalVisible}
        />

        <View
          className="flex-1 justify-center pt-4"
          style={{ width: contentWidth, alignSelf: 'center' }}
        >
          <View className="flex-row items-center justify-between">
            <Image className="h-14 w-36" resizeMode="contain" source={require('../../../../assets/deep/logo.jpg')} />
            <View className="rounded-full bg-primary-50 px-3 py-1.5">
              <Text className="text-xs font-semibold uppercase tracking-wider text-primary-600">Agente</Text>
            </View>
          </View>

          <View className="mt-8">
            <StepIndicator current={step} />
            <Text className="mt-8 text-4xl font-bold leading-tight text-zinc-950">{title}</Text>
            <Text className="mt-3 max-w-sm text-base leading-6 text-zinc-500">{description}</Text>
          </View>

          <Animated.View
            className="mt-8"
            style={{ opacity: fieldOpacity, transform: [{ translateY: fieldOffset }] }}
          >
            {!isCpfStep ? (
              <Pressable
                className="mb-5 self-start rounded-full bg-zinc-100 px-4 py-2"
                disabled={isLoading}
                onPress={resetFlow}
              >
                <Text className="text-sm font-medium text-zinc-600">{formatCpf(cpf)} · trocar</Text>
              </Pressable>
            ) : null}

            <View className="rounded-3xl border border-zinc-200 bg-white px-5 pb-4 pt-3">
              <Text className="text-xs font-semibold uppercase tracking-widest text-primary-600">
                {isCpfStep ? 'CPF' : step === 'reset-password' ? 'Nova senha' : 'Senha'}
              </Text>
              <View className="mt-1 flex-row items-center">
                <TextInput
                  ref={inputRef}
                  autoFocus={!isCpfStep}
                  className="min-h-16 flex-1 py-2 text-xl font-semibold text-zinc-950"
                  editable={!isLoading}
                  keyboardType={isCpfStep ? 'number-pad' : 'default'}
                  maxLength={isCpfStep ? 14 : undefined}
                  onChangeText={(text) => {
                    if (isCpfStep) {
                      const digits = text.replace(/\D/g, '').slice(0, 11);
                      setCpf(digits);
                    } else {
                      setPassword(text);
                    }
                    setErrorMessage(null);
                  }}
                  onSubmitEditing={handleSubmit}
                  placeholder={isCpfStep ? '000.000.000-00' : 'Digite sua senha'}
                  returnKeyType={isCpfStep && !isCpfComplete ? 'next' : 'go'}
                  secureTextEntry={!isCpfStep}
                  value={isCpfStep ? formatCpf(cpf) : password}
                />
                <Pressable
                  accessibilityLabel="Continuar"
                  className="ml-3 h-14 w-14 items-center justify-center rounded-full bg-primary-500 active:bg-primary-600 disabled:opacity-50"
                  disabled={isSubmitDisabled}
                  onPress={handleSubmit}
                >
                  {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text className="text-2xl text-white">›</Text>}
                </Pressable>
              </View>
            </View>

            {step === 'reset-password' && password.length > 0 ? <PasswordStrengthMeter password={password} /> : null}

            {errorMessage ? (
              <View className="mt-4 flex-row items-start rounded-2xl bg-red-50 px-4 py-3">
                <View className="mr-3 mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-red-100">
                  <Text className="text-xs font-bold text-red-600">!</Text>
                </View>
                <Text className="flex-1 text-sm leading-5 text-red-700">{errorMessage}</Text>
              </View>
            ) : null}
          </Animated.View>

          <View className="flex-1" />

          <Text className="pb-2 text-center text-xs leading-5 text-zinc-400">
            Acesso protegido e disponivel offline apos a autenticacao.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
