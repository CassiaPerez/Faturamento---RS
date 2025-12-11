

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
  AGUARDANDO_EMISSAO = 'aguardando_emissao_nf',
  FINALIZADO = 'finalizado'
}

export enum StatusSolicitacao {
  PENDENTE = 'pendente',
  EM_ANALISE = 'em_analise',
  EM_ANALISE_COMERCIAL = 'em_analise_comercial',
  EM_ANALISE_CREDITO = 'em_analise_credito',
  APROVADO_PARA_FATURAMENTO = 'aprovado_para_faturamento',
  REJEITADO = 'rejeitado',
  FATURADO = 'faturado'
}

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  manager_id?: string;
  password?: string;
  sales_codes?: string[]; // Códigos do vendedor no ERP (pode ter mais de um)
}

export interface Pedido {
  id: string;
  numero_pedido: string;
  codigo_cliente: string;
  nome_cliente: string;
  nome_produto: string;
  unidade: string;
  
  // Volumes
  volume_total: number;
  volume_restante: number; // Disponível para solicitar
  volume_faturado: number; // Efetivamente faturado (NF emitida)
  
  // Valores
  valor_total: number;
  valor_faturado: number; // Soma do valor das NFs emitidas
  
  codigo_vendedor: string;
  nome_vendedor: string;
  
  // Status e Controle
  status: StatusPedido;
  setor_atual?: Role; // Onde o pedido está "parado" ou sendo processado
  motivo_status?: string; // Último motivo relevante
  data_criacao: string;
}

export interface SolicitacaoFaturamento {
  id: string;
  pedido_id: string;
  numero_pedido: string;
  nome_cliente: string;
  nome_produto: string;
  unidade: string;
  volume_solicitado: number;
  status: StatusSolicitacao;
  status_pedido?: string;
  criado_por: string;
  aprovado_por?: string;
  data_solicitacao: string;
  motivo_rejeicao?: string;
  aprovacao_comercial?: boolean;
  aprovacao_credito?: boolean;
  obs_comercial?: string;
  obs_credito?: string;
  obs_vendedor?: string;
  
  // Novos campos para fluxo de faturamento
  prazo_pedido?: string;
  obs_faturamento?: string;
  
  blocked_by?: Role;
}

export interface HistoricoEvento {
  id: string;
  pedido_id: string;
  data_evento: string;
  usuario: string;
  setor: Role | string;
  acao: string; // ex: 'Solicitação Criada', 'Aprovado Comercial', 'Faturado', 'Rejeitado'
  detalhes?: string; // Motivo, valores, observações
  tipo: 'SUCESSO' | 'ERRO' | 'INFO' | 'ALERTA';
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