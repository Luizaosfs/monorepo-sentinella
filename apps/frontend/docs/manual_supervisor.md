# Manual do Supervisor — SENTINELLA
**Sistema de Gestão do Combate à Dengue**

> Versão 1.0 · Perfil: Supervisor Municipal

---

## 1. O que o supervisor acompanha no sistema

O supervisor tem uma visão completa de tudo que acontece no campo. No Sentinella, você consegue:

- Ver em tempo real onde estão os focos e quais foram tratados
- Acompanhar a produtividade de cada agente
- Controlar prazos de atendimento (SLA)
- Receber denúncias de cidadãos
- Gerar relatórios e exportar dados
- Cadastrar e gerenciar usuários
- Importar a lista de imóveis do município

O sistema funciona como um **painel de controle** da operação de campo.

---

## 2. Mapa de focos

O mapa mostra todos os focos identificados no município, organizados por prioridade e situação.

### Como acessar:
Menu lateral → **Mapa de Focos**

### O que você vê no mapa:

| Cor do ponto | Significado |
|-------------|-------------|
| 🔴 Vermelho | Foco confirmado, aguardando tratamento |
| 🟠 Laranja | Foco em atendimento |
| 🟡 Âmbar | Suspeita, aguardando inspeção |
| 🟢 Verde | Foco resolvido |
| 🔵 Azul | Denúncia de cidadão |

### Como usar:
- Clique em qualquer ponto para ver os detalhes do foco
- Use os filtros no lado esquerdo para visualizar por bairro, prioridade ou situação
- A camada de **heatmap** (mapa de calor) mostra as regiões com maior concentração de focos

### Mapa Comparativo:
Compare dois períodos lado a lado: Menu → **Mapa Comparativo**
Selecione dois levantamentos e veja como a situação evoluiu.

---

## 3. Produtividade dos agentes

Acompanhe o desempenho de cada agente em tempo real.

### Como acessar:
Menu lateral → **Produtividade dos Agentes**

### O que você encontra:

- Número de vistorias realizadas por agente no período
- Comparativo entre agentes (quem visitou mais imóveis)
- Taxa de imóveis com foco por agente
- Imóveis visitados vs. imóveis no roteiro

### Supervisor em Tempo Real:
Para ver quem está em campo agora: Menu → **Supervisor em Tempo Real**

Mostra os agentes com vistorias registradas hoje e o horário da última atividade.

---

## 4. Imóveis pendentes

Controle os imóveis que precisam de atenção especial.

### Imóveis com difícil acesso:
Menu lateral → **Imóveis Problemáticos**

Mostra imóveis com 3 ou mais tentativas sem acesso, organizados por criticidade:
- Quantas tentativas foram feitas
- Se o imóvel foi marcado para voo de drone
- Se há calha visível e inacessível

**Para marcar um imóvel para drone:** Clique no imóvel → Botão **"Marcar para drone"**

### Central Operacional:
Menu lateral → **Central Operacional**

Painel com os KPIs do dia:
- Focos pendentes de atendimento
- SLA próximo do vencimento
- Imóveis críticos no score de risco
- Vistorias realizadas hoje
- Agentes em campo

---

## 5. SLA (prazos de atendimento)

SLA é o prazo máximo para que um foco seja atendido após ser identificado. O sistema controla automaticamente.

### Como acessar:
Menu lateral → **SLA**

### Prazos de referência:

| Prioridade | Prazo máximo |
|------------|-------------|
| Crítico / Urgente | 4 horas |
| Alta | 12 horas |
| Moderada / Média | 24 horas |
| Baixa / Monitoramento | 72 horas |

> Focos próximos a casos notificados de dengue têm a prioridade elevada automaticamente.

### O que fazer quando um SLA vence:
1. Acesse o foco com SLA vencido
2. Verifique o motivo do atraso
3. Reatribua para um agente disponível ou acione supervisão superior
4. O sistema registra a escalada para auditoria

### Feriados:
Cadastre os feriados municipais para que o sistema desconte esses dias do cálculo de SLA:
Menu → **SLA e Feriados**

---

## 6. Canal cidadão

Cidadãos podem denunciar focos de mosquito diretamente pelo celular, acessando um link ou QR Code disponibilizado pela prefeitura.

### Como funciona:
1. O cidadão acessa a página de denúncia e preenche o endereço e tipo de problema
2. O sistema cria automaticamente um foco com origem "Cidadão"
3. Você recebe uma notificação (alerta no sistema e/ou push no celular)
4. O foco aparece em azul no mapa

### Como gerar o QR Code:
Menu lateral → **Canal Cidadão**
- Copie o link ou baixe o QR Code
- Distribua em panfletos, redes sociais e na sede da prefeitura

### Como acompanhar as denúncias:
Na mesma tela, você vê todas as denúncias recebidas com data, endereço e situação atual.

---

## 7. Relatórios

### Relatórios disponíveis:

| Relatório | Onde acessar | O que mostra |
|-----------|-------------|-------------|
| Central Operacional | Menu → Central Operacional | KPIs do dia |
| Produtividade | Menu → Produtividade Agentes | Vistorias por agente |
| LIRAa | Menu → LIRAa | Índice de infestação por quarteirão |
| Score de risco | Menu → Score de Surto | Risco por região |
| Eficácia de tratamentos | Menu → Eficácia de Tratamentos | Resultado do larvicida por tipo de depósito |
| Casos notificados | Menu → Casos Notificados | Casos de dengue registrados pelas unidades de saúde |

