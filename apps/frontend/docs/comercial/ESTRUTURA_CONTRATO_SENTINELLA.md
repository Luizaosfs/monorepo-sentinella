# SENTINELLA — ESTRUTURA DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS SaaS
**Versão:** 1.0 — Abril 2026
**Nota:** Este documento é uma estrutura de referência. A versão final deve ser revisada por assessoria jurídica.

---

## CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SOFTWARE COMO SERVIÇO (SaaS)
### SISTEMA DE GESTÃO OPERACIONAL DA VIGILÂNCIA AMBIENTAL — SENTINELLA

---

### PARTES

**CONTRATANTE:**
[Nome da Prefeitura Municipal]
CNPJ: [___]
Representada pelo(a) Secretário(a) de Saúde: [Nome]

**CONTRATADA:**
[Razão social da empresa fornecedora do Sentinella]
CNPJ: [___]
Representada por: [Nome do responsável]

---

## CLÁUSULA 1 — OBJETO

### 1.1 Objeto principal
O presente contrato tem por objeto a **prestação de serviços de software como serviço (SaaS)** para gestão operacional da vigilância ambiental, compreendendo:

a) Licença de uso da plataforma Sentinella, acessível via navegador web e aplicativo móvel;
b) Hospedagem da plataforma e dos dados do CONTRATANTE em infraestrutura cloud;
c) Serviços de implantação, configuração e treinamento;
d) Suporte técnico contínuo conforme SLA definido neste contrato;
e) Manutenção corretiva e evolutiva do sistema durante a vigência.

### 1.2 Plano contratado
O CONTRATANTE contrata o Plano [Base / Profissional / Avançado], conforme especificações do Anexo I — Descrição de Serviços.

### 1.3 O que não é objeto deste contrato
a) Fornecimento de hardware (computadores, smartphones, roteadores);
b) Conectividade à internet nos locais de trabalho;
c) Integração com sistemas legados não previstos no Anexo I;
d) Consultoria estratégica de saúde pública ou epidemiologia.

---

## CLÁUSULA 2 — IMPLANTAÇÃO

### 2.1 Etapas da implantação
A CONTRATADA realizará as seguintes atividades de implantação, conforme cronograma acordado:

a) Configuração do ambiente da prefeitura na plataforma;
b) Cadastro inicial de regiões, bairros e usuários;
c) Importação de imóveis (a partir de arquivo fornecido pelo CONTRATANTE);
d) Configuração de SLA, feriados locais e parâmetros operacionais;
e) Validação do ambiente com a equipe técnica do CONTRATANTE.

### 2.2 Prazo
A implantação será concluída em até **15 (quinze) dias úteis** após assinatura do contrato e recebimento dos dados pelo CONTRATANTE.

### 2.3 Responsabilidade do CONTRATANTE na implantação
a) Indicar ponto focal técnico para acompanhamento;
b) Fornecer base de endereços/imóveis em formato acordado;
c) Disponibilizar equipe para treinamento nas datas acordadas;
d) Garantir dispositivos (computador e smartphones) para os usuários.

---

## CLÁUSULA 3 — TREINAMENTO

### 3.1 Treinamentos incluídos
a) **Treinamento de supervisor/gestor:** 3 horas, presencial ou videoconferência;
b) **Treinamento de agentes de campo:** 2 horas por turma (até 2 turmas por ano);
c) **Treinamento de notificadores:** 1 hora, presencial ou videoconferência;
d) **Material de treinamento:** roteiros, FAQ e vídeos de apoio.

### 3.2 Treinamentos adicionais
Treinamentos além dos incluídos poderão ser contratados separadamente conforme tabela de serviços avulsos.

### 3.3 Renovação anual
A cada renovação de contrato, a CONTRATADA realizará um treinamento de reciclagem de até 2 horas para o supervisor.

---

## CLÁUSULA 4 — SUPORTE TÉCNICO

### 4.1 Canais de suporte
a) Chat/WhatsApp Business: em horário comercial (08h–18h, dias úteis);
b) E-mail: em horário comercial, com resposta garantida conforme SLA;
c) Telefone emergencial: para incidentes críticos (sistema fora do ar).

### 4.2 Classificação de incidentes

| Severidade | Descrição | Exemplo |
|---|---|---|
| **Crítico** | Sistema inacessível ou perda de dados | Plataforma fora do ar; sincronização falha para todos os agentes |
| **Alto** | Funcionalidade principal indisponível | Agente não consegue salvar vistoria; supervisor não acessa dashboard |
| **Médio** | Funcionalidade secundária com problema | Relatório com erro; filtro não funciona |
| **Baixo** | Dúvida operacional ou melhoria | Como configurar feriado; como exportar dados |

