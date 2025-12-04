
import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, SolicitacaoFaturamento, StatusSolicitacao, Role } from '../types';
import { CheckCircle2, XCircle, Banknote, CalendarDays, AlertTriangle, Eye, Lock, Search, X, MessageSquarePlus } from 'lucide-react';

const CreditPanel: React.FC<{ user: User }> = ({ user }) => {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFaturamento[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'rejected'>('pending');
  
  // States for Rejection Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // States for Approval Modal
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approvalObservation, setApprovalObservation] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.getSolicitacoes(user).then(data => {
      setSolicitacoes(data);
    });
  }, [user]);

  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);

  const openApproveModal = (id: string) => {
    setApproveId(id);
    setApprovalObservation('');
    setIsApproveModalOpen(true);
  };

  const handleConfirmApproval = async () => {
    if (!approveId) return;
    // Aprovação específica do crédito com observação
    await api.approveSolicitacaoStep(approveId, Role.CREDITO, user, approvalObservation);
    // Atualiza localmente
    setSolicitacoes(prev => prev.map(s => s.id === approveId ? { 
      ...s, 
      aprovacao_credito: true,
      obs_credito: approvalObservation || undefined 
    } : s));
    
    setIsApproveModalOpen(false);
    setApproveId(null);
  };

  const openRejectModal = (id: string) => {
    setRejectId(id);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmRejection = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    await api.updateSolicitacaoStatus(rejectId, StatusSolicitacao.REJEITADO, user, rejectReason);
    const formattedReason = `[BLOQUEIO: CRÉDITO] ${rejectReason}`;
    setSolicitacoes(prev => prev.map(s => s.id === rejectId ? { ...s, status: StatusSolicitacao.REJEITADO, motivo_rejeicao: formattedReason } : s));
    setIsRejectModalOpen(false);
    setRejectId(null);
  };

  // Logica de Filtro: Status deve ser EM_ANALISE e minha flag deve ser false
  const pendingList = solicitacoes.filter(s => 
    (s.status === StatusSolicitacao.EM_ANALISE || s.status === StatusSolicitacao.EM_ANALISE_CREDITO) 
    && !s.aprovacao_credito
  );
  
  const rejectedList = solicitacoes.filter(s => s.status === StatusSolicitacao.REJEITADO);
  const displayList = activeTab === 'pending' ? pendingList : rejectedList;

  const filteredList = displayList.filter(s => 
    s.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.numero_pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.criado_por.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-end gap-4">
         <div>
           <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><Banknote className="text-indigo-600" /> Análise de Crédito</h2>
           <p className="text-slate-500 mt-1">Liberação financeira e verificação de limite.</p>
         </div>
         <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Aguardando ({pendingList.length})</button>
            <button onClick={() => setActiveTab('rejected')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'rejected' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Bloqueados ({rejectedList.length})</button>
         </div>
       </div>

       <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={18} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" /></div>
            <input type="text" placeholder="Filtrar por Cliente, Pedido..." className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"><X size={16} /></button>)}
         </div>
         <div className="text-xs text-slate-500 font-medium">Exibindo {filteredList.length} de {displayList.length} registros</div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         {filteredList.map(sol => (
           <div key={sol.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
             <div className="p-5 border-b border-slate-100 bg-gradient-to-b from-indigo-50/50 to-white flex justify-between items-start">
               <div><span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">{sol.numero_pedido}</span><h4 className="font-bold text-slate-900 line-clamp-1 text-lg" title={sol.nome_cliente}>{sol.nome_cliente}</h4></div>
               {activeTab === 'rejected' && (<span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-full border border-red-200 flex items-center gap-1"><Lock size={10} /> BLOQUEADO</span>)}
             </div>
             <div className="p-5 flex-1 space-y-4">
               <div><p className="text-xs text-slate-500 font-semibold uppercase">Volume</p><p className="text-2xl font-bold text-slate-800">{sol.volume_solicitado} <span className="text-sm font-medium text-slate-400">{sol.unidade}</span></p></div>
               {activeTab === 'pending' && (<div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex items-start gap-2"><AlertTriangle size={16} className="text-orange-500 mt-0.5" /><div><p className="text-xs font-bold text-orange-800">Verificar Limite</p><p className="text-[10px] text-orange-700 leading-tight mt-0.5">Consulte o histórico de pagamentos antes de liberar.</p></div></div>)}
               {activeTab === 'rejected' && sol.motivo_rejeicao && (<div className="bg-red-50 p-3 rounded-lg border border-red-100"><p className="text-[10px] font-bold text-red-800 uppercase tracking-wide mb-1 flex items-center gap-1"><Lock size={10} /> Motivo do Bloqueio</p><p className="text-xs text-red-700 leading-relaxed font-medium break-words">{sol.motivo_rejeicao}</p></div>)}
               <div className="space-y-2 pt-2 border-t border-slate-50"><div className="flex items-center text-xs text-slate-500"><CalendarDays size={12} className="mr-2 text-slate-400" /> Data: <span className="font-medium text-slate-700 ml-1">{new Date(sol.data_solicitacao).toLocaleDateString()}</span></div></div>
             </div>
             {activeTab === 'pending' && (
               <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                 <button onClick={() => openRejectModal(sol.id)} className="flex-1 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"><XCircle size={14} /> Bloquear</button>
                 <button onClick={() => openApproveModal(sol.id)} className="flex-[2] px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"><CheckCircle2 size={14} /> Liberar Crédito</button>
               </div>
             )}
             {activeTab === 'rejected' && (<div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center"><span className="text-xs text-slate-400 font-medium flex items-center gap-1"><Eye size={12} /> Acompanhando status</span></div>)}
           </div>
         ))}
       </div>
       {filteredList.length === 0 && (<div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">{searchTerm ? <Search size={32} className="text-slate-300" /> : <Banknote size={32} className="text-slate-300" />}</div><p className="text-slate-500 font-medium">{searchTerm ? 'Nenhum resultado para esta busca.' : (activeTab === 'pending' ? 'Nenhuma pendência de crédito.' : 'Nenhum bloqueio recente.')}</p></div>)}
       
       {/* Modal de Rejeição/Bloqueio */}
       {isRejectModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-red-50/50"><div className="p-2 bg-red-100 rounded-full text-red-600"><AlertTriangle size={24} /></div><h3 className="text-lg font-bold text-slate-800">Bloquear Solicitação</h3></div>
             <div className="p-6 space-y-4"><p className="text-sm text-slate-600">Por favor, informe o motivo do bloqueio de crédito.</p><textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo (ex: Limite excedido, pendências financeiras...)" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm min-h-[100px]" autoFocus /></div>
             <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3"><button onClick={() => setIsRejectModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button><button onClick={handleConfirmRejection} disabled={!rejectReason.trim()} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">Confirmar Bloqueio</button></div>
           </div>
         </div>
       )}

       {/* Modal de Aprovação com Observação */}
       {isApproveModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-indigo-50/50">
               <div className="p-2 bg-indigo-100 rounded-full text-indigo-600"><CheckCircle2 size={24} /></div>
               <h3 className="text-lg font-bold text-slate-800">Confirmar Liberação</h3>
             </div>
             <div className="p-6 space-y-4">
               <p className="text-sm text-slate-600">Deseja adicionar alguma observação à liberação de crédito? (Opcional)</p>
               <div className="relative">
                 <MessageSquarePlus className="absolute left-3 top-3 text-slate-400" size={16} />
                 <textarea 
                   value={approvalObservation} 
                   onChange={(e) => setApprovalObservation(e.target.value)} 
                   placeholder="Ex: Liberado mediante pagamento antecipado..." 
                   className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm min-h-[100px]" 
                   autoFocus 
                 />
               </div>
             </div>
             <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
               <button onClick={() => setIsApproveModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
               <button onClick={handleConfirmApproval} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 transition-all text-sm">Confirmar Liberação</button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default CreditPanel;
