# 14 — Glossário do Sentinella Web

> **Para quem é este documento:** qualquer pessoa que encontre um termo desconhecido no código, na documentação ou em uma conversa sobre o sistema. Cada entrada explica o termo como ele existe no sistema real — não como conceito genérico.

---

## Termos do domínio de negócio

---

### Agente de Controle de Endemias
Profissional de saúde pública que visita imóveis domiciliar por domiciliar para inspecionar depósitos de água, aplicar larvicida e registrar riscos. No sistema, acessa o portal do Agente (`/agente/*`). Diferente do Operador: o agente faz vistoria domiciliar estruturada (formulário PNCD 5 etapas); o operador atende focos de levantamento identificados por drone ou manual.

---

### Aggregate Root
Termo de Domain-Driven Design. No Sentinella, `focos_risco` é o aggregate root do ciclo operacional a partir da versão 2.1.0 (julho de 2026). Isso significa que toda operação de atendimento (quem assumiu, quando foi resolvido, que ação foi aplicada) passa por `focos_risco` — não mais por `levantamento_itens`, que agora é imutável.

---

### Atendimento
O processo pelo qual um operador assume um foco de risco, vai ao campo, trata o problema e o marca como resolvido. Gera histórico imutável em `foco_risco_historico`.

---

### Bairro
Subdivisão geográfica de uma região, dentro do território de um cliente (prefeitura). Usado para organizar planejamentos, filtrar dados e calcular risco por área.

---

### Canal Cidadão
Funcionalidade que permite ao cidadão comum reportar suspeitas de foco de dengue via QR code impresso pela prefeitura, sem necessidade de login. Acessível em `/denuncia/:slug/:bairroId`. A denúncia vira um `foco_risco` com origem `cidadao`.

---

### Caso Notificado
Registro de caso de dengue, chikungunya, zika ou suspeito, informado por uma unidade de saúde (UBS, UPA, hospital). Não contém dados pessoais identificáveis (LGPD — sem nome, CPF, data de nascimento). Ao ser inserido, o trigger `trg_cruzar_caso_focos` cruza automaticamente com focos próximos em raio de 300m.

---

### Ciclo Epidemiológico
Período bimestral de trabalho dos agentes de controle de endemias. O ano é dividido em 6 ciclos: ciclo 1 = jan/fev, ciclo 2 = mar/abr, …, ciclo 6 = nov/dez. Calculado como `Math.ceil((mes + 1) / 2)`. Campo `ciclo` na tabela `vistorias`.

---

### Classificação de Risco
Atribuição de um nível de gravidade a um foco ou área. Valores usados no sistema: `alto`, `médio`, `baixo`. No contexto pluviométrico, inclui também `Muito Alto`. Afeta o cálculo de SLA (Muito Alto reduz o prazo em −30%).

---

### Cliente
Uma prefeitura municipal que contratou o Sentinella. Raiz de isolamento de dados no sistema (multitenancy). Todos os dados estão vinculados a um `cliente_id`. O termo "cliente" no código sempre significa prefeitura — nunca usuário final.

---

### CNES
Cadastro Nacional de Estabelecimentos de Saúde. Sistema federal que lista todas as unidades de saúde do Brasil. O Sentinella sincroniza dados do CNES diariamente (Edge Function `cnes-sync`, cron 3h UTC) para manter o cadastro de unidades de saúde atualizado. Requer `uf` e `ibge_municipio` configurados no cliente.

---

### Cruzamento Caso↔Foco
Processo automático (trigger `trg_cruzar_caso_focos` no banco) que vincula casos notificados com focos próximos (raio de 300m) usando PostGIS. Eleva a prioridade do foco para Crítico quando há casos próximos. O resultado é registrado em `caso_foco_cruzamento`. Nunca deve ser replicado no frontend — é responsabilidade exclusiva do trigger.

---

### Depósito PNCD
Tipo de depósito de água classificado pelo Programa Nacional de Controle da Dengue. Tipos inspecionados pelos agentes:
- **A1** — Caixas d'água elevadas ou enterradas, com ou sem tampa
- **A2** — Outros armazenamentos domésticos (tonéis, barris, cisternas)
- **B** — Pequenos depósitos móveis (vasos, pratos, bebedouros)
- **C** — Depósitos fixos grandes (calhas, lajes, piscinas)
- **D1** — Pneus e materiais rodantes
- **D2** — Lixo acumulado
- **E** — Depósitos naturais (ocos de árvore, bromélias, pedras)

---