### 4.3 SLA de atendimento

| Severidade | Plano Base | Plano Profissional | Plano Avançado |
|---|---|---|---|
| Crítico | 4h úteis | 2h úteis | 1h (24/7) |
| Alto | 8h úteis | 4h úteis | 2h úteis |
| Médio | 2 dias úteis | 1 dia útil | 4h úteis |
| Baixo | 5 dias úteis | 3 dias úteis | 1 dia útil |

### 4.4 Exclusões de suporte
a) Problemas causados por falta de internet no local do CONTRATANTE;
b) Uso indevido do sistema fora das orientações de treinamento;
c) Problemas em dispositivos fornecidos pelo CONTRATANTE.

---

## CLÁUSULA 5 — SEGURANÇA E LGPD

### 5.1 Proteção de dados pessoais
A CONTRATADA atua como **operadora** de dados pessoais na forma da Lei 13.709/2018 (LGPD), processando apenas os dados necessários para a prestação do serviço.

### 5.2 Dados não armazenados
Em conformidade com a LGPD, o sistema **NÃO armazena**:
- Nome de pacientes ou moradores
- CPF ou qualquer identificador pessoal direto
- Data de nascimento de pacientes

### 5.3 Dados armazenados sobre localização de casos
Apenas endereço e bairro de residência para fins de cruzamento epidemiológico, sem vínculo com identidade do paciente.

### 5.4 Medidas de segurança
a) Criptografia em trânsito (TLS 1.3) e em repouso;
b) Autenticação por e-mail e senha com hash seguro (Supabase Auth);
c) Isolamento de dados por prefeitura (Row Level Security no banco de dados);
d) Acesso restrito por função de usuário (RBAC);
e) Logs de acesso e alterações auditáveis;
f) Sem acesso de terceiros aos dados sem autorização prévia.

### 5.5 Notificação de incidente
Em caso de incidente de segurança com potencial impacto a dados pessoais, a CONTRATADA notificará o CONTRATANTE em até **72 horas** após a ciência do evento.

### 5.6 DPA (Data Processing Agreement)
As partes poderão firmar Acordo de Processamento de Dados separado, conforme exigência da ANPD.

---

## CLÁUSULA 6 — BACKUP E RETENÇÃO DE DADOS

### 6.1 Backup
a) Backup automático diário dos dados do CONTRATANTE;
b) Retenção mínima de 30 dias de backups;
c) Backup mensal retido por 12 meses.

### 6.2 Retenção de dados operacionais
a) Vistorias e focos: retidos pelo prazo mínimo de **5 (cinco) anos**;
b) Logs de acesso: retidos por **2 (dois) anos**;
c) Dados sensíveis anonimizados ou excluídos conforme política de retenção.

### 6.3 Exportação de dados
O CONTRATANTE poderá solicitar exportação de seus dados a qualquer momento, no formato CSV ou JSON, sem custo adicional.

---

## CLÁUSULA 7 — PROPRIEDADE DOS DADOS

### 7.1
**Todos os dados inseridos pelo CONTRATANTE (vistorias, focos, casos, imóveis, usuários) são de exclusiva propriedade do CONTRATANTE.**

### 7.2
A CONTRATADA não utilizará os dados do CONTRATANTE para fins comerciais, estatísticos ou de qualquer natureza sem autorização prévia e expressa.

### 7.3
Em caso de rescisão ou não renovação do contrato, a CONTRATADA entregará ao CONTRATANTE, em até **30 (trinta) dias**, a exportação completa de todos os seus dados, sem custo adicional.

---

## CLÁUSULA 8 — DISPONIBILIDADE (UPTIME)

### 8.1 SLA de disponibilidade
A CONTRATADA garante disponibilidade mínima da plataforma de **99,0% ao mês** (excluídas janelas de manutenção programadas).

### 8.2 Manutenção programada
Manutenções programadas serão comunicadas com antecedência mínima de **48 horas**, preferencialmente em horários de baixo uso (madrugada ou finais de semana).

### 8.3 Crédito por indisponibilidade
Em caso de indisponibilidade superior ao SLA acordado, o CONTRATANTE terá direito a crédito proporcional na próxima fatura.

---

## CLÁUSULA 9 — VIGÊNCIA

### 9.1
O presente contrato entra em vigor na data de assinatura e tem vigência de **12 (doze) meses**.

### 9.2 Renovação automática
O contrato se renova automaticamente por igual período, salvo manifestação de rescisão por qualquer das partes com antecedência mínima de **60 (sessenta) dias**.

---

## CLÁUSULA 10 — RESCISÃO

