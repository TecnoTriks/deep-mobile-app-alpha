import type { AuthSession } from '../features/auth/types/auth';
import type { AuthStackParamList } from './types';

type AuthRouteInput = {
  forceFullRefresh: boolean;
  hasGroup: boolean;
  hasTeam: boolean;
  isOfflineReady: boolean;
  session: AuthSession | null;
};

export function resolveAuthRoute({
  forceFullRefresh,
  hasGroup,
  hasTeam,
  isOfflineReady,
  session,
}: AuthRouteInput): keyof AuthStackParamList | 'App' {
  if (!session) return 'Login';
  if (!hasTeam) return 'JoinTeam';
  if (!hasGroup) return 'NoGroup';
  if (!isOfflineReady || forceFullRefresh) return 'Preparation';
  return 'App';
}

export function buildAuthRouteKey(input: AuthRouteInput) {
  const target = resolveAuthRoute(input);
  if (target === 'App') return 'App';
  return `Auth:${target}`;
}