### Drone
Veículo aéreo não tripulado (VANT) usado para sobrevoo de regiões e captura de imagens. O processamento das imagens é feito por pipeline Python externo (não está neste repositório). O pipeline usa YOLO para detectar focos e insere os resultados no banco via RPC.

---

### e-SUS Notifica
Sistema federal de notificação de doenças do Ministério da Saúde. O Sentinella possui integração para enviar casos confirmados diretamente, evitando duplicação de trabalho. Configurável por prefeitura com suporte a ambiente de homologação e produção.

---

### Escalamento
Ação administrativa de elevar um SLA vencido ou em risco, recalculando novo prazo. Preserva a prioridade original para auditoria. Registrado no histórico do SLA.

---

### Evidência
Registro fotográfico, dado GPS ou observação que comprova a identificação ou resolução de um foco. Imagens armazenadas no Cloudinary com vínculo rastreável no banco (levantamento_item_id ou foco_risco_id).

---

### ExifTool
Software open-source para leitura e escrita de metadados em arquivos. Usado no pipeline Python externo para extrair coordenadas GPS das imagens capturadas pelo drone.

---

### Falso Positivo
Item detectado pelo YOLO que não corresponde a um foco real. O operador pode marcar como falso positivo no painel de detalhes. Os feedbacks são armazenados em `yolo_feedback` e podem ser usados para re-treino do modelo.

---

### Foco de Dengue
Qualquer local com água parada ou condições favoráveis à reprodução do mosquito *Aedes aegypti*. Pode ser identificado por drone, vistoria domiciliar, análise pluviométrica ou denúncia de cidadão.

---

### Foco de Risco (`focos_risco`)
A entidade central do sistema a partir da versão 2.1.0. Representa o ciclo de vida operacional completo de cada foco identificado. Tem 7 estados possíveis (`suspeita → em_triagem → aguarda_inspecao → confirmado → em_tratamento → resolvido / descartado`) e 5 origens possíveis (`drone`, `agente`, `cidadao`, `pluvio`, `manual`). Toda transição de estado é registrada em `foco_risco_historico`.

> **Atenção para devs:** as colunas `status_atendimento`, `acao_aplicada`, `data_resolucao`, `checkin_em` e similares foram **removidas de `levantamento_itens`** na migration `20260711000000`. No código TypeScript, esses campos existem na interface `LevantamentoItem` marcados como `@virtual` — são preenchidos pela função `enrichItensComFoco()` em `api.ts` a partir de `focos_risco`, não vêm do banco.

---

### GPS Checkin
Registro automático de localização GPS do agente ou operador no momento em que inicia o atendimento de um imóvel ou foco. Usado para auditoria de campo e confirmação de presença no local.

---

### Haversine
Fórmula matemática para calcular a distância entre dois pontos geográficos na superfície da Terra. Usada em algumas funções legadas do sistema. A partir da migration `20260710000000` (focos_risco), os cruzamentos geoespaciais principais usam PostGIS com índice GIST, que é mais performático.

---

### Heatmap
Mapa de calor que exibe a densidade de focos por área geográfica. O Sentinella tem heatmap estático e heatmap temporal animado (`AdminHeatmapTemporal.tsx`) com slider semana a semana e botão Play/Pause.

---

### Imóvel
Edificação ou terreno cadastrado no sistema, visitável pelos agentes. Tipos: `residencial`, `comercial`, `terreno`, `ponto_estrategico`. Possui histórico de vistorias, perfil de acesso (prioridade de drone, histórico de tentativas sem acesso, presença de calha).

---

### Item de Levantamento (`levantamento_itens`)
Registro individual de um foco ou evidência encontrada dentro de um levantamento. **Imutável após criado** — representa o que foi encontrado, não o que foi feito. O que é feito sobre o foco está em `focos_risco`. Cada item tem um `foco_risco_id` que vincula ao foco correspondente.

---

### Janela Pós-Chuva
Período de 3 a 6 dias após chuva intensa, quando larvas estão em desenvolvimento ativo. É a janela de maior risco operacional para proliferação do *Aedes aegypti*. O sistema exibe alerta no widget pluviométrico durante essa janela e sugere criação de planejamentos.

---

### Larvicida
Produto químico aplicado em depósitos de água para eliminar larvas do mosquito. Registrado nas vistorias de campo: tipo de larvicida e quantidade em gramas por depósito.

---

### Levantamento
Agrupador de itens de uma operação em uma data específica. Ligado a um planejamento. Regra de negócio: apenas um levantamento por planejamento por dia. Tipos: `DRONE` ou `MANUAL`.

---

