# Regra de negócio: Criação manual de levantamento_itens

## 1. Diagnóstico do schema

### O que já existia
- **levantamentos**: `id`, `cliente_id`, `usuario_id`, `planejamento_id`, `titulo`, `data_voo`, `total_itens`, `created_at`, `tipo_entrada` (text, adicionado em migration anterior).
- **levantamento_itens**: todos os campos necessários (latitude, longitude, item, risco, acao, score_final, prioridade, sla_horas, endereco_curto/completo, image_url, maps, waze, data_hora, payload, etc.).
- **planejamento**: `id`, `descricao`, `data_planejamento`, `cliente_id`, `area_total`, `altura_voo`, `area`, `tipo`, `created_at`, `updated_at`.
- **usuarios**: `id` (PK), `auth_id` (link com auth.users), `nome`, `email`, `cliente_id`.
- **papeis_usuarios**: `usuario_id` (= auth.uid()), `papel` (enum: admin, supervisor, usuario, operador).
- **RLS**: políticas por `usuario_pode_acessar_cliente(cliente_id)`; operador com regras específicas em operacoes/usuarios.
- **Funções**: `usuario_pode_acessar_cliente`, `is_admin`, `current_usuario_public_id()`, `get_meu_papel()`.

### Lacunas identificadas
1. **planejamento**: não tinha coluna `ativo` para "marcar como ativo" e permitir que operador só escolha planejamentos ativos.
2. **Reuso de levantamento**: não havia unicidade (cliente, planejamento, data_voo) para tipo MANUAL, arriscando criar vários levantamentos para o mesmo dia.
3. **tipo_entrada**: existia como text sem constraint; padronizamos com CHECK (DRONE/MANUAL).
4. **Tags**: não havia catálogo; `levantamento_itens.item` é texto livre. Foi criada tabela `tags` e pivot `levantamento_item_tags` para uso manual e futuro uso pelo drone.
5. **Criação manual**: não havia função única que garantisse "criar ou reutilizar levantamento + inserir item + validar papel e planejamento ativo".

---

## 2. Decisões de modelagem

| Decisão | Justificativa |
|--------|----------------|
| **planejamento.ativo** (boolean, default true) | Regra exige "marcar como ativo"; apenas planejamentos ativos podem ser escolhidos pelo operador. |
| **Unicidade levantamento manual** | Índice único em `(cliente_id, planejamento_id, date_trunc('day', data_voo))` WHERE tipo_entrada = 'MANUAL'. Um levantamento MANUAL por dia/planejamento/cliente; vários itens no mesmo levantamento. |
| **tipo_entrada** | CHECK para valores 'DRONE'/'MANUAL' (e minúsculas se necessário). |
| **tags** | Tabela `tags` (id, slug, label) + `levantamento_item_tags` (levantamento_item_id, tag_id). Tags iniciais: caixa_dagua_suja, entulho, lixo_acumulado, etc. Campo `item` em levantamento_itens permanece para compatibilidade e uso pelo drone. |
| **RPC SECURITY DEFINER** | A função insere em `levantamentos` e `levantamento_itens`; as políticas RLS exigem acesso ao cliente. Com DEFINER a função roda com permissão do dono e validações internas (papel, planejamento ativo, cliente do operador). Retorno em JSON para o front. |
| **Quem pode chamar a RPC** | admin, supervisor, usuario, operador. Operador só pode para o próprio cliente (validado dentro da função). |

---

## 3. Migration SQL

Arquivo: **`20250306170000_levantamento_item_manual_regra.sql`**

Inclui:
- `planejamento.ativo` (boolean NOT NULL DEFAULT true)
- CHECK em `levantamentos.tipo_entrada`
- Índice único `uix_levantamentos_manual_por_dia` para reuso
- Tabelas `tags` e `levantamento_item_tags` + seed de tags + RLS
- Função `criar_levantamento_item_manual(...)` e GRANT EXECUTE

---

## 4. Função de negócio (RPC)

**Nome:** `public.criar_levantamento_item_manual`

