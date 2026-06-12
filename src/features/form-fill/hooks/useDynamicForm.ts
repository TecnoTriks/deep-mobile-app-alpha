import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import { buildVisibilityMap, collectVisibleFormValues, createOfflineDraftData, getEffectiveValues, getInitialFormValues, validateVisibleRequiredFields } from '../engine/formEngine';
import type { DynamicField, FormErrors, FormValue, FormValues } from '../types/form';

export function useDynamicForm(fields: DynamicField[], draftValues: FormValues = {}) {
  const initialValues = useMemo(
    () => ({ ...getInitialFormValues(fields), ...draftValues }),
    [draftValues, fields],
  );
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [changeVersion, setChangeVersion] = useState(0);
  // O recalculo pesado da logica condicional (visibilidade, valores efetivos e dados do
  // rascunho) roda sobre uma copia "adiada" dos valores. Assim a digitacao no campo
  // focado (que usa `values` direto) permanece a 60fps enquanto essas varreduras de
  // formulario inteiro sao coalescidas e processadas em prioridade menor pelo React.
  const deferredValues = useDeferredValue(values);
  const effectiveValues = useMemo(() => getEffectiveValues(fields, deferredValues), [fields, deferredValues]);
  const visibility = useMemo(() => buildVisibilityMap(fields, effectiveValues), [fields, effectiveValues]);
  const draftData = useMemo(() => createOfflineDraftData(fields, deferredValues, effectiveValues), [effectiveValues, fields, deferredValues]);

  const setValue = useCallback((fieldId: string, value: FormValue) => {
    setIsDirty(true);
    setChangeVersion((current) => current + 1);
    setValues((current) => ({ ...current, [fieldId]: value }));
    setErrors((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  }, []);

  const validate = useCallback(() => {
    // Recalcula a partir dos valores atuais (nao da copia adiada) para que o submit
    // nunca valide com um estado defasado por uma tecla.
    const freshEffectiveValues = getEffectiveValues(fields, values);
    const nextErrors = validateVisibleRequiredFields(fields, freshEffectiveValues);
    setErrors(nextErrors);
    return { errors: nextErrors, isValid: Object.keys(nextErrors).length === 0 };
  }, [fields, values]);

  const collectValues = useCallback(() => collectVisibleFormValues(fields, values), [fields, values]);
  const markSaved = useCallback(() => setIsDirty(false), []);

  const reset = useCallback((nextDraftValues: FormValues = {}) => {
    setValues({ ...getInitialFormValues(fields), ...nextDraftValues });
    setErrors({});
    setIsDirty(false);
    setChangeVersion((current) => current + 1);
  }, [fields]);

  return {
    changeVersion,
    collectValues,
    draftData,
    effectiveValues,
    errors,
    isDirty,
    markSaved,
    reset,
    setValue,
    validate,
    values,
    visibility,
  };
}