### LGPD
Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018). O Sentinella respeita a LGPD não armazenando dados pessoais identificáveis de pacientes em `casos_notificados` — sem nome, CPF, data de nascimento ou qualquer identificador direto. Apenas endereço e bairro de residência são armazenados para o cruzamento geoespacial.

---

### LIRAa
Levantamento de Índice Rápido para *Aedes aegypti*. Metodologia oficial do Ministério da Saúde para estimar infestação por bairro e quarteirão. O Sentinella possui módulo específico para LIRAa com distribuição por quarteirão.

---

### Multitenancy
Modelo de software onde múltiplos clientes (prefeituras) compartilham a mesma infraestrutura com isolamento completo de dados. Implementado via `cliente_id` em todas as tabelas + RLS no PostgreSQL. Uma prefeitura jamais acessa dados de outra.

---

### Notificador
Profissional de UBS ou hospital que registra casos de dengue no sistema. Acessa o portal do Notificador (`/notificador/*`). Não é o mesmo que "notificação push" (Web Push).

---

### Operador
Usuário responsável por atender focos de risco em campo. Acessa o portal do Operador (`/operador/*`). Vê apenas os focos e SLAs atribuídos a ele. Tem suporte offline para trabalho sem conexão.

---

### Persistência Pluviométrica
Quantidade de dias consecutivos com chuva relevante. Um dos fatores de redução do prazo de SLA. Se persistência > 3 dias, aplica redutor de −20% no prazo de atendimento.

---

### Pipeline de Drone
Módulo externo em Python (não neste repositório) que realiza: captura de imagens pelo drone → extração de coordenadas GPS (ExifTool) → análise de detecção de focos (YOLO) → upload de imagens (Cloudinary) → inserção de resultados no banco via RPC Supabase.

---

### Planejamento
Define ONDE e COMO será feita a operação: qual região/bairro, qual tipo (drone ou manual), qual data. Um planejamento pode gerar múltiplos levantamentos ao longo do tempo (um por dia de operação).

---

### Plano de Ação
Conjunto de ações corretivas tomadas pelo operador após identificar e confirmar um foco. Pode ser selecionado do catálogo padronizado (`plano_acao_catalogo`) ou descrito livremente.

---

### Prioridade
Nível de urgência de um foco de risco ou SLA. Em `focos_risco`: P1 (crítica) a P5 (monitoramento). Em `sla_operacional`: `Crítica`, `Urgente`, `Alta`, `Moderada`, `Baixa`, `Monitoramento`. Afeta o prazo de SLA e a ordem de exibição no painel do operador.

---

### PWA (Progressive Web App)
Tecnologia que permite ao Sentinella ser instalado como aplicativo no celular (Android e iOS) e funcionar offline. Implementado com Workbox (Service Worker). **Limitação:** notificações Web Push não funcionam no iOS Safari.

---

### Quarteirão
Divisão urbana usada nos levantamentos LIRAa. O sistema tem módulo de distribuição por quarteirão.

---

### Região
Estrutura geográfica cadastrada pelo cliente para organizar planejamentos. Uma região pertence a um cliente e pode ter configuração de SLA diferenciada. Contém bairros.

---

### RLS (Row Level Security)
Funcionalidade do PostgreSQL que restringe quais linhas cada usuário pode ver ou modificar, com base em políticas definidas por tabela. No Sentinella, é a última linha de defesa do multitenancy: mesmo que o frontend cometa um erro e esqueça de filtrar por `cliente_id`, o banco rejeita o acesso a dados de outros clientes.

---

### RPC (Remote Procedure Call)
Função PL/pgSQL no Supabase chamada via `supabase.rpc('nome_da_funcao', params)`. Usada para operações complexas que precisam de validações de segurança, acesso a múltiplas tabelas ou lógica que não pode ser replicada no frontend.

---

### Score YOLO
Pontuação de confiança da detecção feita pelo modelo YOLO. Pode vir do pipeline em escala `0–1` ou `0–100` — o frontend sempre normaliza para `0–1` antes de exibir. Faixas: ≥0.85 muito alta / ≥0.65 alta / ≥0.45 média / <0.45 baixa. Itens com `tipo_entrada = 'MANUAL'` não têm score — exibir "Entrada manual".

---

### SLA (Service Level Agreement)
Prazo máximo para atendimento de um foco confirmado. Calculado automaticamente por trigger no banco ao confirmar um foco, levando em conta prioridade, risco climático, feriados e configuração do cliente. Mínimo absoluto: 2 horas. Se vencido, o sistema registra a violação e pode enviar notificação push.

---

