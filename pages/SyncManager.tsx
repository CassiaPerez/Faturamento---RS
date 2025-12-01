import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { analyzeComplexSyncData } from '../services/geminiService';
import { LogSincronizacao } from '../types';
import { RefreshCw, BrainCircuit, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';

const SyncManager: React.FC = () => {
  const [logs, setLogs] = useState<LogSincronizacao[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const fetchLogs = async () => {
    const data = await api.getLogs();
    setLogs(data);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setAnalysisResult(null);
    try {
      await api.triggerManualSync();
      await fetchLogs();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAnalyzeLog = async (log: LogSincronizacao) => {
    if (log.sucesso) return;
    setAnalyzingId(log.id);
    setAnalysisResult(null);
    
    const logDetails = `
      Arquivo: ${log.arquivo}
      Tipo: ${log.tipo}
      Data: ${log.data}
      Erros: ${log.mensagens.join('; ')}
    `;

    const result = await analyzeComplexSyncData(logDetails);
    setAnalysisResult(result);
    setAnalyzingId(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header & Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sincronização de Dados</h2>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Conector Google Drive ativo (Ciclo de 3h)
          </p>
        </div>
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className={`px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3 ${
            isSyncing ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-900/20'
          }`}
        >
          <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Processando Dados...' : 'Forçar Sincronização Agora'}
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-slate-100 rounded-lg">
            <FileText size={20} className="text-slate-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Arquivo de Origem</p>
            <p className="text-sm font-medium text-slate-700 truncate font-mono">carteira_pedidos.csv</p>
          </div>
        </div>
        <a href="https://drive.google.com/file/d/1ifetFw_-dbBGrUQrupy9luJqxuD6sMVy/view" target="_blank" className="text-xs text-brand-600 hover:underline ml-12">
          Abrir no Google Drive ↗
        </a>
      </div>

      {/* Analysis Result */}
      {analysisResult && (
        <div className="bg-gradient-to-r from-purple-50 to-white border border-purple-100 p-6 rounded-2xl shadow-sm animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <BrainCircuit size={100} className="text-purple-600" />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <BrainCircuit size={20} />
            </div>
            <h4 className="font-bold text-purple-900">Diagnóstico Inteligente (Gemini)</h4>
          </div>
          <div className="prose prose-sm text-purple-900/80 max-w-none whitespace-pre-line relative z-10 leading-relaxed">
            {analysisResult}
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h4 className="font-bold text-slate-700">Log de Execução</h4>
          <span className="text-xs font-medium text-slate-400">Últimos 30 dias</span>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-white text-slate-400 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-semibold w-48">Data/Hora</th>
              <th className="px-6 py-4 font-semibold w-32">Tipo</th>
              <th className="px-6 py-4 font-semibold w-32">Status</th>
              <th className="px-6 py-4 font-semibold">Mensagens do Sistema</th>
              <th className="px-6 py-4 font-semibold w-40 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-300" />
                    {new Date(log.data).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                    {log.tipo}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {log.sucesso ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full text-xs border border-emerald-100">
                      <CheckCircle size={12} /> Sucesso
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-red-600 font-medium bg-red-50 px-2.5 py-1 rounded-full text-xs border border-red-100">
                      <AlertTriangle size={12} /> Falha
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                  <div className="max-w-md truncate" title={log.mensagens.join('\n')}>
                    {log.mensagens[0]}
                    {log.mensagens.length > 1 && <span className="ml-2 text-slate-400 text-[10px]">+{log.mensagens.length - 1}</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  {!log.sucesso && (
                    <button 
                      onClick={() => handleAnalyzeLog(log)}
                      disabled={analyzingId === log.id}
                      className="inline-flex items-center gap-1.5 text-purple-600 hover:text-white hover:bg-purple-600 border border-purple-200 hover:border-purple-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <BrainCircuit size={14} className={analyzingId === log.id ? 'animate-pulse' : ''} />
                      {analyzingId === log.id ? 'Pensando...' : 'Diagnóstico IA'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="p-12 text-center text-slate-400">
            Nenhum registro de log encontrado.
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncManager;