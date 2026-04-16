# QW-10B — Governança de Arquivos, Órfãos e Retenção de Imagens

## Status: Implementado

---

## 1. Diagnóstico — Mapa de campos de arquivo

### Tabelas com referências a arquivos externos (Cloudinary)

| Tabela | Campo URL | Campo public_id | Tipo de arquivo | Observação |
|---|---|---|---|---|
| `levantamento_itens` | `image_url` | `image_public_id` ✅ | Foto do foco/item (drone ou manual) | public_id adicionado em QW-10B |
| `vistorias` | `assinatura_responsavel_url` | `assinatura_public_id` ✅ | Assinatura digital do morador | public_id adicionado em QW-10B |
| `vistorias` | `foto_externa_url` | `foto_externa_public_id` ✅ | Foto externa sem acesso | public_id adicionado em QW-10B |
| `vistoria_calhas` | `foto_url` | `foto_public_id` ✅ | Foto de calha identificada | public_id adicionado em QW-10B |
| `levantamento_item_evidencias` | `image_url` | `public_id` ✅ | Evidência adicional do item | public_id adicionado em QW-10B |
| `operacao_evidencias` | `image_url` | `public_id` ✅ | Evidência de operação corretiva | public_id adicionado em QW-10B |
| `clientes` | `kmz_url` | — | Arquivo KMZ de território | Sem limpeza — permanente |

### Campos sem necessidade de limpeza

- `clientes.kmz_url` — arquivo de configuração territorial, permanente por definição.

---

## 2. Caminhos de upload identificados

| Origem | Edge Function / lib | public_id capturado antes QW-10B | Corrigido |
|---|---|---|---|
| `OperadorNovoItemManual` | `lib/cloudinary.ts` (upload direto) | Apenas em estado React, descartado após submit | ✅ QW-10B |
| `OperadorFormularioVistoria` (assinatura) | `upload-evidencia` Edge Function | Nunca capturado | ✅ QW-10B |
| `DenunciaCidadao` | `cloudinary-upload-image` Edge Function | Nunca capturado | ✅ QW-10B |
| `OperadorNovoItemManual` (cancelamento) | `cloudinary-delete-image` Edge Function | Exclusão imediata no cancel/unmount | — (já funcionava) |

---

## 3. Cenários de órfão — antes do QW-10B

### Órfão permanente (sem recuperação possível antes)
1. **Denúncia cidadão com foto**: foto enviada ao Cloudinary, URL salva em `levantamento_itens.image_url` (via payload), `public_id` descartado → sem possibilidade de exclusão posterior.
2. **Assinatura de vistoria**: upload via `upload-evidencia`, apenas URL retornada, `public_id` nunca armazenado → exclusão impossível ao deletar a vistoria.
3. **Item manual com imagem**: `public_id` ficava em estado React; se o usuário submetia e depois o item era soft-deleted, a imagem ficava permanentemente no Cloudinary.

### Órfão temporário (cleanup parcial existia)
4. **Item manual cancelado**: o `useEffect` de cleanup em `OperadorNovoItemManual` já chamava `deleteImage(uploadPublicId)` no unmount sem submit — este caminho funcionava.

### Orphan em cascade (estrutural)
5. **Evidências (`levantamento_item_evidencias`)**: têm `ON DELETE CASCADE` referenciando `levantamento_itens`. Como `levantamento_itens` usa soft delete, as evidências não são deletadas fisicamente. Ficam em banco sem vinculação ativa.
6. **Fotos de calha**: `vistoria_calhas` tem `ON DELETE CASCADE` referenciando `vistorias`. Se a vistoria for deletada fisicamente (cascade do imóvel), o registro é removido mas o Cloudinary não é notificado.

---

## 4. Implementação QW-10B

### 4.1 Migration `20260720000000_qw10b_governanca_arquivos.sql`

**Correção 1**: Colunas `*_public_id` adicionadas com `ADD COLUMN IF NOT EXISTS text` em:
- `levantamento_itens.image_public_id`
- `vistorias.assinatura_public_id`
- `vistorias.foto_externa_public_id`
- `vistoria_calhas.foto_public_id`
- `levantamento_item_evidencias.public_id`
- `operacao_evidencias.public_id`

**Correção 2**: Tabela `cloudinary_orfaos` — fila de limpeza segura:
```
id, public_id, url, origem_tabela, origem_id, cliente_id,
motivo, retention_until (padrão: now() + 5 years),
processado_em, deletado_em, erro, created_at
```
- RLS: apenas `admin` pode consultar.
- Índice parcial em `retention_until` para registros pendentes.

**Correção 3**: Trigger `trg_orfaos_levantamento_item` — AFTER UPDATE OF `deleted_at` em `levantamento_itens`:
- Dispara quando `OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL`
- Insere `image_public_id` (se presente) em `cloudinary_orfaos`
- Insere `public_id` das evidências vinculadas

**Correção 4**: Trigger `trg_orfaos_vistoria` — BEFORE DELETE em `vistorias`:
- Captura `assinatura_public_id` e `foto_externa_public_id`
- Captura `foto_public_id` de todas as calhas vinculadas

**Correção 5**: RPC `criar_levantamento_item_manual` — novo parâmetro `p_image_public_id text DEFAULT NULL`, persistido na coluna `image_public_id`.

