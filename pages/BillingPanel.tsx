import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, SolicitacaoFaturamento, StatusSolicitacao, Role, ItemSolicitado, Pedido } from '../types';
import { CheckCircle2, XCircle, FileCheck, Clock, CalendarDays, User as UserIcon, Send, AlertTriangle, RefreshCcw, XOctagon, Search, X, Lock, Ban, MessageSquare, Eye, Calendar, ArrowRight, Package, Calculator, Info } from 'lucide-react';
import OrderDetailsModal from '../components/OrderDetailsModal';

const BillingPanel: React.FC<{ user: User }> = ({ user }) => {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFaturamento[]>([]);
  const [pedidosCache, setPedidosCache] = useState<Pedido[]>([]); // Cache de pedidos para buscar preços
  const [activeTab, setActiveTab] = useState<'triage' | 'invoice' | 'rejected' | 'history'>('triage');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de Envio para Aprovação (Com edição de itens)
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [sendId, setSendId] = useState<string | null>(null);
  const [sendPrazo, setSendPrazo] = useState('');
  const [sendObs, setSendObs] = useState('');
  
  // Estado para controle dos itens dentro do modal de envio
  const [analysisItems, setAnalysisItems] = useState<{
      nome_produto: string;
      volume_original: number;
      volume_editado: string;
      unidade: string;
      selected: boolean;
      obs: string;
  }[]>([]);

  // Modal de Desbloqueio
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
  const [unblockId, setUnblockId] = useState<string | null>(null);
  const [unblockReason, setUnblockReason] = useState('');

  // Modal de Faturamento com Conferência
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceSolId, setInvoiceSolId] = useState<string | null>(null);
  const [invoiceVolumes, setInvoiceVolumes] = useState<Record<string, string>>({});
  const [currentSolForInvoice, setCurrentSolForInvoice] = useState<SolicitacaoFaturamento | null>(null);
  const [invoiceObservation, setInvoiceObservation] = useState('');

  // Modal de Detalhes
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<SolicitacaoFaturamento | null>(null);

  useEffect(() => {
    // Carrega solicitações e também pedidos (para ter os preços unitários)
    const loadData = async () => {
        const [sols, peds] = await Promise.all([
            api.getSolicitacoes(user),
            api.getPedidos(user)
        ]);
        setSolicitacoes(sols);
        setPedidosCache(peds);
    };
    loadData();
  }, [user]);

  useEffect(() => {
    setSearchTerm('');
  }, [activeTab]);

  const updateLocalStatus = (id: string, newStatus: StatusSolicitacao, extraUpdates: Partial<SolicitacaoFaturamento> = {}) => {
    setSolicitacoes(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, status: newStatus, ...extraUpdates };
        if (newStatus === StatusSolicitacao.EM_ANALISE) {
           updated.aprovacao_comercial = false;
           updated.aprovacao_credito = false;
           updated.blocked_by = undefined;
           updated.motivo_rejeicao = undefined;
           updated.obs_comercial = undefined;
           updated.obs_credito = undefined;
           updated.aprovado_por = undefined;
        }
        return updated;
      }
      return s;
    }));
  };

  // --- LÓGICA DE FATURAMENTO (INVOICE) ---
  const openInvoiceModal = (sol: SolicitacaoFaturamento) => {
      setInvoiceSolId(sol.id);
      setCurrentSolForInvoice(sol);

      const initialVolumes: Record<string, string> = {};
      if (sol.itens_solicitados) {
          sol.itens_solicitados.forEach(item => {
              initialVolumes[item.nome_produto] = item.volume.toString();
          });
      } else {
          initialVolumes[sol.nome_produto] = sol.volume_solicitado.toString();
      }
      setInvoiceVolumes(initialVolumes);
      setInvoiceObservation('');
      setIsInvoiceModalOpen(true);
  };

  const handleConfirmInvoice = async () => {
      if (!invoiceSolId || !currentSolForInvoice) return;

      const itensFaturados: ItemSolicitado[] = [];
      const originalItems = currentSolForInvoice.itens_solicitados || [{
          nome_produto: currentSolForInvoice.nome_produto,
          volume: currentSolForInvoice.volume_solicitado,
          unidade: currentSolForInvoice.unidade
      }];

      for (const item of originalItems) {
          const rawVal = invoiceVolumes[item.nome_produto];
          const volumeStr = String(rawVal || '0').trim().replace(',', '.');
          const val = parseFloat(volumeStr);
          if (!isNaN(val) && val > 0) {
              itensFaturados.push({
                  nome_produto: item.nome_produto,
                  volume: val,
                  unidade: item.unidade
              });
          }
      }

      if (itensFaturados.length === 0) {
          alert("Atenção: Nenhum volume foi informado.");
          // return; // Opcional bloquear
      }

      try {
          await api.updateSolicitacaoStatus(
              invoiceSolId,
              StatusSolicitacao.FATURADO,
              user,
              undefined,
              undefined,
              { obs_emissao_nf: invoiceObservation },
              itensFaturados
          );

          updateLocalStatus(invoiceSolId, StatusSolicitacao.FATURADO, {
              itens_atendidos: itensFaturados,
              obs_emissao_nf: invoiceObservation,
              data_faturamento: new Date().toISOString()
          });
          setIsInvoiceModalOpen(false);
          setInvoiceSolId(null);
          setCurrentSolForInvoice(null);
          setInvoiceObservation('');
      } catch (e: any) {
          alert("Erro ao faturar: " + e.message);
      }
  };

  // --- LÓGICA DE ENVIO PARA ANÁLISE (TRIAGEM) ---
  const openSendModal = (id: string) => {
    const sol = solicitacoes.find(s => s.id === id);
    if (!sol) {
        console.error("Solicitação não encontrada:", id);
        return;
    }

    console.log("=== ABRINDO MODAL DE ENVIO ===");
    console.log("Solicitação completa:", JSON.stringify(sol, null, 2));

    setSendId(id);
    setSendPrazo(sol.prazo_pedido || '');
    setSendObs(sol.obs_faturamento || '');

    // Prepara lista de edição baseada nos itens solicitados
    if (sol.itens_solicitados && sol.itens_solicitados.length > 0) {
        console.log("Usando itens_solicitados:", sol.itens_solicitados);
        const items = sol.itens_solicitados.map(i => ({
            nome_produto: i.nome_produto,
            volume_original: i.volume || 0,
            volume_editado: String(i.volume || 0),
            unidade: i.unidade || 'TN',
            selected: true,
            obs: i.obs || ''
        }));
        console.log("Items preparados:", items);
        setAnalysisItems(items);
    } else {
        // Fallback para solicitações sem estrutura de itens
        console.log("Usando FALLBACK - sem itens_solicitados");
        const volume = sol.volume_solicitado || 0;
        const item = {
            nome_produto: sol.nome_produto || 'Produto',
            volume_original: volume,
            volume_editado: String(volume),
            unidade: sol.unidade || 'TN',
            selected: true,
            obs: ''
        };
        console.log("Item fallback preparado:", item);
        setAnalysisItems([item]);
    }

    setIsSendModalOpen(true);
  };

  const toggleAnalysisItem = (idx: number) => {
      setAnalysisItems(prev => {
          const next = [...prev];
          next[idx].selected = !next[idx].selected;
          return next;
      });
  };

  const updateAnalysisItemVolume = (idx: number, val: string) => {
      setAnalysisItems(prev => {
          const next = [...prev];
          next[idx].volume_editado = val;
          return next;
      });
  };

  const updateAnalysisItemObs = (idx: number, val: string) => {
      setAnalysisItems(prev => {
          const next = [...prev];
          next[idx].obs = val;
          return next;
      });
  };

  const handleConfirmSend = async () => {
    if (!sendId) return;

    if (!sendPrazo.trim()) {
        alert("Por favor, preencha o prazo do pedido antes de enviar.");
        return;
    }

    if (analysisItems.length === 0) {
        alert("Erro: Nenhum item disponível para envio. Por favor, feche e abra o modal novamente.");
        return;
    }

    // Filtra e prepara os itens que realmente vão para análise
    const itemsToSend: ItemSolicitado[] = [];

    console.log("=== DEBUG ENVIO ===");
    console.log("analysisItems:", JSON.stringify(analysisItems, null, 2));

    for (const item of analysisItems) {
        console.log(`Processando item: ${item.nome_produto}, selected: ${item.selected}, volume_editado: ${item.volume_editado}, volume_original: ${item.volume_original}`);

        if (item.selected) {
            // Usa volume_original como fallback se volume_editado estiver vazio
            const volumeValue = item.volume_editado || item.volume_original;
            const volumeStr = String(volumeValue || '0').trim().replace(',', '.');
            const vol = parseFloat(volumeStr);

            console.log(`  -> volumeValue: ${volumeValue}, volumeStr: ${volumeStr}, vol: ${vol}`);

            if (!isNaN(vol) && vol > 0) {
                itemsToSend.push({
                    nome_produto: item.nome_produto,
                    volume: vol,
                    unidade: item.unidade,
                    obs: item.obs || ''
                });
                console.log(`  -> Item adicionado!`);
            } else {
                console.warn(`  -> Item ${item.nome_produto} ignorado: volume inválido (${volumeStr})`);
            }
        } else {
            console.log(`  -> Item não selecionado, pulando`);
        }
    }

    console.log("itemsToSend final:", JSON.stringify(itemsToSend, null, 2));

    if (itemsToSend.length === 0) {
        alert("Erro: Nenhum item válido selecionado.\n\nVerifique:\n1. Se há itens marcados\n2. Se os volumes estão preenchidos\n3. O console do navegador para mais detalhes (F12)");
        console.error("ERRO: analysisItems completo:", analysisItems);
        return;
    }

    try {
        // A API agora aceita 'itensAtendidos' (neste contexto, itens revisados) para recalcular o saldo da carteira
        // O que não estiver nesta lista voltará para a carteira (volume_restante do pedido)
        await api.updateSolicitacaoStatus(
            sendId,
            StatusSolicitacao.EM_ANALISE,
            user,
            undefined,
            undefined,
            {
                prazo: sendPrazo,
                obs_faturamento: sendObs
            },
            itemsToSend // Passa os itens revisados
        );

        // Atualiza volume_solicitado visual localmente para refletir o novo total
        const novoVolumeTotal = itemsToSend.reduce((acc, i) => acc + i.volume, 0);
        const novoResumoProdutos = itemsToSend.map(i => `${i.nome_produto}: ${i.volume} ${i.unidade}`).join(' | ');

        updateLocalStatus(sendId, StatusSolicitacao.EM_ANALISE, {
            prazo_pedido: sendPrazo,
            obs_faturamento: sendObs,
            itens_solicitados: itemsToSend,
            volume_solicitado: novoVolumeTotal,
            nome_produto: novoResumoProdutos
        });

        setIsSendModalOpen(false);
        setSendId(null);
        setSendPrazo('');
        setSendObs('');
        alert("Solicitação enviada com sucesso para análise dos setores de Crédito e Comercial!");
    } catch (error: any) {
        console.error("Erro ao enviar solicitação:", error);
        alert("Erro ao enviar solicitação: " + (error.message || "Erro desconhecido"));
    }
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

  const openRejectModal = (id: string) => {
    setRejectId(id);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmRejection = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    await api.updateSolicitacaoStatus(rejectId, StatusSolicitacao.REJEITADO, user, rejectReason, Role.FATURAMENTO);
    const formattedReason = `[BLOQUEIO: FATURAMENTO] ${rejectReason}`;
    updateLocalStatus(rejectId, StatusSolicitacao.REJEITADO, { motivo_rejeicao: formattedReason, blocked_by: Role.FATURAMENTO });
    setIsRejectModalOpen(false);
    setRejectId(null);
  };

  const triageList = solicitacoes.filter(s => s.status === StatusSolicitacao.PENDENTE);
  const invoiceList = solicitacoes.filter(s => s.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO);
  const rejectedList = solicitacoes.filter(s => s.status === StatusSolicitacao.REJEITADO);
  const inProgressList = solicitacoes.filter(s => s.status === StatusSolicitacao.EM_ANALISE);
  const historyList = solicitacoes.filter(s => s.status === StatusSolicitacao.FATURADO);

  const getSourceList = () => {
    switch (activeTab) {
      case 'triage': return [...triageList, ...inProgressList];
      case 'invoice': return invoiceList;
      case 'rejected': return rejectedList;
      case 'history': return historyList;
      default: return [];
    }
  };

  const filteredList = getSourceList().filter(s => 
    s.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.numero_pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.criado_por.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canUnblock = (sol: SolicitacaoFaturamento) => {
     return user.role === Role.ADMIN || sol.blocked_by === Role.FATURAMENTO || !sol.blocked_by;
  };

  const getBlockerColor = (role?: Role) => {
    switch (role) {
      case Role.CREDITO: return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case Role.COMERCIAL: return 'bg-blue-50 text-blue-700 border-blue-200';
      case Role.FATURAMENTO: return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  const getBlockerLabel = (role?: Role) => {
    switch (role) {
      case Role.CREDITO: return 'CRÉDITO';
      case Role.COMERCIAL: return 'COMERCIAL';
      case Role.FATURAMENTO: return 'FATURAMENTO';
      case Role.ADMIN: return 'ADMINISTRADOR';
      default: return 'BLOQUEADO';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-end gap-4">
         <div>
           <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Faturamento</h2>
           <p className="text-slate-500 mt-1">Gestão de fluxo de aprovação e emissão de notas.</p>
         </div>
         <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
           <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm min-w-max">
              <button onClick={() => setActiveTab('triage')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'triage' ? 'bg-crop-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Acompanhamento ({triageList.length + inProgressList.length})</button>
              <button onClick={() => setActiveTab('invoice')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'invoice' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Emitir Notas ({invoiceList.length})</button>
              <button onClick={() => setActiveTab('rejected')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'rejected' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Bloqueados ({rejectedList.length})</button>
              <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>Histórico ({historyList.length})</button>
           </div>
         </div>
       </div>

       <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
         <div className="relative w-full md:w-96 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={18} className="text-slate-400 group-focus-within:text-crop-600 transition-colors" /></div>
            <input type="text" placeholder="Filtrar por Cliente, Pedido..." className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-crop-500 focus:border-transparent transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"><X size={16} /></button>)}
         </div>
         <div className="text-xs text-slate-500 font-medium">Exibindo {filteredList.length} de {getSourceList().length} registros</div>
       </div>

       {inProgressList.length > 0 && activeTab === 'triage' && (
         <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
           <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Clock size={20} /></div>
           <div><p className="text-sm font-bold text-blue-900">Processos em Andamento</p><p className="text-xs text-blue-700">{inProgressList.length} solicitações aguardando aprovação paralela de Comercial e Crédito.</p></div>
         </div>
       )}

       <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         {filteredList.map(sol => (
           <div key={sol.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
             <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-gradient-to-b from-slate-50 to-white">
               <div>
                 <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">{sol.numero_pedido}</span>
                 <h4 className="font-bold text-slate-900 line-clamp-1 text-lg" title={`${sol.codigo_cliente ? `[${sol.codigo_cliente}] ` : ''}${sol.nome_cliente}`}>
                   {sol.codigo_cliente && <span className="text-crop-600 mr-1">[{sol.codigo_cliente}]</span>}
                   {sol.nome_cliente}
                 </h4>
                 {sol.status === StatusSolicitacao.REJEITADO && (
                    <div className="mt-2 flex items-center gap-1.5">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bloqueio:</span>
                       <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border flex items-center gap-1 uppercase ${getBlockerColor(sol.blocked_by as Role)}`}>
                         <Ban size={10} /> {getBlockerLabel(sol.blocked_by as Role)}
                       </span>
                    </div>
                 )}
               </div>
               
               <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1 ${sol.status === StatusSolicitacao.PENDENTE ? 'bg-orange-50 text-orange-700 border-orange-100' : sol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : sol.status === StatusSolicitacao.REJEITADO ? 'bg-red-50 text-red-700 border-red-100' : sol.status === StatusSolicitacao.FATURADO ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100' }`}>
                  {sol.status === StatusSolicitacao.FATURADO ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                  {sol.status === StatusSolicitacao.PENDENTE ? 'Triagem' : sol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO ? 'Pronto' : sol.status === StatusSolicitacao.REJEITADO ? 'Rejeitado' : sol.status === StatusSolicitacao.FATURADO ? 'Faturado' : 'Em Análise'}
               </div>
             </div>
             <div className="p-5 flex-1 space-y-4">
               {/* Exibir Produto e Embalagem */}
               <div className="mb-2 pb-2 border-b border-slate-50">
                   <p className="text-[10px] text-slate-400 font-bold uppercase">Produtos / Embalagens</p>
                   {sol.itens_solicitados && sol.itens_solicitados.length > 1 ? (
                       <ul className="space-y-1.5 mt-1">
                           {sol.itens_solicitados.map((item, idx) => (
                               <li key={idx} className="flex justify-between items-start text-xs text-slate-700 bg-slate-50/50 p-2 rounded border border-slate-100">
                                   <div>
                                       <div className="font-bold">{item.nome_produto}</div>
                                       <div className="text-[10px] text-slate-500">Embalagem: {item.unidade}</div>
                                   </div>
                                   <div className="flex flex-col items-end">
                                      <span className="font-bold text-crop-600">{item.volume.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.unidade}</span>
                                      {item.obs && <span className="text-[9px] text-slate-400 italic mt-0.5">Obs: {item.obs}</span>}
                                   </div>
                               </li>
                           ))}
                       </ul>
                   ) : sol.itens_solicitados && sol.itens_solicitados.length === 1 ? (
                       <div className="mt-1">
                           <p className="text-sm font-semibold text-slate-700">{sol.itens_solicitados[0].nome_produto}</p>
                           <p className="text-xs text-slate-500">Embalagem: {sol.itens_solicitados[0].unidade}</p>
                       </div>
                   ) : (
                       <p className="text-sm font-semibold text-slate-700 leading-tight">{sol.nome_produto || 'Não identificado'}</p>
                   )}
               </div>
               
               <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-slate-500 font-semibold uppercase">Volume a Faturar</p>
                    <p className="text-2xl font-bold text-slate-800">{sol.volume_solicitado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  </div>
                  <div className="text-right">
                       <p className="text-xs text-slate-500 font-semibold uppercase">Valor do Pedido</p>
                       <p className="text-xl font-bold text-slate-900">
                         {sol.valor_solicitado
                            ? sol.valor_solicitado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : <span className="text-slate-400 text-sm">Não calculado</span>
                         }
                       </p>
                   </div>
               </div>
               
               {(sol.status === StatusSolicitacao.EM_ANALISE || sol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO) && (
                   <div className="flex gap-2 flex-wrap mt-2">
                       {sol.aprovacao_comercial ? (
                           <span className="text-[10px] bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200 flex items-center gap-1 font-bold uppercase">
                               <CheckCircle2 size={12} /> Comercial: OK
                           </span>
                       ) : (
                           <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1 font-bold uppercase">
                               <Clock size={12} /> Comercial: ...
                           </span>
                       )}

                       {sol.aprovacao_credito ? (
                           <span className="text-[10px] bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200 flex items-center gap-1 font-bold uppercase">
                               <CheckCircle2 size={12} /> Crédito: OK
                           </span>
                       ) : (
                           <span className="text-[10px] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1 font-bold uppercase">
                               <Clock size={12} /> Crédito: ...
                           </span>
                       )}
                   </div>
               )}

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

               {/* Exibir Obs Vendedor */}
               {sol.obs_vendedor && (
                   <div className="flex items-start gap-2 bg-amber-50 p-2 rounded-lg border border-amber-100 mt-2">
                       <MessageSquare size={12} className="text-amber-600 mt-0.5 shrink-0" />
                       <div className="text-[10px] text-amber-800">
                           <span className="font-bold">Nota do Vendedor:</span> {sol.obs_vendedor}
                       </div>
                   </div>
               )}

               {sol.status === StatusSolicitacao.REJEITADO && sol.motivo_rejeicao && (
                 <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <div className="flex items-center justify-between mb-1">
                       <p className="text-[10px] font-bold text-red-800 uppercase tracking-wide flex items-center gap-1"><AlertTriangle size={10} /> Motivo</p>
                    </div>
                    <p className="text-xs text-red-700 leading-relaxed font-medium break-words">{sol.motivo_rejeicao.replace(/\[.*?\]\s*/, '')}</p>
                    {sol.blocked_by && sol.blocked_by !== Role.FATURAMENTO && activeTab === 'rejected' && (
                        <p className="text-[10px] text-red-500 mt-2 border-t border-red-100 pt-1 italic flex items-center gap-1">
                           <Lock size={8} /> Aguardando desbloqueio do setor: {getBlockerLabel(sol.blocked_by as Role)}
                        </p>
                    )}
                 </div>
               )}
               <div className="space-y-2 pt-2 border-t border-slate-50"><div className="flex items-center text-xs text-slate-500"><UserIcon size={12} className="mr-2 text-slate-400" /> Solicitado por: <span className="font-medium text-slate-700 ml-1">{sol.criado_por}</span></div><div className="flex items-center text-xs text-slate-500"><CalendarDays size={12} className="mr-2 text-slate-400" /> Data: <span className="font-medium text-slate-700 ml-1">{new Date(sol.data_solicitacao).toLocaleDateString()}</span></div></div>
             </div>
 
             {activeTab === 'history' && (
               <div className="p-5 space-y-3 border-t border-slate-100">
                  {sol.data_faturamento && (
                     <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar size={12} className="text-blue-500" />
                        <span>Faturado em: <span className="font-bold">{new Date(sol.data_faturamento).toLocaleString('pt-BR')}</span></span>
                     </div>
                  )}

                  {sol.itens_atendidos && sol.itens_atendidos.length > 0 && (
                     <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-800 uppercase mb-2 flex items-center gap-1"><Package size={10} /> Itens Faturados</p>
                        <div className="space-y-1">
                           {sol.itens_atendidos.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-xs text-blue-700">
                                 <span>{item.nome_produto}</span>
                                 <span className="font-bold">{item.volume.toLocaleString('pt-BR')} {item.unidade}</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  {sol.obs_emissao_nf && (
                     <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-800 uppercase mb-1 flex items-center gap-1"><MessageSquare size={10} /> Observação da Emissão</p>
                        <p className="text-xs text-emerald-700 leading-relaxed">{sol.obs_emissao_nf}</p>
                     </div>
                  )}
               </div>
             )}

             {/* ÁREA DE AÇÕES */}
             <div className="p-4 bg-slate-50 border-t border-slate-100">
               {user.role === Role.GERENTE ? (
                 <div className="w-full py-2 text-xs font-bold text-slate-400 bg-slate-100/50 rounded-lg border border-slate-200 border-dashed text-center flex items-center justify-center gap-2 cursor-default">
                    <Eye size={14} /> Visualização Gerencial (Apenas Leitura)
                 </div>
               ) : (
                 <>
                   {activeTab === 'triage' && sol.status === StatusSolicitacao.PENDENTE && (
                     <div className="flex gap-3">
                       <button onClick={() => openRejectModal(sol.id)} className="flex-1 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"><XCircle size={14} /> Rejeitar</button>
                       <button onClick={() => openSendModal(sol.id)} className="flex-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"><Send size={14} /> Enviar p/ Aprovação</button>
                     </div>
                   )}
                   
                   {activeTab === 'invoice' && sol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO && (
                     <div className="flex gap-3">
                        <button onClick={() => openRejectModal(sol.id)} className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2">
                          <XCircle size={14} /> Rejeitar
                        </button>
                        <button onClick={() => openInvoiceModal(sol)} className="flex-[2] px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2">
                          <FileCheck size={14} /> Faturar
                        </button>
                     </div>
                   )}
                   
                   {activeTab === 'rejected' && sol.status === StatusSolicitacao.REJEITADO && (
                     <div className="flex gap-3">
                       <button className="flex-1 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all flex items-center justify-center gap-2" disabled><XOctagon size={14} /> Cancelado</button>
                       <button 
                          onClick={() => openUnblockModal(sol.id)} 
                          disabled={!canUnblock(sol)}
                          className={`flex-1 px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 ${canUnblock(sol) ? 'bg-amber-500 hover:bg-amber-600 hover:shadow' : 'bg-slate-300 cursor-not-allowed'}`}
                       >
                          {canUnblock(sol) ? <><RefreshCcw size={14} /> Reiniciar Fluxo</> : <><Lock size={14} /> Bloqueado</>}
                       </button>
                     </div>
                   )}
                 </>
               )}

               {activeTab === 'triage' && sol.status === StatusSolicitacao.EM_ANALISE && (
                   <div className="w-full px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg border border-slate-200 text-center flex items-center justify-center gap-2">
                       <Clock size={14} /> Aguardando Setores...
                   </div>
               )}

               {activeTab === 'history' && (
                   <div className="w-full px-4 py-2 text-xs font-bold text-blue-600 bg-blue-100 rounded-lg border border-blue-200 text-center flex items-center justify-center gap-2">
                       <CheckCircle2 size={14} /> Pedido Faturado
                   </div>
               )}

               <button
                 onClick={() => { setSelectedSolicitacao(sol); setIsDetailsModalOpen(true); }}
                 className="w-full mt-2 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors flex items-center justify-center gap-2"
               >
                 <Info size={14} /> Ver Detalhes Completos
               </button>
             </div>
           </div>
         ))}
       </div>
       {filteredList.length === 0 && (<div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">{searchTerm ? <Search size={32} className="text-slate-300" /> : <FileCheck size={32} className="text-slate-300" />}</div><p className="text-slate-500 font-medium">{searchTerm ? 'Nenhuma solicitação encontrada com este filtro.' : 'Nenhuma solicitação nesta aba.'}</p></div>)}
       
       {/* Modal de Rejeição */}
       {isRejectModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-red-50/50"><div className="p-2 bg-red-100 rounded-full text-red-600"><AlertTriangle size={24} /></div><h3 className="text-lg font-bold text-slate-800">Rejeitar Solicitação</h3></div>
             <div className="p-6 space-y-4"><p className="text-sm text-slate-600">Informe o motivo da rejeição para devolver o pedido.</p><textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ex: Erro no pedido, falta de estoque..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-sm min-h-[100px]" autoFocus /></div>
             <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3"><button onClick={() => setIsRejectModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button><button onClick={handleConfirmRejection} disabled={!rejectReason.trim()} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm">Confirmar Rejeição</button></div>
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

       {/* Modal de Envio para Aprovação */}
       {isSendModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-blue-50/50">
               <div className="p-2 bg-blue-100 rounded-full text-blue-600"><Send size={24} /></div>
               <h3 className="text-lg font-bold text-slate-800">Enviar para Análise</h3>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-5">
               <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="font-bold">Instrução:</span> Selecione os itens que possuem estoque disponível. Itens desmarcados ou com volume reduzido retornarão automaticamente para a carteira.
               </p>

               {/* LISTA DE ITENS PARA EDIÇÃO */}
               <div className="space-y-3">
                   {analysisItems.map((item, idx) => (
                       <div key={idx} className={`border rounded-xl p-3 transition-all ${item.selected ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                           <div className="flex items-center gap-3 mb-2">
                               <input 
                                  type="checkbox" 
                                  checked={item.selected} 
                                  onChange={() => toggleAnalysisItem(idx)}
                                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                               />
                               <div className="flex-1 min-w-0">
                                   <p className={`text-sm font-bold truncate ${item.selected ? 'text-slate-800' : 'text-slate-500'}`}>{item.nome_produto}</p>
                                   <p className="text-[10px] text-slate-400">Solicitado: {item.volume_original} {item.unidade}</p>
                               </div>
                           </div>
                           
                           {item.selected && (
                               <div className="grid grid-cols-3 gap-3 ml-8 animate-fade-in">
                                   <div className="col-span-1">
                                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Volume</label>
                                       <input
                                          type="text"
                                          inputMode="decimal"
                                          value={item.volume_editado}
                                          onChange={e => updateAnalysisItemVolume(idx, e.target.value)}
                                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 outline-none"
                                       />
                                   </div>
                                   <div className="col-span-2">
                                       <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Observação do Item</label>
                                       <input 
                                          type="text" 
                                          value={item.obs}
                                          onChange={e => updateAnalysisItemObs(idx, e.target.value)}
                                          placeholder="Ex: Lote específico..."
                                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 focus:ring-1 focus:ring-blue-500 outline-none"
                                       />
                                   </div>
                               </div>
                           )}
                       </div>
                   ))}
               </div>

               <div className="space-y-1.5 border-t border-slate-100 pt-4">
                   <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                       <Calendar size={12} /> Prazo do Pedido <span className="text-red-500">*</span>
                   </label>
                   <input
                       type="text"
                       placeholder="Ex: 30 dias, 30/60/90..."
                       value={sendPrazo}
                       onChange={e => setSendPrazo(e.target.value)}
                       className={`w-full p-3 border rounded-xl focus:ring-2 focus:border-transparent outline-none text-sm font-medium ${sendPrazo.trim() ? 'bg-slate-50 border-slate-200 focus:ring-blue-500' : 'bg-red-50 border-red-300 focus:ring-red-500'}`}
                   />
                   {!sendPrazo.trim() && (
                       <p className="text-xs text-red-600 flex items-center gap-1">
                           <AlertTriangle size={12} /> Campo obrigatório para enviar ao Crédito e Comercial
                       </p>
                   )}
               </div>
               
               <div className="space-y-1.5">
                   <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><MessageSquare size={12} /> Obs. Geral (Opcional)</label>
                   <textarea value={sendObs} onChange={e => setSendObs(e.target.value)} placeholder="Alguma nota importante para os aprovadores?" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm min-h-[60px]" />
               </div>
             </div>

             <div className="p-6 border-t border-slate-100 bg-slate-50/50">
               <div className="flex gap-3">
                 <button onClick={() => setIsSendModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
                 <button onClick={handleConfirmSend} disabled={!sendPrazo.trim()} className="flex-[2] px-4 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2">
                     <Send size={16} /> Enviar p/ Crédito & Comercial
                 </button>
               </div>
               {!sendPrazo.trim() && (
                   <p className="text-xs text-amber-600 text-center mt-2 flex items-center justify-center gap-1">
                       <Clock size={12} /> Preencha o prazo para habilitar o envio
                   </p>
               )}
             </div>
           </div>
         </div>
       )}

       {/* Modal de Conferência de Faturamento */}
       {isInvoiceModalOpen && currentSolForInvoice && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-emerald-50/50">
               <div className="p-2 bg-emerald-100 rounded-full text-emerald-600"><FileCheck size={24} /></div>
               <h3 className="text-lg font-bold text-slate-800">Conferência de Faturamento</h3>
             </div>
             
             <div className="p-6 space-y-4 overflow-y-auto">
               <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-3">
                  <Calculator size={18} className="text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                      <p className="font-bold">Regra de Faturamento:</p>
                      <p className="text-xs mt-1">O valor a ser debitado será calculado multiplicando o <strong>Valor Unitário Original</strong> pela <strong>Quantidade Faturada</strong> informada abaixo. O saldo não faturado retornará automaticamente para a carteira.</p>
                  </div>
               </div>
               
               <div className="space-y-3">
                   {currentSolForInvoice.itens_solicitados ? (
                       currentSolForInvoice.itens_solicitados.map((item, idx) => {
                           // Busca o valor unitário no pedido original cached
                           const pedidoOrig = pedidosCache.find(p => p.id === currentSolForInvoice.pedido_id);
                           const itemPedido = pedidoOrig?.itens.find(i => i.nome_produto === item.nome_produto);
                           const valorUnitario = itemPedido ? itemPedido.valor_unitario : 0;
                           const volumeFaturado = parseFloat(invoiceVolumes[item.nome_produto]?.replace(',', '.') || '0');
                           const totalFaturar = volumeFaturado * valorUnitario;

                           return (
                               <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                   <div className="flex justify-between mb-3 border-b border-slate-200/60 pb-2">
                                       <span className="text-sm font-bold text-slate-800">{item.nome_produto}</span>
                                       <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-mono">Solicitado: {item.volume} {item.unidade}</span>
                                   </div>
                                   
                                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                                       {/* Coluna 1: Preço Unitário (ReadOnly) */}
                                       <div className="flex flex-col">
                                           <span className="text-[10px] font-bold text-slate-400 uppercase">Valor Unitário</span>
                                           <span className="text-sm font-bold text-slate-700">{valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                       </div>

                                       {/* Coluna 2: Input Volume */}
                                       <div className="flex flex-col">
                                           <label className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Qtd. a Faturar</label>
                                           <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    value={invoiceVolumes[item.nome_produto] || ''}
                                                    onChange={e => setInvoiceVolumes(prev => ({...prev, [item.nome_produto]: e.target.value}))}
                                                    placeholder={`Max: ${item.volume}`}
                                                />
                                                <span className="text-xs font-bold text-slate-500">{item.unidade}</span>
                                           </div>
                                       </div>

                                       {/* Coluna 3: Total Calculado */}
                                       <div className="flex flex-col items-end bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                           <span className="text-[10px] font-bold text-emerald-700 uppercase">Subtotal (Débito)</span>
                                           <span className="text-lg font-extrabold text-emerald-900">
                                               {totalFaturar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                           </span>
                                       </div>
                                   </div>
                               </div>
                           );
                       })
                   ) : (
                       // Fallback para solicitações antigas sem itens detalhados
                       <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                           <div className="flex justify-between mb-2">
                               <span className="text-xs font-bold text-slate-700">{currentSolForInvoice.nome_produto}</span>
                               <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600">Solicitado: {currentSolForInvoice.volume_solicitado}</span>
                           </div>
                           <div className="relative">
                               <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-600">Faturar:</span>
                               <input
                                  type="text"
                                  inputMode="decimal"
                                  className="w-full pl-16 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                                  value={invoiceVolumes[currentSolForInvoice.nome_produto] || ''}
                                  onChange={e => setInvoiceVolumes(prev => ({...prev, [currentSolForInvoice.nome_produto]: e.target.value}))}
                                  placeholder={`Max: ${currentSolForInvoice.volume_solicitado}`}
                               />
                           </div>
                       </div>
                   )}
               </div>

               <div className="bg-amber-50 border-t border-amber-100 p-4">
                  <label className="text-xs font-bold text-amber-800 uppercase block mb-2 flex items-center gap-1">
                     <MessageSquare size={14} /> Observação da Emissão (Opcional)
                  </label>
                  <textarea
                     value={invoiceObservation}
                     onChange={e => setInvoiceObservation(e.target.value)}
                     placeholder="Ex: NF emitida com observações fiscais, liberação imediata..."
                     className="w-full p-3 bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-sm min-h-[80px]"
                  />
                  <p className="text-xs text-amber-600 mt-1">Esta observação ficará registrada no histórico do pedido</p>
               </div>
             </div>

             <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
               <button onClick={() => setIsInvoiceModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
               <button onClick={handleConfirmInvoice} className="flex-[2] px-4 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 transition-all text-sm flex items-center justify-center gap-2">
                   <CheckCircle2 size={18} /> Confirmar Emissão
               </button>
             </div>
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

export default BillingPanel;