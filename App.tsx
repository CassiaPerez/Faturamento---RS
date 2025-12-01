
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OrderList from './pages/OrderList';
import BillingPanel from './pages/BillingPanel';
import SyncManager from './pages/SyncManager';
import UserManagement from './pages/UserManagement';
import GeminiChat from './components/GeminiChat';
import { User, Role } from './types';
import { MOCK_USERS } from './services/dataService';

const App: React.FC = () => {
  // Default to Admin for demo ease, but allows switching
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]);
  const [currentView, setCurrentView] = useState('dashboard');

  const handleSwitchUser = (userId: string) => {
    // Note: We'll fetch the full list in real implementation, 
    // for now we trust the layout/mock data structure has been updated by dataService fallback
    // In a real app, this would be an API call or context lookup
    import('./services/dataService').then(module => {
      module.api.getUsers().then(users => {
        const user = users.find(u => u.id === userId);
        if (user) setCurrentUser(user);
      });
    });
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard user={currentUser} onNavigate={setCurrentView} />;
      case 'orders':
        return <OrderList user={currentUser} />;
      case 'billing':
        return <BillingPanel user={currentUser} />;
      case 'sync':
        return <SyncManager />;
      case 'users':
        return <UserManagement />;
      default:
        return <Dashboard user={currentUser} onNavigate={setCurrentView} />;
    }
  };

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
