# 01 — Contexto do Produto

> **Para quem é este documento:** quem precisa entender o *porquê* do sistema antes de entender o *como*. Produto managers, parceiros comerciais, novos membros de time, avaliadores técnicos.

---

## O problema real que o Sentinella resolve

O Brasil enfrenta epidemias cíclicas de dengue. Em 2024, o país superou 6 milhões de casos — o maior número registrado na história. A maioria dos municípios brasileiros ainda combate o mosquito *Aedes aegypti* com ferramentas inadequadas para a escala do problema:

- **Planilhas Excel** para registrar vistorias
- **Ligações telefônicas** para coordenar equipes de campo
- **SINAN** (sistema federal) para notificações — lento, sem integração operacional em tempo real
- **Inspeção manual** sem priorização — equipe vai ao campo sem saber onde o risco é maior

O resultado é previsível: focos críticos sem atendimento, gestores sem dados confiáveis, operadores sem direção clara, epidemias que poderiam ser contidas se transformando em surtos.

---

## O que o Sentinella oferece

O Sentinella é uma **plataforma operacional completa** — não apenas um painel de visualização. Ele cobre o ciclo inteiro da vigilância epidemiológica:

```
Identificar foco → Priorizar → Atribuir → Tratar em campo → Registrar → Auditar
```

Isso significa que o sistema não termina quando um foco é identificado: ele acompanha o foco até sua resolução, registra quem fez o quê e quando, e avisa quando os prazos estão sendo descumpridos.

---

## Quem usa o sistema e como

O Sentinella tem **cinco perfis de usuário** com portais completamente diferentes:

### Admin da plataforma (`/admin/*`)
- É a equipe do Sentinella (SaaS), não uma prefeitura
- Acesso a todas as prefeituras cadastradas
- Gerencia clientes, monitora SLAs globais, visualiza painel comparativo entre municípios
- Pode assumir o contexto de qualquer prefeitura para suporte

### Supervisor (`/admin/*` com escopo de um cliente)
- É o administrador de uma prefeitura específica
- Cria e gerencia usuários da sua equipe
- Configura regiões, SLAs, catálogos de ações, feriados
- Acompanha todos os indicadores operacionais

### Usuário / Gestor (`/admin/*` com permissões reduzidas)
- Acompanha operações em andamento
- Gera relatórios, visualiza heatmaps, acessa comparativos
- Não gerencia configurações estruturais

### Operador de campo (`/operador/*`)
- Recebe a lista dos focos que precisa atender
- Realiza checkin GPS ao chegar ao local
- Registra evidências fotográficas e aplica plano de ação
- Conduz vistorias domiciliares imóvel por imóvel
- Pode trabalhar **sem conexão à internet** (modo offline com fila IndexedDB)

### Agente de controle de endemias (`/agente/*`)
- Visita imóveis domiciliar por domiciliar
- Inspeciona depósitos de água (padrão PNCD: A1–E)
- Registra focos de larva, aplica larvicida, coleta riscos sociais e sanitários
- Preenche o formulário em stepper de 5 etapas, com suporte offline

### Notificador (`/notificador/*`)
- Funcionário de UBS, UPA ou hospital
- Registra casos de dengue, chikungunya, zika e suspeitos
- O sistema cruza automaticamente cada caso com focos próximos (raio de 300m)

### Cidadão (portal público sem login)
- Acessa `/denuncia/:slug/:bairroId` via QR code impresso pela prefeitura
- Reporta suspeitas de foco sem criar conta
- A denúncia chega diretamente aos gestores da prefeitura

---

## Proposta de valor por perfil

