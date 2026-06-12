import './global.css';

import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/features/auth/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/shared/components/ErrorBoundary';
import { LastCrashNotice } from './src/shared/components/LastCrashNotice';
import { migrateDatabase } from './src/shared/database/migrations';
import { installGlobalErrorHandler } from './src/shared/diagnostics/installGlobalErrorHandler';
import { NetworkProvider } from './src/shared/context/NetworkContext';
import { queryClient } from './src/shared/query/queryClient';

// Registra o handler global de erros fatais o mais cedo possivel, antes de qualquer render.
installGlobalErrorHandler();

// Prevent the native splash from auto-hiding — we control the timing.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const SPLASH_DURATION_MS = 3000;
const SPLASH_FADE_MS = 400;

function CustomSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade starts at SPLASH_DURATION_MS.
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        duration: SPLASH_FADE_MS,
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }, SPLASH_DURATION_MS);

    // Guaranteed unmount: independent of animation callback (which can silently
    // drop on Android with useNativeDriver). Without this, opacity reaches 0 but
    // the View stays mounted and blocks all touch events on the screen below.
    const doneTimer = setTimeout(onDone, SPLASH_DURATION_MS + SPLASH_FADE_MS + 50);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [opacity, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <Image
        autoplay
        contentFit="contain"
        source={require('./assets/deep/start-img-app.gif')}
        style={{ width: 220, height: 220 }}
      />
    </Animated.View>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  // Hide the native splash as soon as the JS bundle is ready.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <NetworkProvider>
          <SQLiteProvider databaseName="deep-agente.db" onInit={migrateDatabase}>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <NavigationContainer>
                  <StatusBar style="dark" />
                  <AppNavigator />
                </NavigationContainer>
                {!splashDone && <CustomSplash onDone={handleSplashDone} />}
                <LastCrashNotice />
              </AuthProvider>
            </QueryClientProvider>
          </SQLiteProvider>
        </NetworkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
