
export enum Role {
  ADMIN = 'ADMIN',
  GERENTE = 'GERENTE',
  FATURAMENTO = 'FATURAMENTO',
  COMERCIAL = 'COMERCIAL',
  CREDITO = 'CREDITO',
  VENDEDOR = 'VENDEDOR'
}

export enum StatusPedido {
  PENDENTE = 'pendente',
  PARCIALMENTE_FATURADO = 'parcialmente_faturado',
  FATURADO = 'faturado'
}

export enum StatusSolicitacao {
  PENDENTE = 'pendente',
  EM_ANALISE = 'em_analise', // Status genérico para aprovação paralela
  EM_ANALISE_COMERCIAL = 'em_analise_comercial', // Mantido para compatibilidade legado (se houver dados antigos)
  EM_ANALISE_CREDITO = 'em_analise_credito', // Mantido para compatibilidade legado
  APROVADO_PARA_FATURAMENTO = 'aprovado_para_faturamento', // Aprovado por todos, pronto para nota
  REJEITADO = 'rejeitado',
  FATURADO = 'faturado' // Processo finalizado
}

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
}

export interface Pedido {
  id: string;
  numero_pedido: string;
  codigo_cliente: string;
  nome_cliente: string;
  nome_produto: string;
  unidade: string; // Nova coluna para embalagem (B20, GL5, etc)
  volume_total: number;
  volume_restante: number;
  valor_total: number;
  codigo_vendedor: string;
  nome_vendedor: string;
  status: StatusPedido;
  data_criacao: string;
}

export interface SolicitacaoFaturamento {
  id: string;
  pedido_id: string;
  numero_pedido: string;
  nome_cliente: string;
  unidade: string;
  volume_solicitado: number;
  status: StatusSolicitacao;
  criado_por: string;
  aprovado_por?: string;
  data_solicitacao: string;
  motivo_rejeicao?: string;
  // Flags de aprovação paralela
  aprovacao_comercial?: boolean;
  aprovacao_credito?: boolean;
  // Observações de aprovação
  obs_comercial?: string;
  obs_credito?: string;
}

export interface LogSincronizacao {
  id: string;
  data: string;
  tipo: 'AUTOMATICO' | 'MANUAL';
  arquivo: string;
  sucesso: boolean;
  mensagens: string[];
}

export interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isThinking?: boolean;
}
