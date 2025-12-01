
export enum Role {
  ADMIN = 'ADMIN',
  GERENTE = 'GERENTE',
  FATURAMENTO = 'FATURAMENTO',
  VENDEDOR = 'VENDEDOR'
}

export enum StatusPedido {
  PENDENTE = 'pendente',
  PARCIALMENTE_FATURADO = 'parcialmente_faturado',
  FATURADO = 'faturado'
}

export enum StatusSolicitacao {
  PENDENTE = 'pendente',
  APROVADO = 'aprovado',
  REJEITADO = 'rejeitado',
  FATURADO = 'faturado'
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
  unidade: string; // Persiste a unidade na solicitação
  volume_solicitado: number;
  status: StatusSolicitacao;
  criado_por: string;
  aprovado_por?: string;
  data_solicitacao: string;
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
