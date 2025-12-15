import React from 'react';
import { SolicitacaoFaturamento } from '../types';
import { X, User, FileText, Package, Calendar, DollarSign, Clock } from 'lucide-react';

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

          {(solicitacao.obs_vendedor || solicitacao.obs_comercial || solicitacao.obs_credito || solicitacao.obs_faturamento) && (
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="text-yellow-600" size={20} />
                <h3 className="font-semibold text-gray-800">Observações</h3>
              </div>
              <div className="space-y-3">
                {solicitacao.obs_vendedor && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Vendedor:</span>
                    <p className="text-sm text-gray-600 mt-1">{solicitacao.obs_vendedor}</p>
                  </div>
                )}
                {solicitacao.obs_comercial && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Comercial:</span>
                    <p className="text-sm text-gray-600 mt-1">{solicitacao.obs_comercial}</p>
                  </div>
                )}
                {solicitacao.obs_credito && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Crédito:</span>
                    <p className="text-sm text-gray-600 mt-1">{solicitacao.obs_credito}</p>
                  </div>
                )}
                {solicitacao.obs_faturamento && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Faturamento:</span>
                    <p className="text-sm text-gray-600 mt-1">{solicitacao.obs_faturamento}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {solicitacao.motivo_rejeicao && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <h3 className="font-semibold text-red-800 mb-2">Motivo da Rejeição</h3>
              <p className="text-sm text-red-600">{solicitacao.motivo_rejeicao}</p>
            </div>
          )}

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
