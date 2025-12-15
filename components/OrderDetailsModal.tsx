import React from 'react';
import { SolicitacaoFaturamento, StatusSolicitacao } from '../types';
import { X, User, FileText, Package, Calendar, DollarSign, Clock, CheckCircle2, AlertTriangle, Send, FileCheck, ArrowRight } from 'lucide-react';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitacao: SolicitacaoFaturamento | null;
}

export default function OrderDetailsModal({ isOpen, onClose, solicitacao }: OrderDetailsModalProps) {
  if (!isOpen || !solicitacao) return null;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const statusLabels: Record<string, string> = {
    'pendente': 'Pendente',
    'em_analise': 'Em Análise',
    'em_analise_comercial': 'Análise Comercial',
    'em_analise_credito': 'Análise Crédito',
    'aprovado_para_faturamento': 'Aprovado',
    'rejeitado': 'Rejeitado',
    'faturado': 'Faturado'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Detalhes do Pedido</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <User className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800">Informações do Cliente</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-600">Nome:</span>
                  <p className="font-medium text-gray-800">{solicitacao.nome_cliente}</p>
                </div>
                {solicitacao.codigo_cliente && (
                  <div>
                    <span className="text-sm text-gray-600">Código:</span>
                    <p className="font-medium text-gray-800">{solicitacao.codigo_cliente}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="text-green-600" size={20} />
                <h3 className="font-semibold text-gray-800">Informações do Pedido</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-600">Número:</span>
                  <p className="font-medium text-gray-800">{solicitacao.numero_pedido}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Status:</span>
                  <p className="font-medium text-gray-800">{statusLabels[solicitacao.status] || solicitacao.status}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <Package className="text-purple-600" size={20} />
              <h3 className="font-semibold text-gray-800">Itens Solicitados</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Produto</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Volume</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Unidade</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Observação</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {solicitacao.itens_solicitados && solicitacao.itens_solicitados.length > 0 ? (
                    solicitacao.itens_solicitados.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-800">{item.nome_produto}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{item.volume.toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{item.unidade}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{item.obs || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-800">{solicitacao.nome_produto}</td>
                      <td className="px-4 py-2 text-sm text-gray-800">{solicitacao.volume_solicitado.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2 text-sm text-gray-800">{solicitacao.unidade}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {solicitacao.itens_atendidos && solicitacao.itens_atendidos.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <Package className="text-amber-600" size={20} />
                <h3 className="font-semibold text-gray-800">Itens Atendidos/Faturados</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Produto</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Volume</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">Unidade</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {solicitacao.itens_atendidos.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-800">{item.nome_produto}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{item.volume.toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{item.unidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="text-gray-600" size={20} />
                <h3 className="font-semibold text-gray-800">Informações Temporais</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-600">Data Solicitação:</span>
                  <p className="font-medium text-gray-800">{formatDate(solicitacao.data_solicitacao)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Criado por:</span>
                  <p className="font-medium text-gray-800">{solicitacao.criado_por}</p>
                </div>
                {solicitacao.aprovado_por && (
                  <div>
                    <span className="text-sm text-gray-600">Aprovado por:</span>
                    <p className="font-medium text-gray-800">{solicitacao.aprovado_por}</p>
                  </div>
                )}
                {solicitacao.prazo_pedido && (
                  <div>
                    <span className="text-sm text-gray-600">Prazo:</span>
                    <p className="font-medium text-gray-800">{solicitacao.prazo_pedido}</p>
                  </div>
                )}
              </div>
            </div>

            {solicitacao.valor_solicitado && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="text-green-600" size={20} />
                  <h3 className="font-semibold text-gray-800">Valores</h3>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Valor Solicitado:</span>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(solicitacao.valor_solicitado)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-blue-600" size={24} />
              <h3 className="text-lg font-bold text-gray-800">Linha do Tempo</h3>
            </div>

            <div className="relative space-y-4">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-200"></div>

              <div className="relative pl-10">
                <div className="absolute left-0 top-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-4 border-white shadow">
                  <User size={16} className="text-white" />
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-green-700 uppercase">Solicitação Criada</span>
                    <span className="text-xs text-gray-500">{formatDate(solicitacao.data_solicitacao)}</span>
                  </div>
                  <p className="text-sm text-gray-700">Por: <span className="font-semibold">{solicitacao.criado_por}</span></p>
                  {solicitacao.obs_vendedor && (
                    <div className="mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                      <p className="text-xs font-semibold text-amber-800">Observação:</p>
                      <p className="text-xs text-amber-700">{solicitacao.obs_vendedor}</p>
                    </div>
                  )}
                </div>
              </div>

              {solicitacao.status !== StatusSolicitacao.PENDENTE && (
                <div className="relative pl-10">
                  <div className="absolute left-0 top-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-4 border-white shadow">
                    <Send size={16} className="text-white" />
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-700 uppercase">Enviado para Análise</span>
                      <span className="text-xs text-gray-500">Faturamento</span>
                    </div>
                    {solicitacao.prazo_pedido && (
                      <p className="text-xs text-gray-600 mt-1">Prazo: <span className="font-semibold">{solicitacao.prazo_pedido}</span></p>
                    )}
                    {solicitacao.obs_faturamento && (
                      <div className="mt-2 bg-blue-50 p-2 rounded border border-blue-200">
                        <p className="text-xs font-semibold text-blue-800">Observação Faturamento:</p>
                        <p className="text-xs text-blue-700">{solicitacao.obs_faturamento}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(solicitacao.aprovacao_comercial || solicitacao.aprovacao_credito) && (
                <div className="relative pl-10">
                  <div className="absolute left-0 top-1 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center border-4 border-white shadow">
                    <CheckCircle2 size={16} className="text-white" />
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                    <span className="text-xs font-bold text-indigo-700 uppercase block mb-2">Aprovações</span>
                    <div className="space-y-2">
                      {solicitacao.aprovacao_comercial && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-green-600" />
                          <span className="text-xs text-gray-700">Comercial aprovado</span>
                        </div>
                      )}
                      {solicitacao.obs_comercial && (
                        <div className="bg-blue-50 p-2 rounded border border-blue-200">
                          <p className="text-xs font-semibold text-blue-800">Obs. Comercial:</p>
                          <p className="text-xs text-blue-700">{solicitacao.obs_comercial}</p>
                        </div>
                      )}
                      {solicitacao.aprovacao_credito && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-green-600" />
                          <span className="text-xs text-gray-700">Crédito aprovado</span>
                        </div>
                      )}
                      {solicitacao.obs_credito && (
                        <div className="bg-indigo-50 p-2 rounded border border-indigo-200">
                          <p className="text-xs font-semibold text-indigo-800">Obs. Crédito:</p>
                          <p className="text-xs text-indigo-700">{solicitacao.obs_credito}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {solicitacao.status === StatusSolicitacao.FATURADO && (
                <div className="relative pl-10">
                  <div className="absolute left-0 top-1 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-white shadow">
                    <FileCheck size={16} className="text-white" />
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-emerald-700 uppercase">Faturado</span>
                      {solicitacao.data_faturamento && (
                        <span className="text-xs text-gray-500">{formatDate(solicitacao.data_faturamento)}</span>
                      )}
                    </div>
                    {solicitacao.obs_emissao_nf && (
                      <div className="mt-2 bg-emerald-50 p-2 rounded border border-emerald-200">
                        <p className="text-xs font-semibold text-emerald-800">Observação da Emissão:</p>
                        <p className="text-xs text-emerald-700">{solicitacao.obs_emissao_nf}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {solicitacao.status === StatusSolicitacao.REJEITADO && solicitacao.motivo_rejeicao && (
                <div className="relative pl-10">
                  <div className="absolute left-0 top-1 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center border-4 border-white shadow">
                    <AlertTriangle size={16} className="text-white" />
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                    <span className="text-xs font-bold text-red-700 uppercase block mb-2">Bloqueado</span>
                    <div className="bg-red-50 p-2 rounded border border-red-200">
                      <p className="text-xs text-red-700">{solicitacao.motivo_rejeicao}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {typeof solicitacao.aprovacao_comercial === 'boolean' && (
              <div className={`rounded-lg p-3 border ${solicitacao.aprovacao_comercial ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <span className="text-sm font-medium">Aprovação Comercial:</span>
                <p className={`font-semibold ${solicitacao.aprovacao_comercial ? 'text-green-700' : 'text-red-700'}`}>
                  {solicitacao.aprovacao_comercial ? 'Aprovado' : 'Reprovado'}
                </p>
              </div>
            )}
            {typeof solicitacao.aprovacao_credito === 'boolean' && (
              <div className={`rounded-lg p-3 border ${solicitacao.aprovacao_credito ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <span className="text-sm font-medium">Aprovação Crédito:</span>
                <p className={`font-semibold ${solicitacao.aprovacao_credito ? 'text-green-700' : 'text-red-700'}`}>
                  {solicitacao.aprovacao_credito ? 'Aprovado' : 'Reprovado'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
