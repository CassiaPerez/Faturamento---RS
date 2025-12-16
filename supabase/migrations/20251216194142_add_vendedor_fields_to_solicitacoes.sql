/*
  # Adicionar campos de vendedor às solicitações

  1. Alterações na Tabela
    - Adiciona campo `codigo_vendedor` (text) à tabela `solicitacoes`
    - Adiciona campo `nome_vendedor` (text) à tabela `solicitacoes`
  
  2. Descrição
    - Permite rastrear qual vendedor é responsável por cada solicitação
    - Melhora a visibilidade e controle sobre as solicitações por vendedor
    - Facilita relatórios e filtros por vendedor

  3. Notas
    - Campos são opcionais (nullable) para manter compatibilidade com dados existentes
    - Os campos serão preenchidos automaticamente em novas solicitações
*/

-- Adiciona campos de vendedor à tabela solicitacoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solicitacoes' AND column_name = 'codigo_vendedor'
  ) THEN
    ALTER TABLE solicitacoes ADD COLUMN codigo_vendedor text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solicitacoes' AND column_name = 'nome_vendedor'
  ) THEN
    ALTER TABLE solicitacoes ADD COLUMN nome_vendedor text;
  END IF;
END $$;