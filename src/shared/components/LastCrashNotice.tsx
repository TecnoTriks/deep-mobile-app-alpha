import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { clearLastCrash, readLastCrash, type CrashRecord } from '../diagnostics/crashLog';

/**
 * Na abertura do app, verifica se ha um crash registrado da sessao anterior (inclusive
 * fechamentos "sozinhos" capturados pelo handler global) e mostra os detalhes. Assim o
 * usuario/dev fica sabendo o que aconteceu mesmo quando o app foi encerrado de repente.
 */
export function LastCrashNotice() {
  const [crash, setCrash] = useState<CrashRecord | null>(null);

  useEffect(() => {
    let active = true;
    readLastCrash().then((record) => {
      if (active) setCrash(record);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!crash) return null;

  const dismiss = () => {
    clearLastCrash();
    setCrash(null);
  };

  const when = (() => {
    try {
      return new Date(crash.timestamp).toLocaleString('pt-BR');
    } catch {
      return crash.timestamp;
    }
  })();

  return (
    <Modal animationType="fade" onRequestClose={dismiss} transparent visible statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
        <View style={{ borderRadius: 24, backgroundColor: '#fff', padding: 20, maxHeight: '80%' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#b91c1c' }}>
            O app fechou inesperadamente
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, color: '#71717a' }}>
            {when} · {crash.origin === 'render' ? 'erro de tela' : crash.isFatal ? 'erro fatal' : 'erro'}
          </Text>

          <ScrollView style={{ marginTop: 14, borderRadius: 12, backgroundColor: '#fef2f2', padding: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }}>{crash.message}</Text>
            {crash.context ? (
              <Text style={{ marginTop: 8, fontSize: 11, color: '#7f1d1d' }}>
                contexto: {JSON.stringify(crash.context)}
              </Text>
            ) : null}
            {crash.stack ? (
              <Text style={{ marginTop: 10, fontSize: 11, color: '#7f1d1d' }}>{crash.stack}</Text>
            ) : null}
            {crash.componentStack ? (
              <Text style={{ marginTop: 10, fontSize: 11, color: '#7f1d1d' }}>{crash.componentStack}</Text>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={dismiss}
            style={{
              marginTop: 16,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              backgroundColor: '#8b5cf6',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Entendi</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