| Perfil | Antes do Sentinella | Com o Sentinella |
|--------|---------------------|--------------------|
| Gestor municipal | Planilhas desatualizadas, sem visibilidade real | Dashboard em tempo real, heatmap, alertas de SLA |
| Operador de campo | Lista em papel, sem priorização | Mapa com rota otimizada, focos priorizados por risco |
| Agente de endemias | Formulário físico, perda de dados | Formulário digital offline com sincronização automática |
| Notificador de UBS | Registro manual no SINAN, sem integração | Registro no sistema + integração e-SUS Notifica + cruzamento automático com focos |
| Gestão estadual / federal | Sem visibilidade entre municípios | Painel comparativo de desempenho por município |

---

## Os módulos principais

### 1. Planejamentos e Levantamentos

O ponto de partida de toda operação de campo. Um **planejamento** define onde e como a equipe vai atuar:
- Qual região ou bairro será coberto
- Qual tipo: drone (análise aérea) ou manual (inspeção a pé)
- Qual data prevista de execução

Um **levantamento** é a execução real de um planejamento em uma data específica. Regra: apenas um levantamento por planejamento por dia. O levantamento agrega todos os **itens de levantamento** — cada suspeita, foco ou evidência encontrada naquele dia.

### 2. Focos de Risco — a entidade central do sistema

Introduzida na versão 2.1.0 (julho de 2026), a entidade `focos_risco` é o **aggregate root** do ciclo operacional. Ela representa o ciclo de vida completo de cada suspeita de foco de dengue, independentemente de onde essa suspeita veio.

**Cinco origens possíveis:**
- `drone` — detectado por análise YOLO de imagem aérea
- `agente` — encontrado em vistoria domiciliar
- `cidadao` — denúncia via canal público
- `pluvio` — risco calculado por análise pluviométrica
- `manual` — criado diretamente por gestor

**Sete estados no ciclo de vida:**
```
suspeita → em_triagem → aguarda_inspecao → confirmado → em_tratamento → resolvido
                                                                       → descartado
```

Cada transição de estado é registrada em `foco_risco_historico` — um ledger imutável para auditoria completa.

> **Nota arquitetural:** Em versões anteriores ao 2.1.0, o ciclo de vida era controlado por colunas em `levantamento_itens` (`status_atendimento`, `acao_aplicada`, `data_resolucao` etc.). Essas colunas foram **removidas do banco de dados** na migration `20260711000000` e migradas para `focos_risco`. O frontend ainda exibe esses campos, mas eles são reconstruídos a partir de `focos_risco` pela camada de serviço — não existem mais como colunas no banco.

### 3. SLA Operacional

Cada foco confirmado ganha um prazo máximo de atendimento. O SLA é calculado automaticamente por trigger no banco, considerando:

| Prioridade | Prazo base |
|------------|-----------|
| Crítica / Urgente | 4 horas |
| Alta | 12 horas |
| Moderada / Média | 24 horas |
| Baixa / Monitoramento | 72 horas |

Fatores de redução automática:
- −30% se risco climático "Muito Alto"
- −20% se persistência de chuva > 3 dias
- −10% se temperatura média > 30°C
- Mínimo absoluto: 2 horas

Se um foco não for atendido no prazo, o SLA é violado. O sistema registra a violação, notifica via Web Push, e o foco pode ser escalado com novo prazo recalculado.

### 4. Vistoria Domiciliar

Agentes de campo visitam imóveis cadastrados um a um. O formulário tem 5 etapas sequenciais:

1. **Responsável** — checkin GPS, contagem de moradores, grupos vulneráveis
2. **Sintomas** — febre, manchas, articulações; se há moradores afetados, um caso suspeito é criado automaticamente por trigger
3. **Inspeção** — depósitos PNCD A1–E: quantos inspecionados, quantos com foco
4. **Tratamento** — focos eliminados, larvicida aplicado (quantidade em gramas)
5. **Riscos** — riscos sociais, sanitários e vetoriais identificados

Se o imóvel estiver fechado ou o morador negar acesso, o agente registra o motivo (fechado, viagem, recusa, cachorro agressivo, calha inacessível). Após **3 tentativas sem acesso**, um trigger eleva automaticamente a prioridade de drone para aquele imóvel.

