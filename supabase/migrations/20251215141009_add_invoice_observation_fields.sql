/*
  # Adicionar campos de observação e data de emissão de nota fiscal

  1. Mudanças
    - Adiciona coluna `obs_emissao_nf` (text) para observações na hora da emissão da nota
    - Adiciona coluna `data_faturamento` (timestamptz) para registrar data/hora do faturamento

  2. Observações
    - Campos opcionais (nullable)
    - Permite rastreamento completo do histórico de faturamento
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solicitacoes' AND column_name = 'obs_emissao_nf'
  ) THEN
    ALTER TABLE solicitacoes ADD COLUMN obs_emissao_nf text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solicitacoes' AND column_name = 'data_faturamento'
  ) THEN
    ALTER TABLE solicitacoes ADD COLUMN data_faturamento timestamptz;
  END IF;
END $$;