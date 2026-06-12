# Análise do fluxo de Sincronização (envio de preenchimentos)

> Documento de trabalho. **Parte A** e **Parte B** são fatos lidos do código (cada um com `arquivo:linha`).
> **Parte C** são perguntas que o código **não responde sozinho** (dependem de você ou do contrato do backend).
> Em cada pergunta há uma **resposta proposta**; confirme, corrija ou recuse na linha `➡️ Sua confirmação:`.
>
> Nada foi alterado no código ainda. O objetivo é fechar as decisões **antes** de mexer, para refinar o fluxo — não inflar.

---

## Parte A — Como o envio funciona hoje (mapa factual)

O ciclo de vida de um preenchimento tem 4 estágios. Cada um é hoje **implícito** (espalhado em telas/serviços), não existe um estado único e persistido que descreva "onde" o preenchimento está.

```
1. PREENCHENDO   form-fill/components/DynamicForm.tsx
   - autosave debounce 500ms grava em offline_form_drafts (status='Rascunho')
     useDraftAutosave.ts:122-133
   - salva também ao desmontar a tela (useDraftAutosave.ts:83-94)

2. CONCLUÍDO     DynamicForm.submit() (DynamicForm.tsx:113-154)
   - valida obrigatórios; se ok, regrava o draft com status='Preenchendo offline'
   - a partir daqui o item aparece na tela de Sync

3. ENVIANDO      sync/screens/SyncScreen.tsx:87-122  →  sync/services/syncService.ts
   - getSyncableDrafts: SELECT ... WHERE status='Preenchendo offline'  (syncService.ts:182)
   - syncAll: 1 requisição POST /campo-visitas/registro por preenchimento (syncService.ts:311)
   - sucesso SÓ se body = { codigo:200, status:'sucesso' }  (syncService.ts:314)

4. CONFIRMADO    syncService.ts:319-320 (só após sucesso)
   - clearFillRecordDraft → DELETE da linha em offline_form_drafts
   - deleteDraftDirectory → apaga os arquivos físicos do preenchimento
```

**O que já está correto e deve ser preservado:**

- A exclusão do rascunho/arquivos **só ocorre após** `{ codigo:200, status:'sucesso' }` (`syncService.ts:313-320`). Qualquer outra resposta ou exceção cai em `failure()` e **mantém** o rascunho (`syncService.ts:315-316`, `:328-329`). Esse é o comportamento "jamais apagar sem garantia" que você pediu — ele já existe para o caminho principal.
- Falha em um item **não** interrompe os demais (`syncAll`, `syncService.ts:345-349`).
- O interceptor do axios rejeita requisições quando offline (`apiClient.ts:32-39`), então um envio sem internet vira `failure` e mantém o rascunho.

---

## Parte B — Pontos de risco encontrados no código

Estes são os pontos onde o fluxo **pode** violar suas regras ("erro silencioso", "falso positivo", "perda de dado preenchido"). Cada um vira uma pergunta na Parte C.

