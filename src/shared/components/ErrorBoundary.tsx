import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { recordCrashSync } from '../diagnostics/crashLog';

type Props = {
  children: ReactNode;
  /** Contexto opcional para anexar ao crash (ex.: { form_base_dados: 'false' }). */
  context?: Record<string, string | number | boolean | null>;
};

type State = {
  error: Error | null;
  componentStack: string | null;
};

/**
 * Captura erros de renderizacao em qualquer ponto abaixo dele. Sem isto, um unico erro
 * de render encerra o app em build de release sem nenhuma mensagem (RedBox so existe em
 * dev). Aqui, em vez de fechar, mostramos a mensagem e o stack na tela e gravamos o crash
 * em disco (visivel tambem na proxima abertura).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    recordCrashSync({
      origin: 'render',
      isFatal: true,
      message: error.message,
      stack: error.stack ?? null,
      componentStack: info.componentStack ?? null,
      context: this.props.context,
      timestamp: new Date().toISOString(),
    });
  }

  private reset = () => {
    this.setState({ error: null, componentStack: null });
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#b91c1c' }}>
          O aplicativo encontrou um erro
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: '#52525b' }}>
          O erro foi registrado neste aparelho. Toque em “Tentar novamente” para continuar.
        </Text>

        <ScrollView
          style={{ marginTop: 16, flex: 1, borderRadius: 12, backgroundColor: '#fef2f2', padding: 12 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }}>{error.message}</Text>
          {error.stack ? (
            <Text style={{ marginTop: 10, fontSize: 11, color: '#7f1d1d' }}>{error.stack}</Text>
          ) : null}
          {componentStack ? (
            <Text style={{ marginTop: 10, fontSize: 11, color: '#7f1d1d' }}>
              {componentStack}
            </Text>
          ) : null}
        </ScrollView>

        <Pressable
          onPress={this.reset}
          style={{
            marginTop: 16,
            marginBottom: 32,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            backgroundColor: '#8b5cf6',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }
}
