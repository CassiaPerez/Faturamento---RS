import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/dataService';
import { User, Pedido, SolicitacaoFaturamento, StatusSolicitacao, Role, StatusPedido, HistoricoEvento } from '../types';
import { 
  Search, Filter, ChevronDown, Package, User as UserIcon, Calendar, Briefcase, X, SlidersHorizontal, History, 
  AlertTriangle, Lock, Ban, MessageSquare, ChevronLeft, ChevronRight, CheckCircle2, Clock, Banknote, TrendingUp, FileCheck, Loader2, Hourglass, Trash2
} from 'lucide-react';

const ITEMS_PER_PAGE = 50;

const OrderList: React.FC<{ user: User }> = ({ user }) => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [requestVolume, setRequestVolume] = useState<string>('');
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

  useEffect(() => {
    api.getPedidos(user).then(setPedidos);
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [globalFilter, filters]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setOrderSolicitacoes([]);
    } else {
      setExpandedId(id);
      setRequestVolume('');
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

  const handleDeleteOrder = async (pedido: Pedido) => {
      if (!window.confirm(`ATENÇÃO: Deseja realmente excluir o pedido ${pedido.numero_pedido}?\n\nIsso apagará todas as solicitações e históricos vinculados.`)) {
          return;
      }
      
      try {
          await api.deletePedido(pedido.id);
          // Força a remoção imediata da UI sem esperar nova busca
          setPedidos(prev => prev.filter(p => p.id !== pedido.id));
          if (expandedId === pedido.id) setExpandedId(null);
      } catch (e: any) {
          alert("Erro ao excluir pedido: " + e.message);
      }
  };

  const handleCreateRequest = async (pedido: Pedido) => {
    if (!requestVolume) return;
    setIsSubmitting(true);
    
    let valStr = requestVolume.trim();
    valStr = valStr.replace(/\./g, ''); 
    valStr = valStr.replace(',', '.');  
    
    const volNumber = parseFloat(valStr);

    if (isNaN(volNumber) || volNumber <= 0) {
      alert("Por favor, insira um volume válido maior que zero.");
      setIsSubmitting(false);
      return;
    }

    if (volNumber > (Number(pedido.volume_restante) + 0.0001)) {
      alert(`Volume solicitado (${volNumber}) excede o saldo disponível (${pedido.volume_restante})`);
      setIsSubmitting(false);
      return;
    }

    try {
      await api.createSolicitacao(pedido.id, volNumber, user, requestObservation);
      
      const updatedPedidos = await api.getPedidos(user);
      setPedidos(updatedPedidos);
      
      // Atualiza listas de histórico e solicitações buscando do serviço (que já contem o novo registro)
      const history = await api.getSolicitacoesByPedido(pedido.id);
      setOrderSolicitacoes(history);
      
      api.getHistoricoPedido(pedido.id).then(serverTimeline => {
          setOrderHistory(serverTimeline);
      });
      
      setRequestVolume('');
      setRequestObservation('');
      alert("Solicitação criada e salva com sucesso!");
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
      const matchesGlobal = 
        globalFilter === '' ||
        p.nome_cliente.toLowerCase().includes(searchLower) || 
        p.numero_pedido.toLowerCase().includes(searchLower) ||
        p.nome_produto.toLowerCase().includes(searchLower) ||
        p.codigo_cliente.includes(searchLower);

      if (!matchesGlobal) return false;

      if (filters.client && !p.nome_cliente.toLowerCase().includes(filters.client.toLowerCase())) return false;
      if (filters.product && !p.nome_produto.toLowerCase().includes(filters.product.toLowerCase())) return false;
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
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={20} className="text-slate-400 group-focus-within:text-brand-500 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Busca rápida (Cliente, Produto, ID)..." 
              className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-base focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          </div>
          
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
        </div>

        {showAdvancedFilters && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Filter size={16} className="text-crop-500" />Refinar Resultados</h4>
              <button onClick={clearFilters} className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors px-3 py-1.5 hover:bg-red-50 rounded-lg"><X size={14} /> Limpar Tudo</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1.5"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Cliente</label><input type="text" value={filters.client} onChange={(e) => handleFilterChange('client', e.target.value)} placeholder="Filtrar por nome..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 transition-all" /></div>
              <div className="space-y-1.5"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Produto</label><input type="text" value={filters.product} onChange={(e) => handleFilterChange('product', e.target.value)} placeholder="Filtrar por produto..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 transition-all" /></div>
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
        {paginatedPedidos.length > 0 ? (
          paginatedPedidos.map(p => {
            const unitPrice = p.valor_total / p.volume_total;
            const valorRestante = p.volume_restante * unitPrice;
            const valorFaturadoReal = p.valor_faturado || (p.volume_faturado || 0) * unitPrice;

            return (
              <div key={p.id} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${expandedId === p.id ? 'border-crop-500 ring-1 ring-crop-500 shadow-lg' : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
                <div onClick={() => toggleExpand(p.id)} className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center gap-4 md:gap-8 relative">
                   <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${p.status === StatusPedido.FINALIZADO ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                   
                   <div className="flex-1 min-w-0 pl-3">
                      <div className="flex items-center gap-3 mb-1">
                         <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{p.numero_pedido}</span>
                         <span className="text-xs font-medium text-slate-400"><Calendar size={12} className="inline mr-1"/>{new Date(p.data_criacao).toLocaleDateString()}</span>
                         {renderStatusBadge(p)}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 truncate">{p.nome_cliente}</h3>
                      <div className="mt-2 text-xs flex items-center gap-2 text-slate-500">
                          <UserIcon size={12} /> {p.codigo_vendedor} - {p.nome_vendedor}
                      </div>
                   </div>

                   <div className="w-full md:w-80 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <p className="text-sm font-semibold text-slate-800 mb-2 line-clamp-2" title={p.nome_produto}>{p.nome_produto}</p>
                      <div className="flex justify-between border-t border-slate-200/50 pt-1">
                          <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Restante</span>
                              <span className={`text-sm font-bold ${p.volume_restante > 0 ? 'text-crop-600' : 'text-slate-400'}`}>{p.volume_restante.toLocaleString('pt-BR')} {p.unidade}</span>
                          </div>
                          <div className="flex flex-col text-right">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Total Inicial</span>
                              <span className="text-xs font-semibold text-slate-600">{p.volume_total.toLocaleString('pt-BR')}</span>
                          </div>
                      </div>
                   </div>

                   <div className="text-right min-w-[150px]">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">Saldo Restante</p>
                      <p className="text-xl font-extrabold text-slate-900">R$ {valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Total: R$ {p.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                   </div>
                   
                   {/* Botões de Ação */}
                   <div className="flex items-center gap-3">
                       {user.role === Role.ADMIN && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation(); // Impede expandir ao clicar
                                    handleDeleteOrder(p);
                                }}
                                className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all border border-transparent hover:border-red-100"
                                title="Excluir Pedido (Admin)"
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
                    
                    <div className="grid grid-cols-3 gap-4 mb-8 bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group/stats">
                        <div className="text-center border-r border-slate-100">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total do Pedido</p>
                            <p className="text-lg font-bold text-slate-800">{p.volume_total.toLocaleString('pt-BR')} <span className="text-xs text-slate-400">{p.unidade}</span></p>
                            <p className="text-sm font-medium text-slate-500">R$ {p.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-center border-r border-slate-100">
                            <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Faturado / Entregue</p>
                            <p className="text-lg font-bold text-emerald-700">{(p.volume_faturado || 0).toLocaleString('pt-BR')} <span className="text-xs text-emerald-500">{p.unidade}</span></p>
                            <p className="text-sm font-medium text-emerald-600">R$ {valorFaturadoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-bold text-crop-600 uppercase mb-1">Saldo a Faturar</p>
                            <p className="text-lg font-bold text-crop-700">{p.volume_restante.toLocaleString('pt-BR')} <span className="text-xs text-crop-500">{p.unidade}</span></p>
                            <p className="text-sm font-medium text-crop-600">R$ {valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                       <div className="col-span-2 space-y-4">
                          
                          {/* Active Solicitations Section (Added to show details like Prazo) */}
                          {orderSolicitacoes.length > 0 && (
                             <div className="mb-6">
                                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                                   <FileCheck size={16} /> Solicitações Recentes
                                </h4>
                                <div className="grid grid-cols-1 gap-3">
                                   {orderSolicitacoes.map(sol => (
                                      <div key={sol.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                         <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                                    sol.status === StatusSolicitacao.PENDENTE ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                    sol.status === StatusSolicitacao.EM_ANALISE ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                    sol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    sol.status === StatusSolicitacao.REJEITADO ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-600'
                                                }`}>
                                                    {sol.status.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-xs text-slate-400">{new Date(sol.data_solicitacao).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-sm font-bold text-slate-800">Vol: {sol.volume_solicitado} {sol.unidade}</span>
                                            </div>
                                            {(sol.prazo_pedido || sol.obs_faturamento) && (
                                                <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                     {sol.prazo_pedido && <div><span className="font-bold">Prazo:</span> {sol.prazo_pedido}</div>}
                                                     {sol.obs_faturamento && <div><span className="font-bold">Obs Fat:</span> {sol.obs_faturamento}</div>}
                                                </div>
                                            )}
                                         </div>
                                         <div className="flex flex-col items-end gap-1">
                                             {sol.status === StatusSolicitacao.EM_ANALISE && (
                                                 <>
                                                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${sol.aprovacao_comercial ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                         Comercial: {sol.aprovacao_comercial ? 'OK' : '...'}
                                                     </span>
                                                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${sol.aprovacao_credito ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                         Crédito: {sol.aprovacao_credito ? 'OK' : '...'}
                                                     </span>
                                                 </>
                                             )}
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          )}

                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2"><History size={16} /> Linha do Tempo</h4>
                          <div className="bg-white rounded-xl border border-slate-200 p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                             {orderHistory.length > 0 ? (
                               <div className="relative pl-4 border-l-2 border-slate-100 space-y-6 py-2">
                                  {orderHistory.map((evt, idx) => {
                                    // Lógica para colorir eventos de reprovação/bloqueio em vermelho
                                    const isError = evt.tipo === 'ERRO' || evt.acao.toLowerCase().includes('bloqueado') || evt.acao.toLowerCase().includes('rejeitado');
                                    const isSuccess = evt.tipo === 'SUCESSO';
                                    const isAlert = evt.tipo === 'ALERTA';

                                    return (
                                      <div key={idx} className="relative">
                                         <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                                             isError ? 'bg-red-500' : isSuccess ? 'bg-emerald-500' : isAlert ? 'bg-amber-500' : 'bg-blue-400'
                                         }`}></div>
                                         <div className="flex justify-between items-start">
                                             <div>
                                                 <p className={`text-sm font-bold ${isError ? 'text-red-700' : 'text-slate-800'}`}>{evt.acao}</p>
                                                 <p className={`text-xs mt-0.5 ${isError ? 'text-red-600 font-medium' : 'text-slate-500'}`}>{evt.detalhes}</p>
                                                 <p className="text-[10px] text-slate-400 mt-1 font-mono uppercase">Por: {evt.usuario} • {evt.setor}</p>
                                             </div>
                                             <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(evt.data_evento).toLocaleString()}</span>
                                         </div>
                                      </div>
                                    );
                                  })}
                               </div>
                             ) : (
                               <div className="text-center text-slate-400 text-sm py-4">Sem histórico registrado.</div>
                             )}
                          </div>
                       </div>

                       <div className="bg-white p-5 rounded-xl border border-crop-200 shadow-sm h-fit">
                          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">Nova Solicitação</h4>
                          <div className="space-y-4">
                            <div>
                               <div className="flex justify-between mb-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Volume</label>
                                  {p.volume_restante > 0 && <button onClick={() => setRequestVolume(p.volume_restante.toLocaleString('pt-BR'))} className="text-[10px] font-bold text-crop-600 hover:underline">USAR MÁXIMO</button>}
                               </div>
                               <div className="relative">
                                  <input 
                                    type="text" 
                                    inputMode="decimal"
                                    value={requestVolume} 
                                    onChange={e => {
                                        // Permite digitação natural de números BR (0-9, vírgula, ponto)
                                        const val = e.target.value.replace(/[^0-9.,]/g, '');
                                        setRequestVolume(val);
                                    }} 
                                    disabled={p.volume_restante <= 0 || isSubmitting} 
                                    className="w-full pl-4 pr-16 py-3 text-lg font-bold text-slate-900 bg-white border-2 border-crop-200 rounded-xl focus:ring-4 focus:ring-crop-100 focus:border-crop-500 transition-all placeholder:text-slate-300 disabled:bg-slate-50 disabled:opacity-70"
                                    placeholder="0,00" 
                                  />
                                  <span className="absolute right-3 top-3.5 text-xs font-bold text-slate-400 uppercase">{p.unidade}</span>
                               </div>
                            </div>
                            
                            <div className="mt-2">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Observação (Opcional)</label>
                                <textarea
                                  value={requestObservation}
                                  onChange={(e) => setRequestObservation(e.target.value)}
                                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 focus:border-transparent outline-none resize-none min-h-[60px]"
                                  placeholder="Alguma observação para o faturamento?"
                                  disabled={p.volume_restante <= 0 || isSubmitting}
                                />
                            </div>

                            <button 
                               onClick={() => handleCreateRequest(p)}
                               disabled={!requestVolume || p.volume_restante <= 0 || isSubmitting}
                               className="w-full bg-crop-600 hover:bg-crop-700 text-white font-bold py-3 rounded-lg shadow-md shadow-crop-900/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                               {isSubmitting ? (
                                 <><Loader2 size={18} className="animate-spin" /> Salvando...</>
                               ) : (
                                 "Confirmar Solicitação"
                               )}
                            </button>
                            {/* Mensagem informativa para pedidos totalmente solicitados mas não finalizados */}
                            {p.volume_restante <= 0 && p.status === StatusPedido.AGUARDANDO_EMISSAO && (
                                <p className="text-xs text-yellow-600 font-medium text-center mt-2 flex items-center justify-center gap-1">
                                    <Hourglass size={12} /> Aguardando emissão de NF para finalizar.
                                </p>
                            )}
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
        )}
      </div>

      {totalPages > 1 && (
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
    </div>
  );
};
export default OrderList;