# Formulário Dinâmico (preenchimento offline)

> Versão atualizada em `docs/navigation/`. O arquivo legado em `docs/05-formulario-dinamico.md` pode estar desatualizado.

Tela: `FillRecordScreen`. Acessada por `App > Records > Fill` ao tocar em "Preencher/Continuar" na lista.

Rota: `RecordsNavigator` → `FillRecordRoute` (wrapper) passa `recordGuid`, `onBack` e `onLocalStateSaved`.

## Componentes

| Arquivo | Responsabilidade |
|---|---|
| `src/features/form-fill/screens/FillRecordScreen.tsx` | Carrega `FillRecordData`; delega ao `DynamicForm` |
| `src/features/form-fill/components/DynamicForm.tsx` | Tabs, BackHandler, prompt de rascunho, submit |
| `src/features/form-fill/hooks/useDraftAutosave.ts` | Autosave (debounce 500ms), save no unmount, `startFresh` |
| `src/features/form-fill/utils/findFieldLabel.ts` | Label recursivo por `id` |
| `src/features/form-fill/components/DynamicFieldRenderer.tsx` | Switch por `field.type` |
| `src/features/form-fill/components/FillRecordTabs.tsx` | Tabs `form` / `record` / `actions` |
| `src/features/form-fill/components/RecordDataTab.tsx` | Dados brutos do registro |
| `src/features/form-fill/components/SelectionSheet.tsx` | Bottom-sheet para `SelectField` |
| `src/features/form-fill/components/fields/FieldContainer.tsx` | Label + helper + error |
| `src/features/form-fill/hooks/useDynamicForm.ts` | Valores, validação, coleta, draft |
| `src/features/form-fill/engine/formEngine.ts` | Visibilidade, validação, coleta, draft |
| `src/features/form-fill/engine/valueValidation.ts` | CPF/CNPJ/telefone/CEP |
| `src/features/form-fill/services/fillRecordService.ts` | `getFillRecordData`, `saveFillRecordDraft`, `clearFillRecordDraft` |
| `src/features/form-fill/services/draftFileService.ts` | Arquivos físicos do rascunho |
| `src/features/form-fill/types/form.ts` | `DynamicField`, `FormValue`, `FillRecordLocalStatus` |
| `src/features/form-fill/vendor/json-logic.js` | JSONLogic para condições |

## Modelo de campo

```ts
DynamicField = {
  id: string;
  type: string;  // text | number | datetime | textarea | select | radio | checkbox |
                // title | divider | group | mult_capturas | signature | upload
  visibility?: boolean;
  config: {
    label?, required?, defaultValue?, conditions?, options?,
    children?: DynamicField[],  // group
    // ...
  };
}
```

`NON_VALUE_FIELDS = {'divider', 'group', 'title'}` em `formEngine.ts`.

## Engine (`formEngine.ts`)

| Função | Uso |
|---|---|
| `isFieldVisible` | Condições JSONLogic + `visibility` |
| `getEffectiveValues` | Zera valores de campos invisíveis |
| `getInitialFormValues` | Defaults por tipo |
| `validateVisibleRequiredFields` | Required, mult_capturas, CPF |
| `collectVisibleFormValues` | Payload de envio |
| `createOfflineDraftData` | Rascunho normalizado |

Condições legadas convertidas em JSONLogic (`conditionToJsonLogic`). Bundle vendorizado — não atualizar do npm.

## Navegação e retorno

- `onBack` → `navigation.goBack()` no stack `Records`.
- `onLocalStateSaved` → `RecordsListContext.setLocalState` → `RecordsScreen` chama `markOfflineDraft`.
- BackHandler Android chama `onBack` no `DynamicForm`.

## Persistência de rascunho

- Tabela `offline_form_drafts` (PK `record_guid + form_guid`).
- Autosave debounce 500ms; save no unmount se dirty.
- `status`: `'Rascunho'` ou `'Preenchendo offline'`.
- Uploads em `form-drafts/{record}/{form}/{field}` via `expo-file-system`.

## Buscas comuns

- "Campo não aparece" → `visibility` e `conditions`; testar `isFieldVisible`.
- "Auto-save não salva" → `isDirty` e `draftPromptHandled`.
- "Adicionar tipo de campo" → `DynamicFieldRenderer` + `components/fields/` + `formEngine` se necessário.
