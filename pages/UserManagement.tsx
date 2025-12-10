
import React, { useEffect, useState } from 'react';
import { api } from '../services/dataService';
import { User, Role } from '../types';
import { 
  Plus, Trash2, UserPlus, Shield, Mail, Search, BadgeCheck,
  LayoutDashboard, ShoppingCart, FileText, Edit, TrendingUp, Banknote, Users, AlertCircle, Lock, CheckCircle
} from 'lucide-react';

const ROLE_DETAILS = {
  [Role.ADMIN]: { label: 'Administrador', description: 'Acesso total.', permissions: ['Tudo'], color: 'bg-red-50 text-red-700', icon: Shield },
  [Role.GERENTE]: { label: 'Gerente Comercial', description: 'Gestão de equipe.', permissions: ['Carteira Geral', 'Dashboards'], color: 'bg-purple-50 text-purple-700', icon: LayoutDashboard },
  [Role.COMERCIAL]: { label: 'Diretor Comercial', description: 'Aprovação.', permissions: ['Aprovar Comercial'], color: 'bg-blue-50 text-blue-700', icon: TrendingUp },
  [Role.CREDITO]: { label: 'Analista de Crédito', description: 'Análise risco.', permissions: ['Liberar Crédito'], color: 'bg-indigo-50 text-indigo-700', icon: Banknote },
  [Role.FATURAMENTO]: { label: 'Analista Faturamento', description: 'Emissão.', permissions: ['Faturar'], color: 'bg-orange-50 text-orange-700', icon: FileText },
  [Role.VENDEDOR]: { label: 'Vendedor', description: 'Carteira própria.', permissions: ['Pedidos'], color: 'bg-emerald-50 text-emerald-700', icon: ShoppingCart }
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: Role.VENDEDOR,
    manager_id: '',
    password: '' // Campo de senha
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await api.getUsers();
    setUsers(data);
  };

  const openCreateModal = () => {
    setNewUser({ name: '', email: '', role: Role.VENDEDOR, manager_id: '', password: '' });
    setEditingId(null);
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setNewUser({ 
      name: user.name, 
      email: user.email, 
      role: user.role,
      manager_id: user.manager_id || '',
      password: '' // Não preenche a senha por segurança, usuário digita se quiser trocar
    });
    setEditingId(user.id);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) return;

    // Validar senha na criação
    if (!editingId && !newUser.password) {
      alert("A senha é obrigatória para novos usuários.");
      return;
    }

    const userPayload = {
      ...newUser,
      // Se estiver editando e senha estiver vazia, remove do payload para não sobrescrever
      password: (editingId && !newUser.password) ? undefined : newUser.password,
      manager_id: newUser.role === Role.VENDEDOR ? newUser.manager_id : undefined 
    };

    // Remover undefined properties
    if (userPayload.password === undefined) delete (userPayload as any).password;

    try {
        setError('');
        if (editingId) {
            await api.updateUser({ id: editingId, ...userPayload });
        } else {
            await api.createUser(userPayload as any);
        }

        setIsModalOpen(false);
        loadUsers(); 
    } catch (e: any) {
        console.error(e);
        // Exibe erro na modal sem fechar
        setError(e.message || "Erro ao salvar usuário no banco de dados.");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este usuário?')) {
      await api.deleteUser(id);
      loadUsers();
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(filter.toLowerCase()) || 
    u.email.toLowerCase().includes(filter.toLowerCase())
  );

  // FILTRO DINÂMICO: Busca todos os usuários que JÁ SÃO Gerentes para popular o dropdown
  const activeManagers = users.filter(u => u.role === Role.GERENTE);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserPlus className="text-crop-600" /> Controle de Acesso
          </h2>
          <p className="text-slate-500 mt-1">Gerencie usuários, permissões e hierarquia comercial.</p>
        </div>
        <button onClick={openCreateModal} className="bg-crop-600 hover:bg-crop-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-crop-900/20 flex items-center gap-2 transition-all active:scale-95">
          <Plus size={20} /> Cadastrar Usuário
        </button>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                <input 
                   type="text" 
                   placeholder="Buscar colaborador..." 
                   value={filter} 
                   onChange={e => setFilter(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-crop-500 focus:border-transparent outline-none text-sm"
                />
            </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Colaborador</th>
              <th className="px-6 py-4">Nível de Acesso</th>
              <th className="px-6 py-4">Gerente Responsável</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredUsers.map((user) => {
              const roleInfo = ROLE_DETAILS[user.role] || ROLE_DETAILS[Role.VENDEDOR];
              const RoleIcon = roleInfo.icon;
              
              // LÓGICA DE EXIBIÇÃO: Busca o nome do gerente pelo ID salvo
              const managerObj = user.manager_id ? users.find(m => m.id === user.manager_id) : null;
              const managerName = managerObj ? managerObj.name : '-';

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
                          <Mail size={12} /> {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`pl-2 pr-3 py-1 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1.5 w-fit ${roleInfo.color}`}>
                      <RoleIcon size={12} /> {roleInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                     {user.role === Role.VENDEDOR ? (
                        managerObj ? (
                            <div className="flex items-center gap-2">
                                <Users size={14} className="text-purple-500" />
                                <span className="font-medium text-slate-700">{managerName}</span>
                            </div>
                        ) : <span className="text-slate-400 italic text-xs">Não vinculado</span>
                     ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(user)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg"><Edit size={16} /></button>
                      <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Usuário' : 'Novo Cadastro'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100"><Plus size={20} className="rotate-45 text-slate-500" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* ALERTA DE ERRO */}
              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-red-700 animate-shake">
                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                    <div className="text-sm">
                        <span className="font-bold">Atenção:</span> {error}
                    </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Nome Completo</label>
                  <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-crop-500 outline-none text-sm font-medium" placeholder="Ex: João da Silva" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Email Corporativo</label>
                  <input type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-crop-500 outline-none text-sm font-medium" placeholder="nome@cropflow.com" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                </div>
              </div>
              
              {/* CAMPO DE SENHA */}
              <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Lock size={12} /> Senha de Acesso</label>
                  <input 
                    type="password" 
                    required={!editingId} // Obrigatório apenas na criação
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-crop-500 outline-none text-sm font-medium" 
                    placeholder={editingId ? "Deixe em branco para manter a atual" : "Crie uma senha segura"} 
                    value={newUser.password} 
                    onChange={e => setNewUser({...newUser, password: e.target.value})} 
                  />
              </div>

              {/* Seletor de Gerente (Aparece apenas se for Vendedor) */}
              {newUser.role === Role.VENDEDOR && (
                  <div className="space-y-2 bg-purple-50 p-4 rounded-xl border border-purple-100">
                      <label className="block text-xs font-bold text-purple-800 uppercase flex items-center gap-2">
                          <Users size={14} /> Vincular Gerente Responsável
                      </label>
                      <div className="relative">
                        <select 
                          className="w-full px-4 py-3 bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-medium text-slate-700 cursor-pointer appearance-none"
                          value={newUser.manager_id}
                          onChange={e => setNewUser({...newUser, manager_id: e.target.value})}
                        >
                            <option value="">Selecione um Gerente...</option>
                            {activeManagers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-purple-500">
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                        </div>
                      </div>

                      {activeManagers.length === 0 ? (
                         <p className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                           <AlertCircle size={10} /> Nenhum usuário "Gerente Comercial" cadastrado.
                         </p>
                      ) : (
                         <p className="text-[10px] text-purple-600 mt-1">
                           O gerente selecionado receberá cópias dos e-mails de bloqueio deste vendedor.
                         </p>
                      )}
                  </div>
              )}

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Shield size={14} /> Nível de Acesso</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(ROLE_DETAILS).map(([key, details]) => {
                    const isSelected = newUser.role === key;
                    const RoleIcon = details.icon;
                    return (
                      <div key={key} onClick={() => setNewUser({...newUser, role: key as Role})} className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative group ${isSelected ? 'border-crop-500 bg-crop-50/50 shadow-md' : 'border-slate-100 bg-white hover:border-crop-200'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-crop-100 text-crop-600' : 'bg-slate-100 text-slate-400 group-hover:text-crop-500'}`}><RoleIcon size={20} /></div>
                          {isSelected && <CheckCircle size={20} className="text-crop-600" />}
                        </div>
                        <h4 className={`font-bold text-sm ${isSelected ? 'text-crop-900' : 'text-slate-700'}`}>{details.label}</h4>
                        <p className="text-[11px] text-slate-500 mt-1">{details.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-sm">Cancelar</button>
              <button onClick={handleSubmit} className="flex-[2] px-6 py-3 rounded-xl font-bold text-white bg-crop-600 hover:bg-crop-700 shadow-lg shadow-crop-900/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"><BadgeCheck size={18} /> {editingId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
