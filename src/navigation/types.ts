import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  JoinTeam: undefined;
  NoGroup: undefined;
  Preparation: undefined;
};

export type RecordsStackParamList = {
  List: undefined;
  Fill: { recordGuid: string };
};

export type AppStackParamList = {
  Home: undefined;
  Overview: undefined;
  Sync: undefined;
  Team: undefined;
  Records: NavigatorScreenParams<RecordsStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppStackParamList>;
};

export const APP_SCREEN_TITLES: Record<keyof AppStackParamList, string> = {
  Home: 'Inicio',
  Overview: 'Visão Geral',
  Records: 'Preenchimentos',
  Sync: 'Sincronização',
  Team: 'Equipe',
};

export type FillRecordScreenProps = NativeStackScreenProps<RecordsStackParamList, 'Fill'>;