**Parâmetros (todos opcionais exceto planejamento_id e data_voo):**
- `p_planejamento_id` (uuid) — obrigatório
- `p_data_voo` (date) — obrigatório
- `p_latitude`, `p_longitude`, `p_item`, `p_risco`, `p_acao`, `p_score_final`, `p_prioridade`, `p_sla_horas`
- `p_endereco_curto`, `p_endereco_completo`, `p_image_url`, `p_maps`, `p_waze`, `p_data_hora`
- `p_tags` (text[]) — slugs das tags (ex.: `['caixa_dagua_suja','entulho']`)
- `p_peso`, `p_payload` (jsonb)

**Validações:**
- Usuário autenticado (`auth.uid()`)
- Usuário existe em `usuarios` (obtém `usuarios.id` e `cliente_id`)
- Papel em `papeis_usuarios` é um de: admin, supervisor, usuario, operador
- Planejamento existe e está `ativo`
- Operador: só pode criar para o `cliente_id` ao qual está vinculado
- Admin/supervisor/usuario: `usuario_pode_acessar_cliente(cliente_id)` do planejamento
- Reutiliza levantamento quando já existe um MANUAL para (cliente, planejamento, data_voo); senão cria um novo com `tipo_entrada = 'MANUAL'`
- Insere tags em `levantamento_item_tags` a partir dos slugs em `p_tags`
- Atualiza `levantamentos.total_itens` após inserir o item

**Retorno (jsonb):**
```json
{
  "levantamento_item": { ... registro criado em levantamento_itens ... },
  "levantamento_criado": true | false,
  "levantamento_id": "uuid"
}
```

---

## 5. RLS / segurança

- **planejamento**: políticas existentes (por cliente) continuam; apenas adicionamos a coluna `ativo`. Quem pode ativar/desativar segue as políticas de UPDATE (quem pode acessar o cliente).
- **levantamentos / levantamento_itens**: políticas existentes continuam. A RPC é SECURITY DEFINER e faz INSERT em nome do usuário lógico (com validações de papel e cliente). O insert em `levantamento_itens` referencia um `levantamento_id` que pertence ao cliente acessível, então a política de INSERT existente é satisfeita.
- **tags**: SELECT liberado para authenticated; INSERT/DELETE em `levantamento_item_tags` apenas quando o item pertence a um levantamento do cliente acessível (já coberto pelas políticas criadas na migration).

Não foi necessário alterar políticas de levantamentos ou levantamento_itens; a função garante que só insere em contexto permitido.

---

## 6. Exemplo de chamada (Supabase JS/TS)

```ts
import { supabase } from '@/lib/supabase';

type CriarItemManualParams = {
  planejamento_id: string;
  data_voo: string; // 'YYYY-MM-DD'
  latitude?: number;
  longitude?: number;
  item?: string;
  risco?: string;
  acao?: string;
  score_final?: number;
  prioridade?: string;
  sla_horas?: number;
  endereco_curto?: string;
  endereco_completo?: string;
  image_url?: string;
  maps?: string;
  waze?: string;
  data_hora?: string; // ISO
  tags?: string[];   // ex: ['caixa_dagua_suja', 'entulho']
  peso?: number;
  payload?: Record<string, unknown>;
};

export async function criarLevantamentoItemManual(params: CriarItemManualParams) {
  const { data, error } = await supabase.rpc('criar_levantamento_item_manual', {
    p_planejamento_id: params.planejamento_id,
    p_data_voo: params.data_voo,
    p_latitude: params.latitude ?? null,
    p_longitude: params.longitude ?? null,
    p_item: params.item ?? null,
    p_risco: params.risco ?? null,
    p_acao: params.acao ?? null,
    p_score_final: params.score_final ?? null,
    p_prioridade: params.prioridade ?? null,
    p_sla_horas: params.sla_horas ?? null,
    p_endereco_curto: params.endereco_curto ?? null,
    p_endereco_completo: params.endereco_completo ?? null,
    p_image_url: params.image_url ?? null,
    p_maps: params.maps ?? null,
    p_waze: params.waze ?? null,
    p_data_hora: params.data_hora ?? null,
    p_tags: params.tags ?? null,
    p_peso: params.peso ?? null,
    p_payload: params.payload ?? null,
  });

  if (error) throw error;
  return data as {
    levantamento_item: LevantamentoItem;
    levantamento_criado: boolean;
    levantamento_id: string;
  };
}

// Uso:
const result = await criarLevantamentoItemManual({
  planejamento_id: 'uuid-do-planejamento-ativo',
  data_voo: '2026-03-06',
  latitude: -15.78,
  longitude: -47.93,
  item: 'Caixa d\'água suja',
  risco: 'alto',
  sla_horas: 24,
  tags: ['caixa_dagua_suja'],
});
console.log(result.levantamento_criado ? 'Novo levantamento criado' : 'Levantamento reutilizado');
console.log(result.levantamento_item.id);
```

