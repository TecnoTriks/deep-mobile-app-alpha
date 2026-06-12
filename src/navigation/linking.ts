import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['deepagente://'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          JoinTeam: 'join-team',
          NoGroup: 'no-group',
          Preparation: 'preparation',
        },
      },
      App: {
        screens: {
          Home: 'home',
          Overview: 'overview',
          Sync: 'sync',
          Team: 'team',
          Records: {
            screens: {
              List: 'records',
              Fill: 'records/:recordGuid',
            },
          },
        },
      },
    },
  },
};
