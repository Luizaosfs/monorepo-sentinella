# Manual do Notificador — SENTINELLA
**Registro de Casos · Unidade de Saúde**

> Versão 1.0 · Para dúvidas, fale com o supervisor da prefeitura.

---

## 1. O que é o módulo de notificação

O módulo de notificação do Sentinella é usado pelos profissionais de saúde das unidades de atendimento (UBS, UPA, hospitais) para registrar casos suspeitos ou confirmados de dengue, chikungunya e zika.

**Por que registrar no Sentinella?**

Quando você registra um caso no sistema, ele é cruzado automaticamente com os focos de mosquito identificados pelas equipes de campo. Se houver um foco a menos de 300 metros do endereço do paciente, o sistema eleva a prioridade daquele foco e aciona a equipe de campo para tratamento urgente.

Isso acelera a resposta da prefeitura e ajuda a evitar novos casos.

**Este módulo não substitui a notificação obrigatória ao SINAN** — ele complementa a gestão operacional local.

---

## 2. Como registrar um caso suspeito

### Como acessar:
Faça login no Sentinella e acesse o menu: **Notificador → Registrar Caso**

### Passo a passo:

**Passo 1 — Selecione a doença suspeita:**
- Dengue
- Chikungunya
- Zika
- Suspeito (quando ainda não foi definida)

**Passo 2 — Informe a situação do caso:**
- Suspeito — ainda não confirmado
- Confirmado — resultado positivo
- Descartado — resultado negativo

**Passo 3 — Data de início dos sintomas:**
Informe a data em que o paciente começou a ter sintomas. Se não souber, registre a data de hoje.

**Passo 4 — Endereço de residência do paciente:**
Digite o endereço onde o paciente mora (rua, número, bairro).

O sistema tentará localizar automaticamente o endereço no mapa. Se localizar, um ponto azul aparecerá no mapa ao lado do formulário. Se não localizar:
- Verifique se o endereço está escrito corretamente
- Tente usar apenas rua e número sem complemento
- Se ainda assim não localizar, o caso será registrado sem coordenadas (ainda assim válido)

> **Atenção — LGPD:** Não registre nome, CPF, data de nascimento ou qualquer dado que identifique o paciente. O sistema armazena apenas o endereço de residência e o bairro.

**Passo 5 — Observações (opcional):**
Adicione informações relevantes para a equipe de campo, como: "paciente mora em residência com piscina" ou "vizinhança com muito lixo acumulado".

**Passo 6 — Salvar:**
Clique em **Registrar caso**. Você verá a mensagem de confirmação com o número de identificação do registro.

---

## 3. Como localizar o endereço

O Sentinella busca o endereço automaticamente no mapa assim que você digita.

### Dicas para o endereço ser encontrado corretamente:

| Situação | O que fazer |
|----------|------------|
| Endereço não encontrado | Verifique erros de digitação (ex: "Rua das Flores" em vez de "R. das Flores") |
| Bairro não reconhecido | Tente usar apenas a rua e o número |
| Endereço genérico (ex: "Sítio") | Registre o bairro mais próximo e descreva nas observações |
| Zona rural | Registre o bairro ou distrito e descreva a localização nas observações |

Mesmo que o endereço não seja encontrado no mapa, o caso ainda será registrado normalmente. A equipe de campo usará o endereço textual para localizar o imóvel.

---

## 4. Como acompanhar casos registrados

Para ver todos os casos já registrados pela sua unidade:

Menu → **Notificador → Meus Casos** (ou acesse pelo painel do supervisor se tiver esse acesso)

### O que você vê na lista:

| Coluna | Significado |
|--------|-------------|
| **Data** | Quando o caso foi registrado |
| **Doença** | Dengue, chikungunya, zika ou suspeito |
| **Situação** | Suspeito / Confirmado / Descartado |
| **Endereço** | Bairro de residência |
| **Foco próximo** | Se há foco identificado no raio de 300m |

### Como atualizar a situação de um caso:

Se um caso suspeito for confirmado ou descartado após exames:
1. Encontre o caso na lista
2. Clique em **"Atualizar situação"**
3. Selecione o novo status (Confirmado ou Descartado)
4. Clique em **Salvar**

> Manter os casos atualizados é importante para que o sistema não gere alertas desnecessários para a equipe de campo.

---

## 5. O que acontece depois que o caso é registrado

Assim que você salva o registro, o sistema executa automaticamente as seguintes ações:

**1. Cruzamento com focos próximos:**
O sistema verifica se existe algum foco de mosquito identificado pela equipe de campo a menos de 300 metros do endereço informado.

**2. Se houver foco próximo:**
- O foco é elevado automaticamente para prioridade **Crítica**
- O supervisor recebe um alerta no sistema
- A equipe de campo é acionada para tratar o foco com urgência

**3. Se não houver foco próximo:**
O caso fica registrado. Se a equipe de campo identificar um foco próximo depois, o sistema faz o vínculo automaticamente.

**4. Cluster de casos no mesmo bairro:**
Se 3 ou mais casos forem registrados no mesmo bairro em um curto período, o supervisor visualiza um alerta especial para criar um planejamento de campo na área.

---

## 6. Integração com vigilância epidemiológica

O Sentinella pode ser configurado para enviar as notificações ao **e-SUS Notifica** (sistema federal de vigilância) de forma automática ou manual, dependendo da configuração da sua prefeitura.

### Envio automático:
Se a prefeitura configurou a integração, os casos confirmados são enviados ao e-SUS Notifica assim que você os marca como "Confirmado".

### Envio manual:
Se o envio não for automático, após confirmar um caso, aparecerá um botão **"Notificar ao e-SUS"**. Clique nele para enviar.

> Se tiver dúvidas sobre como a integração está configurada na sua prefeitura, fale com o supervisor municipal do Sentinella.

---

## 7. Dicas importantes

**Registre o mais cedo possível:**
Quanto mais rápido o caso for registrado, mais rápido a equipe de campo pode agir na área. Idealmente, registre no mesmo dia do atendimento.

**Mantenha os casos atualizados:**
Quando um exame confirmar ou descartar o caso, atualize no sistema. Casos suspeitos que ficam abertos por muito tempo geram alertas desnecessários para a equipe de campo.

**Endereço de residência, não de atendimento:**
Registre o endereço onde o paciente **mora**, não o endereço da unidade de saúde. O que importa é saber onde o mosquito pode estar se reproduzindo.

**Privacidade do paciente:**
O sistema foi projetado para não armazenar dados pessoais identificáveis. Não tente registrar nome, CPF ou telefone nos campos de texto — essas informações não devem entrar no sistema.

**Problemas frequentes:**

| Situação | O que fazer |
|----------|------------|
| Não consigo fazer login | Fale com o supervisor municipal |
| Erro ao salvar o caso | Verifique sua conexão com a internet |
| Caso duplicado registrado | Fale com o supervisor para que ele possa corrigir |
| Não encontro o campo para determinada doença | A doença pode não estar ativa na sua configuração — fale com o supervisor |

---

*Manual do Notificador · Sistema Sentinella · Para uso em treinamentos de prefeitura*
