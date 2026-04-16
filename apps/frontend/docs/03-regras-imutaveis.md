# Regras Imutáveis do Projeto

## Regras de trabalho da IA
- não modificar código existente sem autorização explícita
- não refatorar estrutura por conta própria
- não renomear entidades de domínio sem autorização
- não remover campos, tabelas, fluxos ou integrações existentes sem validar impacto
- não propor simplificações que quebrem regras de negócio já documentadas

## Fonte de verdade
- a documentação da pasta docs é obrigatória
- o domínio do sistema prevalece sobre suposições genéricas
- se houver ambiguidade, listar a dúvida antes de sugerir implementação

## Restrições
- preservar compatibilidade com fluxo drone
- preservar compatibilidade com fluxo manual
- preservar modelo de dados existente, salvo pedido explícito
- respeitar integrações existentes com Supabase, Cloudinary e demais serviços

## Modo padrão de assistência
- explicar primeiro
- sugerir depois
- implementar somente quando solicitado