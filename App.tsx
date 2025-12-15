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

  // Configuração do Timer de Sincronização Automática (3 horas)
  useEffect(() => {
    const SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 Horas

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
    api.triggerManualSync('AUTOMATICO').catch(() => console.warn("Sync inicial falhou (normal se offline)"));

    return () => clearInterval(timer);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
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

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 font-sans">
      <Layout
        currentUser={currentUser}
        currentView={currentView}
        onNavigate={setCurrentView}
      >
        {renderContent()}
      </Layout>
      <GeminiChat />
    </div>
  );
};

export default App;
