# GUIA DE TREINAMENTO — AGENTE DE CAMPO
**Sistema:** Sentinella
**Perfil:** Operador / Agente de Controle de Endemias
**Duração:** 1,5 a 2 horas por agente
**Formato:** Individual ou grupos de até 5

---

## OBJETIVO DO TREINAMENTO

Ao fim deste treinamento, o agente deve ser capaz de:
- Fazer login e visualizar sua lista de imóveis do dia
- Executar uma vistoria completa (5 etapas) sem ajuda
- Registrar tentativa sem acesso (imóvel fechado)
- Fazer vistoria em modo offline e sincronizar depois
- Navegar para o próximo imóvel usando o mapa com rota

---

## ANTES DE COMEÇAR

**Checklist do dispositivo:**
- [ ] Android 8+ ou iOS 13+ (versão mínima)
- [ ] Chrome ou Safari atualizado
- [ ] GPS ativado e funcionando
- [ ] Câmera funcionando
- [ ] Pelo menos 20% de bateria
- [ ] Acesso testado ao sistema (login feito)

---

## MÓDULO 1 — LOGIN E PRIMEIRO ACESSO (15 min)

### 1.1 Fazer login
1. Abrir o navegador (Chrome)
2. Acessar o endereço do sistema (fornecido pelo supervisor)
3. Inserir e-mail e senha fornecidos
4. Tocar em "Entrar"

**Problema comum:** "Não recebi o e-mail de boas-vindas"
→ Verificar pasta de spam / lixo eletrônico
→ Solicitar reenvio ao supervisor

### 1.2 OnboardingModal
Ao entrar pela primeira vez, aparece um tour de boas-vindas.
- Ler cada tela e tocar em "Avançar"
- Ao final, tocar em "Começar"

### 1.3 Tela inicial — Meu Dia
Rota: `/agente/hoje`

O agente vê:
- Saudação com nome e data
- Cards de resumo do ciclo: imóveis pendentes, visitados, cobertura (%)
- Seleção do tipo de atividade para o dia

**Tipos de atividade:**
| Tipo | Quando usar |
|---|---|
| Tratamento | Visita padrão + aplicação de larvicida |
| Pesquisa | Apenas inspeção, sem larvicida |
| LIRAa | Levantamento de índice (ciclo específico) |
| Ponto Estratégico | Borracharias, cemitérios, ferros-velhos |

**Prática:** Selecionar o tipo de atividade do dia indicado pelo supervisor.

---

## MÓDULO 2 — LISTA DE IMÓVEIS (20 min)

Rota: `/operador/imoveis`

### 2.1 Leitura da lista
Cada imóvel tem uma cor de status:
- **Vermelho** = Pendente (ainda não visitado)
- **Verde** = Visitado (vistoria concluída)
- **Âmbar** = Revisita (agendado para nova tentativa)
- **Cinza** = Fechado (sem acesso e sem retorno agendado)

### 2.2 Filtros
- Buscar por nome da rua, bairro ou quarteirão
- Filtrar por status para ver só os pendentes

### 2.3 Cadastrar novo imóvel
Se o agente encontrar um imóvel que não está na lista:
1. Tocar no botão "+" (FAB na tela)
2. Preencher logradouro, número, bairro
3. O GPS preenche as coordenadas automaticamente
4. Tocar em "Salvar"

**Prática:** Buscar um imóvel pelo nome da rua e abrir os detalhes.

---

## MÓDULO 3 — VISTORIA COMPLETA (40 min)

Rota: `/operador/vistoria/:imovelId` (ou `/agente/vistoria/:imovelId`)

### Como iniciar
1. Na lista de imóveis, tocar no imóvel desejado
2. Tocar em "Iniciar Vistoria"
3. Aguardar o GPS capturar a localização (importante para o checkin)

### Etapas da vistoria

#### Etapa 1 — Responsável
- O GPS é capturado automaticamente (não fechar o app nesta etapa)
- Registrar número de moradores com + / -
- Marcar se há moradores: grávidas, idosos, crianças até 7 anos
- **Se NÃO conseguiu entrar no imóvel:** Tocar em "Não consegui entrar" → ir para o fluxo de sem acesso (ver Módulo 4)
- Tocar em "Próximo"

#### Etapa 2 — Sintomas
- Marcar se algum morador tem sintomas: febre, manchas, dor nas articulações, dor de cabeça
- Se sim: registrar quantos moradores estão com sintomas
- Um banner amarelo avisa que o sistema criará um caso suspeito automaticamente
- Tocar em "Próximo"

#### Etapa 3 — Inspeção de Depósitos
Para cada tipo de depósito PNCD presente no imóvel:

| Código | Tipo |
|---|---|
| A1 | Caixas d'água elevadas |
| A2 | Outros armazenamentos (tonéis, tambores) |
| B | Pequenos depósitos móveis (vasos, potes, bebedouros) |
| C | Depósitos fixos (cisternas, piscinas) |
| D1 | Pneus e materiais rodantes |
| D2 | Lixo e entulho |
| E | Depósitos naturais (bromélias, ocos de árvore) |

Para cada tipo:
1. Registrar quantos foram **inspecionados**
2. Registrar quantos tinham **focos** (larvas ou pupas)
   - Número de focos ≤ número de inspecionados
3. Se o imóvel tem calha: marcar e registrar posição, condição e se tem foco

- Tocar em "Próximo"

