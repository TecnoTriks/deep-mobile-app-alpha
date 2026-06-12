import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FillRecordScreen } from '../features/form-fill/screens/FillRecordScreen';
import { RecordsScreen } from '../features/records/screens/records/RecordsScreen';
import { RecordsListProvider, useRecordsListContext } from './RecordsListContext';
import type { FillRecordScreenProps, RecordsStackParamList } from './types';

const RecordsStack = createNativeStackNavigator<RecordsStackParamList>();

function FillRecordRoute({ navigation, route }: FillRecordScreenProps) {
  const { setLocalState } = useRecordsListContext();

  return (
    <FillRecordScreen
      onBack={() => navigation.goBack()}
      onLocalStateSaved={(recordGuid, status) => setLocalState({ recordGuid, status })}
      recordGuid={route.params.recordGuid}
    />
  );
}

export function RecordsNavigator() {
  return (
    <RecordsListProvider>
      <RecordsStack.Navigator screenOptions={{ headerShown: false }}>
        <RecordsStack.Screen component={RecordsScreen} name="List" />
        <RecordsStack.Screen component={FillRecordRoute} name="Fill" />
      </RecordsStack.Navigator>
    </RecordsListProvider>
  );
}
