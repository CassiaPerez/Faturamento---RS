
import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, Pedido } from '../types';
import { TrendingUp, Scale, Package, ChevronRight, AlertCircle } from 'lucide-react';

interface DashboardProps {
  user: User;
  onNavigate: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await api.getPedidos(user);
      setPedidos(data);
    };
    fetchData();
  }, [user]);

  const totalVolume = pedidos.reduce((acc, curr) => acc + curr.volume_total, 0);
  const totalPedidos = pedidos.length;
  
  // Recent orders
  const recentOrders = [...pedidos]
    .sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime())
    .slice(0, 15); // Increased slice since we have more space

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
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
          <h3 className="text-4xl font-extrabold text-slate-900 mt-2">{totalPedidos}</h3>
          <div className="mt-4 flex items-center text-sm text-slate-500 font-medium">
            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs mr-2">Total</span>
            Carteira Ativa
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
    </div>
  );
};

export default Dashboard;
