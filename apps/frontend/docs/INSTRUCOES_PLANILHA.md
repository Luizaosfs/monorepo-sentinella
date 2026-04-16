# Instruções — Planilha de Importação de Imóveis
### Sistema Sentinella · Para uso da prefeitura

---

## O que é esta planilha

Esta planilha é o modelo oficial para importar imóveis no sistema Sentinella.
Preencha uma linha por imóvel e envie o arquivo para o responsável pelo sistema na prefeitura.

Os formatos aceitos são:
- **MODELO_IMPORTACAO_IMOVEIS.xlsx** (Excel / LibreOffice Calc) — recomendado
- **MODELO_IMPORTACAO_IMOVEIS.csv** (texto separado por vírgula)

---

## Colunas da planilha

### Colunas obrigatórias

| Coluna | Descrição | Exemplo |
|--------|-----------|---------|
| **logradouro** | Nome completo da rua, avenida ou travessa | `Rua das Flores` |
| **bairro** | Nome do bairro onde o imóvel está | `Centro` |
| **cidade** | Nome do município | `Santa Fé do Sul` |
| **uf** | Sigla do estado (2 letras) | `SP` |

> Se qualquer uma dessas colunas estiver vazia, a linha será **rejeitada** na importação.

---

### Colunas opcionais

| Coluna | Descrição | Exemplo | Observação |
|--------|-----------|---------|-----------|
| **numero** | Número do imóvel | `123` | Use `S/N` para imóveis sem número |
| **complemento** | Complemento do endereço | `Fundos` / `Apto 2` | Livre |
| **cep** | CEP do imóvel | `15775-000` | Com ou sem traço |
| **tipo_imovel** | Tipo do imóvel | `residencial` | Ver tabela abaixo |
| **quarteirao** | Código do quarteirão | `Q12` | Conforme cadastro da prefeitura |
| **lote** | Número do lote | `L34` | Conforme cadastro da prefeitura |
| **latitude** | Latitude decimal | `-20.2193` | Se não informada, o sistema localiza automaticamente |
| **longitude** | Longitude decimal | `-50.9218` | Se não informada, o sistema localiza automaticamente |

---

### Valores aceitos para `tipo_imovel`

| Valor na planilha | Significado |
|------------------|-------------|
| `residencial` | Casa, apartamento, moradia (padrão quando não informado) |
| `comercial` | Loja, empresa, estabelecimento comercial |
| `terreno` | Lote vazio, terreno baldio |
| `ponto_estrategico` | Borracharia, cemitério, ferro-velho, depósito de pneus |

> Se a coluna `tipo_imovel` estiver vazia, o sistema usará `residencial` como padrão.

---

### Valores aceitos para `uf`

```
AC  AL  AM  AP  BA  CE  DF  ES  GO  MA
MG  MS  MT  PA  PB  PE  PI  PR  RJ  RN
RO  RR  RS  SC  SE  SP  TO
```

---

## Coordenadas (latitude e longitude)

Se você tiver as coordenadas dos imóveis, preencha as colunas `latitude` e `longitude`.

**Formato correto:**
- Número decimal com ponto (não vírgula)
- Negativo para o Brasil
- Exemplo: `-20.2193` e `-50.9218`

**Formato incorreto:**
- `-20,2193` (vírgula no lugar de ponto) — não aceito
- `20.2193` (sem sinal negativo) — vai colocar o imóvel no hemisfério norte

**Se não tiver as coordenadas:**
Deixe as colunas `latitude` e `longitude` em branco. O sistema vai localizar o endereço automaticamente pelo nome da rua, número, bairro e cidade.

> O sistema localiza até **300 imóveis sem coordenadas** por importação. Para arquivos maiores, recomenda-se incluir as coordenadas na planilha.

---

## Regras importantes

1. **Um imóvel por linha** — não coloque dois imóveis na mesma linha
2. **Não repetir imóveis** — se o mesmo endereço (rua + número + bairro) já existir no sistema, a linha será ignorada automaticamente
3. **Não alterar os nomes das colunas** — o sistema reconhece pelo cabeçalho. Se mudar o nome, a coluna será ignorada
4. **Não deixar linhas em branco no meio da planilha** — linhas completamente vazias são ignoradas
5. **Não usar fórmulas do Excel** nas células de dados — use apenas texto
6. **Acentos são aceitos** — `Rua São João`, `Jardim América`, etc.

---

## Como preencher corretamente

### Exemplo de preenchimento correto:

| logradouro | numero | complemento | bairro | cidade | uf | cep | tipo_imovel | quarteirao | lote | latitude | longitude |
|-----------|--------|------------|--------|--------|----|-----|------------|-----------|------|----------|-----------|
| Rua das Flores | 123 | | Centro | Santa Fé do Sul | SP | 15775-000 | residencial | Q12 | L34 | -20.2193 | -50.9218 |
| Avenida Brasil | 456 | Fundos | Jardim América | Santa Fé do Sul | SP | 15775-100 | comercial | Q08 | L02 | | |
| Rua São João | S/N | | Vila Nova | Santa Fé do Sul | SP | | terreno | Q03 | L15 | | |

### Erros comuns a evitar:

| Erro | Exemplo errado | Exemplo correto |
|------|---------------|----------------|
| Vírgula na coordenada | `-20,2193` | `-20.2193` |
| Coordenada positiva | `20.2193` | `-20.2193` |
| Tipo de imóvel com acento | `comercião` | `comercial` |
| UF com nome por extenso | `São Paulo` | `SP` |
| Duas informações na mesma célula | `Rua X, 123` | Separar em colunas `logradouro` e `numero` |

---

## Como enviar a planilha

Após preencher, salve o arquivo e envie para o supervisor municipal do Sentinella, que fará a importação pelo sistema.

O sistema vai gerar um relatório com o resultado de cada linha:
- Importado com sucesso
- Duplicado (ignorado)
- Erro (com descrição do problema)

Se houver erros, o supervisor enviará o relatório de volta para que a prefeitura corrija as linhas problemáticas e reenvie apenas as linhas com erro.

---

## Dúvidas

Em caso de dúvidas sobre o preenchimento, entre em contato com o supervisor municipal do Sentinella ou com o suporte da plataforma em **suporte@sentinella.app**.

---

*Instrucoes de Importacao · Sistema Sentinella · Versão 1.0*
