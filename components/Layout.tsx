import React, { useEffect, useState } from 'react';
import { User, Role } from '../types';
import { api } from '../services/dataService';
import { 
  LayoutDashboard, 
  Package, 
  CreditCard, 
  RefreshCw, 
  User as UserIcon,
  ChevronDown,
  Bell,
  Search,
  Sprout,
  Users,
  TrendingUp,
  Banknote,
  Settings,
  Menu,
  X
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  onSwitchUser: (userId: string) => void;
  currentView: string;
  onNavigate: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentUser, onSwitchUser, currentView, onNavigate }) => {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Fetch users for the switcher (keeps dropdown in sync)
    api.getUsers().then(setUsersList);
  }, [currentView]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [Role.ADMIN, Role.GERENTE, Role.VENDEDOR, Role.FATURAMENTO, Role.COMERCIAL, Role.CREDITO] },
    { id: 'orders', label: 'Carteira de Pedidos', icon: Package, roles: [Role.ADMIN, Role.GERENTE, Role.VENDEDOR] },
    { id: 'billing', label: 'Faturamento', icon: CreditCard, roles: [Role.ADMIN, Role.GERENTE, Role.FATURAMENTO] },
    { id: 'commercial', label: 'Aprovação Comercial', icon: TrendingUp, roles: [Role.ADMIN, Role.GERENTE, Role.COMERCIAL] },
    { id: 'credit', label: 'Análise de Crédito', icon: Banknote, roles: [Role.ADMIN, Role.GERENTE, Role.CREDITO] },
    { id: 'sync', label: 'Sincronização', icon: RefreshCw, roles: [Role.ADMIN, Role.GERENTE] },
    { id: 'users', label: 'Usuários', icon: Users, roles: [Role.ADMIN] },
    { id: 'settings', label: 'Configurações', icon: Settings, roles: [Role.ADMIN] },
  ];

  const handleNavigate = (id: string) => {
    onNavigate(id);
    setIsMobileMenuOpen(false); // Close menu on mobile after click
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-72 bg-[#0f172a] text-white flex flex-col shadow-xl transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-[#020617]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-crop-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-crop-900/50">
              <Sprout size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">CROPFLOW</h1>
              <p className="text-[10px] text-slate-400 tracking-wide uppercase font-medium mt-0.5">Gestão Inteligente</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2 mt-2">Menu Principal</p>
          {menuItems.map((item) => {
            if (!item.roles.includes(currentUser.role)) return null;
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive 
                    ? 'bg-crop-600 text-white shadow-md shadow-crop-900/30' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} transition-colors`} />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile / Switcher */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur-sm">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800 border border-slate-700 mb-3 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-crop-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-inner ring-2 ring-slate-800">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] text-slate-400 truncate capitalize font-medium">{currentUser.role.toLowerCase()}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] text-slate-500 font-bold uppercase px-1 tracking-wider">Simular Acesso</label>
            <div className="relative group">
              <UserIcon size={14} className="absolute left-2.5 top-2.5 text-slate-500 group-hover:text-crop-400 transition-colors" />
              <select 
                value={currentUser.id}
                onChange={(e) => onSwitchUser(e.target.value)}
                className="w-full bg-slate-950 text-slate-300 text-xs rounded-lg pl-8 pr-4 py-2 border border-slate-700 focus:outline-none focus:border-crop-500 focus:ring-1 focus:ring-crop-500 appearance-none cursor-pointer hover:border-slate-600 transition-colors"
              >
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-slate-800 capitalize flex items-center gap-3 truncate">
              {menuItems.find(i => i.id === currentView)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            {/* Search Bar (Hidden on Mobile) */}
            <div className="hidden md:flex items-center bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 focus-within:ring-2 focus-within:ring-crop-100 focus-within:border-crop-400 transition-all w-64 group">
              <Search size={16} className="text-slate-400 group-focus-within:text-crop-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisa global..." 
                className="bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder:text-slate-400 w-full ml-2"
              />
            </div>

            {/* Sync Status Badge (Hidden on Small Mobile) */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 text-[10px] font-bold uppercase tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Sync Ativo
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

            <button className="relative p-2 text-slate-400 hover:text-crop-600 hover:bg-slate-50 rounded-lg transition-all">
              <Bell size={20} />
              <span className="absolute top-1.5 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;