| # | Severidade | Onde | Risco |
|---|---|---|---|
| R1 | **Crítico** | `syncService.ts:113-120` e `:283-288` | Se um arquivo de `upload`/foto não puder ser lido no envio, ele é **silenciosamente descartado** (`catch {}`), o resto é enviado, a API retorna 200 e o rascunho + arquivos são apagados. → preenchimento enviado **sem a imagem**, e o original já foi apagado. Falso positivo + perda de dado. |
| R2 | **Alto** | `syncService.ts:298-317` | Não há chave de idempotência no payload. Se o servidor **processar** o envio mas a resposta se perder (timeout de 5min, queda), o cliente vê erro → mantém o rascunho → próximo envio **duplica** o registro no servidor. |
| R3 | **Alto** | `syncService.ts:314` | "Sucesso" depende **só** do corpo `{codigo:200,status:'sucesso'}`, não do HTTP. Se a API um dia responder sucesso em outro formato, o cliente trata como falha e reenvia (duplica). Se responder esse corpo sem ter persistido, apaga indevidamente. |
| ~~R4~~ | **DESCARTADO** | `OverviewScreen.tsx:295-351` | ~~"Resetar tudo" apaga drafts não enviados.~~ **Achado falso:** o reset já é confirmado por modal, bloqueado offline e avisa sobre pendentes via `getPendingDraftsCount`. É ação deliberada — não é erro silencioso. (Resíduo real e menor: `leaveTeam`/`JoinTeam`/`NoGroup` chamam `clearAllOfflineData` **sem** o aviso de pendentes.) |
| R5 | **Médio** | `SyncScreen.tsx:124-128` + `syncService.ts:255-261` | "Concluir" chama `requestFullRefresh()` mesmo havendo falhas. O refresh reimporta `offline_records`. Um rascunho cujo registro **sumiu** do novo consolidado fica órfão: `syncDraft` falha em "Registro não encontrado" e ele **nunca** envia nem é apagado (fica preso). → ver Q8. |
| R6 | Confirmado | `syncService.ts:182` | Só `status='Preenchendo offline'` é enviável; `'Rascunho'` nunca sobe. **Confirmado como regra.** |
| R7 | Confirmado | `syncService.ts:151-154` | Backend não bloqueia coordenada vazia, **mas** a regra é capturar GPS do aparelho em TODO preenchimento. Hoje só `mult_capturas` captura; forms sem ele caem na coordenada do registro. → ver Q7. |
| R8 | Médio | `syncService.ts:319-329` | Após sucesso da API, se `clearFillRecordDraft` lançar exceção, cai no `catch` e retorna `failure` — embora o servidor **já tenha aceitado**. Próximo envio recusado por "já preenchido" → ver Q1. |

### Integridade e relação dos arquivos (o ponto central) — Achados A–D

| # | Severidade | Onde | Risco |
|---|---|---|---|
| **A** | **Crítico** | `formEngine.ts:273-277` (getFileName) + `draftFileService.ts:11-15` (safeFileName) | Os arquivos são únicos no disco (`Date-index-nome`), mas `dados[field_id]` **remove o prefixo de unicidade**. Dois arquivos de origem `foto.jpg` viram `["foto.jpg","foto.jpg"]` no POST. Se o servidor casa upload por nome → colisão/sobrescrita. ("arquivos únicos") |
| **B** | **Alto** | `syncService.ts:99-128` (buildUploads) | A relação `dados[]` (nomes) ↔ `uploads[].urls` (base64) é **posicional, por índice**. Funciona só se os arrays nunca divergirem em tamanho/ordem (invariante mantido por convenção, não imposto) e se o servidor casar por posição. ("arquivos que se relacionam") |
| **C** | **Crítico** | `syncService.ts:111-119` | Descarte silencioso no envio (`if(!uri) continue`, `catch{}`) pode encurtar `urls` e **desalinhar o índice** do Achado B → envio parcial + rascunho apagado no 200. Erro silencioso → falso positivo → perda. |
| **D** | **Médio** | `MultiCaptureField.tsx:46-53` + `syncService.ts:151-154` | Não há captura universal de GPS no preenchimento; só `mult_capturas`. Forms sem ele usam a coordenada do **registro** (cadastro), não a do aparelho. → ver Q7. |

> Observação de previsibilidade (não é pergunta): a documentação em `docs/` ainda fala em `features/offline/`, mas o código real está em `features/sync/`, `features/consolidated-data/` e `features/form-fill/`. Atualizar os `.md` reduz risco de manutenção no lugar errado.

---

## Parte C — Perguntas para confirmar (o código não responde)

### Q1 — Idempotência no servidor (R2, R8) — **a mais importante**
O endpoint `POST /campo-visitas/registro` **deduplica** envios repetidos do mesmo preenchimento? Ou seja: se o app enviar o mesmo preenchimento duas vezes (porque a 1ª resposta se perdeu), o servidor cria **dois** registros ou reconhece que é o mesmo?

- **✅ CONFIRMADO (usuário):** o backend já deduplica por `base_dados_guid` — se já preenchido, recusa e retorna `codigo: 404`. Não é preciso chave de idempotência no app.
- **Ação no cliente (a definir):** o app precisa tratar "já preenchido" como **sucesso terminal** (apagar o rascunho), senão o rascunho fica preso reenviando para sempre. Hoje só apaga em `{codigo:200,status:'sucesso'}`.
- **Recomendação de número:** trocar `404` por **`409 (Conflict)`** ou um `codigo` próprio com `status:'ja_processado'` — `404` se confunde com "rota/registro inexistente".
- **⚠️ Pergunta aberta (baseless):** registros "sem base" usam `base_dados_guid='0000…0'`. A dedup por `base_dados_guid` recusaria o 2º preenchimento sem base indevidamente? Como o backend trata isso?