### Slug
Identificador amigável e legível em URL para um cliente. Usado no canal cidadão (`/denuncia/:slug/:bairroId`) para identificar a prefeitura sem expor o `cliente_id` interno (UUID).

---

### Supervisor
Papel administrativo de um cliente específico. Equivale ao admin dentro do escopo daquela prefeitura — gerencia usuários, configurações, planejamentos e SLA. Não tem acesso a dados de outras prefeituras.

---

### Triagem IA Pós-Voo
Análise automática dos itens de um levantamento de drone via Edge Function `triagem-ia-pos-voo`. Usa clustering geográfico por grade de 0.001° + Claude Haiku para gerar sumário executivo em linguagem natural. O resultado é armazenado em `levantamento_analise_ia`.

---

### Unidade de Saúde
UBS (Unidade Básica de Saúde), UPA (Unidade de Pronto Atendimento) ou hospital cadastrado no sistema. Local onde casos de dengue são notificados. Dados sincronizados com o CNES. Unidades com `origem='manual'` e sem CNES nunca são inativadas pela sincronização automática.

---

### Vistoria
Visita de um agente a um imóvel. Registra: acesso (ou não), moradores, sintomas, depósitos inspecionados por tipo PNCD, larvicida aplicado, riscos identificados. Pode ser salva offline e sincronizada ao reconectar.

---

### YOLO ("You Only Look Once")
Modelo de visão computacional para detecção de objetos em imagens em tempo real. No Sentinella, usado no pipeline externo Python para identificar possíveis focos de dengue nas imagens capturadas pelo drone.

---

## Termos técnicos

| Termo | Definição no contexto do Sentinella |
|-------|-------------------------------------|
| **Edge Function** | Função serverless em Deno rodando no Supabase. São 12 funções no sistema. |
| **enrichItensComFoco()** | Função em `api.ts` que reconstrói campos virtuais de `LevantamentoItem` a partir de `focos_risco`. |
| **GC (gcTime)** | Tempo que o React Query mantém dados inativos em cache antes de descartar. Configurado em `queryConfig.ts`. |
| **Haversine** | Fórmula de distância geográfica — usada em queries legadas. Substituída por PostGIS nos cruzamentos principais. |
| **IndexedDB** | Banco de dados no navegador, usado para a fila de operações offline (`offlineQueue.ts`). |
| **JWT** | JSON Web Token — formato do token de autenticação emitido pelo Supabase Auth. |
| **PostGIS** | Extensão PostgreSQL para dados geoespaciais com índices GIST. Confirmado ativo a partir de `20260710000000`. |
| **React Query** | Biblioteca para cache e sincronização de estado do servidor. Versão 5 (TanStack). |
| **STALE** | Constantes de tempo de validade de cache em `queryConfig.ts`. Sempre usar a constante — nunca número literal. |
| **Supabase** | Plataforma Backend-as-a-Service sobre PostgreSQL. Provê auth, banco, storage, Edge Functions, realtime. |
| **Trigger** | Função PL/pgSQL executada automaticamente pelo banco em resposta a INSERT/UPDATE/DELETE. Lógica crítica vive aqui. |
| **Virtual field** | Campo que existe na interface TypeScript mas não no banco de dados. Reconstruído em `api.ts` a partir de outra tabela. |
| **Web Push** | Notificações push via navegador, mesmo sem o app aberto. Não funciona no iOS Safari. |
| **Workbox** | Biblioteca Google para criação de Service Workers. Usada para cache offline do Sentinella. |

---

## Siglas

| Sigla | Significado |
|-------|-------------|
| CNES | Cadastro Nacional de Estabelecimentos de Saúde |
| DDD | Domain-Driven Design |
| IBGE | Instituto Brasileiro de Geografia e Estatística |
| LGPD | Lei Geral de Proteção de Dados Pessoais |
| LIRAa | Levantamento de Índice Rápido para *Aedes aegypti* |
| PNCD | Programa Nacional de Controle da Dengue |
| PWA | Progressive Web App |
| RBAC | Role-Based Access Control |
| RLS | Row Level Security |
| RPC | Remote Procedure Call |
| SaaS | Software as a Service |
| SINAN | Sistema de Informação de Agravos de Notificação |
| SLA | Service Level Agreement |
| UBS | Unidade Básica de Saúde |
| UPA | Unidade de Pronto Atendimento |
| UUID | Universally Unique Identifier (formato dos IDs no banco) |
| VANT | Veículo Aéreo Não Tripulado (drone) |
| YOLO | You Only Look Once (modelo de visão computacional) |

---

*Documento baseado no código-fonte real. Versão 2.1.0 do sistema, análise em 2026-03-26.*
