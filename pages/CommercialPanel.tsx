import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, SolicitacaoFaturamento, StatusSolicitacao, Role, Pedido } from '../types';
import { CheckCircle2, XCircle, TrendingUp, CalendarDays, User as UserIcon, AlertTriangle, Eye, Search, X, MessageSquarePlus, Unlock, Lock, Ban, RefreshCcw, MessageSquare, Calendar, DollarSign, Package, AlertOctagon } from 'lucide-react';

const CommercialPanel: React.FC<{ user: User }> = ({ user }) => {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFaturamento[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'rejected'>('pending');
  
  // Rejection Modal (Global)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // Approval Modal (Detailed Item Check)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approvalObservation, setApprovalObservation] = useState('');
  
  // Estado para conferência de itens no modal de aprovação
  const [approvalItems, setApprovalItems] = useState<{
      nome_produto: string;
      volume: number;
      unidade: string;
      valor_unitario: number;
      valor_total: number;
      selected: boolean;
      rejectObs: string;
  }[]>([]);

  // Unblock Modal
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
  const [unblockId, setUnblockId] = useState<string | null>(null);
  const [unblockReason, setUnblockReason] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.getSolicitacoes(user).then(data => {
      setSolicitacoes(data);
    });
  }, [user]);

  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);

  const openApproveModal = async (id: string) => {
    const sol = solicitacoes.find(s => s.id === id);
    if (!sol) return;
    
    // Busca o pedido original para obter os preços unitários
    // Nota: Como não temos acesso direto aos pedidos aqui, faremos um fetch rápido
    const allPedidos = await api.getPedidos(user);
    const pedido = allPedidos.find(p => p.id === sol.pedido_id);

    setApproveId(id);
    setApprovalObservation('');
    
    let itemsToApprove: any[] = [];
    
    if (sol.itens_solicitados && sol.itens_solicitados.length > 0) {
        itemsToApprove = sol.itens_solicitados.map(item => {
            const pedidoItem = pedido?.itens.find(pi => pi.nome_produto === item.nome_produto);
            const precoUnitario = pedidoItem ? pedidoItem.valor_unitario : 0;
            return {
                nome_produto: item.nome_produto,
                volume: item.volume,
                unidade: item.unidade,
                valor_unitario: precoUnitario,
                valor_total: item.volume * precoUnitario,
                selected: true,
                rejectObs: ''
            };
        });
    } else {
        // Fallback legado
        const pedidoItem = pedido?.itens.find(pi => pi.nome_produto === sol.nome_produto);
        const precoUnitario = pedidoItem ? pedidoItem.valor_unitario : (sol.valor_solicitado && sol.volume_solicitado ? sol.valor_solicitado / sol.volume_solicitado : 0);
        itemsToApprove = [{
            nome_produto: sol.nome_produto,
            volume: sol.volume_solicitado,
            unidade: sol.unidade,
            valor_unitario: precoUnitario,
            valor_total: sol.valor_solicitado || 0,
            selected: true,
            rejectObs: ''
        }];
    }
    
    setApprovalItems(itemsToApprove);
    setIsApproveModalOpen(true);
  };

  const toggleItemSelection = (index: number) => {
      setApprovalItems(prev => {
          const next = [...prev];
          next[index].selected = !next[index].selected;
          // Se selecionar, limpa obs de rejeição. Se desselecionar, mantém vazia para preencher.
          if (next[index].selected) next[index].rejectObs = '';
          return next;
      });
  };

  const updateItemRejectObs = (index: number, value: string) => {
      setApprovalItems(prev => {
          const next = [...prev];
          next[index].rejectObs = value;
          return next;
      });
  };

  const handleConfirmApproval = async () => {
    if (!approveId) return;

    // Separa aprovados e rejeitados
    const aprovados = approvalItems.filter(i => i.selected).map(i => ({
        nome_produto: i.nome_produto,
        volume: i.volume,
        unidade: i.unidade
    }));

    const rejeitados = approvalItems.filter(i => !i.selected).map(i => ({
        nome_produto: i.nome_produto,
        volume: i.volume,
        unidade: i.unidade,
        obs: i.rejectObs || 'Rejeitado pelo comercial sem observação específica.'
    }));

    // Validação: Se rejeitou item, precisa ter obs? (Opcional, mas boa prática)
    // Se não selecionou nada, é rejeição total (melhor usar botão de rejeição global, mas vamos suportar aqui)
    if (aprovados.length === 0 && rejeitados.length > 0) {
        if (!confirm("Todos os itens foram desmarcados. Isso rejeitará a solicitação inteira. Continuar?")) return;
        // Chama fluxo de rejeição global usando a primeira obs
        await api.updateSolicitacaoStatus(approveId, StatusSolicitacao.REJEITADO, user, rejeitados[0].obs, Role.COMERCIAL);
    } else {
        // Fluxo normal ou parcial
        await api.approveSolicitacaoStep(approveId, Role.COMERCIAL, user, approvalObservation, aprovados, rejeitados);
    }
    
    // Atualiza localmente (Simplificado, reload ideal seria via fetch novamente)
    const updatedData = await api.getSolicitacoes(user);
    setSolicitacoes(updatedData);
    
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
    // Passa Role.COMERCIAL explicitamente para garantir que o bloqueio seja atribuído ao setor correto
    await api.updateSolicitacaoStatus(rejectId, StatusSolicitacao.REJEITADO, user, rejectReason, Role.COMERCIAL);
    const formattedReason = `[BLOQUEIO: COMERCIAL] ${rejectReason}`;
    setSolicitacoes(prev => prev.map(s => s.id === rejectId ? { ...s, status: StatusSolicitacao.REJEITADO, motivo_rejeicao: formattedReason, blocked_by: Role.COMERCIAL } : s));
    setIsRejectModalOpen(false);
    setRejectId(null);
  };

  const openUnblockModal = (id: string) => {
    setUnblockId(id);
    setUnblockReason('');
    setIsUnblockModalOpen(true);
  };

  const handleConfirmUnblock = async () => {
    if (!unblockId || !unblockReason.trim()) return;
    try {
      await api.unblockSolicitacao(unblockId, user); 
      const updated = await api.getSolicitacoes(user);
      setSolicitacoes(updated);
      setIsUnblockModalOpen(false);
      setUnblockId(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Lógica Paralela: Mostra tudo que está em análise e que EU ainda não aprovei.
  // Não importa se o crédito já aprovou ou não.
  const pendingList = solicitacoes.filter(s => 
    (s.status === StatusSolicitacao.EM_ANALISE) 
    && !s.aprovacao_comercial
  );
  
  const rejectedList = solicitacoes.filter(s => s.status === StatusSolicitacao.REJEITADO);
  const displayList = activeTab === 'pending' ? pendingList : rejectedList;

  const filteredList = displayList.filter(s => 
    s.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.numero_pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.criado_por.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Regra Estrita: Só pode desbloquear se for Admin ou se foi o Comercial que bloqueou
  const canUnblock = (sol: SolicitacaoFaturamento) => {
     return user.role === Role.ADMIN || sol.blocked_by === Role.COMERCIAL;
  };

  const getBlockerColor = (role?: Role) => {
    switch (role) {
      case Role.CREDITO: return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case Role.COMERCIAL: return 'bg-blue-100 text-blue-800 border-blue-200';
      case Role.FATURAMENTO: return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-red-50 text-red-700 border-red-100';
    }
  };

  const getBlockerLabel = (role?: Role) => {
    switch (role) {
      case Role.CREDITO: return 'SETOR CRÉDITO';
      case Role.COMERCIAL: return 'SETOR COMERCIAL';
      case Role.FATURAMENTO: return 'SETOR FATURAMENTO';
      default: return 'BLOQUEADO';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-end gap-4">
         <div>
           <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2"><TrendingUp className="text-blue-600" /> Aprovação Comercial</h2>
           <p className="text-slate-500 mt-1">Validação de margem e estratégia comercial.</p>
         </div>
         <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pending' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Pendentes ({pendingList.length})</button>
            <button onClick={() => setActiveTab('rejected')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'rejected' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Rejeitados ({rejectedList.length})</button>
         </div>
       </div>

       <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={18} className="text-slate-400 group-focus-within:text-blue-600 transition-colors" /></div>
            <input type="text" placeholder="Filtrar por Cliente, Pedido..." className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"><X size={16} /></button>)}
         </div>
         <div className="text-xs text-slate-500 font-medium">Exibindo {filteredList.length} de {displayList.length} registros</div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         {filteredList.map(sol => (
           <div key={sol.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
             <div className="p-5 border-b border-slate-100 bg-gradient-to-b from-blue-50/50 to-white flex justify-between items-start">
               <div>
                 <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">{sol.numero_pedido}</span>
                 <h4 className="font-bold text-slate-900 line-clamp-1 text-lg" title={`${sol.codigo_cliente ? `[${sol.codigo_cliente}] ` : ''}${sol.nome_cliente}`}>
                   {sol.codigo_cliente && <span className="text-blue-600 mr-1">[{sol.codigo_cliente}]</span>}
                   {sol.nome_cliente}
                 </h4>
               </div>
               {activeTab === 'rejected' && (<span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-full border border-red-200 flex items-center gap-1"><Lock size={10} /> BLOQUEADO</span>)}
             </div>
             <div className="p-5 flex-1 space-y-4">
               {/* Exibir Produto */}
               <div className="mb-2 pb-2 border-b border-slate-50">
                   <p className="text-[10px] text-slate-400 font-bold uppercase">Produto</p>
                   <p className="text-sm font-semibold text-slate-700 leading-tight">{sol.nome_produto || 'Não identificado'}</p>
               </div>
               
               <div className="flex justify-between items-end">
                   <div>
                       <p className="text-xs text-slate-500 font-semibold uppercase">Volume</p>
                       <p className="text-2xl font-bold text-slate-800">{sol.volume_solicitado.toLocaleString('pt-BR')} <span className="text-sm font-medium text-slate-400">{sol.unidade}</span></p>
                   </div>
                   <div className="text-right">
                       <p className="text-xs text-slate-500 font-semibold uppercase">Valor Solicitado</p>
                       <p className="text-xl font-bold text-slate-900">
                         {sol.valor_solicitado 
                            ? sol.valor_solicitado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                            : <span className="text-slate-400 text-sm">Não calc.</span>
                         }
                       </p>
                   </div>
               </div>
               
               {/* Mostrar observação do crédito se houver */}
               {sol.obs_credito && (
                   <div className="flex items-start gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                       <MessageSquare size={12} className="text-indigo-600 mt-0.5 shrink-0" />
                       <div className="text-[10px] text-indigo-800">
                           <span className="font-bold">Crédito:</span> {sol.obs_credito}
                       </div>
                   </div>
               )}
               {/* Status de Aprovação do Crédito */}
               {sol.aprovacao_credito && (
                   <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold uppercase bg-emerald-50 px-2 py-1 rounded w-fit">
                       <CheckCircle2 size={10} /> Crédito Aprovado
                   </div>
               )}

               {/* Exibir Obs Vendedor */}
               {sol.obs_vendedor && (
                   <div className="flex items-start gap-2 bg-amber-50 p-2 rounded-lg border border-amber-100 mt-2">
                       <MessageSquare size={12} className="text-amber-600 mt-0.5 shrink-0" />
                       <div className="text-[10px] text-amber-800">
                           <span className="font-bold">Nota do Vendedor:</span> {sol.obs_vendedor}
                       </div>
                   </div>
               )}

               {/* Exibir Observações do Faturamento/Envio */}
               {(sol.prazo_pedido || sol.obs_faturamento) && (
                   <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2 space-y-1">
                      {sol.prazo_pedido && (
                         <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                            <Calendar size={12} className="text-slate-400" />
                            <span className="font-bold uppercase">Prazo:</span> {sol.prazo_pedido}
                         </div>
                      )}
                      {sol.obs_faturamento && (
                         <div className="flex items-start gap-1.5 text-[10px] text-slate-600">
                            <MessageSquare size={12} className="text-slate-400 mt-0.5" />
                            <div><span className="font-bold uppercase">Obs. Fat:</span> {sol.obs_faturamento}</div>
                         </div>
                      )}
                   </div>
               )}

               {activeTab === 'pending' && (
                   <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                       <TrendingUp size={16} className="text-blue-500 mt-0.5" />
                       <div>
                           <p className="text-xs font-bold text-blue-800">Verificar Rentabilidade</p>
                           <p className="text-[10px] text-blue-700 leading-tight mt-0.5">Analise a margem de contribuição deste pedido.</p>
                       </div>
                   </div>
               )}

               {activeTab === 'rejected' && sol.motivo_rejeicao && (
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                     <div className="flex items-center justify-between mb-1">
                       <p className="text-[10px] font-bold text-red-800 uppercase tracking-wide flex items-center gap-1"><Lock size={10} /> Motivo do Bloqueio</p>
                       {sol.blocked_by && (
                         <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase flex items-center gap-1 ${getBlockerColor(sol.blocked_by as Role)}`}>
                           <Ban size={8} /> {getBlockerLabel(sol.blocked_by as Role)}
                         </span>
                       )}
                    </div>
                     <p className="text-xs text-red-700 leading-relaxed font-medium break-words">{sol.motivo_rejeicao.replace(/\[.*?\]\s*/, '')}</p>
                     {sol.blocked_by && sol.blocked_by !== Role.COMERCIAL && (
                        <p className="text-[10px] text-red-500 mt-2 border-t border-red-100 pt-1 italic flex items-center gap-1">
                           <Lock size={8} /> Bloqueado por: {sol.blocked_by}
                        </p>
                    )}
                  </div>
               )}
               <div className="space-y-2 pt-2 border-t border-slate-50"><div className="flex items-center text-xs text-slate-500"><CalendarDays size={12} className="mr-2 text-slate-400" /> Data: <span className="font-medium text-slate-700 ml-1">{new Date(sol.data_solicitacao).toLocaleDateString()}</span></div></div>
             </div>
             {activeTab === 'pending' && (
               <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                 <button onClick={() => openRejectModal(sol.id)} className="flex-1 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"><XCircle size={14} /> Bloquear Tudo</button>
                 <button onClick={() => openApproveModal(sol.id)} className="flex-[2] px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"><CheckCircle2 size={14} /> Conferir & Aprovar</button>
               </div>
             )}
             {activeTab === 'rejected' && (
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                  {canUnblock(sol) ? (
                    <button onClick={() => openUnblockModal(sol.id)} className="w-full px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"><Unlock size={14} /> Reconsiderar / Desbloquear</button>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><Eye size={12} /> Somente leitura (Bloqueio Externo)</span>
                  )}
                </div>
             )}
           </div>
         ))}
       </div>
       {filteredList.length === 0 && (<div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">{searchTerm ? <Search size={32} className="text-slate-300" /> : <TrendingUp size={32} className="text-slate-300" />}</div><p className="text-slate-500 font-medium">{searchTerm ? 'Nenhum resultado para esta busca.' : (activeTab === 'pending' ? 'Nenhuma pendência comercial.' : 'Nenhum bloqueio recente.')}</p></div>)}
       
       {/* Modal de Rejeição/Bloqueio (Global) */}
       {isRejectModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-red-50/50"><div className="p-2 bg-red-100 rounded-full text-red-600"><AlertTriangle size={24} /></div><h3 className="text-lg font-bold text-slate-800">Bloquear Solicitação Inteira</h3></div>
             <div className="p-6 space-y-4"><p className="text-sm text-slate-600">Por favor, informe o motivo do bloqueio comercial para todos os itens.</p><textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo (ex: Margem baixa, política de preços...)" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm min-h-[100px]" autoFocus /></div>
             <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3"><button onClick={() => setIsRejectModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button><button onClick={handleConfirmRejection} disabled={!rejectReason.trim()} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">Confirmar Bloqueio</button></div>
           </div>
         </div>
       )}

       {/* Modal de Aprovação Detalhada (Por Item) */}
       {isApproveModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-blue-50/50">
               <div className="p-2 bg-blue-100 rounded-full text-blue-600"><CheckCircle2 size={24} /></div>
               <h3 className="text-lg font-bold text-slate-800">Conferência Comercial</h3>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 flex items-start gap-3">
                    <AlertOctagon className="shrink-0 mt-0.5" size={18} />
                    <div>
                        <p className="font-bold">Instruções de Validação:</p>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                            <li>Confira o <span className="font-bold">Preço Unitário</span> de cada item.</li>
                            <li>Desmarque itens reprovados. Eles serão separados e bloqueados.</li>
                            <li>Valores são carregados diretamente do pedido original e não podem ser editados aqui.</li>
                        </ul>
                    </div>
                </div>

                <div className="space-y-3">
                    {approvalItems.map((item, idx) => (
                        <div key={idx} className={`border rounded-xl p-4 transition-all ${item.selected ? 'bg-white border-blue-200 shadow-sm' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="checkbox" 
                                    checked={item.selected} 
                                    onChange={() => toggleItemSelection(idx)}
                                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h4 className={`font-bold text-sm ${item.selected ? 'text-slate-800' : 'text-red-800 decoration-red-400'}`}>{item.nome_produto}</h4>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.selected ? 'bg-blue-100 text-blue-700' : 'bg-red-200 text-red-700'}`}>
                                            {item.selected ? 'APROVADO' : 'REJEITADO'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Volume</span>
                                            <span className="text-sm font-medium text-slate-700">{item.volume} {item.unidade}</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">Preço Unitário</span>
                                            <span className="text-sm font-bold text-slate-900">{item.valor_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {!item.selected && (
                                <div className="mt-3 pl-9 animate-fade-in">
                                    <label className="block text-[10px] font-bold text-red-700 uppercase mb-1">Motivo da Rejeição (Obrigatório)</label>
                                    <input 
                                        type="text" 
                                        value={item.rejectObs}
                                        onChange={(e) => updateItemRejectObs(idx, e.target.value)}
                                        placeholder="Ex: Preço abaixo da tabela, margem insuficiente..."
                                        className="w-full p-2 bg-white border border-red-300 rounded-lg text-xs text-red-800 placeholder:text-red-300 focus:ring-1 focus:ring-red-500 outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><MessageSquare size={12} /> Observação Geral (Opcional)</label>
                    <textarea 
                        value={approvalObservation} 
                        onChange={(e) => setApprovalObservation(e.target.value)} 
                        placeholder="Nota geral para os itens aprovados..." 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm min-h-[60px]" 
                    />
                </div>
             </div>

             <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
               <button onClick={() => setIsApproveModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
               <button onClick={handleConfirmApproval} className="flex-[2] px-4 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center justify-center gap-2">
                   <CheckCircle2 size={16} /> Confirmar Validação
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Modal de Desbloqueio */}
       {isUnblockModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-amber-50/50"><div className="p-2 bg-amber-100 rounded-full text-amber-600"><RefreshCcw size={24} /></div><h3 className="text-lg font-bold text-slate-800">Desbloquear / Reiniciar</h3></div>
             <div className="p-6 space-y-4"><p className="text-sm text-slate-600">Justifique o desbloqueio para reiniciar o processo.</p><textarea value={unblockReason} onChange={(e) => setUnblockReason(e.target.value)} placeholder="Ex: Correção realizada..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-sm min-h-[100px]" autoFocus /></div>
             <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3"><button onClick={() => setIsUnblockModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button><button onClick={handleConfirmUnblock} disabled={!unblockReason.trim()} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">Confirmar</button></div>
           </div>
         </div>
       )}
    </div>
  );
};

export default CommercialPanel;