➡️ Sua confirmação: __________________________________________

---

### Q2 — Contrato de sucesso (R3)
`{ codigo:200, status:'sucesso' }` é o **único e garantido** sinal de que o preenchimento foi persistido? O que a API retorna se o registro **já tinha sido processado** antes (reenvio)? E em sucesso parcial (registro salvo, mas um upload falhou no servidor)?

- **✅ CONFIRMADO (usuário):** `codigo=200` ⇒ tudo certo. Único sinal de sucesso. Demais respostas mantêm o rascunho (exceto "já preenchido" da Q1, que também deve limpar o rascunho).

➡️ Sua confirmação: __________________________________________

---

### Q3 — Integridade de uploads no envio (R1) — **regra de ouro**
Quando um arquivo de `upload`/foto referenciado no preenchimento **não puder ser lido** no momento do envio (ex.: apagado do disco), o que deve acontecer?

- **Reenquadrado (usuário):** a questão real é se o arquivo é **salvo no lugar certo no momento do preenchimento** — se sim, ele sempre estará disponível para virar base64 no POST. → ver **Achados A–C** (a falha não está em "ler no envio", e sim em (A) perda de unicidade do nome e (B) correlação posicional frágil).
- **Resposta proposta:** trocar os `catch {}` silenciosos do envio (`syncService.ts:111-119`) por **falha controlada do item** (mantém rascunho), E corrigir a raiz nos Achados A/B (identidade explícita por arquivo). Nunca envio parcial silencioso.

➡️ Sua confirmação: __________________________________________

---

### Q4 — Formato esperado dos uploads pelo backend (R1, contrato)
O servidor espera o nome do arquivo dentro de `dados[field_id]` **e** o base64 correspondente em `uploads[] = { field_id, urls:[dataURL] }`? Um `field_id` citado em `dados` mas **ausente** em `uploads` é erro no servidor, ou ele ignora?

- **Parcialmente confirmado (usuário):** há preenchimentos que podem **não ter imagem** — ok. O foco é garantir que, quando existem, foram salvas corretamente (Achados A–C).
- **⚠️ Pergunta aberta (decisiva para o "método"):** o servidor casa `dados[field_id]` ↔ `uploads[].urls` **por posição (índice)** ou **por nome do arquivo**? A resposta define se basta corrigir a unicidade (Achado A) ou se precisamos do modelo por `uid` explícito (Parte D).

➡️ Sua confirmação: __________________________________________

---

### ~~Q5~~ — DESCARTADA (achado falso)
O "Resetar tudo" do Overview **já é** ação deliberada: modal de confirmação, bloqueio offline e aviso de pendentes via `getPendingDraftsCount` ([OverviewScreen.tsx:295-351](../src/features/overview/screens/OverviewScreen.tsx)). Não é erro silencioso. Removido da lista.

- **Resíduo menor (a confirmar separadamente):** `leaveTeam`/`JoinTeam`/`NoGroup` chamam `clearAllOfflineData` **sem** o aviso de pendentes. Vale aplicar a mesma checagem de pendentes nesses pontos? (baixa prioridade)

---

### Q6 — Limite do que é enviável (R6)
Confirma que **apenas** preenchimentos concluídos (`'Preenchendo offline'`) sobem, e que `'Rascunho'` (incompleto) **nunca** é enviado automaticamente?

- **✅ CONFIRMADO (usuário):** sim. Rascunho fica só no aparelho; só "Concluir" (que valida obrigatórios) torna enviável.

➡️ Sua confirmação: __________________________________________

---

### Q7 — Coordenadas ausentes (R7)
Quando não há coordenadas (nem em `mult_capturas`, nem no registro), enviar `latitude:''`/`longitude:''` é aceitável para o backend, ou o envio deve ser **bloqueado** até obter localização?

