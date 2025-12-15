





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

export interface PedidoItem {
  id: string; // ID único do item (pode ser gerado)
  nome_produto: string;
  unidade: string;
  volume_total: number;
  volume_restante: number;
  volume_faturado: number;
  valor_unitario: number;
  valor_total: number;
}

export interface Pedido {
  id: string;
  numero_pedido: string;
  codigo_cliente: string;
  nome_cliente: string;
  
  // Array de Produtos
  itens: PedidoItem[];

  // Campos Agregados (Legado + Visualização Rápida)
  nome_produto: string; // Resumo ou nome do principal
  unidade: string; // Unidade predominante ou 'Mix'
  
  // Volumes Totais (Soma dos itens)
  volume_total: number;
  volume_restante: number; 
  volume_faturado: number; 
  
  // Valores Totais (Soma dos itens)
  valor_total: number;
  valor_faturado: number;
  
  codigo_vendedor: string;
  nome_vendedor: string;
  
  status: StatusPedido;
  setor_atual?: Role; 
  motivo_status?: string; 
  data_criacao: string;
}

export interface ItemSolicitado {
  nome_produto: string;
  volume: number;
  unidade: string;
  obs?: string; // Observação específica do item (ex: Faturamento)
}

export interface SolicitacaoFaturamento {
  id: string;
  pedido_id: string;
  numero_pedido: string;
  codigo_cliente?: string;
  nome_cliente: string;
  
  // Campo legado para compatibilidade visual (contém resumo: "Prod A: 10 | Prod B: 20")
  nome_produto: string; 
  unidade: string;
  volume_solicitado: number; // Soma dos volumes para KPI
  valor_solicitado?: number; // Valor monetário total da solicitação
  
  // Detalhe real da solicitação
  itens_solicitados?: ItemSolicitado[];
  // Detalhe do que foi efetivamente faturado (se diferente do solicitado)
  itens_atendidos?: ItemSolicitado[];

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
  
  prazo_pedido?: string;
  obs_faturamento?: string;
  obs_emissao_nf?: string;
  data_faturamento?: string;

  blocked_by?: Role;
}

export interface HistoricoEvento {
  id: string;
  pedido_id: string;
  data_evento: string;
  usuario: string;
  setor: Role | string;
  acao: string; 
  detalhes?: string; 
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