### Relatório semanal automático:
Todo início de semana, o sistema envia automaticamente um resumo por e-mail com os principais indicadores. Certifique-se de que seu e-mail está atualizado no cadastro.

---

## 8. Como gerar relatório em PDF

1. Acesse **Central Operacional** no menu lateral
2. No canto superior direito, clique em **"Relatório PDF"**
3. O arquivo será baixado automaticamente com:
   - Data do relatório
   - KPIs do município
   - Score médio de risco
   - Lista dos 20 imóveis mais críticos

> O PDF pode ser impresso ou enviado por e-mail para a secretaria de saúde.

---

## 9. Como cadastrar usuários

Você pode cadastrar agentes, notificadores e outros supervisores.

### Como acessar:
Menu lateral → **Usuários**

### Como cadastrar um novo usuário:

1. Clique em **"+ Novo usuário"**
2. Preencha: nome, e-mail e telefone
3. Selecione o **perfil de acesso**:

| Perfil | O que pode fazer |
|--------|----------------|
| **Agente** (operador) | Registrar vistorias em campo |
| **Notificador** | Registrar casos suspeitos de dengue na unidade de saúde |
| **Supervisor** | Gerenciar tudo, exceto configurações globais do sistema |

4. Clique em **Salvar**
5. O usuário receberá um e-mail com as instruções de acesso

### Regras importantes:
- Supervisores podem cadastrar agentes e notificadores, mas **não podem cadastrar outros supervisores** (isso é feito pelo administrador do sistema)
- Para desativar um usuário: clique no usuário → **"Desativar"**

---

## 10. Como importar imóveis

A importação permite carregar a base de imóveis do município em lote, a partir de uma planilha.

### Como acessar:
Menu lateral → **Importar Imóveis (CSV/XLSX)**

### Passo a passo:

**1. Baixe o modelo:**
Clique em **"Baixar modelo CSV"** ou **"Baixar modelo XLSX"** e preencha com os dados dos imóveis.

**Colunas obrigatórias:**
- `logradouro` — nome da rua
- `numero` — número do imóvel
- `bairro` — bairro

**Colunas opcionais:**
- `tipo_imovel` — residencial, comercial, terreno ou ponto_estrategico (padrão: residencial)
- `complemento`, `quarteirao`, `cidade`, `uf`
- `latitude` e `longitude` — se não informadas, o sistema busca automaticamente (máximo 300 imóveis por importação)

**2. Faça o upload:**
Arraste o arquivo ou clique em "Selecionar arquivo". Arquivos CSV e XLSX são aceitos.

**3. Revise o preview:**
O sistema mostra os primeiros registros. Verifique se as colunas foram reconhecidas corretamente.

**4. Clique em Importar:**
Acompanhe o progresso. Ao final, você verá o relatório com:
- Total de imóveis importados com sucesso
- Duplicados ignorados (já existiam na base)
- Geocodificados automaticamente
- Erros por linha

**5. Baixe o relatório de erros:**
Se houver erros, clique em **"Baixar relatório CSV"** para ver linha por linha o que falhou.

### Dicas:
- Imóveis duplicados (mesma rua + número + bairro) são ignorados automaticamente
- Para importações com mais de 300 imóveis sem coordenadas, inclua latitude e longitude na planilha — isso acelera muito o processo

---

## 11. Como acompanhar notificações de casos de dengue

O sistema integra os casos registrados pelas unidades de saúde com os focos identificados em campo.

### Como acessar:
Menu lateral → **Casos Notificados**

### O que você vê:
- Todos os casos registrados pelos notificadores das unidades de saúde
- Situação de cada caso (suspeito, confirmado, descartado)
- Quando um caso está próximo de um foco conhecido (raio de 300m), os dois aparecem vinculados

### Quando há cluster de casos:
Se 3 ou mais casos forem notificados no mesmo bairro, aparece um botão **"Criar planejamento"** — use para acionar a equipe de campo na área.

### Casos com foco próximo:
Focos que têm casos de dengue confirmados nas proximidades aparecem com prioridade **Crítica** automaticamente.

---

## 12. Rotina semanal do gestor

Use esta rotina como referência para manter a operação organizada:

### Segunda-feira (início da semana)
- [ ] Verificar relatório semanal automático recebido por e-mail
- [ ] Conferir SLAs vencidos e redistribuir se necessário
- [ ] Verificar imóveis com 3+ tentativas sem acesso e acionar drone se necessário

### Durante a semana (diário)
- [ ] Conferir **Central Operacional** no início do dia — focos críticos sem agente
- [ ] Acompanhar notificações do **Canal Cidadão** — novas denúncias recebidas
- [ ] Monitorar agentes em campo via **Supervisor em Tempo Real**

### Sexta-feira (fechamento da semana)
- [ ] Gerar **Relatório PDF** e enviar para a secretaria
- [ ] Verificar cobertura de visitas da semana por bairro
- [ ] Atualizar a base de imóveis se houver novos cadastros
- [ ] Revisar score de risco por região — planejar próximas ações

### Mensal
- [ ] Calcular e registrar o **LIRAa** do ciclo
- [ ] Verificar produtividade dos agentes no mês
- [ ] Conferir eficácia dos tratamentos aplicados
- [ ] Atualizar cadastro de feriados para o mês seguinte

---

*Manual do Supervisor · Sistema Sentinella · Para uso em treinamentos de prefeitura*