**Correção 6**: RPC `denunciar_cidadao` — novo parâmetro `p_foto_public_id text DEFAULT NULL`, persistido em `levantamento_itens.image_public_id`.

### 4.2 Frontend

| Arquivo | Mudança |
|---|---|
| `OperadorNovoItemManual.tsx` | Passa `image_public_id: uploadPublicId` ao `api.itens.criarManual` |
| `OperadorFormularioVistoria.tsx` | Captura `upData.public_id` da assinatura; chama `api.vistorias.atualizarPublicIds` após `createCompleta` |
| `DenunciaCidadao.tsx` | `uploadFoto()` passa a retornar `{url, public_id}`; `denunciar_cidadao` recebe `p_foto_public_id` |

### 4.3 api.ts

- `api.itens.criarManual`: aceita `image_public_id?: string | null`, passa como `p_image_public_id`
- `api.vistorias.atualizarPublicIds(vistoriaId, ids)`: UPDATE direto para persistir public_ids após RPC
- `api.cloudinaryOrfaos.listar(clienteId?)`: consulta fila de órfãos pendentes (admin only)

### 4.4 Edge Function `cloudinary-cleanup-orfaos`

- Requer JWT de admin no Authorization header
- Parâmetro `dry_run` (padrão: `true`) — **sempre executar dry_run primeiro**
- Parâmetro `limite` (padrão: 50, máximo: 200)
- Processa apenas registros com `retention_until < now()` e `processado_em IS NULL`
- Usa Cloudinary Destroy API com assinatura SHA-1
- Resultado `not found` do Cloudinary é tratado como sucesso (idempotente)
- Marca `deletado_em` ou `erro` em `cloudinary_orfaos`

---

## 5. Política de retenção

| Tipo de arquivo | Retenção | Justificativa |
|---|---|---|
| Evidências de foco (imagens de drone/manual) | **5 anos** | Valor probatório, auditoria epidemiológica, LGPD art. 16 |
| Assinaturas digitais de vistoria | **5 anos** | Comprovante de visita, respaldo jurídico |
| Fotos de calha / sem acesso | **5 anos** | Evidência de campo, suporte a notificações formais |
| Fotos de denúncia cidadão | **5 anos** | Mesma base — item vira levantamento_item com valor probatório |
| Evidências operacionais | **5 anos** | Auditoria de ações corretivas |
| Arquivos KMZ de cliente | **Permanente** | Configuração de território, não pessoal |
| Órfãos sem vínculo (upload interrompido) | **90 dias** | Sem valor de negócio após período de graça |

> **Nota LGPD**: Nenhuma das imagens armazena dados pessoais identificáveis diretos. As fotos de vistoria registram imóveis (não pessoas). A assinatura é armazenada com fins de comprovação de visita, sem vinculação nominal no banco.

---

## 6. Procedimento de limpeza (manual, sob demanda)

```bash
# 1. Verificar o que seria deletado (dry_run=true — padrão seguro)
curl -X POST "$SUPABASE_URL/functions/v1/cloudinary-cleanup-orfaos" \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true, "limite": 50}'

# 2. Revisar output. Somente se satisfatório, executar real:
curl -X POST "$SUPABASE_URL/functions/v1/cloudinary-cleanup-orfaos" \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"dry_run": false, "limite": 50}'
```

> **NUNCA** configurar cron automático com `dry_run=false` sem revisão humana prévia.
> Registros com `retention_until` de 5 anos não serão processados até 2031+.

---

## 7. Lacunas conhecidas (próximas iterações)

| ID | Lacuna | Impacto | Prioridade |
|---|---|---|---|
| L-1 | Fotos de `operacao_evidencias` não têm trigger de captura ainda (somente coluna adicionada) | Baixo — `operacoes` raramente deletadas | Futura |
| L-2 | `levantamento_item_evidencias.public_id` não é preenchido no upload atual (pipeline drone Python) | Médio — requer mudança no pipeline Python | Futura |
| L-3 | `vistorias.foto_externa_public_id` não preenchido em `VistoriaSemAcesso.tsx` | Médio — fluxo sem acesso captura URL mas não public_id | Próxima sprint |
| L-4 | Backfill de registros históricos sem public_id | Impossível sem varredura Cloudinary API | Longo prazo |
| L-5 | Sem cron automático para `cloudinary-cleanup-orfaos` | Baixo — retenção de 5 anos dá margem longa | Longo prazo |

---

## 8. Arquivos modificados

| Arquivo | Tipo de mudança |
|---|---|
| `supabase/migrations/20260720000000_qw10b_governanca_arquivos.sql` | Nova migration |
| `supabase/functions/cloudinary-cleanup-orfaos/index.ts` | Nova Edge Function |
| `src/services/api.ts` | `criarManual` + `atualizarPublicIds` + `cloudinaryOrfaos.listar` |
| `src/pages/operador/OperadorNovoItemManual.tsx` | Passa `image_public_id` |
| `src/pages/operador/OperadorFormularioVistoria.tsx` | Captura e persiste `assinatura_public_id` |
| `src/pages/public/DenunciaCidadao.tsx` | Captura e passa `foto_public_id` |
