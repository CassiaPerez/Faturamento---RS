/*
  # Adicionar código do cliente às solicitações

  1. Alterações
    - Adiciona coluna `codigo_cliente` na tabela `solicitacoes`
    - Tipo: text (opcional)
    - Permite melhor identificação do cliente nas solicitações
  
  2. Notas
    - Campo opcional para compatibilidade com dados existentes
    - Será populado automaticamente em novas solicitações
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'solicitacoes' AND column_name = 'codigo_cliente'
  ) THEN
    ALTER TABLE solicitacoes ADD COLUMN codigo_cliente text;
  END IF;
END $$;