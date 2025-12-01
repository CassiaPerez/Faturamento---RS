
import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, SolicitacaoFaturamento, StatusSolicitacao } from '../types';
import { CheckCircle2, XCircle, FileCheck, Clock, CalendarDays, User as UserIcon } from 'lucide-react';

const BillingPanel: React.FC<{ user: User }> = ({ user }) => {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFaturamento[]>([]);

  useEffect(() => {
    api.getSolicitacoes(user).then(setSolicitacoes);
  }, [user]);

  const handleStatusChange = async (id: string, newStatus: StatusSolicitacao) => {
    await api.updateSolicitacaoStatus(id, newStatus, user);
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="flex justify-between items-end">
         <div>
           <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Faturamento</h2>
           <p className="text-slate-500 mt-1">Central de aprovação e emissão de notas fiscais.</p>
         </div>
         <div className="flex gap-3">
           <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium shadow-sm">
             <span className="text-slate-500">Total Pendente:</span> <span className="ml-2 text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">{solicitacoes.filter(s => s.status === StatusSolicitacao.PENDENTE).length}</span>
           </div>
         </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         {solicitacoes.map(sol => (
           <div key={sol.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
             
             {/* Card Header */}
             <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-gradient-to-b from-slate-50 to-white">
               <div>
                 <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                   {sol.numero_pedido}
                 </span>
                 <h4 className="font-bold text-slate-900 line-clamp-1 text-lg" title={sol.nome_cliente}>
                   {sol.nome_cliente}
                 </h4>
               </div>
               <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1
                 ${sol.status === StatusSolicitacao.PENDENTE ? 'bg-orange-50 text-orange-700 border-orange-100' : 
                   sol.status === StatusSolicitacao.APROVADO ? 'bg-blue-50 text-blue-700 border-blue-100' :
                   sol.status === StatusSolicitacao.FATURADO ? 'bg-green-50 text-green-700 border-green-100' :
                   'bg-red-50 text-red-700 border-red-100' }`}>
                 {sol.status === StatusSolicitacao.PENDENTE && <Clock size={10} />}
                 {sol.status === StatusSolicitacao.FATURADO && <CheckCircle2 size={10} />}
                 {sol.status}
               </div>
             </div>

             {/* Card Body */}
             <div className="p-5 flex-1 space-y-4">
               <div className="flex justify-between items-end">
                 <div>
                   <p className="text-xs text-slate-500 font-semibold uppercase">Volume Solicitado</p>
                   <p className="text-2xl font-bold text-slate-800">{sol.volume_solicitado} <span className="text-sm font-medium text-slate-400">{sol.unidade}</span></p>
                 </div>
               </div>

               <div className="space-y-2 pt-2 border-t border-slate-50">
                 <div className="flex items-center text-xs text-slate-500">
                   <UserIcon size={12} className="mr-2 text-slate-400" />
                   Solicitado por: <span className="font-medium text-slate-700 ml-1">{sol.criado_por}</span>
                 </div>
                 <div className="flex items-center text-xs text-slate-500">
                   <CalendarDays size={12} className="mr-2 text-slate-400" />
                   Data: <span className="font-medium text-slate-700 ml-1">{new Date(sol.data_solicitacao).toLocaleDateString()}</span>
                 </div>
                 {sol.aprovado_por && (
                   <div className="flex items-center text-xs text-slate-500">
                     <FileCheck size={12} className="mr-2 text-green-500" />
                     Aprovado por: <span className="font-medium text-slate-700 ml-1">{sol.aprovado_por}</span>
                   </div>
                 )}
               </div>
             </div>

             {/* Card Actions */}
             <div className="p-4 bg-slate-50 border-t border-slate-100">
               {sol.status === StatusSolicitacao.PENDENTE && (
                 <div className="flex gap-3">
                   <button 
                    onClick={() => handleStatusChange(sol.id, StatusSolicitacao.REJEITADO)}
                    className="flex-1 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg border border-transparent hover:border-red-100 transition-all flex items-center justify-center gap-2"
                   >
                     <XCircle size={14} /> Rejeitar
                   </button>
                   <button 
                    onClick={() => handleStatusChange(sol.id, StatusSolicitacao.APROVADO)}
                    className="flex-1 px-4 py-2 text-xs font-bold text-white bg-crop-600 hover:bg-crop-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
                   >
                     <CheckCircle2 size={14} /> Aprovar
                   </button>
                 </div>
               )}

               {sol.status === StatusSolicitacao.APROVADO && (
                 <button 
                  onClick={() => handleStatusChange(sol.id, StatusSolicitacao.FATURADO)}
                  className="w-full px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
                 >
                   <FileCheck size={14} /> Faturar
                 </button>
               )}
               
               {(sol.status === StatusSolicitacao.FATURADO || sol.status === StatusSolicitacao.REJEITADO) && (
                 <div className="text-center py-2 text-xs text-slate-400 font-medium italic">
                   Processo finalizado
                 </div>
               )}
             </div>

           </div>
         ))}
       </div>
       
       {solicitacoes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <FileCheck size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Nenhuma solicitação encontrada.</p>
          </div>
       )}
    </div>
  );
};

export default BillingPanel;
