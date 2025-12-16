import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OrderList from './pages/OrderList';
import BillingPanel from './pages/BillingPanel';
import CommercialPanel from './pages/CommercialPanel';
import CreditPanel from './pages/CreditPanel';
import SyncManager from './pages/SyncManager';
import UserManagement from './pages/UserManagement';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import GeminiChat from './components/GeminiChat';
import { User } from './types';
import { api } from './services/dataService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Carrega sessão salva ao iniciar e atualiza dados do usuário do banco
  useEffect(() => {
    const loadSession = async () => {
      const savedSession = api.getCurrentSession();
      if (savedSession) {
        setCurrentUser(savedSession);
        const refreshedUser = await api.refreshCurrentUser();
        if (refreshedUser && JSON.stringify(refreshedUser) !== JSON.stringify(savedSession)) {
          setCurrentUser(refreshedUser);
        }
      }
      setIsLoadingSession(false);
    };
    loadSession();
  }, []);

  // Configuração do Timer de Sincronização Automática (30 minutos)
  useEffect(() => {
    const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

    const timer = setInterval(() => {
      console.log(`[AutoSync] Iniciando sincronização automática programada (${new Date().toLocaleTimeString()})...`);
      api.triggerManualSync('AUTOMATICO').then(res => {
         console.log("[AutoSync] Sucesso:", res);
      }).catch(err => {
         console.error("[AutoSync] Falha:", err);
      });
    }, SYNC_INTERVAL_MS);

    // Tenta rodar uma vez ao montar o app para garantir dados frescos,
    // mas de forma silenciosa (sem bloquear UI)
    if (currentUser) {
      api.triggerManualSync('AUTOMATICO').catch(() => console.warn("Sync inicial falhou (normal se offline)"));
    }

    return () => clearInterval(timer);
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setCurrentView('dashboard');
  };

  const renderContent = () => {
    if (!currentUser) return null;

    switch (currentView) {
      case 'dashboard':
        return <Dashboard user={currentUser} onNavigate={setCurrentView} />;
      case 'orders':
        return <OrderList user={currentUser} />;
      case 'billing':
        return <BillingPanel user={currentUser} />;
      case 'commercial':
        return <CommercialPanel user={currentUser} />;
      case 'credit':
        return <CreditPanel user={currentUser} />;
      case 'sync':
        return <SyncManager />;
      case 'users':
        return <UserManagement />;
      case 'settings':
        return <SettingsPage user={currentUser} />;
      default:
        return <Dashboard user={currentUser} onNavigate={setCurrentView} />;
    }
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-crop-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 font-sans">
      <Layout
        currentUser={currentUser}
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={handleLogout}
      >
        {renderContent()}
      </Layout>
      <GeminiChat />
    </div>
  );
};

export default App;
