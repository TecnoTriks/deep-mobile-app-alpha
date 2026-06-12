import jsonLogic, { type JsonLogicRule } from '../vendor/json-logic';
import { detectNumericValueType, isValidCpf } from './valueValidation';
import type {
  DynamicField,
  FormErrors,
  FormValue,
  FormValues,
  LegacyConditions,
} from '../types/form';

const NON_VALUE_FIELDS = new Set(['divider', 'group', 'title']);
const conditionLogicCache = new WeakMap<LegacyConditions, JsonLogicRule | null>();

function toComparable(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return value;
  return value;
}

function conditionToJsonLogic(condition?: LegacyConditions): JsonLogicRule | null {
  if (!condition?.regras?.length) return null;
  const cached = conditionLogicCache.get(condition);
  if (cached !== undefined) return cached;

  const rules = condition.regras.map<JsonLogicRule>((rule) => {
    const fieldValue = { var: rule.campo };
    const expected = toComparable(rule.valor);

    // Igualdade comparada como string (via "cat") para evitar falsos positivos do "==" do JS
    // com valores ainda nao preenchidos. Em JS, '' == 0 e '' == false sao `true`, o que faria
    // uma condicional "equals: 0" ou "equals: false" bater com um campo ainda vazio. Convertendo
    // ambos os lados para string ('' vs '0' / 'false') essa comparacao deixa de dar falso positivo,
    // sem afetar comparacoes normais (ex.: campo numerico salvo como string "25" contra valor 25).
    const equalsRule = { '==': [{ cat: [fieldValue, ''] }, { cat: [expected, ''] }] };
    const notEqualsRule = { '!=': [{ cat: [fieldValue, ''] }, { cat: [expected, ''] }] };

    switch (rule.operador) {
      case 'contains':
        return { in: [expected, fieldValue] };
      case 'equals':
        return equalsRule;
      case 'notContains':
        return { '!': { in: [expected, fieldValue] } };
      case 'notEquals':
        return notEqualsRule;
      case 'isEmpty':
        return { '!': { '!!': fieldValue } };
      case 'isNotEmpty':
        return { '!!': fieldValue };
      default:
        return equalsRule;
    }
  });

  const logic = condition.tipo === 'OR' ? { or: rules } : { and: rules };
  conditionLogicCache.set(condition, logic);
  return logic;
}

function emptyForField(value: FormValue): FormValue {
  if (Array.isArray(value)) return [];
  if (typeof value === 'boolean') return false;
  if (typeof value === 'number') return '';
  return '';
}

export function isFieldVisible(field: DynamicField, values: FormValues, parentVisible = true) {
  if (!parentVisible || field.visibility === false || field.config?.visibility === false) return false;

  const condition = field.config?.conditions;
  const logic = conditionToJsonLogic(condition);
  if (!logic) return true;

  const result = Boolean(jsonLogic.apply(logic, values));
  return condition?.action === 'hide' ? !result : result;
}

function collectFieldIds(fields: DynamicField[]): string[] {
  const ids: string[] = [];
  const visit = (items: DynamicField[]) => {
    items.forEach((field) => {
      if (field.type === 'group') {
        visit(field.config.children ?? []);
        return;
      }
      if (!NON_VALUE_FIELDS.has(field.type)) {
        ids.push(field.id);
      }
    });
  };
  visit(fields);
  return ids;
}

/**
 * Percorre os campos (incluindo os filhos de "group") e retorna todos os campos cujo
 * "type" esteja na lista informada, na ordem em que aparecem no formulario.
 */
export function collectFieldsByType(fields: DynamicField[], types: string[]): DynamicField[] {
  const result: DynamicField[] = [];

  const visit = (items: DynamicField[]) => {
    items.forEach((field) => {
      if (field.type === 'group') {
        visit(field.config.children ?? []);
        return;
      }
      if (types.includes(field.type)) {
        result.push(field);
      }
    });
  };

  visit(fields);
  return result;
}

function visibilityMap(fields: DynamicField[], values: FormValues): Map<string, boolean> {
  const map = new Map<string, boolean>();

  const visit = (items: DynamicField[], parentVisible: boolean) => {
    items.forEach((field) => {
      const visible = isFieldVisible(field, values, parentVisible);
      if (field.type === 'group') {
        visit(field.config.children ?? [], visible);
        return;
      }
      if (!NON_VALUE_FIELDS.has(field.type)) {
        map.set(field.id, visible);
      }
    });
  };

  visit(fields, true);
  return map;
}

/**
 * Mapa de visibilidade de TODOS os campos (inclui grupos, titulos e dividers), com a
 * visibilidade do pai ja propagada para os filhos. Calculado uma unica vez por mudanca
 * de valores e compartilhado com a renderizacao para que cada campo nao precise
 * reavaliar a logica condicional (jsonLogic) por conta propria a cada re-render.
 */
