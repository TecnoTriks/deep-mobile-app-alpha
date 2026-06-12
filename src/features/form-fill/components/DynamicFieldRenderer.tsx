import { memo, useCallback } from 'react';
import { Text, View } from 'react-native';

import type { DynamicField, FormErrors, FormValue, FormValues } from '../types/form';
import { useRetornos } from './RetornosContext';
import { CheckboxField } from './fields/CheckboxField';
import { DateTimeField } from './fields/DateTimeField';
import { MultiCaptureField } from './fields/MultiCaptureField';
import { NumberField } from './fields/NumberField';
import { RadioField } from './fields/RadioField';
import { SelectField } from './fields/SelectField';
import { SignatureField } from './fields/SignatureField';
import { DividerField, TitleField } from './fields/StructuralFields';
import { TextField } from './fields/TextField';
import { TextareaField } from './fields/TextareaField';
import { UploadField } from './fields/UploadField';

type Props = {
  draftScope: {
    formGuid: string;
    recordGuid: string;
  };
  errors: FormErrors;
  field: DynamicField;
  isLastChild?: boolean;
  onChange: (fieldId: string, value: FormValue) => void;
  values: FormValues;
  visibility: Map<string, boolean>;
};

function DynamicFieldRendererComponent({
  draftScope,
  errors,
  field,
  isLastChild = false,
  onChange,
  values,
  visibility,
}: Props) {
  const reprovados = useRetornos();
  const changeFieldValue = useCallback(
    (value: FormValue) => onChange(field.id, value),
    [field.id, onChange],
  );
  const visible = visibility.get(field.id) ?? true;
  if (!visible) return null;

  const commonProps = {
    error: errors[field.id],
    field,
    onChange: changeFieldValue,
    value: values[field.id],
  };

  const rejection = reprovados.get(field.id);

  const fieldSpacingStyle = { marginTop: 8, marginBottom: isLastChild ? 0 : 8 };

  const wrapWithRejection = (node: React.ReactNode) => {
    if (!rejection) return node;
    return (
      <>
        {node}
        <View className="mt-1.5 flex-row items-start rounded-lg bg-red-50 px-3 py-2">
          <Text className="flex-1 text-xs font-medium leading-4 text-red-600">⚠ {rejection}</Text>
        </View>
      </>
    );
  };

  const wrap = (node: React.ReactNode) => <View style={fieldSpacingStyle}>{node}</View>;

  // `field.type` vem de JSON do servidor: um campo sem "type" (ou nao-string) faria
  // `.toLowerCase()` lancar e — sem isso — fecharia o app. Normaliza com seguranca.
  switch (String(field.type ?? '').toLowerCase()) {
    case 'text':
      return wrap(wrapWithRejection(<TextField {...commonProps} />));
    case 'number':
      return wrap(wrapWithRejection(<NumberField {...commonProps} />));
    case 'datetime':
      return wrap(wrapWithRejection(<DateTimeField {...commonProps} />));
    case 'textarea':
      return wrap(wrapWithRejection(<TextareaField {...commonProps} />));
    case 'select':
      return wrap(wrapWithRejection(<SelectField {...commonProps} />));
    case 'radio':
      return wrap(wrapWithRejection(<RadioField {...commonProps} />));
    case 'checkbox':
      return wrap(wrapWithRejection(<CheckboxField {...commonProps} />));
    case 'title':
      return wrap(<TitleField field={field} isLastChild={isLastChild} />);
    case 'divider':
      return wrap(<DividerField isLastChild={isLastChild} />);
    case 'group':
      return wrap(
        <View className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <View className="border-b border-zinc-200 px-3 py-2.5">
            <Text className="text-base font-bold text-zinc-800">{field.config.label}</Text>
          </View>
          <View className="px-3 pb-2 pt-0">
            {(field.config.children ?? []).map((child, index) => (
              <View key={child.id}>
                <DynamicFieldRenderer
                  draftScope={draftScope}
                  errors={errors}
                  field={child}
                  isLastChild={index === (field.config.children ?? []).length - 1}
                  onChange={onChange}
                  values={values}
                  visibility={visibility}
                />
              </View>
            ))}
          </View>
        </View>,
      );
    case 'mult_capturas':
      return wrap(<MultiCaptureField {...commonProps} />);
    case 'signature':
      return wrap(<SignatureField {...commonProps} />);
    case 'upload':
      return wrap(<UploadField {...commonProps} draftScope={draftScope} />);
    default:
      return (
        <View className="mb-4 rounded-xl bg-red-50 p-3">
          <Text className="text-sm text-red-700">Tipo de campo nao suportado: {field.type}</Text>
        </View>
      );
  }
}

function propsAreEqual(previous: Props, next: Props) {
  if (
    previous.field !== next.field
    || previous.onChange !== next.onChange
    || previous.isLastChild !== next.isLastChild
    || previous.draftScope.formGuid !== next.draftScope.formGuid
    || previous.draftScope.recordGuid !== next.draftScope.recordGuid
  ) {
    return false;
  }

  // Grupos sempre re-renderizam para que os filhos reavaliem a propria visibilidade.
  if (String(next.field.type ?? '').toLowerCase() === 'group') return false;

  // Comparacao O(1): le o booleano ja calculado no mapa em vez de reavaliar jsonLogic.
  const fieldId = next.field.id;
  return Object.is(previous.values[fieldId], next.values[fieldId])
    && previous.errors[fieldId] === next.errors[fieldId]
    && previous.visibility.get(fieldId) === next.visibility.get(fieldId);
}

export const DynamicFieldRenderer = memo(DynamicFieldRendererComponent, propsAreEqual);
