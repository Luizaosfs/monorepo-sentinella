# SENTINELLA — MODELO COMERCIAL
**Versão:** 1.0 — Abril 2026
**Uso:** Proposta comercial para prefeituras

---

## PREMISSA

Prefeitura não compra software.
Prefeitura compra **solução**, **suporte**, **resultado** e **rastreabilidade**.

Por isso, o Sentinella é contratado como **serviço de gestão operacional da vigilância**, não como licença de sistema.

O preço inclui tudo que é necessário para a operação funcionar: plataforma, hospedagem, suporte, treinamento, implantação e atualizações.

---

## MODELO DE CONTRATAÇÃO

### Plano Base — Vigilância Digital

**Para quem é:** Municípios com até 100 mil habitantes que querem digitalizar as vistorias e ter dashboard operacional.

| Item | Incluso |
|---|---|
| Sistema web para supervisor e gestor | ✅ |
| Aplicativo de campo para agentes (até 10 usuários) | ✅ |
| Hospedagem e backup | ✅ |
| Implantação e configuração inicial | ✅ |
| Treinamento (1 turma) | ✅ |
| Suporte por e-mail e chat | ✅ |
| Atualizações do sistema | ✅ |
| Relatórios operacionais | ✅ |
| Dashboard do supervisor | ✅ |
| Canal do cidadão (QR code) | ✅ |

**Não incluso no Plano Base:** drone, integração e-SUS, análise por IA

---

### Plano Profissional — Vigilância Inteligente

**Para quem é:** Municípios entre 100 mil e 500 mil habitantes, com operação estruturada de controle de endemias.

Tudo do Plano Base, mais:

| Item adicional | Incluso |
|---|---|
| Usuários ilimitados | ✅ |
| Índice LIRAa automático (IIP e IBP por quarteirão) | ✅ |
| Score preditivo de surto por região | ✅ |
| Cruzamento de casos notificados × focos (PostGIS) | ✅ |
| Integração e-SUS Notifica (homologação e produção) | ✅ |
| Mapa de calor temporal animado | ✅ |
| Painel de produtividade comparativa de agentes | ✅ |
| Relatório semanal automático por e-mail | ✅ |
| Reunião mensal de acompanhamento (videoconferência) | ✅ |
| SLA de suporte: resposta em até 4h úteis | ✅ |

---

### Plano Avançado — Vigilância com Drone e IA

**Para quem é:** Municípios com alta incidência, operação de drone já estruturada ou interesse em análise por inteligência artificial.

Tudo do Plano Profissional, mais:

| Item adicional | Incluso |
|---|---|
| Integração com pipeline de drone (Python + YOLO) | ✅ |
| Triagem automática pós-voo com IA (Claude) | ✅ |
| Identificação de larvas por IA na vistoria | ✅ |
| Painel de correlação vistoria × drone | ✅ |
| Cloudinary para armazenamento de imagens | ✅ |
| Análise de eficácia de larvicida por tipo de depósito | ✅ |
| Gerente de conta dedicado | ✅ |
| SLA de suporte: resposta em até 2h úteis | ✅ |

---

## TABELA DE PREÇOS SUGERIDOS

> *Os valores abaixo são referência de posicionamento para municípios brasileiros. Ajustar conforme porte, negociação e contexto de licitação.*

| Plano | Faixa populacional | Valor mensal sugerido | Valor anual |
|---|---|---|---|
| Base | Até 50 mil hab. | R$ 1.800 | R$ 21.600 |
| Base | 50–100 mil hab. | R$ 2.800 | R$ 33.600 |
| Profissional | 100–250 mil hab. | R$ 4.500 | R$ 54.000 |
| Profissional | 250–500 mil hab. | R$ 6.500 | R$ 78.000 |
| Avançado | Qualquer porte | A partir de R$ 9.000 | A partir de R$ 108.000 |

**Taxa de implantação (única):**
- Plano Base: R$ 3.500
- Plano Profissional: R$ 6.000
- Plano Avançado: R$ 10.000

> *Implantação inclui configuração, importação de dados, treinamento e operação assistida (Semanas 0 e 1 do plano de piloto).*

---

## FLUXO DE CONTRATAÇÃO SUGERIDO

```
1. PILOTO (30–45 dias)
   ↓ Gratuito ou com taxa simbólica (R$ 1.500)
   ↓ Valida o sistema na realidade local

2. APRESENTAÇÃO DE RESULTADOS
   ↓ Relatório do piloto para secretaria
   ↓ Demonstração dos indicadores gerados

3. PROPOSTA FORMAL
   ↓ Proposta com plano, valor e escopo
   ↓ Adequada ao processo de compra da prefeitura

4. CONTRATAÇÃO
   ↓ Contrato 12 meses com renovação automática
   ↓ Ou processo licitatório (dispensa/inexigibilidade/pregão)

5. OPERAÇÃO PLENA
   ↓ Expansão para todos os bairros
   ↓ Acompanhamento mensal
```

---

## MODALIDADES DE COMPRA PÚBLICA

O Sentinella pode ser contratado via:

### Dispensa de licitação
Aplicável para contratos de tecnologia abaixo do limite legal (verificar valor atualizado na Lei 14.133/2021 e regulamentações municipais).

### Inexigibilidade
Para serviço de natureza singular, quando o fornecedor é o único que entrega a solução com as características técnicas específicas. Requer justificativa técnica.

### Adesão à ata de registro de preços
Se outro município já tiver contratado via pregão, é possível aderir à ata.

### Pregão eletrônico (para contratos maiores)
Sentinella pode auxiliar na elaboração do Termo de Referência com especificações técnicas do serviço.

---

## COMO JUSTIFICAR A CONTRATAÇÃO

A prefeitura pode justificar a contratação do Sentinella com base em:

1. **Eficiência administrativa:** substituição de processos manuais (papel e planilha) por sistema digital com rastreabilidade comprovada
2. **Conformidade com LGPD:** o sistema foi desenhado em conformidade com a Lei 13.709/2018
3. **Integridade dos dados:** histórico auditável e imutável de todas as ações de campo
4. **Saúde pública:** ferramenta de apoio ao Programa Nacional de Controle da Dengue (PNCD) e às exigências do Ministério da Saúde para vigilância ambiental
5. **Economicidade:** comparado com o custo de horas administrativas para digitação, consolidação e relatórios manuais

---

## O QUE A PREFEITURA NÃO PRECISA COMPRAR SEPARADO

- Servidor próprio
- Licença de banco de dados
- Contrato de hospedagem
- Software de mapas
- Sistema de backup
- Ferramenta de relatórios

**Tudo está incluso no serviço.**

---

## COMPARATIVO COM ALTERNATIVAS

| Critério | Planilha + papel | Sistema genérico de TI | Sentinella |
|---|---|---|---|
| Rastreabilidade de campo | ❌ | Parcial | ✅ Completa |
| Modo offline para campo | ❌ | Geralmente não | ✅ |
| Indicadores epidemiológicos (LIRAa, IIP) | Manual | Não tem | ✅ Automático |
| Cruzamento caso × foco | Manual | Não tem | ✅ Automático (PostGIS) |
| Conformidade LGPD | ❌ | Depende | ✅ Por design |
| Auditoria imutável | ❌ | Parcial | ✅ |
| SLA por tipo e prioridade | ❌ | Não tem | ✅ Configurável |
| Implantação sem TI local | ✅ | ❌ | ✅ |
| Treinamento incluído | N/A | Separado | ✅ Incluso |
| Score preditivo de surto | ❌ | Não tem | ✅ |
