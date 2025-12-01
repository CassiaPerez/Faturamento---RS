
import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, Role } from '../types';
import { 
  Plus, 
  Trash2, 
  UserPlus, 
  Shield, 
  Mail, 
  Search, 
  CheckCircle, 
  Info,
  BadgeCheck,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Edit
} from 'lucide-react';

// Definição das Regras e Níveis
const ROLE_DETAILS = {
  [Role.ADMIN]: {
    label: 'Administrador',
    description: 'Acesso irrestrito a todo o sistema.',
    permissions: ['Gestão de Usuários', 'Configurações', 'Sincronização', 'Todos os Pedidos'],
    color: 'bg-red-50 text-red-700 border-red-200 ring-red-100',
    icon: Shield
  },
  [Role.GERENTE]: {
    label: 'Gerente Comercial',
    description: 'Visão estratégica e gestão de equipe.',
    permissions: ['Dashboards Completos', 'Todos os Pedidos', 'Relatórios', 'Sincronização'],
    color: 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-100',
    icon: LayoutDashboard
  },
  [Role.FATURAMENTO]: {
    label: 'Analista Faturamento',
    description: 'Operacional de emissão de notas.',
    permissions: ['Aprovar Solicitações', 'Faturar Pedidos', 'Dashboards Financeiros'],
    color: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-100',
    icon: FileText
  },
  [Role.VENDEDOR]: {
    label: 'Vendedor',
    description: 'Foco na própria carteira de clientes.',
    permissions: ['Visualizar Próprios Pedidos', 'Criar Solicitações', 'Histórico Pessoal'],
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
    icon: ShoppingCart
  }
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('');
  
  // New User Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: Role.VENDEDOR
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await api.getUsers();
    setUsers(data);
  };

  const openCreateModal = () => {
    setNewUser({ name: '', email: '', role: Role.VENDEDOR });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setNewUser({ name: user.name, email: user.email, role: user.role });
    setEditingId(user.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) return;

    if (editingId) {
      // Edit Mode
      await api.updateUser({
        id: editingId,
        ...newUser
      });
    } else {
      // Create Mode
      await api.createUser(newUser);
    }

    setIsModalOpen(false);
    setNewUser({ name: '', email: '', role: Role.VENDEDOR });
    setEditingId(null);
    loadUsers(); 
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este usuário? O acesso será revogado imediatamente.')) {
      await api.deleteUser(id);
      loadUsers();
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(filter.toLowerCase()) || 
    u.email.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserPlus className="text-crop-600" />
            Controle de Acesso
          </h2>
          <p className="text-slate-500 mt-1 max-w-2xl">
            Gerencie os usuários do sistema e atribua níveis de permissão (Roles) para controlar o acesso aos módulos de Vendas, Faturamento e Gestão.
          </p>
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-crop-600 hover:bg-crop-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-crop-900/20 flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap"
        >
          <Plus size={20} />
          Cadastrar Usuário
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left: Stats/Info (Optional Context) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Resumo de Acessos</h3>
            <div className="space-y-3">
              {Object.entries(ROLE_DETAILS).map(([key, details]) => {
                const count = users.filter(u => u.role === key).length;
                return (
                  <div key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${details.color.split(' ')[0].replace('bg-', 'bg-')}`}></div>
                      <span className="text-xs font-medium text-slate-600">{details.label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 text-blue-800 text-xs leading-relaxed">
            <div className="flex items-center gap-2 mb-2 font-bold">
              <Info size={16} />
              <span>Dica de Segurança</span>
            </div>
            Evite compartilhar senhas. Cada vendedor deve ter seu próprio login para garantir o rastreamento correto das solicitações de faturamento.
          </div>
        </div>

        {/* Right: Users Table */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 focus-within:ring-2 focus-within:ring-crop-500 transition-all">
            <div className="p-2 text-slate-400">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              placeholder="Pesquisar por nome, email ou cargo..." 
              className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 placeholder:text-slate-400 text-sm h-10"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Colaborador</th>
                  <th className="px-6 py-4">Nível de Acesso</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user) => {
                  const roleInfo = ROLE_DETAILS[user.role];
                  const RoleIcon = roleInfo.icon;
                  
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm border border-slate-200 shadow-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-700 text-sm">{user.name}</p>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                              <Mail size={12} />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`pl-2 pr-3 py-1 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1.5 ${roleInfo.color}`}>
                            <RoleIcon size={12} />
                            {roleInfo.label}
                          </span>
                          <span className="text-[10px] text-slate-400 pl-1">{roleInfo.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(user)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar Usuário"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Remover Acesso"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredUsers.length === 0 && (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                  <UserPlus size={32} className="opacity-20" />
                </div>
                <p className="text-sm font-medium">Nenhum usuário encontrado com este filtro.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal - Create/Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  {editingId ? 'Editar Usuário' : 'Novo Cadastro'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {editingId ? 'Atualize as informações de acesso.' : 'Preencha os dados para criar um novo acesso.'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-crop-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                    placeholder="Ex: João da Silva"
                    value={newUser.name}
                    onChange={e => setNewUser({...newUser, name: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Email Corporativo</label>
                  <input 
                    type="email" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-crop-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                    placeholder="nome@cropfield.com"
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Shield size={14} /> Selecione o Nível de Acesso (Role)
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(ROLE_DETAILS).map(([key, details]) => {
                    const isSelected = newUser.role === key;
                    const RoleIcon = details.icon;
                    
                    return (
                      <div 
                        key={key}
                        onClick={() => setNewUser({...newUser, role: key as Role})}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative overflow-hidden group ${
                          isSelected 
                            ? 'border-crop-500 bg-crop-50/50 shadow-md' 
                            : 'border-slate-100 bg-white hover:border-crop-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-crop-100 text-crop-600' : 'bg-slate-100 text-slate-400 group-hover:text-crop-500 group-hover:bg-crop-50'}`}>
                            <RoleIcon size={20} />
                          </div>
                          {isSelected && <CheckCircle size={20} className="text-crop-600" />}
                        </div>
                        
                        <h4 className={`font-bold text-sm ${isSelected ? 'text-crop-900' : 'text-slate-700'}`}>
                          {details.label}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                          {details.description}
                        </p>
                        
                        <div className="mt-3 pt-3 border-t border-slate-100/50">
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Permissões:</p>
                          <div className="flex flex-wrap gap-1">
                            {details.permissions.slice(0, 2).map(p => (
                              <span key={p} className="text-[9px] px-1.5 py-0.5 bg-white rounded border border-slate-100 text-slate-500">
                                {p}
                              </span>
                            ))}
                            {details.permissions.length > 2 && (
                              <span className="text-[9px] px-1.5 py-0.5 text-slate-400">+{details.permissions.length - 2}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-[2] px-6 py-3 rounded-xl font-bold text-white bg-crop-600 hover:bg-crop-700 shadow-lg shadow-crop-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                <BadgeCheck size={18} />
                {editingId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
