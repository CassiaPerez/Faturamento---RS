
import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, Pedido, Role, SolicitacaoFaturamento, StatusSolicitacao, StatusPedido } from '../types';
import { TrendingUp, Scale, Package, ChevronRight, AlertCircle, FileCheck, CheckCircle2, CalendarDays, History, Clock, Ban } from 'lucide-react';

interface DashboardProps {
  user: User;
  onNavigate: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [historicoFaturado, setHistoricoFaturado] = useState<SolicitacaoFaturamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  // Define se é um perfil de Backoffice (Que deve ver histórico ao invés de carteira)
  const isBackOffice = [Role.FATURAMENTO, Role.COMERCIAL, Role.CREDITO].includes(user.role);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      if (isBackOffice) {
        // Para Backoffice: Busca solicitações e filtra apenas as Faturadas para o histórico
        const solicitacoes = await api.getSolicitacoes(user);
        const faturados = solicitacoes
          .filter(s => s.status === StatusSolicitacao.FATURADO)
          .sort((a, b) => new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime());
        setHistoricoFaturado(faturados);
      } else {
        // Para Gerente/Admin/Vendedor: Busca Carteira de Pedidos (A API já filtra por vendedor se necessário)
        const data = await api.getPedidos(user);
        setPedidos(data);
      }
      
