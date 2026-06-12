import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { setApiAccessToken, setSessionExpiredHandler } from '../../../shared/api/apiClient';
import { clearAllOfflineData, isOfflineDataReady } from '../../consolidated-data/services/offlineQueries';
import { login } from '../services/authService';
import { clearSession, loadSession, saveSession } from '../services/sessionStorage';
import type { AuthSession } from '../types/auth';
import { getErrorMessage } from '../../../shared/utils/getErrorMessage';

type AuthContextValue = {
  forceFullRefresh: boolean;
  isLoading: boolean;
  isOfflineReady: boolean;
  isReauthLoading: boolean;
  isReauthVisible: boolean;
  reauthError: string | null;
  shouldPromptDataRefresh: boolean;
  session: AuthSession | null;
  cancelReauth: () => void;
  clearForceFullRefresh: () => void;
  clearOfflineReady: () => void;
  dismissDataRefreshPrompt: () => void;
  markOfflineReady: () => void;
  requestFullRefresh: () => void;
  refreshSession: (update: Partial<import('../types/auth').AuthenticatedAgent>) => Promise<void>;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
  submitReauth: (senha: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [shouldPromptDataRefresh, setShouldPromptDataRefresh] = useState(false);
  const [forceFullRefresh, setForceFullRefresh] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReauthVisible, setIsReauthVisible] = useState(false);
  const [isReauthLoading, setIsReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const reauthResolveRef = useRef<((token: string | null) => void) | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    (async () => {
      try {
        const storedSession = await loadSession(database);

        if (storedSession) {
          setApiAccessToken(storedSession.token);
          setSession(storedSession);
          setIsOfflineReady(await isOfflineDataReady(database, storedSession.agent.guid));
        }
      } catch (error) {
        // Uma falha transitoria de leitura do banco no cold start NAO pode deixar o app
        // preso no LoadingScreen (sem tela de login). Sem sessao restaurada, cai para o
        // Login — fluxo previsivel — e o erro fica registrado, nunca silencioso.
        console.error('[auth] Falha ao restaurar sessao no bootstrap:', error);
        setApiAccessToken(null);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [database]);

  // Sair da conta sempre limpa todos os dados offline deste agente (registros,
  // rascunhos, estruturas, etc.), alem da sessao salva. Isso garante que um proximo
  // login (mesmo do mesmo agente) comece com dados consolidados do zero, sem deixar
  // tabelas do banco com lixo de uma sessao anterior.
  const signOut = useCallback(async () => {
    const agentGuid = sessionRef.current?.agent.guid;
    if (agentGuid) {
      try {
        await clearAllOfflineData(database, agentGuid);
      } catch {
        // Mesmo que a limpeza dos dados offline falhe, a sessao deve ser encerrada
        // normalmente para nao travar o usuario na tela de login.
      }
    }

    await clearSession(database);
    setApiAccessToken(null);
    setIsOfflineReady(false);
    setShouldPromptDataRefresh(false);
    setForceFullRefresh(false);
    setIsReauthVisible(false);
    setReauthError(null);
    setSession(null);
  }, [database]);

  // Chamado pelo interceptor do apiClient quando uma requisicao recebe 401
  // ("Sessao nao encontrada ou expirada"). Exibe o modal de reautenticacao e
  // resolve com o novo token (ou `null` se o usuario cancelar).
  const requestReauth = useCallback((): Promise<string | null> => {
    setReauthError(null);
    setIsReauthVisible(true);
    return new Promise<string | null>((resolve) => {
      reauthResolveRef.current = resolve;
    });
  }, []);

  const cancelReauth = useCallback(() => {
    setIsReauthVisible(false);
    setReauthError(null);
    reauthResolveRef.current?.(null);
    reauthResolveRef.current = null;
    // A sessao esta realmente expirada e o usuario optou por nao reautenticar
    // agora: encerra a sessao local e volta para a tela de login.
    void signOut();
  }, [signOut]);

  const submitReauth = useCallback(async (senha: string) => {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      cancelReauth();
      return;
    }

    setIsReauthLoading(true);
    setReauthError(null);

    try {
      const freshLogin = await login({ cpf: currentSession.agent.cpf, senha });
      // Only update the token — preserve the current agent's team/group data.
      // login() returns grupo_equipe_guid: null (endpoint doesn't return it),
      // so replacing the full agent would send the user back to NoGroup.
      const nextSession: AuthSession = { ...currentSession, token: freshLogin.token };
      await saveSession(database, nextSession);
      setApiAccessToken(nextSession.token);
      setSession(nextSession);
      setIsReauthVisible(false);
      reauthResolveRef.current?.(nextSession.token);
      reauthResolveRef.current = null;
    } catch (error) {
      setReauthError(getErrorMessage(error, 'Nao foi possivel entrar. Verifique sua senha.'));
    } finally {
      setIsReauthLoading(false);
    }
  }, [cancelReauth, database]);

  useEffect(() => {
    setSessionExpiredHandler(requestReauth);
    return () => setSessionExpiredHandler(null);
  }, [requestReauth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      forceFullRefresh,
      isLoading,
      isOfflineReady,
      isReauthLoading,
      isReauthVisible,
      reauthError,
      shouldPromptDataRefresh,
      session,
      cancelReauth,
      clearForceFullRefresh: () => setForceFullRefresh(false),
      clearOfflineReady: () => setIsOfflineReady(false),
      dismissDataRefreshPrompt: () => setShouldPromptDataRefresh(false),
      markOfflineReady: () => setIsOfflineReady(true),
      requestFullRefresh: () => setForceFullRefresh(true),
      refreshSession: async (update) => {
        const current = sessionRef.current;
        if (!current) return;
        // Merge: only overwrite fields that are explicitly provided (not undefined).
        // The profile endpoint returns subset fields (equipe, group, etc.) and omits
        // invariants like tipo/tipo_agente/cpf — those must come from the base session.
        const mergedAgent = { ...current.agent };
        for (const [k, v] of Object.entries(update) as [keyof typeof update, unknown][]) {
          if (v !== undefined) {
            (mergedAgent as Record<string, unknown>)[k] = v;
          }
        }
        const updated: AuthSession = { ...current, agent: mergedAgent };
        await saveSession(database, updated);
        setSession(updated);
      },
      signIn: async (nextSession) => {
        await saveSession(database, nextSession);
        setApiAccessToken(nextSession.token);
        const offlineReady = await isOfflineDataReady(database, nextSession.agent.guid);
        setIsOfflineReady(offlineReady);
        setShouldPromptDataRefresh(offlineReady);
        setSession(nextSession);
      },
      signOut,
      submitReauth,
    }),
    [
      cancelReauth,
      database,
      forceFullRefresh,
      isLoading,
      isOfflineReady,
      isReauthLoading,
      isReauthVisible,
      reauthError,
      session,
      shouldPromptDataRefresh,
      signOut,
      submitReauth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
