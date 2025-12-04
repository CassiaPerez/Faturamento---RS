
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OrderList from './pages/OrderList';
import BillingPanel from './pages/BillingPanel';
import CommercialPanel from './pages/CommercialPanel';
import CreditPanel from './pages/CreditPanel';
import SyncManager from './pages/SyncManager';
import UserManagement from './pages/UserManagement';
import LoginPage from './pages/LoginPage';
import GeminiChat from './components/GeminiChat';
import { User } from './types';
import { api } from './services/dataService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleSwitchUser = (userId: string) => {
    // Allows switching for testing purposes inside the app
    api.getUsers().then(users => {
      const user = users.find(u => u.id === userId);
      if (user) setCurrentUser(user);
    });
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
        onSwitchUser={handleSwitchUser}
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