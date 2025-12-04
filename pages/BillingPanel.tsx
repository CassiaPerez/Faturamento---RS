
import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, SolicitacaoFaturamento, StatusSolicitacao, Role } from '../types';
import { CheckCircle2, XCircle, FileCheck, Clock, CalendarDays, User as UserIcon, Send, AlertTriangle, RefreshCcw, XOctagon, Search, X } from 'lucide-react';

const BillingPanel: React.FC<{ user: User }> = ({ user }) => {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFaturamento[]>([]);
  const [activeTab, setActiveTab] = useState<'triage' | 'invoice' | 'rejected'>('triage');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.getSolicitacoes(user).then(setSolicitacoes);
  }, [user]);

  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);

  const handleStatusChange = async (id: string, newStatus: StatusSolicitacao) => {
    await api.updateSolicitacaoStatus(id, newStatus, user);
    setSolicitacoes(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
  };

  const openRejectModal = (id: string) => {
    setRejectId(id);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmRejection = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    await api.updateSolicitacaoStatus(rejectId, StatusSolicitacao.REJEITADO, user, rejectReason);
    const formattedReason = `[BLOQUEIO: FATURAMENTO] ${rejectReason}`;
    setSolicitacoes(prev => prev.map(s => s.id === rejectId ? { ...s, status: StatusSolicitacao.REJEITADO, motivo_rejeicao: formattedReason } : s));
    setIsRejectModalOpen(false);
    setRejectId(null);
  };

  const triageList = solicitacoes.filter(s => s.status === StatusSolicitacao.PENDENTE);
  const invoiceList = solicitacoes.filter(s => s.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO);
  const rejectedList = solicitacoes.filter(s => s.status === StatusSolicitacao.REJEITADO);
  
  // Lista de itens que estão sendo analisados por Crédito/Comercial
  const inProgressList = solicitacoes.filter(s => 
    s.status === StatusSolicitacao.EM_ANALISE || 
    s.status === StatusSolicitacao.EM_ANALISE_COMERCIAL || // Legado
    s.status === StatusSolicitacao.EM_ANALISE_CREDITO // Legado
  );

  const getSourceList = () => {
    switch (activeTab) {
      case 'triage': return triageList;
      case 'invoice': return invoiceList;
      case 'rejected': return rejectedList;
      default: return [];
    }
  };

  const sourceList = getSourceList();
  const filteredList = sourceList.filter(s => 
    s.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.numero_pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.criado_por.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-end gap-4">
         <div>
           <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Faturamento</h2>
           <p className="text-slate-500 mt-1">Gestão de fluxo de aprovação e emissão de notas.</p>
         </div>
         <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('triage')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'triage' ? 'bg-crop-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Triagem ({triageList.length})</button>
            <button onClick={() => setActiveTab('invoice')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'invoice' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Emitir Notas ({invoiceList.length})</button>
            <button onClick={() => setActiveTab('rejected')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'rejected' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Rejeitados ({rejectedList.length})</button>
         </div>
       </div>

       <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={18} className="text-slate-400 group-focus-within:text-crop-600 transition-colors" /></div>
            <input type="text" placeholder="Filtrar por Cliente, Pedido..." className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 focus:border-transparent transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"><X size={16} /></button>)}
         </div>
         <div className="text-xs text-slate-500 font-medium">Exibindo {filteredList.length} de {sourceList.length} registros</div>
       </div>

       {inProgressList.length > 0 && activeTab === 'triage' && (
         <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
           <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Clock size={20} /></div>
           <div><p className="text-sm font-bold text-blue-900">Processos em Andamento</p><p className="text-xs text-blue-700">{inProgressList.length} solicitações aguardando aprovação Comercial e Crédito.</p></div>
         </div>
       )}

       <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         {filteredList.map(sol => (
           <div key={sol.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
             <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-gradient-to-b from-slate-50 to-white">
               <div><span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">{sol.numero_pedido}</span><h4 className="font-bold text-slate-900 line-clamp-1 text-lg" title={sol.nome_cliente}>{sol.nome_cliente}</h4></div>
               <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1 ${sol.status === StatusSolicitacao.PENDENTE ? 'bg-orange-50 text-orange-700 border-orange-100' : sol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : sol.status === StatusSolicitacao.REJEITADO ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-100' }`}><Clock size={10} />{sol.status === StatusSolicitacao.PENDENTE ? 'Triagem' : sol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO ? 'Pronto' : sol.status === StatusSolicitacao.REJEITADO ? 'Rejeitado' : 'Análise'}</div>
             </div>
             <div className="p-5 flex-1 space-y-4">
               <div className="flex justify-between items-end"><div><p className="text-xs text-slate-500 font-semibold uppercase">Volume Solicitado</p><p className="text-2xl font-bold text-slate-800">{sol.volume_solicitado} <span className="text-sm font-medium text-slate-400">{sol.unidade}</span></p></div></div>
               
               {activeTab === 'invoice' && (
                 <div className="flex gap-2 flex-wrap mt-2">
                   <span className="text-[10px] bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200 flex items-center gap-1 font-bold uppercase">
                     <CheckCircle2 size={12} /> Comercial: OK
                   </span>
                   <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200 flex items-center gap-1 font-bold uppercase">
                     <CheckCircle2 size={12} /> Crédito: OK
                   </span>
                 </div>
               )}

               {sol.status === StatusSolicitacao.REJEITADO && sol.motivo_rejeicao && (<div className="bg-red-50 p-3 rounded-lg border border-red-100"><p className="text-[10px] font-bold text-red-800 uppercase tracking-wide mb-1 flex items-center gap-1"><AlertTriangle size={10} /> Motivo / Origem</p><p className="text-xs text-red-700 leading-relaxed font-medium">{sol.motivo_rejeicao}</p></div>)}
               <div className="space-y-2 pt-2 border-t border-slate-50"><div className="flex items-center text-xs text-slate-500"><UserIcon size={12} className="mr-2 text-slate-400" /> Solicitado por: <span className="font-medium text-slate-700 ml-1">{sol.criado_por}</span></div><div className="flex items-center text-xs text-slate-500"><CalendarDays size={12} className="mr-2 text-slate-400" /> Data: <span className="font-medium text-slate-700 ml-1">{new Date(sol.data_solicitacao).toLocaleDateString()}</span></div></div>
             </div>
             <div className="p-4 bg-slate-50 border-t border-slate-100">
               {activeTab === 'triage' && sol.status === StatusSolicitacao.PENDENTE && (
                 <div className="flex gap-3">
                   <button onClick={() => openRejectModal(sol.id)} className="flex-1 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"><XCircle size={14} /> Rejeitar</button>
                   <button onClick={() => handleStatusChange(sol.id, StatusSolicitacao.EM_ANALISE)} className="flex-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"><Send size={14} /> Enviar p/ Aprovação</button>
                 </div>
               )}
               {activeTab === 'invoice' && sol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO && (
                 <button onClick={() => handleStatusChange(sol.id, StatusSolicitacao.FATURADO)} className="w-full px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"><FileCheck size={14} /> Faturar</button>
               )}
               {activeTab === 'rejected' && sol.status === StatusSolicitacao.REJEITADO && (
                 <div className="flex gap-3">
                   <button className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all flex items-center justify-center gap-2" disabled><XOctagon size={14} /> Cancelado</button>
                   <button onClick={() => handleStatusChange(sol.id, StatusSolicitacao.PENDENTE)} className="flex-1 px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"><RefreshCcw size={14} /> Reiniciar Fluxo</button>
                 </div>
               )}
             </div>
           </div>
         ))}
       </div>
       {filteredList.length === 0 && (<div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">{searchTerm ? <Search size={32} className="text-slate-300" /> : <FileCheck size={32} className="text-slate-300" />}</div><p className="text-slate-500 font-medium">{searchTerm ? 'Nenhuma solicitação encontrada com este filtro.' : 'Nenhuma solicitação nesta aba.'}</p></div>)}
       {isRejectModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-red-50/50"><div className="p-2 bg-red-100 rounded-full text-red-600"><AlertTriangle size={24} /></div><h3 className="text-lg font-bold text-slate-800">Rejeitar Solicitação</h3></div>
             <div className="p-6 space-y-4"><p className="text-sm text-slate-600">Informe o motivo da rejeição para devolver o pedido.</p><textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ex: Erro no pedido, falta de estoque..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm min-h-[100px]" autoFocus /></div>
             <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3"><button onClick={() => setIsRejectModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button><button onClick={handleConfirmRejection} disabled={!rejectReason.trim()} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">Confirmar Rejeição</button></div>
           </div>
         </div>
       )}
    </div>
  );
};

export default BillingPanel;
