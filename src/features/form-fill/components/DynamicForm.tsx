import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { FillRecordTabs, type FillRecordTab } from './FillRecordTabs';
import { KeyboardScrollContext } from './KeyboardScrollContext';
import { RecordDataTab } from './RecordDataTab';
import { RetornosContext } from './RetornosContext';
import { SelectionSheetProvider } from './SelectionSheet';
import { SituacaoDeCampoFlow } from './SituacaoDeCampoFlow';
import { createOfflineDraftData } from '../engine/formEngine';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { useDynamicForm } from '../hooks/useDynamicForm';
import { isDraftReadyForSync } from '../services/fillRecordService';
import { findFieldLabel } from '../utils/findFieldLabel';
import type { FillRecordData, FillRecordLocalStatus, FormValue } from '../types/form';
import { AlertModal } from '../../../shared/components/AlertModal';
import { ErrorBoundary } from '../../../shared/components/ErrorBoundary';

type Props = {
  data: FillRecordData;
  onBack: () => void;
  onLocalStateSaved: (recordGuid: string, status: FillRecordLocalStatus) => void;
};

export function DynamicForm({ data, onBack, onLocalStateSaved }: Props) {
  const database = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const reprovadosMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of (data.retornos?.reprovados ?? [])) {
      if (item.observacao) map.set(item.id, item.observacao);
    }
    return map;
  }, [data.retornos]);

  const retornosContextValue = useMemo(() => ({ reprovados: reprovadosMap }), [reprovadosMap]);

  const mergedInitialValues = useMemo(
    () => ({ ...data.computedInitialValues, ...data.draftValues }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { changeVersion, draftData, errors, isDirty, markSaved, reset, setValue, validate, values, visibility } = useDynamicForm(data.form.fields, mergedInitialValues);
  const [activeTab, setActiveTab] = useState<FillRecordTab>('form');
  const [alertState, setAlertState] = useState<{
    cancelLabel?: string;
    confirmLabel?: string;
    description: string;
    onCancel?: () => void;
    onConfirm?: () => void;
    title: string;
    variant?: 'default' | 'success';
  } | null>(null);
  const [draftPromptHandled, setDraftPromptHandled] = useState(!data.hasDraft);
  const [missingFields, setMissingFields] = useState<{ id: string; label: string }[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardScrollContext = useMemo(
    () => ({ scrollViewRef, scrollY }),
    [],
  );
  const draftScope = useMemo(
    () => ({ formGuid: data.form.guid, recordGuid: data.record.guid }),
    [data.form.guid, data.record.guid],
  );

  const { persistDraft, saveState, setLocalStatus, startFresh } = useDraftAutosave({
    changeVersion,
    data,
    database,
    draftData,
    draftPromptHandled,
    isDirty,
    markSaved,
    onLocalStateSaved,
    reset,
    values,
  });

  const changeValue = useCallback((fieldId: string, value: FormValue) => {
    setLocalStatus('Rascunho');
    setValue(fieldId, value);
  }, [setLocalStatus, setValue]);

  useEffect(() => {
    const backAction = () => {
      onBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [onBack]);

  useEffect(() => {
    if (draftPromptHandled || !data.hasDraft) return;
    setAlertState({
      cancelLabel: 'Recomecar',
      confirmLabel: 'Continuar rascunho',
      description: 'Existe um preenchimento anterior nao concluido para este registro. Deseja continuar de onde parou ou comecar novamente?',
      onCancel: () => {
        startFresh();
        setDraftPromptHandled(true);
      },
      onConfirm: () => setDraftPromptHandled(true),
      title: 'Rascunho encontrado',
    });
  }, [data.hasDraft, draftPromptHandled, startFresh]);

  const submit = async () => {
    if (!draftPromptHandled) return;
    const validation = validate();
    if (!validation.isValid) {
      const fieldList = Object.keys(validation.errors).map((id) => ({
        id,
        label: findFieldLabel(data.form.fields, id) ?? id,
      }));
      setMissingFields(fieldList);
      setAlertState({
        confirmLabel: 'Entendi',
        description: 'Preencha os campos obrigatorios antes de continuar:',
        title: 'Campos obrigatorios',
      });
      return;
    }

    try {
      setLocalStatus('Preenchendo offline');
      // Recalcula o payload "dados" a partir dos valores atuais (nao da copia adiada),
      // garantindo que o ultimo caractere digitado entre no envio mesmo se o submit
      // ocorrer no mesmo quadro da ultima tecla.
      const freshDraftData = createOfflineDraftData(data.form.fields, values);
      await persistDraft(values, freshDraftData, 'Preenchendo offline');

      // Verificacao de integridade: le de volta do banco antes de confirmar ao usuario.
      // So mostra "Salvo" se o preenchimento realmente ficou persistido e visivel para o Sync.
      const persisted = await isDraftReadyForSync(database, data.record.guid, data.form.guid);
      if (!persisted) {
        setAlertState({
          confirmLabel: 'Fechar',
          description: 'Nao foi possivel confirmar o salvamento neste aparelho. Toque em concluir novamente.',
          title: 'Falha ao salvar',
        });
        return;
      }

      setAlertState({
        confirmLabel: 'OK',
        description: 'As respostas foram salvas neste aparelho.',
        onConfirm: () => {
          setAlertState(null);
          onBack();
        },
        title: 'Salvo offline',
        variant: 'success',
      });
    } catch {
      setAlertState({
        confirmLabel: 'Fechar',
        description: 'Nao foi possivel salvar o preenchimento offline.',
        title: 'Falha ao salvar',
      });
    }
  };

  return (
    <KeyboardScrollContext.Provider value={keyboardScrollContext}>
    <RetornosContext.Provider value={retornosContextValue}>
    <SelectionSheetProvider>
      <FillRecordTabs activeTab={activeTab} onChange={setActiveTab} saveState={saveState} />

      {activeTab === 'form' ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: insets.bottom + 120 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y; }}
          ref={scrollViewRef}
          scrollEventThrottle={16}
        >
          <View className="mb-3 flex-row items-center gap-3 rounded-2xl bg-primary-500 px-3 py-3">
            <Pressable
              accessibilityLabel="Voltar"
              className="h-10 w-10 items-center justify-center rounded-xl bg-white/15 active:bg-white/25"
              onPress={onBack}
            >
              <Text className="text-xl font-semibold text-white">{'‹'}</Text>
            </Pressable>
            <View className="flex-1">
              <Text className="text-xs font-medium uppercase tracking-wide text-white/70" numberOfLines={1}>
                {data.record.name}
              </Text>
              <Text className="text-base font-bold leading-5 text-white" numberOfLines={2}>
                {data.form.name}
              </Text>
            </View>
          </View>

          <ErrorBoundary
            context={{
              fieldsCount: data.form.fields.length,
              formGuid: data.form.guid,
              recordGuid: data.record.guid,
            }}
          >
            {data.form.fields.map((field, index) => (
              <DynamicFieldRenderer
                draftScope={draftScope}
                errors={errors}
                field={field}
                isLastChild={index === data.form.fields.length - 1}
                key={field.id}
                onChange={changeValue}
                values={values}
                visibility={visibility}
              />
            ))}

            {data.form.fields.length === 0 ? (
              <View className="rounded-2xl bg-white p-5">
                <Text className="text-center text-sm text-zinc-500">Este formulário não possui campos configurados.</Text>
              </View>
            ) : null}
          </ErrorBoundary>

          <View className="mt-2">
            <Pressable
              className="min-h-14 items-center justify-center rounded-2xl bg-primary-500 px-4 active:bg-primary-600"
              onPress={submit}
            >
              <Text className="text-base font-semibold text-white">Concluir preenchimento offline</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {activeTab === 'record' ? <RecordDataTab data={data.record.rawData} /> : null}
      {activeTab === 'actions' ? (
        <SituacaoDeCampoFlow
          formGuid={data.form.guid}
          onBack={onBack}
          onLocalStateSaved={onLocalStateSaved}
          recordGuid={data.record.guid}
        />
      ) : null}

      <AlertModal
        cancelLabel={alertState?.cancelLabel}
        confirmLabel={alertState?.confirmLabel ?? 'OK'}
        description={alertState?.description ?? ''}
        onCancel={alertState?.onCancel}
        onConfirm={() => {
          alertState?.onConfirm?.();
          setAlertState(null);
          setMissingFields([]);
        }}
        onClose={() => {
          setAlertState(null);
          setMissingFields([]);
        }}
        title={alertState?.title ?? ''}
        variant={alertState?.variant}
        visible={alertState !== null}
      >
        {missingFields.length > 0 ? (
          <ScrollView className="mt-3 w-full" style={{ maxHeight: 220 }} nestedScrollEnabled>
            {missingFields.map((field) => (
              <View
                key={field.id}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5"
                style={{ marginTop: field === missingFields[0] ? 0 : 6 }}
              >
                <Text className="text-sm font-medium text-red-700">{field.label}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </AlertModal>
    </SelectionSheetProvider>
    </RetornosContext.Provider>
    </KeyboardScrollContext.Provider>
  );
}