- **✅ CONFIRMADO (usuário):** o backend não bloqueia, **mas** a regra é: **toda** finalização de preenchimento deve capturar o GPS do aparelho, forçando precisão no momento do preenchimento.
- **Gap (Achado D):** hoje só `mult_capturas` captura GPS ([MultiCaptureField.tsx:46-53](../src/features/form-fill/components/fields/MultiCaptureField.tsx)). Forms sem esse campo usam a coordenada do **registro** (cadastro), não a do aparelho ([syncService.ts:151-154](../src/features/sync/services/syncService.ts)). Falta uma **captura de GPS obrigatória no "Concluir"** de todo registro.
- ➡️ Confirmar: a captura obrigatória é no momento de **Concluir** o preenchimento (1 coordenada por preenchimento), correto?

➡️ Sua confirmação: __________________________________________

---

### Q8 (REFORMULADA) — preenchimento concluído deve ser autossuficiente para envio?
Hoje o `syncDraft` lê o registro local (`offline_records WHERE guid=?`, `syncService.ts:255-261`) para montar o payload (`base_dados_guid`, coordenada de fallback). Se entre o "Concluir" e o envio esse registro **deixar de existir** localmente (ex.: um refresh que faz `DELETE FROM offline_records` e reimporta, `offlineSync.ts:160`), o envio falha em "Registro não encontrado" e o preenchimento fica **preso**: não envia e não é apagado.

**Pergunta:** o preenchimento, ao ser **Concluído**, deve **congelar no próprio rascunho** tudo que precisa para o envio (`base_dados_guid`, coordenadas, ids/nomes de arquivo), tornando o envio **independente** de o registro local ainda existir?

- **Resposta proposta:** Sim. Garante previsibilidade e desacopla o envio do estado dos dados consolidados.

➡️ Sua confirmação: __________________________________________

---

### Q9 — Detecção de "online" (captive portal)
`isOnline` hoje = `isConnected && isInternetReachable` (`NetworkContext.tsx:20-30`), checado a cada 10s. Isso não garante que **a API** está acessível (ex.: Wi-Fi de cliente com portal). Precisamos de uma verificação real contra o host da API antes de sincronizar?

- **Resposta proposta:** Não adicionar ping próprio agora. Como todo envio sem alcance vira `failure` controlado (mantém o rascunho), não há perda. Só revisar se aparecerem casos reais de "diz online mas não envia". Manter simples.

➡️ Sua confirmação: __________________________________________

---

## Parte D — Padrão de fluxo proposto (para aprovar antes de codar)

Você pediu um "método/lógica específica que garanta o fluxo" e previsibilidade — sem inflar. A proposta **não adiciona features**; ela torna **explícito** o estado que hoje é implícito, para que nenhuma etapa apague nada sem uma confirmação persistida.

**Máquina de estados única por preenchimento** (uma coluna de estado no próprio `offline_form_drafts`, em vez de inferir por `status` textual):

```
PREENCHENDO ──concluir──▶ PRONTO_PARA_ENVIO ──POST──▶ (resposta)
                                  ▲                      │
                                  └──── falha (mantém) ◀──┤
                                                          ▼
                                              CONFIRMADO(server_id) ──limpa──▶ (apagado)
```

Regras invariantes (cada uma elimina um risco da Parte B):

1. **Só se apaga em CONFIRMADO**, e CONFIRMADO exige `server_id` retornado pela API. (R2/R3/R8)
2. **Envio é tudo-ou-nada por item**: faltou um arquivo/coordenada exigida → não sai do estado PRONTO. (R1/R7)
3. **Nada é descartado em silêncio**: todo `catch` vira um resultado de falha visível com motivo. (R1)
4. **Payload é congelado no "Concluir"** (base_dados_guid, coords, nomes de arquivo), para o envio não depender do registro continuar existindo. (R5)
5. **Reset respeita pendentes** (Q5).

➡️ Aprova seguir por esse padrão? (sim / ajustar / não): __________________________________________

---

### Como responder
Preencha as linhas `➡️` acima (pode ser direto neste arquivo). Com as confirmações eu refino o código **só** nos pontos confirmados, sem adicionar verificações desnecessárias.