#### Etapa 4 — Tratamento
Para cada tipo de depósito **que teve foco**:
- Registrar quantos foram **eliminados** (água jogada fora, recipiente destruído)
- Registrar se usou **larvicida** (toggle)
- Se usou larvicida: registrar quantos gramas foram aplicados

- Tocar em "Próximo"

#### Etapa 5 — Riscos e Finalização
Marcar riscos identificados:

**Risco Social:**
- Menor incapaz sem responsável
- Idoso incapaz sem responsável
- Dependente químico
- Risco alimentar
- Risco de moradia

**Risco Sanitário:**
- Criação de animais em condições inadequadas
- Lixo acumulado
- Resíduos orgânicos
- Resíduos químicos
- Resíduos de saúde

**Risco Vetorial:**
- Acúmulo de material orgânico
- Animais com sinais de leishmaniose
- Caixa d'água destampada
- Outro risco vetorial (campo livre)

- Adicionar observações se necessário
- Tocar em **"FINALIZAR"**
- Aguardar tela de confirmação verde

**Prática:** Executar uma vistoria completa em um imóvel real com o instrutor observando.

---

## MÓDULO 4 — IMÓVEL SEM ACESSO (20 min)

### Quando usar
O imóvel está fechado, o morador não veio atender, cachorro bravo, ou recusou entrada.

### Como registrar
Na Etapa 1, tocar em "Não consegui entrar no imóvel":

1. **Selecionar o motivo:**
   - Fechado / Ausente
   - Viagem prolongada
   - Recusa de entrada
   - Cachorro bravo / animal agressivo
   - Outro

2. **Registrar calha visível de fora (se houver):**
   - Ativar toggle "Há calha visível de fora"
   - Selecionar posição (frontal, lateral, fundo)
   - Selecionar condição (limpa, com água, obstruída)
   - Marcar se há foco visível

3. **Selecionar horário sugerido para retorno:**
   - Manhã (7h–12h)
   - Tarde (12h–17h)
   - Qualquer horário

4. **Foto externa (opcional mas recomendado):**
   - Tocar em "Tirar foto"
   - Fotografar a fachada ou calha visível

5. Tocar em "Registrar Sem Acesso"

**Alerta importante:** Na 3ª tentativa sem acesso no mesmo imóvel, o sistema automaticamente marca o imóvel para vistoria por drone. Uma mensagem especial aparece na tela.

**Prática:** Simular um registro de sem acesso em imóvel de teste.

---

## MÓDULO 5 — MODO OFFLINE (20 min)

### O que é
Quando não há sinal de internet no campo, o Sentinella continua funcionando. As vistorias ficam salvas no celular e são enviadas automaticamente quando a internet voltar.

### Como funciona
1. Perder conexão → banner laranja aparece: "Modo Offline — X vistorias pendentes"
2. Continuar fazendo vistorias normalmente
3. Ao reconectar → banner some → vistorias são enviadas automaticamente
4. Uma notificação confirma: "X vistorias sincronizadas com sucesso"

### Exercício prático
1. **Desativar o Wi-Fi** do celular (manter dados móveis desligados também)
2. Fazer uma vistoria completa
3. Verificar o badge "1 vistoria pendente" na tela inicial
4. **Religar o Wi-Fi**
5. Aguardar a sincronização automática
6. Verificar toast de confirmação

**Importante:** Não fechar o navegador enquanto estiver sincronizando.

---

## MÓDULO 6 — MAPA E ROTA (10 min)

Rota: `/operador/mapa`

### Como usar
1. Tocar em "Mapa" no menu
2. Ver os imóveis pendentes no mapa (pins vermelhos)
3. O sistema calcula automaticamente a rota mais eficiente
4. Tocar em "Abrir no Google Maps" para navegação passo a passo

**Dica:** Usar o mapa toda manhã para planejar o percurso do dia antes de sair a campo.

---

## DÚVIDAS FREQUENTES

**P: Fiz uma vistoria errada. Posso desfazer?**
R: Não é possível desfazer. Adicione uma observação explicando o erro. O supervisor pode criar um novo foco corrigido.

**P: O GPS não capturou a localização. O que fazer?**
R: Aguardar 30 segundos com o app aberto ao ar livre. Se persistir, marcar manualmente na etapa 1.

**P: O app travou durante uma vistoria. Perdi os dados?**
R: Não. Os dados são salvos automaticamente a cada etapa. Reabrir o app e retomar a vistoria.

**P: Esqueci a senha.**
R: Clicar em "Esqueci minha senha" na tela de login. Um link será enviado ao e-mail cadastrado.

**P: Encontrei um imóvel diferente do que está no sistema (ex.: casa demolida).**
R: Registrar como "fechado" com observação "imóvel demolido" e informar ao supervisor.

---

## AVALIAÇÃO DO TREINAMENTO

| Habilidade | Demonstrado? |
|---|---|
| Login realizado com sucesso | [ ] Sim [ ] Não |
| Lista de imóveis acessada | [ ] Sim [ ] Não |
| Vistoria completa realizada (5 etapas) | [ ] Sim [ ] Não |
| Sem acesso registrado corretamente | [ ] Sim [ ] Não |
| Modo offline testado e sincronização confirmada | [ ] Sim [ ] Não |
| Mapa e rota acessados | [ ] Sim [ ] Não |

**Data do treinamento:** ___________
**Instrutor:** ___________
**Agente treinado:** ___________
**Dispositivo testado (modelo):** ___________
**Resultado:** [ ] Aprovado [ ] Requer reforço
