import * as Network from 'expo-network';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { setApiNetworkOnline } from '../api/apiClient';

type NetworkContextValue = {
  isOnline: boolean;
  checkNow: () => Promise<void>;
};

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  checkNow: async () => {},
});

export function NetworkProvider({ children }: PropsWithChildren) {
  const [isOnline, setIsOnline] = useState(true);

  const checkConnectivity = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setIsOnline(online);
      // Mantem o cache usado pelo interceptor do apiClient em sincronia com o estado real.
      setApiNetworkOnline(online);
    } catch {
      // Se a verificacao falhar, mantém o estado atual para nao bloquear o usuario
    }
  }, []);

  useEffect(() => {
    void checkConnectivity();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void checkConnectivity();
    });

    const intervalId = setInterval(() => void checkConnectivity(), 10_000);

    return () => {
      appStateSub.remove();
      clearInterval(intervalId);
    };
  }, [checkConnectivity]);

  const value = useMemo<NetworkContextValue>(
    () => ({ isOnline, checkNow: checkConnectivity }),
    [isOnline, checkConnectivity],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
