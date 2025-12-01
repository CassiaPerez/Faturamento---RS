
import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, Pedido, StatusPedido, SolicitacaoFaturamento, StatusSolicitacao } from '../types';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  Package, 
  User as UserIcon,
  Calendar,
  Briefcase,
  X,
  SlidersHorizontal,
  History,
  FileCheck,
  CheckCircle2
} from 'lucide-react';

const OrderList: React.FC<{ user: User }> = ({ user }) => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [requestVolume, setRequestVolume] = useState<string>('');
  
  // Local state for expanded order history
  const [orderSolicitacoes, setOrderSolicitacoes] = useState<SolicitacaoFaturamento[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Filters State
  const [globalFilter, setGlobalFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    client: '',
    product: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    api.getPedidos(user).then(setPedidos);
  }, [user]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setOrderSolicitacoes([]);
    } else {
      setExpandedId(id);
      setRequestVolume('');
      // Fetch history
      setIsLoadingHistory(true);
      try {
        const history = await api.getSolicitacoesByPedido(id);
        setOrderSolicitacoes(history);
      } finally {
        setIsLoadingHistory(false);
      }
    }
  };

  const handleCreateRequest = async (pedido: Pedido) => {
    if (!requestVolume) return;
    
    const sanitizedVolume = requestVolume.replace(',', '.');
    const volNumber = Number(sanitizedVolume);

    if (isNaN(volNumber) || volNumber <= 0) {
      alert("Por favor, insira um volume válido.");
      return;
    }

    try {
      await api.createSolicitacao(pedido.id, volNumber, user);
      alert("Solicitação de faturamento enviada com sucesso!");
      // Don't close, just refresh data
      const updatedPedidos = await api.getPedidos(user);
      setPedidos(updatedPedidos);
      // Refresh history
      const history = await api.getSolicitacoesByPedido(pedido.id);
      setOrderSolicitacoes(history);
      setRequestVolume('');
    } catch (error: any) {
      console.error("Erro ao criar solicitação:", error);
      alert(`Falha ao criar solicitação: ${error.message || error}`);
    }
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      client: '',
      product: '',
      status: '',
      startDate: '',
      endDate: ''
    });
    setGlobalFilter('');
  };

  const filteredPedidos = pedidos.filter(p => {
    // 1. Global Search (matches multiple fields)
    const searchLower = globalFilter.toLowerCase();
    const matchesGlobal = 
      globalFilter === '' ||
      p.nome_cliente.toLowerCase().includes(searchLower) || 
      p.numero_pedido.toLowerCase().includes(searchLower) ||
      p.nome_produto.toLowerCase().includes(searchLower) ||
      p.codigo_cliente.includes(searchLower);

    if (!matchesGlobal) return false;

    // 2. Advanced Filters
    if (filters.client && !p.nome_cliente.toLowerCase().includes(filters.client.toLowerCase())) return false;
    if (filters.product && !p.nome_produto.toLowerCase().includes(filters.product.toLowerCase())) return false;
    if (filters.status && p.status !== filters.status) return false;
    
    if (filters.startDate) {
      // Compare only dates YYYY-MM-DD
      const orderDate = p.data_criacao;
      if (orderDate < filters.startDate) return false;
    }
    
    if (filters.endDate) {
      const orderDate = p.data_criacao;
      if (orderDate > filters.endDate) return false;
    }

    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      
      {/* Toolbar & Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          
          {/* Main Search */}
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
          
          {/* Controls */}
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 border rounded-xl font-bold transition-all shadow-sm ${
                showAdvancedFilters 
                  ? 'bg-crop-50 border-crop-200 text-crop-700 ring-2 ring-crop-100' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal size={18} />
              <span>Filtros</span>
            </button>
            <div className="px-5 py-3 bg-white text-slate-800 rounded-xl font-bold border border-slate-200 shadow-sm min-w-[140px] text-center flex items-center justify-center gap-2">
              <span className="text-lg">{filteredPedidos.length}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Resultados</span>
            </div>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Filter size={16} className="text-crop-500" />
                Refinar Resultados
              </h4>
              <button 
                onClick={clearFilters} 
                className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1.5 transition-colors px-3 py-1.5 hover:bg-red-50 rounded-lg"
              >
                <X size={14} /> Limpar Tudo
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Cliente</label>
                <input 
                  type="text" 
                  value={filters.client}
                  onChange={(e) => handleFilterChange('client', e.target.value)}
                  placeholder="Filtrar por nome..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 focus:border-transparent transition-all"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Produto</label>
                <input 
                  type="text" 
                  value={filters.product}
                  onChange={(e) => handleFilterChange('product', e.target.value)}
                  placeholder="Filtrar por produto..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Status</label>
                <div className="relative">
                  <select 
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 focus:border-transparent appearance-none cursor-pointer transition-all"
                  >
                    <option value="">Todos os Status</option>
                    <option value={StatusPedido.PENDENTE}>Pendente</option>
                    <option value={StatusPedido.PARCIALMENTE_FATURADO}>Parcialmente Faturado</option>
                    <option value={StatusPedido.FATURADO}>Faturado (Sem saldo)</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Data de Criação</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="date" 
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 focus:border-transparent transition-all"
                  />
                  <span className="text-slate-300">-</span>
                  <input 
                    type="date" 
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 pb-10">
        {filteredPedidos.length > 0 ? (
          filteredPedidos.map(p => (
            <div 
              key={p.id} 
              className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                expandedId === p.id 
                  ? 'border-crop-500 ring-1 ring-crop-500 shadow-lg' 
                  : 'border-slate-200 shadow-sm hover:shadow-md hover:border-crop-300'
              }`}
            >
              {/* Card Header / Summary Row */}
              <div 
                onClick={() => toggleExpand(p.id)}
                className="p-5 cursor-pointer flex flex-col md:flex-row md:items-center gap-4 md:gap-8 relative"
              >
                {/* Status Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  p.status === StatusPedido.FATURADO ? 'bg-emerald-500' : 
                  p.status === StatusPedido.PARCIALMENTE_FATURADO ? 'bg-blue-500' : 'bg-orange-400'
                }`} />

                {/* ID & Client */}
                <div className="flex-1 min-w-0 pl-3">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 group-hover:border-slate-300">
                      {p.numero_pedido}
                    </span>
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                      <Calendar size={12} /> {new Date(p.data_criacao).toLocaleDateString('pt-BR')}
                    </span>
                    {p.status !== StatusPedido.PENDENTE && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${
                        p.status === StatusPedido.FATURADO 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {p.status === StatusPedido.FATURADO ? 'Faturado' : 'Parcial'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 truncate tracking-tight">{p.nome_cliente}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                    <Briefcase size={14} className="text-slate-400" />
                    <span className="truncate">{p.codigo_cliente}</span>
                  </div>
                  <div className="mt-2.5 flex items-center">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/80 text-xs group-hover:border-slate-300 transition-colors">
                      <UserIcon size={12} className="text-slate-400" />
                      <span className="font-mono font-bold text-slate-600">{p.codigo_vendedor}</span>
                      <span className="text-slate-300">|</span>
                      <span className="font-medium text-slate-700 truncate max-w-[150px] md:max-w-[240px]" title={p.nome_vendedor}>
                        {p.nome_vendedor}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Product & Volume */}
                <div className="w-full md:w-80 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-sm font-semibold text-slate-800 mb-2 leading-relaxed" title={p.nome_produto}>
                    {p.nome_produto}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Disponível</span>
                      <span className={`text-base font-bold ${p.volume_restante > 0 ? 'text-crop-600' : 'text-slate-400'}`}>
                        {p.volume_restante.toLocaleString('pt-BR')} <span className="text-xs font-medium">{p.unidade}</span>
                      </span>
                    </div>
                    {p.volume_restante < p.volume_total && (
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total</span>
                        <span className="text-sm font-semibold text-slate-600">
                          {p.volume_total.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Value & Action */}
                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto min-w-[180px]">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-0.5 tracking-wider">Valor Total</p>
                    <p className="text-xl font-extrabold text-slate-900">
                      R$ {p.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                    expandedId === p.id 
                      ? 'bg-crop-600 text-white rotate-180 shadow-md' 
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}>
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === p.id && (
                <div className="bg-slate-50 border-t border-slate-100 p-6 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Left Column: Details & History */}
                    <div className="space-y-6">
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <p className="text-xs text-slate-400 uppercase font-bold mb-1 tracking-wider">Volume Inicial</p>
                          <p className="text-lg font-bold text-slate-700">{p.volume_total.toLocaleString('pt-BR')} {p.unidade}</p>
                        </div>
                        <div className={`p-4 rounded-xl border shadow-sm ${
                          p.volume_restante > 0 ? 'bg-white border-crop-200' : 'bg-slate-100 border-slate-200 opacity-70'
                        }`}>
                          <p className="text-xs text-crop-600 uppercase font-bold mb-1 tracking-wider">Saldo Atual</p>
                          <p className="text-lg font-bold text-crop-700">{p.volume_restante.toLocaleString('pt-BR')} {p.unidade}</p>
                        </div>
                      </div>

                      {/* Request History Table */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                          <History size={16} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Histórico de Solicitações</span>
                        </div>
                        
                        {isLoadingHistory ? (
                          <div className="p-6 text-center text-xs text-slate-400 italic">Carregando histórico...</div>
                        ) : orderSolicitacoes.length > 0 ? (
                          <div className="max-h-[150px] overflow-y-auto">
                            <table className="w-full text-xs text-left">
                              <thead className="text-slate-400 font-medium bg-slate-50 sticky top-0">
                                <tr>
                                  <th className="px-4 py-2">Data</th>
                                  <th className="px-4 py-2">Volume</th>
                                  <th className="px-4 py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {orderSolicitacoes.map(sol => (
                                  <tr key={sol.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 text-slate-600">{new Date(sol.data_solicitacao).toLocaleDateString()}</td>
                                    <td className="px-4 py-2 font-bold text-slate-700">{sol.volume_solicitado} {sol.unidade}</td>
                                    <td className="px-4 py-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                        sol.status === StatusSolicitacao.FATURADO ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                        sol.status === StatusSolicitacao.APROVADO ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                        sol.status === StatusSolicitacao.REJEITADO ? 'bg-red-50 text-red-700 border-red-100' :
                                        'bg-orange-50 text-orange-700 border-orange-100'
                                      }`}>
                                        {sol.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-6 text-center text-xs text-slate-400">Nenhuma solicitação registrada.</div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Action Panel */}
                    <div className="bg-white p-6 rounded-2xl border border-crop-100 shadow-sm flex flex-col justify-center h-full">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Package size={18} className="text-crop-500" />
                        Nova Solicitação de Faturamento
                      </h4>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-slate-500 uppercase">Quantidade a Faturar</label>
                            {p.volume_restante > 0 && (
                              <button 
                                onClick={() => setRequestVolume(p.volume_restante.toString())}
                                className="text-[10px] font-bold text-crop-600 hover:text-crop-800 uppercase tracking-wide"
                              >
                                Usar Saldo Total
                              </button>
                            )}
                          </div>
                          <div className="relative group">
                            <input 
                              type="number" 
                              value={requestVolume}
                              onChange={(e) => setRequestVolume(e.target.value)}
                              placeholder="0.00"
                              disabled={p.volume_restante <= 0}
                              className="w-full pl-4 pr-16 py-3 text-lg font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-crop-500 focus:border-transparent transition-all disabled:bg-slate-100 disabled:text-slate-400"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">{p.unidade}</span>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button 
                            onClick={() => setExpandedId(null)}
                            className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex-1"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleCreateRequest(p)}
                            disabled={!requestVolume || Number(requestVolume.replace(',', '.')) <= 0 || Number(requestVolume.replace(',', '.')) > p.volume_restante}
                            className="px-6 py-3 rounded-xl font-bold text-white bg-crop-600 hover:bg-crop-700 shadow-lg shadow-crop-900/20 active:scale-95 transition-all flex-[2] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                          >
                            Confirmar Solicitação
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="bg-slate-100 p-6 rounded-full mb-4">
              <Package size={48} className="text-slate-300" />
            </div>
            <p className="text-lg font-bold text-slate-600">Nenhum pedido encontrado</p>
            <p className="text-sm mt-1">Tente ajustar seus filtros de busca.</p>
            <button onClick={clearFilters} className="mt-6 text-crop-600 font-bold hover:underline">
              Limpar todos os filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderList;