### 10.1 Rescisão por iniciativa do CONTRATANTE
O CONTRATANTE poderá rescindir o contrato mediante comunicação com antecedência de **60 dias**, sem multa, desde que não haja inadimplência.

### 10.2 Rescisão por descumprimento
Qualquer das partes poderá rescindir o contrato por descumprimento de obrigação, após notificação com prazo de **15 dias** para cura.

### 10.3 Efeitos da rescisão
a) A CONTRATADA manterá o acesso ativo por **30 dias** após o encerramento para exportação de dados;
b) Após esse prazo, os dados serão retidos por 90 dias antes da exclusão definitiva.

---

## CLÁUSULA 11 — VALOR E FORMA DE PAGAMENTO

### 11.1
O valor mensal do serviço é de **R$ [___]**, conforme plano contratado.

### 11.2 Taxa de implantação
A taxa única de implantação é de **R$ [___]**, devida na assinatura do contrato.

### 11.3 Forma de pagamento
Mensalidade via boleto ou transferência, com vencimento no dia **[___] de cada mês**.

### 11.4 Inadimplência
O não pagamento por mais de **30 dias** autoriza a CONTRATADA a suspender temporariamente o acesso, sem rescisão automática do contrato.

---

## CLÁUSULA 12 — REAJUSTE

### 12.1
Os valores contratados serão reajustados anualmente pelo **IPCA** (IBGE) acumulado nos 12 meses anteriores à data de renovação.

---

## CLÁUSULA 13 — RESPONSABILIDADES DO CONTRATANTE

O CONTRATANTE se obriga a:

a) Manter os usuários cadastrados atualizados (desativar usuários desligados);
b) Utilizar o sistema conforme as finalidades contratadas;
c) Não compartilhar credenciais de acesso entre usuários;
d) Comunicar imediatamente qualquer suspeita de acesso indevido;
e) Garantir dispositivos e conectividade adequados para os usuários;
f) Designar um ponto focal para comunicação com a CONTRATADA;
g) Efetuar os pagamentos nos prazos contratados.

---

## CLÁUSULA 14 — RESPONSABILIDADES DA CONTRATADA

A CONTRATADA se obriga a:

a) Manter a plataforma disponível conforme SLA contratado;
b) Realizar backups conforme esta cláusula 6;
c) Atender chamados de suporte conforme os prazos contratados;
d) Notificar incidentes de segurança conforme cláusula 5.5;
e) Manter os dados do CONTRATANTE seguros e em conformidade com a LGPD;
f) Disponibilizar exportação de dados quando solicitado;
g) Comunicar com antecedência qualquer manutenção programada;
h) Não subcontratar serviços sem anuência do CONTRATANTE para os componentes que impactem dados pessoais.

---

## CLÁUSULA 15 — DISPOSIÇÕES GERAIS

### 15.1 Sigilo
Ambas as partes se comprometem a manter sigilo sobre informações confidenciais trocadas durante a vigência do contrato.

### 15.2 Foro
Fica eleito o foro da comarca de [___] para dirimir quaisquer controvérsias deste contrato.

### 15.3 Atualizações do sistema
A CONTRATADA poderá lançar atualizações e melhorias no sistema sem necessidade de aditivo contratual, desde que não sejam retiradas funcionalidades incluídas no plano contratado.

---

## ANEXO I — DESCRIÇÃO DE SERVIÇOS (preencher por plano)

| Funcionalidade | Base | Profissional | Avançado |
|---|---|---|---|
| Sistema web (supervisor, gestor) | ✅ | ✅ | ✅ |
| App de campo (agentes) | ✅ | ✅ | ✅ |
| Gestão de focos de risco | ✅ | ✅ | ✅ |
| Dashboard operacional | ✅ | ✅ | ✅ |
| Mapa de focos | ✅ | ✅ | ✅ |
| Gestão de SLA | ✅ | ✅ | ✅ |
| Modo offline | ✅ | ✅ | ✅ |
| Canal do cidadão | ✅ | ✅ | ✅ |
| Relatório automático semanal | ❌ | ✅ | ✅ |
| Índice LIRAa (IIP/IBP) | ❌ | ✅ | ✅ |
| Score preditivo de surto | ❌ | ✅ | ✅ |
| Cruzamento caso × foco | ❌ | ✅ | ✅ |
| Integração e-SUS | ❌ | ✅ | ✅ |
| Reunião mensal de acompanhamento | ❌ | ✅ | ✅ |
| Pipeline drone + IA | ❌ | ❌ | ✅ |
| Identificação de larvas por IA | ❌ | ❌ | ✅ |
| Gerente de conta dedicado | ❌ | ❌ | ✅ |

---

*Documento de referência — revisão jurídica necessária antes de uso em licitação pública.*