---

## 7. Cenários de teste (SQL)

Executar no SQL Editor do Supabase (com usuário autenticado e dados existentes).

```sql
-- 1) Criar com levantamento inexistente (deve criar levantamento + item)
-- Substituir :planejamento_id por um UUID de planejamento ativo do seu cliente.
SELECT public.criar_levantamento_item_manual(
  '00000000-0000-0000-0000-000000000001'::uuid,  -- planejamento_id
  current_date,                                     -- data_voo
  -15.78, -47.93,                                   -- lat, lon
  'Teste manual', 'medio', 'Vistoriar', 50, 'Média', 24,
  'Rua X', 'Rua X, 123', NULL, NULL, NULL, now(),
  ARRAY['caixa_dagua_suja'],
  NULL, NULL
);

-- 2) Criar novamente mesmo dia mesmo planejamento (deve reutilizar levantamento)
SELECT public.criar_levantamento_item_manual(
  '00000000-0000-0000-0000-000000000001'::uuid,
  current_date,
  -15.79, -47.94,
  'Segundo item', 'baixo', NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL, now(),
  ARRAY['entulho'],
  NULL, NULL
);
-- Esperado: levantamento_criado = false, mesmo levantamento_id.

-- 3) Erro: planejamento inativo
-- Primeiro desative um planejamento: UPDATE planejamento SET ativo = false WHERE id = '...';
-- Depois chame a RPC com esse id → deve falhar com "Planejamento não está ativo".

-- 4) Erro: perfil sem permissão
-- Com usuário que não tem papel em papeis_usuarios (ou papel não permitido) → "Papel não permitido".

-- 5) Operador e cliente diferente
-- Com usuário operador vinculado ao cliente A e planejamento do cliente B → "Operador só pode criar itens para o cliente ao qual está vinculado".
```

---

## 8. Integração no front (sentinelaweb)

- **API** (`src/services/api.ts`): `api.itens.criarManual(params)`, `api.planejamentos.listAtivosByCliente(clienteId)`, `api.tags.list()`.
- **Rota**: `/operador/levantamentos/novo-item` — formulário "Criar item manual" (planejamento ativo, data do voo, local, item, risco, tags, etc.). Após sucesso, redireciona para `/operador/levantamentos` com toast "Item criado. Levantamento reutilizado" ou "Novo levantamento criado."
- **Acesso**: item de menu **"Criar item manual"** no portal Operador (sidebar) e botão na página Meus itens (`/operador/levantamentos`).
- **Admin**: em Admin > Planejamentos, o formulário de edição inclui o switch **Ativo** ("Disponível para criar item manual"); a listagem exibe badge Ativo/Inativo. Apenas planejamentos ativos aparecem no select do formulário de criar item manual.

---

## 9. Observações finais

- **Unicidade**: um levantamento MANUAL por (cliente, planejamento, dia) é garantida pela RPC (SELECT antes do INSERT). Índice `ix_levantamentos_manual_reuso` acelera a busca.
- **data_voo**: a função recebe `date`; a coluna em `levantamentos` pode ser date ou timestamptz.
- **total_itens**: a função atualiza `levantamentos.total_itens` após cada inserção.
- **Tags**: o campo `item` em `levantamento_itens` continua sendo preenchido (p_item); as tags na pivot são complementares.
- **Lovable**: o projeto foi criado com Lovable; esta migration adiciona colunas, tabelas e a função RPC, preservando compatibilidade.