      setLoading(false);
    };
    fetchData();
  }, [user, isBackOffice]);

  // --- RENDERIZAÇÃO PARA BACKOFFICE (Histórico de Faturamento) ---
  if (isBackOffice) {
    const totalFaturadoVolume = historicoFaturado.reduce((acc, curr) => acc + curr.volume_solicitado, 0);
    const countNotas = historicoFaturado.length;

    return (
      <div className="space-y-8 animate-fade-in pb-10">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
             <History className="text-emerald-600" /> Histórico de Faturamento
           </h2>
           <p className="text-slate-500 mt-1">Visão consolidada de solicitações finalizadas e notas emitidas.</p>
        </div>

        {/* KPI Cards Backoffice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <FileCheck size={64} className="text-emerald-600" />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                  <FileCheck size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Notas Emitidas</p>
              </div>
              <h3 className="text-4xl font-extrabold text-slate-900 mt-2">{countNotas}</h3>
              <div className="mt-4 text-xs font-bold text-slate-400 uppercase">
                 Entregas Realizadas
              </div>
           </div>

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Scale size={64} className="text-blue-600" />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                  <Scale size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Volume Faturado</p>
              </div>
              <h3 className="text-4xl font-extrabold text-slate-900 mt-2">
                {totalFaturadoVolume.toLocaleString('pt-BR')} <span className="text-xl text-slate-400 font-semibold">Ton/Un</span>
              </h3>
              <div className="mt-4 text-xs font-bold text-slate-400 uppercase">
                 Acumulado Geral
              </div>
           </div>
        </div>

        {/* Lista de Histórico */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              Últimas Notas Emitidas
            </h3>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
              Status: FATURADO
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
            {historicoFaturado.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {historicoFaturado.map((item) => (
                  <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.numero_pedido}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <CalendarDays size={12} /> {new Date(item.data_solicitacao).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800">{item.nome_cliente}</h4>
                      <p className="text-xs text-slate-500">{item.nome_produto}</p>
                      {item.prazo_pedido && (
                         <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                           Prazo: {item.prazo_pedido}
                         </span>
                      )}
                    </div>
                    
                    <div className="text-right">
                       <p className="text-[10px] text-slate-400 font-bold uppercase">Volume</p>
                       <div className="flex items-center justify-end gap-2">
                          <p className="text-lg font-bold text-slate-800">{item.volume_solicitado.toLocaleString('pt-BR')} {item.unidade}</p>
                          <CheckCircle2 size={18} className="text-emerald-500" />
                       </div>
                       <p className="text-[10px] text-slate-400">Solicitado por: {item.criado_por}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center flex flex-col items-center text-slate-400">
                 <History size={48} className="opacity-20 mb-3" />
                 <p>Nenhum histórico de faturamento recente.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERIZAÇÃO PADRÃO (GERENTE, ADMIN, VENDEDOR) ---

  const totalVolume = pedidos.reduce((acc, curr) => acc + curr.volume_total, 0);
  const totalPedidos = pedidos.length;
  const pedidosAtivos = pedidos.filter(p => p.status !== StatusPedido.FINALIZADO);
  const pedidosFinalizados = pedidos.filter(p => p.status === StatusPedido.FINALIZADO);

  // Recent orders
  const recentOrders = [...pedidos]
    .sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime())
    .slice(0, 15);

  // Histórico completo (ordenado por data de criação)
  const historicoCompleto = [...pedidos]
    .sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime());

  return (
    <div className="space-y-8 animate-fade-in pb-10">

      <div>
         <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
           <Package className="text-brand-600" /> Dashboard Comercial
         </h2>
         <p className="text-slate-500 mt-1">
           {user.role === Role.VENDEDOR
             ? `Visão da carteira de: ${user.name}`
             : 'Visão gerencial de toda a carteira ativa.'}
         </p>
      </div>

      {/* TABS DE NAVEGAÇÃO */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <TrendingUp size={18} /> Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'history' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <History size={18} /> Histórico Completo ({pedidos.length})
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quantity Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Package size={64} className="text-blue-600" />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                  <Package size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pedidos em Carteira</p>
              </div>
              <h3 className="text-4xl font-extrabold text-slate-900 mt-2">{pedidosAtivos.length}</h3>
              <div className="mt-4 flex items-center text-sm text-slate-500 font-medium">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs mr-2">Ativos</span>
                <span className="text-emerald-600 font-bold">{pedidosFinalizados.length} finalizados</span>
              </div>
            </div>

            {/* Volume Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Scale size={64} className="text-indigo-600" />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                  <Scale size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Volume Total</p>
              </div>
              <h3 className="text-4xl font-extrabold text-slate-900 mt-2">{totalVolume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-xl text-slate-400 font-semibold">Vol/Qtd</span></h3>
              <div className="mt-4 flex items-center text-sm text-emerald-600 font-bold">
                <TrendingUp size={16} className="mr-1" />
                <span>+12%</span> <span className="text-slate-400 font-medium ml-1">vs mês anterior</span>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-8">

            {/* Recent Orders List (Full Width) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[600px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              Últimos Pedidos
            </h3>
            <span className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-500">
              Recentes
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {recentOrders.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors group flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between md:justify-start items-center gap-3 mb-1">
                        <span className="font-mono text-xs text-slate-400 font-medium group-hover:text-brand-600 transition-colors bg-slate-100 px-2 py-0.5 rounded">
                          {order.numero_pedido}
                        </span>
                        <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100 uppercase">
                          {order.status}
                        </span>
                        <span className="text-xs text-slate-400 hidden md:inline-block">
                          {new Date(order.data_criacao).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-base truncate">{order.nome_cliente}</h4>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{order.nome_produto}</p>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-6 md:w-1/3">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Volume</p>
                        <p className="text-sm font-bold text-slate-700">{order.volume_total.toLocaleString('pt-BR')} {order.unidade}</p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Valor</p>
                        <p className="text-base font-bold text-slate-900">R$ {order.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 p-6 text-center">
                <AlertCircle size={32} className="opacity-20" />
                <p className="text-sm">Nenhum pedido recente encontrado.</p>
              </div>
            )}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <button
              onClick={() => onNavigate('orders')}
              className="text-sm font-bold text-brand-600 hover:text-brand-800 flex items-center justify-center gap-1 mx-auto transition-colors"
            >
              Ver Carteira Completa <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
        </>
      )}

      {/* ABA: HISTÓRICO COMPLETO */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* KPI Cards do Histórico */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Package size={20} className="text-slate-600" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase">Total Pedidos</p>
              </div>
              <h3 className="text-3xl font-extrabold text-slate-900">{pedidos.length}</h3>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase">Finalizados</p>
              </div>
              <h3 className="text-3xl font-extrabold text-emerald-600">{pedidosFinalizados.length}</h3>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Clock size={20} className="text-blue-600" />
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase">Em Andamento</p>
              </div>
              <h3 className="text-3xl font-extrabold text-blue-600">{pedidosAtivos.length}</h3>
            </div>
          </div>

          {/* Lista de Histórico Completo */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <History size={20} /> Histórico de Todos os Pedidos
              </h3>
              <p className="text-xs text-slate-500 mt-1">Visualização completa incluindo pedidos finalizados e em andamento</p>
            </div>

            <div className="overflow-y-auto max-h-[700px] custom-scrollbar">
              {historicoCompleto.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {historicoCompleto.map((pedido) => {
                    const isFinalizado = pedido.status === StatusPedido.FINALIZADO;
                    const isBloqueado = pedido.motivo_status?.includes('BLOQUEIO');

                    return (
                      <div key={pedido.id} className={`p-5 hover:bg-slate-50 transition-colors ${isFinalizado ? 'bg-emerald-50/30' : ''} ${isBloqueado ? 'bg-red-50/30' : ''}`}>
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-mono text-xs text-slate-500 font-bold bg-white px-2.5 py-1 rounded border border-slate-200">
                                {pedido.numero_pedido}
                              </span>

                              {/* Badge de Status */}
                              <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase border flex items-center gap-1 ${
                                isFinalizado
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isBloqueado
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : pedido.status === StatusPedido.AGUARDANDO_EMISSAO
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {isFinalizado && <CheckCircle2 size={10} />}
                                {isBloqueado && <Ban size={10} />}
                                {!isFinalizado && !isBloqueado && <Clock size={10} />}
                                {isFinalizado ? 'FINALIZADO' : isBloqueado ? 'BLOQUEADO' : pedido.status}
                              </span>

                              {/* Badge do Setor Atual */}
                              {pedido.setor_atual && !isFinalizado && (
                                <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded border border-slate-200">
                                  📍 {pedido.setor_atual}
                                </span>
                              )}

                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <CalendarDays size={12} /> {new Date(pedido.data_criacao).toLocaleDateString('pt-BR')}
                              </span>
                            </div>

                            <h4 className="font-bold text-slate-800 text-base mb-1">{pedido.nome_cliente}</h4>
                            <p className="text-xs text-slate-500">{pedido.nome_produto}</p>

                            {/* Mostra motivo se bloqueado */}
                            {pedido.motivo_status && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-xs text-red-700 font-medium">{pedido.motivo_status}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-8">
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">Volume</p>
                              <p className="text-sm font-bold text-slate-700">{pedido.volume_total.toLocaleString('pt-BR')} {pedido.unidade}</p>
                              <p className="text-[10px] text-emerald-600 font-bold">Faturado: {pedido.volume_faturado.toLocaleString('pt-BR')}</p>
                            </div>

                            <div className="text-right min-w-[120px]">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">Valor Total</p>
                              <p className="text-lg font-bold text-slate-900">
                                R$ {pedido.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center text-slate-400">
                  <History size={48} className="opacity-20 mb-3" />
                  <p>Nenhum histórico disponível.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
