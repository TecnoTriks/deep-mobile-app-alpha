import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AppStackParamList, RecordsStackParamList, RootStackParamList } from './types';

export type AppNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<AppStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type RecordsNavigationProp = NativeStackNavigationProp<RecordsStackParamList>;

export function useAppNavigation() {
  return useNavigation<AppNavigationProp>();
}

export function useRecordsNavigation() {
  return useNavigation<RecordsNavigationProp>();
}
