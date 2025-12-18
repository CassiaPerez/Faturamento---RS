import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/dataService';
import { User, Pedido, SolicitacaoFaturamento, StatusSolicitacao, Role, StatusPedido, HistoricoEvento } from '../types';
import {
  Search, Filter, ChevronDown, Package, User as UserIcon, Calendar, Briefcase, X, SlidersHorizontal, History,
  AlertTriangle, Lock, Ban, MessageSquare, ChevronLeft, ChevronRight, CheckCircle2, Clock, Banknote, TrendingUp, FileCheck, Loader2, Hourglass, Trash2, LayoutList, ArrowRight, RefreshCcw, Info
} from 'lucide-react';
import OrderDetailsModal from '../components/OrderDetailsModal';

const ITEMS_PER_PAGE = 50;

const OrderList: React.FC<{ user: User }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'rejected'>('orders');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [allSolicitacoes, setAllSolicitacoes] = useState<SolicitacaoFaturamento[]>([]); // Para a aba de rejeitados
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Estado para volumes individuais: { "nome_produto": "valor_digitado" }
  const [itemVolumes, setItemVolumes] = useState<Record<string, string>>({});
  const [requestObservation, setRequestObservation] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [orderSolicitacoes, setOrderSolicitacoes] = useState<SolicitacaoFaturamento[]>([]);
  const [orderHistory, setOrderHistory] = useState<HistoricoEvento[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [globalFilter, setGlobalFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    client: '',
    product: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const [currentPage, setCurrentPage] = useState(1);

  // Modal de Detalhes
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<SolicitacaoFaturamento | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
      const [pedidosData, solicitacoesData] = await Promise.all([
          api.getPedidos(user),
          api.getSolicitacoes(user)
      ]);
      setPedidos(pedidosData);
      setAllSolicitacoes(solicitacoesData);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [globalFilter, filters, activeTab]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setOrderSolicitacoes([]);
    } else {
      setExpandedId(id);
      setItemVolumes({}); // Limpa inputs
      setRequestObservation('');
      setIsLoadingHistory(true);
      try {
        const [history, timeline] = await Promise.all([
           api.getSolicitacoesByPedido(id),
           api.getHistoricoPedido(id)
        ]);
        setOrderSolicitacoes(history);
        setOrderHistory(timeline);
      } finally {
        setIsLoadingHistory(false);
      }
    }
  };

  const handleGoToOrder = (numeroPedido: string) => {
      setActiveTab('orders');
      setGlobalFilter(numeroPedido);
      // Opcional: Expandir automaticamente se necessário, mas o filtro já ajuda a encontrar
  };

  const handleDeleteOrder = async (pedido: Pedido) => {
      if (!window.confirm(`ATENÇÃO: Deseja realmente excluir o pedido ${pedido.numero_pedido}?\n\nIsso apagará todas as solicitações e históricos vinculados.`)) {
          return;
      }
      try {
          await api.deletePedido(pedido.id);
          setPedidos(prev => prev.filter(p => p.id !== pedido.id));
          if (expandedId === pedido.id) setExpandedId(null);
      } catch (e: any) {
          alert("Erro ao excluir pedido: " + e.message);
      }
  };

  const handleVolumeChange = (productName: string, value: string) => {
      // Permite digitação natural de números BR (0-9, vírgula, ponto)
      const val = value.replace(/[^0-9.,]/g, '');
      setItemVolumes(prev => ({ ...prev, [productName]: val }));
  };

  const handleCreateRequest = async (pedido: Pedido) => {
    const itensParaSolicitar: { nome_produto: string, volume: number, unidade: string }[] = [];
    
    // Processa os inputs
    for (const [prodName, volStr] of Object.entries(itemVolumes)) {
        if (!volStr) continue;
        
        // Fix: Explicit cast to string to avoid 'unknown' type error
        let valStr = (volStr as string).trim();
        valStr = valStr.replace(/\./g, ''); 
        valStr = valStr.replace(',', '.');  
        const volNumber = parseFloat(valStr);

        if (!isNaN(volNumber) && volNumber > 0) {
            const itemOriginal = pedido.itens.find(i => i.nome_produto === prodName);
            if (itemOriginal) {
                // Validação individual
                if (volNumber > (itemOriginal.volume_restante + 0.001)) {
                    alert(`Volume solicitado para ${prodName} (${volNumber}) excede o saldo disponível (${itemOriginal.volume_restante})`);
                    return;
                }
                itensParaSolicitar.push({
                    nome_produto: prodName,
                    volume: volNumber,
                    unidade: itemOriginal.unidade
                });
            }
        }
    }

    if (itensParaSolicitar.length === 0) {
        alert("Por favor, informe o volume para pelo menos um item.");
        return;
    }

    setIsSubmitting(true);
    try {
      await api.createSolicitacao(pedido.id, itensParaSolicitar, user, requestObservation);
      
      // Recarrega tudo para atualizar saldos e listas
      await loadData();
      
      const history = await api.getSolicitacoesByPedido(pedido.id);
      setOrderSolicitacoes(history);
      
      api.getHistoricoPedido(pedido.id).then(serverTimeline => {
          setOrderHistory(serverTimeline);
      });
      
      setItemVolumes({});
      setRequestObservation('');
      alert("Solicitação criada com sucesso!");
    } catch (error: any) {
      console.error("Erro ao criar solicitação:", error);
      alert(`Falha ao criar solicitação: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ client: '', product: '', status: '', startDate: '', endDate: '' });
    setGlobalFilter('');
  };

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const searchLower = globalFilter.toLowerCase();
      // Busca Global: Agora verifica também dentro dos itens
      const itemsMatch = p.itens.some(i => i.nome_produto.toLowerCase().includes(searchLower));
      
      const matchesGlobal = 
        globalFilter === '' ||
        p.nome_cliente.toLowerCase().includes(searchLower) || 
        p.numero_pedido.toLowerCase().includes(searchLower) ||
        p.codigo_cliente.includes(searchLower) ||
        itemsMatch;

      if (!matchesGlobal) return false;

      if (filters.client && !p.nome_cliente.toLowerCase().includes(filters.client.toLowerCase())) return false;
      // Filtro Específico de Produto: Verifica array de itens
      if (filters.product && !p.itens.some(i => i.nome_produto.toLowerCase().includes(filters.product.toLowerCase()))) return false;
      if (filters.status && p.status !== filters.status) return false;
      
      if (filters.startDate) {
        const orderDate = p.data_criacao;
        if (orderDate < filters.startDate) return false;
      }
      
      if (filters.endDate) {
        const orderDate = p.data_criacao;
        if (orderDate > filters.endDate) return false;
      }

      return true;
    });
  }, [pedidos, globalFilter, filters]);

  // Conta apenas pedidos ativos (não finalizados)
  const pedidosAtivos = useMemo(() => {
      return pedidos.filter(p => p.status !== StatusPedido.FINALIZADO);
  }, [pedidos]);

  // Filtra solicitações rejeitadas para a aba de "Devoluções"
  const rejectedList = useMemo(() => {
      return allSolicitacoes.filter(s =>
          s.status === StatusSolicitacao.REJEITADO &&
          (globalFilter === '' || s.nome_cliente.toLowerCase().includes(globalFilter.toLowerCase()) || s.numero_pedido.includes(globalFilter))
      ).sort((a, b) => new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime());
  }, [allSolicitacoes, globalFilter]);

  const totalPages = Math.ceil(filteredPedidos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPedidos = filteredPedidos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const renderStatusBadge = (p: Pedido) => {
     let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';
     let icon = <Clock size={10} />;
     
     if (p.status === StatusPedido.FINALIZADO) {
         colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
         icon = <CheckCircle2 size={10} />;
     } else if (p.status === StatusPedido.AGUARDANDO_EMISSAO) {
         colorClass = 'bg-yellow-50 text-yellow-700 border-yellow-100';
         icon = <Hourglass size={10} />;
     } else if (p.setor_atual === Role.CREDITO) {
         colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-100';
         icon = <Banknote size={10} />;
     } else if (p.setor_atual === Role.COMERCIAL) {
         colorClass = 'bg-blue-50 text-blue-700 border-blue-100';
         icon = <TrendingUp size={10} />;
     } else if (p.setor_atual === Role.FATURAMENTO) {
         colorClass = 'bg-orange-50 text-orange-700 border-orange-100';
         icon = <FileCheck size={10} />;
     } else if (p.status === StatusPedido.PARCIALMENTE_FATURADO) {
         colorClass = 'bg-blue-50 text-blue-700 border-blue-100';
     }

     if (p.motivo_status && p.motivo_status.includes("BLOQUEIO")) {
         colorClass = 'bg-red-50 text-red-700 border-red-100';
         icon = <Ban size={10} />;
     }

     let label = p.status as string;
     if (p.status === StatusPedido.FINALIZADO) label = 'FINALIZADO';
     if (p.status === StatusPedido.AGUARDANDO_EMISSAO) label = 'AGUARDANDO NF';
     if (p.motivo_status?.includes("BLOQUEIO")) label = `BLOQUEADO (${p.setor_atual})`;
     else if (p.setor_atual && p.status !== StatusPedido.FINALIZADO && p.status !== StatusPedido.AGUARDANDO_EMISSAO) label = `EM ${p.setor_atual}`;

     return (
       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border flex items-center gap-1.5 ${colorClass}`}>
          {icon}
          {label}
       </span>
     );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      
      <div className="mb-6 space-y-4">
        {/* TABS DE NAVEGAÇÃO */}
        <div className="flex gap-4 border-b border-slate-200">
            <button
                onClick={() => setActiveTab('orders')}
                className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'border-crop-600 text-crop-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Package size={18} /> Carteira Ativa ({pedidosAtivos.length})
            </button>
            <button 
                onClick={() => setActiveTab('rejected')}
                className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'rejected' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <AlertTriangle size={18} /> Devoluções & Rejeições ({rejectedList.length})
            </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={20} className="text-slate-400 group-focus-within:text-brand-500 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar por Cliente, ID, Produto..." 
              className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-base focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>
          
          {activeTab === 'orders' && (
            <div className="flex flex-row gap-3 w-full md:w-auto">
                <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 border rounded-xl font-bold transition-all shadow-sm ${showAdvancedFilters ? 'bg-crop-50 border-crop-200 text-crop-700 ring-2 ring-crop-100' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                <SlidersHorizontal size={18} />
                <span>Filtros</span>
                </button>
                <div className="px-5 py-3 bg-white text-slate-800 rounded-xl font-bold border border-slate-200 shadow-sm min-w-[100px] md:min-w-[140px] text-center flex items-center justify-center gap-2">
                <span className="text-lg">{filteredPedidos.length}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Total</span>
                </div>
            </div>
          )}
        </div>

        {activeTab === 'orders' && showAdvancedFilters && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Filter size={16} className="text-crop-500" />Refinar Resultados</h4>
              <button onClick={clearFilters} className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors px-3 py-1.5 hover:bg-red-50 rounded-lg"><X size={14} /> Limpar Tudo</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1.5"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Cliente</label><input type="text" value={filters.client} onChange={(e) => handleFilterChange('client', e.target.value)} placeholder="Filtrar por nome..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 transition-all" /></div>
              <div className="space-y-1.5"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Produto</label><input type="text" value={filters.product} onChange={(e) => handleFilterChange('product', e.target.value)} placeholder="Soja, Milho, etc..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 transition-all" /></div>
              <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Status</label>
                  <div className="relative">
                      <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 appearance-none cursor-pointer transition-all">
                          <option value="">Todos os Status</option>
                          <option value={StatusPedido.PENDENTE}>Pendente</option>
                          <option value={StatusPedido.PARCIALMENTE_FATURADO}>Parcialmente Faturado</option>
                          <option value={StatusPedido.AGUARDANDO_EMISSAO}>Aguardando NF</option>
                          <option value={StatusPedido.FINALIZADO}>Finalizado</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  </div>
              </div>
              <div className="space-y-1.5"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Data de Criação</label><div className="flex gap-2 items-center"><input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 transition-all" /><span className="text-slate-300">-</span><input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 transition-all" /></div></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 pb-4">
        
        {/* ABA: REJEITADOS */}
        {activeTab === 'rejected' && (
            rejectedList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {rejectedList.map(sol => (
                        <div key={sol.id} className="bg-white rounded-xl border border-l-4 border-l-red-500 border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-3">
                                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider flex items-center gap-1">
                                    <Ban size={10} /> {sol.status}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">{new Date(sol.data_solicitacao).toLocaleDateString()}</span>
                            </div>
                            
                            <h4 className="font-bold text-slate-800 text-base mb-1 truncate" title={sol.nome_cliente}>{sol.nome_cliente}</h4>
                            <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                                <Package size={12} /> {sol.numero_pedido}
                            </p>

                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 mb-4">
                                <p className="text-[10px] font-bold text-red-800 uppercase mb-1 flex items-center gap-1">
                                    <MessageSquare size={10} /> Motivo da Devolução
                                </p>
                                <p className="text-xs text-red-700 leading-relaxed font-medium">
                                    {sol.motivo_rejeicao || "Sem motivo especificado."}
                                </p>
                                {sol.blocked_by && (
                                    <div className="mt-2 pt-2 border-t border-red-200/50 text-[10px] text-red-500 italic">
                                        Bloqueado por: {sol.blocked_by}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <button
                                    onClick={() => handleGoToOrder(sol.numero_pedido)}
                                    className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <RefreshCcw size={14} /> Acessar Pedido e Corrigir
                                </button>
                                <button
                                    onClick={() => { setSelectedSolicitacao(sol); setIsDetailsModalOpen(true); }}
                                    className="w-full py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-600 font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Info size={14} /> Ver Detalhes
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 p-12">
                    <CheckCircle2 size={48} className="text-emerald-100" />
                    <p className="font-medium text-slate-500">Nenhuma devolução pendente.</p>
                    <p className="text-xs">Todos os seus pedidos estão fluindo corretamente.</p>
                </div>
            )
        )}

        {/* ABA: CARTEIRA DE PEDIDOS */}
        {activeTab === 'orders' && (
            paginatedPedidos.length > 0 ? (
            paginatedPedidos.map(p => {
                const valorRestante = p.itens.reduce((acc, i) => acc + (i.volume_restante * i.valor_unitario), 0);

                // Texto do Produto com Embalagem (Card Fechado)
                let productDisplay = "Mix de Produtos";
                if (p.itens.length === 1) {
                    productDisplay = `${p.itens[0].nome_produto} (${p.itens[0].unidade})`;
                } else if (p.itens.length > 1) {
                    // Mostra os 2 primeiros nomes com embalagem
                    productDisplay = `${p.itens[0].nome_produto} (${p.itens[0].unidade}), ${p.itens[1].nome_produto} (${p.itens[1].unidade})${p.itens.length > 2 ? ` +${p.itens.length - 2}` : ''}`;
                }

                return (
                <div key={p.id} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${expandedId === p.id ? 'border-crop-500 ring-1 ring-crop-500 shadow-lg' : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
                    <div onClick={() => toggleExpand(p.id)} className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center gap-4 md:gap-8 relative">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${p.status === StatusPedido.FINALIZADO ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                    
                    <div className="flex-1 min-w-0 pl-3">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">{p.numero_pedido}</span>
                            <span className="text-xs font-medium text-slate-400"><Calendar size={12} className="inline mr-1"/>{new Date(p.data_criacao).toLocaleDateString()}</span>
                            {renderStatusBadge(p)}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 truncate">{p.nome_cliente}</h3>
                        <div className="text-xs text-slate-500 font-medium mt-1">
                            Código: <span className="font-mono font-bold text-slate-700">{p.codigo_cliente}</span>
                        </div>
                        <div className="mt-1 text-xs flex items-center gap-2 text-slate-500">
                            <UserIcon size={12} /> {p.codigo_vendedor} - {p.nome_vendedor}
                        </div>
                    </div>

                    <div className="w-full md:w-80 bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                        <div className="flex items-start gap-2 mb-2">
                            <LayoutList size={16} className="text-slate-400 mt-0.5" />
                            {/* Aumentado o peso da fonte e cor para melhor visibilidade */}
                            <p className="text-sm font-bold text-slate-800 line-clamp-2" title={productDisplay}>
                                {productDisplay || <span className="text-slate-400 italic font-normal">Produto não identificado</span>}
                            </p>
                        </div>
                        
                        <div className="flex justify-between border-t border-slate-200/50 pt-1">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Volume a Faturar</span>
                                <span className={`text-sm font-bold ${p.volume_restante > 0 ? 'text-crop-600' : 'text-slate-400'}`}>
                                    {p.volume_restante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Itens</span>
                                <span className="text-xs font-semibold text-slate-600">{p.itens.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-right min-w-[150px]">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">Saldo Restante</p>
                        <p className="text-xl font-extrabold text-slate-900">R$ {valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Total Pedido: R$ {p.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    
                    {/* Botões de Ação */}
                    <div className="flex items-center gap-3">
                        {user.role === Role.ADMIN && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteOrder(p);
                                    }}
                                    className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all border border-transparent hover:border-red-100"
                                    title="Excluir Pedido"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${expandedId === p.id ? 'bg-crop-600 text-white rotate-180' : 'bg-slate-100 text-slate-400'}`}>
                                <ChevronDown size={20} />
                            </div>
                    </div>
                    </div>

                    {expandedId === p.id && (
                    <div className="bg-slate-50 border-t border-slate-100 p-6 animate-fade-in">
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="col-span-2 space-y-4">
                            
                            {/* TABELA DE ITENS (NOVO) */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Package size={16} /> Itens do Pedido
                                    </h4>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Produto / Embalagem</th>
                                            <th className="px-4 py-3 font-semibold text-right">Valor Unit.</th>
                                            <th className="px-4 py-3 font-semibold text-right">Volume Total</th>
                                            <th className="px-4 py-3 font-semibold text-right">Faturado</th>
                                            <th className="px-4 py-3 font-semibold text-right text-crop-600">A Faturar</th>
                                            <th className="px-4 py-3 font-semibold text-right">Valor Restante</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {p.itens.map(item => {
                                            const valorRestanteItem = item.volume_restante * item.valor_unitario;
                                            return (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800">{item.nome_produto}</div>
                                                    <div className="text-xs text-slate-500 font-medium">Embalagem: {item.unidade}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500">R$ {item.valor_unitario.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="px-4 py-3 text-right text-slate-600 font-medium">{item.volume_total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{(item.volume_faturado || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="px-4 py-3 text-right font-bold text-crop-600 bg-crop-50/30">{item.volume_restante.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900">R$ {valorRestanteItem.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>

                            {/* Timeline do Pedido */}
                            {orderHistory.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                                        <History size={16} /> Linha do Tempo
                                    </h4>
                                    <div className="relative space-y-3 pl-6 border-l-2 border-slate-200">
                                        {orderHistory.map((evento, idx) => {
                                            const isBlocked = evento.tipo === 'ERRO' || evento.acao.includes('BLOQUEIO') || evento.acao.includes('REJEITADO');
                                            const isSuccess = evento.tipo === 'SUCESSO';
                                            const isWarning = evento.tipo === 'ALERTA';

                                            let iconColor = 'bg-blue-500';
                                            let bgColor = 'bg-blue-50';
                                            let borderColor = 'border-blue-200';
                                            let icon = <History size={12} />;

                                            if (isBlocked) {
                                                iconColor = 'bg-red-500';
                                                bgColor = 'bg-red-50';
                                                borderColor = 'border-red-200';
                                                icon = <Ban size={12} />;
                                            } else if (isSuccess) {
                                                iconColor = 'bg-emerald-500';
                                                bgColor = 'bg-emerald-50';
                                                borderColor = 'border-emerald-200';
                                                icon = <CheckCircle2 size={12} />;
                                            } else if (isWarning) {
                                                iconColor = 'bg-yellow-500';
                                                bgColor = 'bg-yellow-50';
                                                borderColor = 'border-yellow-200';
                                                icon = <AlertTriangle size={12} />;
                                            }

                                            return (
                                                <div key={evento.id} className="relative">
                                                    <div className={`absolute -left-[1.6rem] w-6 h-6 rounded-full ${iconColor} flex items-center justify-center text-white shadow-md`}>
                                                        {icon}
                                                    </div>
                                                    <div className={`bg-white border ${borderColor} rounded-lg p-3 shadow-sm hover:shadow-md transition-all`}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${bgColor} ${isBlocked ? 'text-red-700' : isSuccess ? 'text-emerald-700' : isWarning ? 'text-yellow-700' : 'text-blue-700'}`}>
                                                                    {evento.setor}
                                                                </span>
                                                                {evento.usuario && (
                                                                    <span className="text-[10px] text-slate-500 font-medium">por {evento.usuario}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                <Clock size={10} />
                                                                {new Date(evento.data_evento).toLocaleString('pt-BR')}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-800 mb-1">{evento.acao}</p>
                                                        {evento.detalhes && (
                                                            <div className={`mt-2 p-2 rounded-lg ${bgColor} border ${borderColor}`}>
                                                                <p className="text-xs text-slate-700 leading-relaxed">{evento.detalhes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Solicitações Anteriores */}
                            {orderSolicitacoes.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                                    <FileCheck size={16} /> Histórico de Solicitações
                                    </h4>
                                    <div className="grid grid-cols-1 gap-3">
                                    {orderSolicitacoes.map(sol => (
                                        <div key={sol.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                                        sol.status === StatusSolicitacao.PENDENTE ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                        sol.status === StatusSolicitacao.FATURADO ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        sol.status === StatusSolicitacao.REJEITADO ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                        {sol.status.replace(/_/g, ' ')}
                                                    </span>
                                                    <span className="text-xs text-slate-400">{new Date(sol.data_solicitacao).toLocaleDateString()}</span>
                                                </div>

                                                {/* Exibe detalhes dos itens solicitados se houver, ou resumo legado */}
                                                {sol.itens_solicitados ? (
                                                    <ul className="text-xs space-y-1 mb-2">
                                                        {sol.itens_solicitados.map((is, idx) => (
                                                            <li key={idx} className="flex justify-between border-b border-slate-50 pb-1">
                                                                <span className="text-slate-700 font-medium">{is.nome_produto}</span>
                                                                <span className="font-bold text-slate-900">{is.volume} {is.unidade}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="text-xs font-bold text-slate-700 mb-2">{sol.nome_produto}</p>
                                                )}

                                                {/* Mostra bloqueios/rejeições */}
                                                {sol.motivo_rejeicao && (
                                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                                        <p className="text-[10px] font-bold text-red-800 uppercase mb-1 flex items-center gap-1">
                                                            <Ban size={10} /> Motivo do Bloqueio/Rejeição
                                                        </p>
                                                        <p className="text-xs text-red-700">{sol.motivo_rejeicao}</p>
                                                        {sol.blocked_by && (
                                                            <p className="text-[10px] text-red-600 mt-1 italic">Bloqueado por: {sol.blocked_by}</p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Comentários dos setores */}
                                                {(sol.obs_vendedor || sol.obs_comercial || sol.obs_credito || sol.prazo_pedido || sol.obs_faturamento) && (
                                                    <div className="mt-2 space-y-1.5">
                                                        {sol.obs_vendedor && (
                                                            <div className="text-xs bg-blue-50 border border-blue-100 p-2 rounded">
                                                                <span className="font-bold text-blue-800">💬 Vendedor:</span> <span className="text-blue-700">{sol.obs_vendedor}</span>
                                                            </div>
                                                        )}
                                                        {sol.obs_comercial && (
                                                            <div className="text-xs bg-cyan-50 border border-cyan-100 p-2 rounded">
                                                                <span className="font-bold text-cyan-800">💼 Comercial:</span> <span className="text-cyan-700">{sol.obs_comercial}</span>
                                                            </div>
                                                        )}
                                                        {sol.obs_credito && (
                                                            <div className="text-xs bg-purple-50 border border-purple-100 p-2 rounded">
                                                                <span className="font-bold text-purple-800">💳 Crédito:</span> <span className="text-purple-700">{sol.obs_credito}</span>
                                                            </div>
                                                        )}
                                                        {sol.prazo_pedido && (
                                                            <div className="text-xs bg-slate-50 border border-slate-100 p-2 rounded">
                                                                <span className="font-bold text-slate-700">📅 Prazo:</span> <span className="text-slate-600">{sol.prazo_pedido}</span>
                                                            </div>
                                                        )}
                                                        {sol.obs_faturamento && (
                                                            <div className="text-xs bg-orange-50 border border-orange-100 p-2 rounded">
                                                                <span className="font-bold text-orange-800">📦 Faturamento:</span> <span className="text-orange-700">{sol.obs_faturamento}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => { setSelectedSolicitacao(sol); setIsDetailsModalOpen(true); }}
                                                    className="mt-3 w-full py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-600 font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Info size={14} /> Ver Detalhes Completos
                                                </button>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-crop-200 shadow-sm h-fit sticky top-4">
                            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">Nova Solicitação</h4>
                            <div className="space-y-4">
                                
                                {/* INPUTS DINÂMICOS POR ITEM */}
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {p.itens.map(item => (
                                        <div key={item.id} className={`p-3 rounded-lg border transition-all ${item.volume_restante <= 0 ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 focus-within:border-crop-400 focus-within:ring-1 focus-within:ring-crop-400'}`}>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-xs font-bold text-slate-700 truncate max-w-[150px]" title={item.nome_produto}>{item.nome_produto}</label>
                                                <span className="text-[10px] text-slate-400">Máx: {item.volume_restante}</span>
                                            </div>
                                            <div className="relative">
                                                <input 
                                                    type="text"
                                                    inputMode="decimal"
                                                    disabled={item.volume_restante <= 0 || isSubmitting}
                                                    value={itemVolumes[item.nome_produto] || ''}
                                                    onChange={e => handleVolumeChange(item.nome_produto, e.target.value)}
                                                    placeholder="0,00"
                                                    className="w-full pl-3 pr-8 py-2 text-sm font-bold text-slate-900 bg-transparent outline-none disabled:cursor-not-allowed"
                                                />
                                                <span className="absolute right-2 top-2 text-xs font-bold text-slate-400">{item.unidade}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="mt-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Observação (Opcional)</label>
                                    <textarea
                                    value={requestObservation}
                                    onChange={(e) => setRequestObservation(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 focus:border-transparent outline-none resize-none min-h-[60px]"
                                    placeholder="Alguma observação para o faturamento?"
                                    disabled={isSubmitting}
                                    />
                                </div>

                                <button 
                                onClick={() => handleCreateRequest(p)}
                                disabled={isSubmitting || p.volume_restante <= 0}
                                className="w-full bg-crop-600 hover:bg-crop-700 text-white font-bold py-3 rounded-lg shadow-md shadow-crop-900/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                {isSubmitting ? (
                                    <><Loader2 size={18} className="animate-spin" /> Salvando...</>
                                ) : (
                                    "Confirmar Solicitação"
                                )}
                                </button>
                            </div>
                        </div>
                        </div>
                    </div>
                    )}
                </div>
                );
            })
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 p-12">
                    <Package size={48} className="opacity-20" />
                    <p>Nenhum pedido encontrado com estes filtros.</p>
                </div>
            )
        )}
      </div>

      {activeTab === 'orders' && totalPages > 1 && (
        <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between shadow-md">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <span className="font-bold text-slate-700">{startIndex + 1}</span> até <span className="font-bold text-slate-700">{Math.min(startIndex + ITEMS_PER_PAGE, filteredPedidos.length)}</span> de <span className="font-bold text-slate-700">{filteredPedidos.length}</span> pedidos
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      <OrderDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        solicitacao={selectedSolicitacao}
      />
    </div>
  );
};
export default OrderList;