import React, { useState } from 'react';
import { api } from '../services/dataService';
import { User } from '../types';
import { Sprout, Lock, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await api.login(email, password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      
      {/* Brand Header */}
      <div className="mb-8 flex flex-col items-center animate-fade-in-down">
        <div className="w-16 h-16 bg-crop-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-crop-900/20 mb-4">
          <Sprout size={36} />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">CROPFLOW</h1>
        <p className="text-slate-500 font-medium tracking-wide uppercase text-xs mt-1">Faturamento RS • Portal Corporativo</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in-up">
        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-1">Bem-vindo de volta</h2>
          <p className="text-sm text-slate-500 mb-6">Acesse sua conta para gerenciar pedidos.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase ml-1">Email</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-crop-600 transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-crop-500 focus:border-transparent outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase ml-1">Senha</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-crop-600 transition-colors" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-crop-500 focus:border-transparent outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 font-medium"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-medium animate-shake">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-crop-600 hover:bg-crop-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-crop-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  Acessar Sistema
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Grupo Cropflow. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;