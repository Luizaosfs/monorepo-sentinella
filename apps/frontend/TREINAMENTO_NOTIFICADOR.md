# GUIA DE TREINAMENTO — NOTIFICADOR (UNIDADE DE SAÚDE)
**Sistema:** Sentinella
**Perfil:** Notificador — funcionário de UBS, UPA ou Hospital
**Duração:** 1 hora
**Formato:** Individual ou grupos de até 3

---

## OBJETIVO DO TREINAMENTO

Ao fim deste treinamento, o notificador deve ser capaz de:
- Registrar um caso suspeito ou confirmado de dengue, chikungunya ou zika
- Geocodificar o endereço do paciente corretamente
- Confirmar ou descartar casos registrados
- Entender o cruzamento automático com focos de campo

---

## ATENÇÃO — REGRA LGPD

> **O sistema Sentinella NÃO armazena dados pessoais identificáveis do paciente.**
> Não preencher: nome, CPF, data de nascimento, número de prontuário.
> O registro é feito com endereço de residência e sintomas apenas.
> Isso está em conformidade com a LGPD (Lei 13.709/2018).

---

## MÓDULO 1 — ACESSO (10 min)

### Login
1. Abrir o navegador (Chrome ou Firefox)
2. Acessar o endereço do sistema
3. Inserir e-mail e senha fornecidos pelo supervisor municipal
4. Tocar em "Entrar"

**Papel:** O notificador é redirecionado automaticamente para `/notificador/registrar`.

**Restrição:** O notificador não tem acesso à lista de focos de campo, ao mapa de agentes nem aos dados administrativos do município. Apenas ao registro e à lista de casos.

---

## MÓDULO 2 — REGISTRAR UM CASO (30 min)

Rota: `/notificador/registrar`

### 2.1 Abrindo o formulário
O formulário já está disponível ao entrar. Não precisa clicar em nenhum botão adicional.

### 2.2 Campos do formulário

#### Doença
Selecionar uma opção:
- Dengue
- Chikungunya
- Zika
- Suspeito (não confirmado em laboratório)

**Dica:** Se o médico ainda não confirmou a doença, usar "Suspeito".

#### Status do caso
- **Suspeito** — paciente com sintomas compatíveis, aguardando confirmação
- **Confirmado** — diagnóstico confirmado em laboratório ou por critério clínico-epidemiológico

#### Unidade de saúde
Selecionar a unidade onde o caso foi atendido (pré-configurada pelo município).

#### Endereço de residência do paciente
Este campo busca o endereço e converte automaticamente em coordenadas GPS (geocodificação).

**Como preencher:**
1. Digitar o logradouro e número
2. Aguardar as sugestões de endereço aparecerem
3. Selecionar o endereço correto na lista
4. As coordenadas são preenchidas automaticamente

**Se o endereço não aparecer:**
- Tentar variações (ex.: "Rua" → "R.", "Avenida" → "Av.")
- Selecionar o endereço mais próximo e adicionar observação com o endereço exato

#### Data de início dos sintomas
Data em que os sintomas começaram (não a data da consulta).

#### Observações (opcional)
Campo livre para informações adicionais relevantes para os agentes de campo.

### 2.3 Salvando o caso
Clicar em "Registrar Caso".
O sistema confirma o registro com uma mensagem de sucesso.

### 2.4 O que acontece depois (automático)
O sistema verifica automaticamente se há algum foco de risco identificado pelos agentes de campo em um raio de **300 metros** do endereço do caso.
- Se encontrar: o foco é elevado para prioridade P1 (Crítico)
- O supervisor municipal é alertado automaticamente
- O notificador não precisa fazer nada adicional

---

## MÓDULO 3 — LISTA DE CASOS (15 min)

Rota: `/notificador` (menu principal)

### 3.1 Lendo a lista
A lista exibe todos os casos registrados pela unidade de saúde.

Colunas:
- **Doença** — dengue, chikungunya, zika ou suspeito
- **Status** — suspeito, confirmado ou descartado
- **Endereço** — bairro do paciente
- **Data** — data de notificação
- **Cruzamento** — indica se há foco de campo próximo

### 3.2 Filtros disponíveis
- Por status (suspeito / confirmado / descartado)
- Por doença
- Por período (esta semana, este mês)

### 3.3 Confirmar ou descartar um caso
Para atualizar o status de um caso:
1. Clicar no caso desejado
2. Clicar em "Confirmar" ou "Descartar"
3. O status é atualizado imediatamente

**Quando confirmar:** Resultado laboratorial positivo chegou.
**Quando descartar:** Diagnóstico diferencial afastou dengue/chikungunya/zika.

---

## MÓDULO 4 — CRUZAMENTO COM FOCOS DE CAMPO (5 min)

### O que é o cruzamento
Quando um caso é registrado, o sistema verifica automaticamente se há focos de mosquito Aedes aegypti identificados pelos agentes de campo a até 300 metros do endereço do paciente.

### Por que isso é importante
- O cruzamento indica que pode haver foco de criação próximo à residência do paciente
- O supervisor de campo é alertado para priorizar aquele foco
- Ajuda a controlar o surto na origem

### O que o notificador vê
Na lista de casos, casos com cruzamento identificado exibem um badge colorido "Foco próximo".
Clicar no caso mostra a distância aproximada do foco mais próximo.

### O que o notificador NÃO precisa fazer
O cruzamento é automático. O notificador não precisa avisar manualmente os agentes de campo.

---

## DÚVIDAS FREQUENTES

**P: Posso registrar o nome do paciente no campo "observações"?**
R: Não. O sistema é projetado para não armazenar dados pessoais do paciente (LGPD). Não registrar nome, CPF ou qualquer identificador pessoal.

**P: O endereço do paciente não aparece na busca. O que fazer?**
R: Tentar variações do nome da rua. Se não funcionar, selecionar o endereço do bairro mais próximo e descrever o endereço exato no campo "observações".

**P: Registrei o caso errado. Como desfaço?**
R: Abrir o caso e clicar em "Descartar". O registro é mantido para fins de auditoria, mas fica com status "descartado".

**P: O sistema confirmou o registro mas não aparece na lista.**
R: Recarregar a página. Se persistir, contatar o supervisor municipal.

**P: Preciso registrar casos de outras doenças (leptospirose, etc.)?**
R: O sistema atual suporta apenas dengue, chikungunya e zika. Para outras doenças, usar os sistemas convencionais de notificação.

---

## AVALIAÇÃO DO TREINAMENTO

| Habilidade | Demonstrado? |
|---|---|
| Login realizado com sucesso | [ ] Sim [ ] Não |
| Caso suspeito registrado com endereço geocodificado | [ ] Sim [ ] Não |
| Caso confirmado a partir de suspeito | [ ] Sim [ ] Não |
| Lista de casos acessada com filtros | [ ] Sim [ ] Não |
| Entendimento do cruzamento automático com focos | [ ] Sim [ ] Não |

**Data do treinamento:** ___________
**Instrutor:** ___________
**Notificador treinado:** ___________
**Unidade de saúde:** ___________
**Resultado:** [ ] Aprovado [ ] Requer reforço