### 5. Risco Pluviométrico

O sistema analisa dados de chuva por bairro diariamente (Edge Function `pluvio-risco-daily`). A janela de maior risco para proliferação do mosquito é **3 a 6 dias após chuva intensa** — quando larvas estão em desenvolvimento ativo mas ainda não viraram mosquitos adultos. Durante essa janela, o sistema:
- Exibe alerta no widget do dashboard
- Eleva SLAs preventivos
- Sugere criação de planejamentos de campo

### 6. Centro de Notificações de Casos

UBS, UPAs e hospitais registram casos de dengue, chikungunya, zika e suspeitos. O sistema:
- Cruza cada caso com focos próximos (raio de 300m) via trigger PostGIS
- Eleva a prioridade dos focos cruzados para "Crítico"
- Exibe banner no painel do operador quando há casos próximos ao foco que está atendendo

Restrição LGPD: o sistema não armazena nome, CPF, data de nascimento ou qualquer identificador direto do paciente — apenas endereço e bairro de residência.

### 7. Canal Cidadão

Qualquer cidadão pode denunciar um foco suspeito via QR code impresso nos postos da prefeitura, sem criar conta. A denúncia é recebida como um `foco_risco` com origem `cidadao` e aparece no painel dos gestores para triagem.

### 8. Triagem IA pós-voo

Após um voo de drone, a Edge Function `triagem-ia-pos-voo` analisa automaticamente os itens detectados:
1. Agrupa focos por grade geográfica (0.001° ≈ 100m)
2. Filtra falsos positivos (score YOLO < limiar configurado)
3. Chama Claude Haiku para gerar sumário executivo em linguagem natural
4. Persiste o sumário em `levantamento_analise_ia` para o gestor consultar

### 9. Análise e Relatórios

- **Heatmap temporal animado** — slider semana a semana com Play/Pause, filtro por risco e tipo
- **Mapa comparativo** — comparar dois levantamentos lado a lado ou com divisão de tela
- **Painel de municípios** — ranking de desempenho entre prefeituras (apenas Admin da plataforma)
- **Score de surto por bairro** — identifica clusters de ≥3 casos em um bairro e sugere criação de planejamento
- **Relatório semanal automático** — enviado por email toda segunda-feira às 8h via Edge Function + Resend API

---

## Diferenciais técnicos do produto

### Offline-first real
Operadores e agentes trabalham frequentemente em áreas com sinal precário. O Sentinella usa IndexedDB para enfileirar operações pendentes e sincroniza automaticamente ao reconectar, exibindo um banner com o número de operações pendentes.

### SLA como guardiã operacional
O SLA não é apenas um indicador — é um mecanismo de alerta. Focos críticos não atendidos geram notificações push via Web Push (mesmo com o app fechado), escalam automaticamente e aparecem em destaque no painel.

### Pipeline de IA integrado
O Sentinella usa dois modelos de IA em pontos específicos do fluxo:
- **YOLO** (pipeline Python externo) para detectar focos em imagens de drone
- **Claude Haiku** (Edge Function) para interpretar clusters de focos e gerar sumários em linguagem natural

### Multitenancy com isolamento real no banco
Cada prefeitura é completamente isolada das outras, não apenas em aplicação, mas no próprio banco de dados via RLS. Uma prefeitura não consegue ver dados de outra mesmo que ocorra um bug no frontend.

---

## Limitações conhecidas (julho de 2026)

- Web Push não tem suporte no iOS Safari (limitação da plataforma Apple)
- Pipeline Python do drone não tem status de processamento visível no painel
- `api.ts` tem 2.831 linhas sem divisão por domínio (cresceu organicamente)
- Sem suíte de testes automatizados

---

*Documento baseado no código-fonte real. Versão 2.1.0 do sistema, análise em 2026-03-26.*