export function buildVisibilityMap(fields: DynamicField[], values: FormValues): Map<string, boolean> {
  const map = new Map<string, boolean>();

  const visit = (items: DynamicField[], parentVisible: boolean) => {
    items.forEach((field) => {
      const visible = isFieldVisible(field, values, parentVisible);
      map.set(field.id, visible);
      if (field.type === 'group') {
        visit(field.config.children ?? [], visible);
      }
    });
  };

  visit(fields, true);
  return map;
}

export function getEffectiveValues(fields: DynamicField[], values: FormValues): FormValues {
  const ids = collectFieldIds(fields);
  let current: FormValues = { ...values };

  for (let iteration = 0; iteration < ids.length; iteration += 1) {
    const visibility = visibilityMap(fields, current);
    let changed = false;
    const next: FormValues = { ...current };

    ids.forEach((id) => {
      if (visibility.get(id) === false) {
        const value = next[id];
        if (value !== undefined && value !== '' && value !== null) {
          next[id] = emptyForField(value);
          changed = true;
        }
      }
    });

    if (!changed) break;
    current = next;
  }

  return current;
}

export function getInitialFormValues(fields: DynamicField[]) {
  const values: FormValues = {};

  const visit = (items: DynamicField[]) => {
    items.forEach((field) => {
      if (field.type === 'group') {
        visit(field.config.children ?? []);
        return;
      }

      if (!NON_VALUE_FIELDS.has(field.type)) {
        values[field.id] = field.config.defaultValue ?? (
          ['checkbox', 'mult_capturas', 'upload'].includes(field.type) ? [] : ''
        );
      }
    });
  };

  visit(fields);
  return values;
}

export function hasValue(value: FormValue) {
  return Array.isArray(value) ? value.length > 0 : value !== null && String(value).trim() !== '';
}

export function validateVisibleRequiredFields(fields: DynamicField[], values: FormValues) {
  const errors: FormErrors = {};

  const visit = (items: DynamicField[], parentVisible = true) => {
    items.forEach((field) => {
      const visible = isFieldVisible(field, values, parentVisible);
      const value = values[field.id];
      if (!visible) return;

      if (field.type === 'group') {
        visit(field.config.children ?? [], visible);
        return;
      }

      if (
        field.type === 'mult_capturas'
        && field.config.required
        && Array.isArray(field.config.capturas)
        && field.config.capturas.length > 0
        && (!Array.isArray(value) || value.length < field.config.capturas.length)
      ) {
        errors[field.id] = 'Realize todas as capturas obrigatorias';
      } else if (field.config.required && !hasValue(value) && field.type !== 'mult_capturas') {
        errors[field.id] = 'Campo obrigatorio';
      } else if (
        field.type === 'number'
        && detectNumericValueType(field.config.name, field.config.label) === 'cpf'
        && typeof value === 'string'
        && value
        && !isValidCpf(value)
      ) {
        errors[field.id] = 'CPF invalido';
      }
    });
  };

  visit(fields);
  return errors;
}

export function collectVisibleFormValues(fields: DynamicField[], values: FormValues) {
  const result: FormValues = {};

  const visit = (items: DynamicField[], parentVisible = true) => {
    items.forEach((field) => {
      const visible = isFieldVisible(field, values, parentVisible);
      if (!visible) return;

      if (field.type === 'group') {
        visit(field.config.children ?? [], visible);
      } else if (!NON_VALUE_FIELDS.has(field.type) && hasValue(values[field.id])) {
        result[field.id] = values[field.id];
      }
    });
  };

  visit(fields);
  return result;
}

function getFileName(value: FormValue) {
  if (typeof value !== 'string') return value;
  const fileName = decodeURIComponent(value.split('/').pop()?.split('?')[0] ?? value);
  return fileName.replace(/^\d+-\d+-/, '');
}

export function createOfflineDraftData(fields: DynamicField[], values: FormValues, effectiveValues = getEffectiveValues(fields, values)) {
  const visibleValues = collectVisibleFormValues(fields, effectiveValues);
  const fieldTypes = new Map<string, string>();

  const visit = (items: DynamicField[]) => {
    items.forEach((field) => {
      fieldTypes.set(field.id, field.type);
      if (field.type === 'group') visit(field.config.children ?? []);
    });
  };
  visit(fields);

  return Object.fromEntries(
    Object.entries(visibleValues).map(([fieldId, value]) => {
      if (fieldTypes.get(fieldId) === 'upload' && Array.isArray(value)) {
        return [fieldId, value.map(getFileName)];
      }
      return [fieldId, value];
    }),
  ) as FormValues;
}
