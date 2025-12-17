import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User } from '../types';
import { Database, Mail, Shield, Save, CheckCircle, AlertCircle, Server, Lock, Send, Settings, FileSpreadsheet, Trash2, Loader2 } from 'lucide-react';

const SettingsPage: React.FC<{ user: User }> = ({ user }) => {
  const [config, setConfig] = useState({
    supabaseUrl: '',
    emailServiceUrl: '',
    csvUrl: '',
    dbConnected: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const data = await api.getSystemConfig();
    // Se não tiver URL configurada, sugere a URL fornecida pelo usuário
    if (!data.csvUrl) {
        data.csvUrl = 'https://drive.google.com/file/d/1ifetFw_-dbBGrUQrupy9luJqxuD6sMVy/view?usp=sharing';
    }
    setConfig(data);
  };

  const handleSave = async () => {
    setIsLoading(true);
    await api.updateSystemConfig({ 
        emailServiceUrl: config.emailServiceUrl,
        csvUrl: config.csvUrl
    });
    setSaveMessage('Configurações salvas com sucesso!');
    setTimeout(() => setSaveMessage(''), 3000);
    setIsLoading(false);
  };

  const handleResetEmailUrl = () => {
    const newUrl = 'https://script.google.com/macros/s/AKfycbzRo-UD20w_MVIA0oN4iEkDyKK3zFCvOznZRYajLBvGqSRV1i4L37xq65ICKxVqT1eG/exec';
    setConfig({ ...config, emailServiceUrl: newUrl });
    setSaveMessage('URL resetada! Clique em "Salvar Configuração" para aplicar.');
    setTimeout(() => setSaveMessage(''), 5000);
  };

  const handleTestEmail = async () => {
    setTestEmailStatus('sending');
    const result = await api.sendTestEmail(user.email);
    if (result.success) {
      setTestEmailStatus('success');
      setTimeout(() => setTestEmailStatus('idle'), 5000);
    } else {
      setTestEmailStatus('error');
      alert('Erro ao enviar: ' + result.message);
    }
  };
  
  const handleClearOrders = async () => {
      if (!confirm("ATENÇÃO: Você está prestes a excluir TODOS os pedidos da carteira e seus históricos.\n\nEsta ação tentará limpar tanto os dados locais quanto o banco de dados remoto.\n\nDeseja continuar?")) {
          return;
      }
      
      setIsClearing(true);
      try {
          await api.clearAllPedidos();
          alert("Carteira limpa com sucesso! O sistema será recarregado para aplicar as alterações.");
          window.location.reload();
      } catch (e: any) {
          alert("Erro ao limpar carteira: " + e.message);
          setIsClearing(false);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="text-slate-600" /> Configurações do Sistema
        </h2>
        <p className="text-slate-500 mt-1">Gerencie conexões, integrações e parâmetros de segurança.</p>
      </div>

      {/* Database Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Database size={20} />
          </div>
          <h3 className="font-bold text-slate-800">Banco de Dados (Supabase)</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Status da Conexão</label>
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${config.dbConnected ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                {config.dbConnected ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span className="font-bold text-sm">{config.dbConnected ? 'Conectado e Operacional' : 'Desconectado / Erro'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Project URL</label>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-mono text-sm truncate">
                <Server size={16} className="text-slate-400" />
                {config.supabaseUrl}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Google Drive / CSV Integration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
               <FileSpreadsheet size={20} />
            </div>
            <h3 className="font-bold text-slate-800">Sincronização de Carteira (Google Drive)</h3>
         </div>
         <div className="p-6 space-y-4">
             <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-sm text-emerald-800">
               O sistema converterá automaticamente links de visualização do Drive para links de download.
               <br/>
               <strong>Dica:</strong> Se houver erro de bloqueio (CORS), utilize a opção "Arquivo {'>'} Compartilhar {'>'} Publicar na Web {'>'} Formato CSV" no Google Sheets.
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Link do Arquivo (Drive ou CSV Direto)</label>
                <input 
                  type="text" 
                  value={config.csvUrl}
                  onChange={(e) => setConfig({...config, csvUrl: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-slate-700"
                  placeholder="Cole o link do Google Drive aqui..."
                />
             </div>
         </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
               <Trash2 size={20} />
            </div>
            <h3 className="font-bold text-slate-800">Gestão de Dados</h3>
         </div>
         <div className="p-6 flex items-center justify-between">
             <div className="max-w-lg">
                 <h4 className="font-bold text-slate-700">Zerar Carteira de Pedidos</h4>
                 <p className="text-sm text-slate-500 mt-1">
                     Remove <strong>todos</strong> os pedidos, solicitações e históricos atuais. 
                     Útil para limpar dados de teste antes de importar a carteira oficial.
                     Os usuários cadastrados não serão removidos.
                 </p>
             </div>
             <button 
                onClick={handleClearOrders}
                disabled={isClearing}
                className="px-5 py-3 rounded-xl bg-white border-2 border-red-100 text-red-600 font-bold text-sm hover:bg-red-50 hover:border-red-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                 {isClearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} 
                 {isClearing ? 'Limpando...' : 'Limpar Carteira'}
             </button>
         </div>
      </div>

      {/* Email Service Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Mail size={20} />
          </div>
          <h3 className="font-bold text-slate-800">Serviço de E-mail</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 mb-4">
            O sistema utiliza <strong>Google Apps Script Webhook</strong> para contornar bloqueios de navegador e enviar e-mails corporativos.
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase">Webhook URL (Google Script)</label>
              <button
                onClick={handleResetEmailUrl}
                className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
                type="button"
              >
                Resetar para Nova URL
              </button>
            </div>
            <input
              type="text"
              value={config.emailServiceUrl}
              onChange={(e) => setConfig({...config, emailServiceUrl: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-crop-500 focus:border-transparent outline-none transition-all text-slate-700"
              placeholder="https://script.google.com/macros/s/..."
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button 
              onClick={handleTestEmail}
              disabled={testEmailStatus === 'sending'}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                testEmailStatus === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {testEmailStatus === 'sending' ? <span className="animate-pulse">Enviando...</span> : testEmailStatus === 'success' ? <>Email Enviado! <CheckCircle size={16}/></> : <><Send size={16}/> Enviar Teste para {user.email}</>}
            </button>
            
            <button 
              onClick={handleSave}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-crop-600 hover:bg-crop-700 shadow-lg shadow-crop-900/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <Save size={18} />
              {isLoading ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
          {saveMessage && <p className="text-right text-xs font-bold text-emerald-600 mt-2 animate-fade-in">{saveMessage}</p>}
        </div>
      </div>

      {/* Auth Info Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
            <Shield size={20} />
          </div>
          <h3 className="font-bold text-slate-800">Autenticação & Segurança</h3>
        </div>
        <div className="p-6">
           <div className="flex items-start gap-4">
             <div className="p-3 bg-slate-100 rounded-full"><Lock size={24} className="text-slate-400" /></div>
             <div>
               <h4 className="font-bold text-slate-800">Autenticação Híbrida</h4>
               <p className="text-sm text-slate-500 mt-1">O sistema utiliza validação interna para administradores e simulação de acesso para perfis operacionais (Vendedores/Gerentes) para facilitar a implantação rápida.</p>
             </div>
           </div>
        </div>
      </div>

    </div>
  );
};

export default SettingsPage;