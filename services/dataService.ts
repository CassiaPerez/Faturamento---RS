import { Pedido, SolicitacaoFaturamento, LogSincronizacao, StatusPedido, StatusSolicitacao, Role, User, HistoricoEvento } from '../types';
import { supabase } from './supabaseClient';

/* 
  === ARQUITETURA: HÍBRIDA (SUPABASE + LOCAL STORAGE) ===
  Melhoria: Persistência local para garantir funcionamento mesmo sem conexão DB.
*/

// --- MOCK DATA PARA INICIALIZAÇÃO OFFLINE ---
// REMOVIDOS PEDIDOS DE EXEMPLO PARA INICIAR LIMPO
const MOCK_PEDIDOS: Pedido[] = [];

// --- STORAGE HELPERS ---
const STORAGE_KEYS = {
  PEDIDOS: 'cropflow_pedidos_v2',       // Atualizado v2 para limpar cache antigo
  SOLICITACOES: 'cropflow_solicitacoes_v2', // Atualizado v2
  HISTORICO: 'cropflow_historico_v2',   // Atualizado v2
  LOGS: 'cropflow_logs_v2',             // Atualizado v2 para corrigir persistência
  CONFIG: 'cropflow_config_v1',         // Mantém configurações (email/db)
  DELETED_IDS: 'cropflow_deleted_ids_v2', // Atualizado v2
  USERS: 'cropflow_users_v1'            // Cache local de usuários
};

const loadFromStorage = <T>(key: string, defaultData: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultData;
  } catch (e) {
    console.warn(`Erro ao carregar ${key} do storage`, e);
    return defaultData;
  }
};

const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Erro ao salvar ${key} no storage`, e);
  }
};

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzuZcOvracR6by--ZRCbv0AT7w3owYuTdgUn2G2V1sJzxD_X_RBF8GIyVzcwwza9TbD/exec';

// Carrega URL salva ou usa padrão
const loadConfig = () => {
  const saved = loadFromStorage(STORAGE_KEYS.CONFIG, { 
      emailServiceUrl: DEFAULT_SCRIPT_URL,
      csvUrl: 'https://drive.google.com/file/d/1ifetFw_-dbBGrUQrupy9luJqxuD6sMVy/view?usp=sharing' // Padrão com o link fornecido 
  });
  return saved;
};

let currentConfig = loadConfig();
let googleScriptUrl = currentConfig.emailServiceUrl || DEFAULT_SCRIPT_URL;

// Inicialização com Fallback LocalStorage ou Mock
let localPedidos: Pedido[] = loadFromStorage(STORAGE_KEYS.PEDIDOS, [...MOCK_PEDIDOS]);
let localSolicitacoes: SolicitacaoFaturamento[] = loadFromStorage(STORAGE_KEYS.SOLICITACOES, []);
let localHistorico: HistoricoEvento[] = loadFromStorage(STORAGE_KEYS.HISTORICO, []);
let localLogs: LogSincronizacao[] = loadFromStorage(STORAGE_KEYS.LOGS, []);
let deletedIds: string[] = loadFromStorage(STORAGE_KEYS.DELETED_IDS, []);

// Cache para eventos recentes
let sessionEvents: HistoricoEvento[] = [];

// MOCK USERS (Fallback Inicial)
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Administrador', role: Role.ADMIN, email: 'administrador@grupocropfield.com.br', password: '123' },
  { id: 'u2', name: 'Gerente Comercial', role: Role.GERENTE, email: 'gerente@cropflow.com', password: '123' },
  { id: 'u3', name: 'Analista Faturamento', role: Role.FATURAMENTO, email: 'faturamento@cropflow.com', password: '123' },
  { id: 'u6', name: 'Diretor Comercial', role: Role.COMERCIAL, email: 'comercial@cropflow.com', password: '123' },
  { id: 'u7', name: 'Analista Crédito', role: Role.CREDITO, email: 'credito@cropflow.com', password: '123' },
  { id: 'u4', name: 'A. J. DEBONI & CIA LTDA', role: Role.VENDEDOR, email: 'deboni@cropflow.com', manager_id: 'u2', password: '123' },
  { id: 'u5', name: 'DANTE LUIS DAMIANI', role: Role.VENDEDOR, email: 'dante@cropflow.com', manager_id: 'u2', password: '123' },
];
let localUsers: User[] = loadFromStorage(STORAGE_KEYS.USERS, [...MOCK_USERS]);

// Helper simples para UUID v4 (para compatibilidade caso crypto.randomUUID falhe ou DB exija UUID válido)
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const getRoleLabel = (role: Role | string) => {
  switch(role) {
    case Role.FATURAMENTO: return 'FATURAMENTO';
    case Role.COMERCIAL: return 'COMERCIAL';
    case Role.CREDITO: return 'CRÉDITO';
    case Role.ADMIN: return 'ADMINISTRADOR';
    case Role.GERENTE: return 'GERÊNCIA';
    case Role.VENDEDOR: return 'VENDEDOR';
    default: return role;
  }
};

const filterDataByRole = (data: Pedido[], user: User) => {
  if (user.role === Role.VENDEDOR) {
    return data.filter(p => p.nome_vendedor && p.nome_vendedor.toLowerCase().includes(user.name.toLowerCase()));
  }
  return data;
};

const logEvento = async (pedidoId: string, user: User, acao: string, detalhes?: string, tipo: 'SUCESSO' | 'ERRO' | 'INFO' | 'ALERTA' = 'INFO', forceLocal: boolean = false) => {
  const evento: any = {
    pedido_id: pedidoId,
    data_evento: new Date().toISOString(),
    usuario: user.name,
    setor: user.role,
    acao,
    detalhes,
    tipo
  };

  const tempId = `temp-${Date.now()}`;
  sessionEvents.push({ ...evento, id: tempId });

  // Tenta salvar no DB, fallback para local
  if (!forceLocal) {
    try {
      const { error } = await supabase.from('historico_eventos').insert(evento);
      if (error) throw error;
      return;
    } catch (e) {
      console.warn("Log evento offline:", e);
    }
  }

  // Fallback Local Persistence
  evento.id = `loc-${Date.now()}`;
  localHistorico.push(evento);
  saveToStorage(STORAGE_KEYS.HISTORICO, localHistorico);
};

// HELPER PRIVADO PARA ENVIO DE EMAIL
const sendEmailToScript = async (payload: any) => {
    // Verificação de conexão básica (Internet), não de banco de dados
    if (!navigator.onLine) {
        console.warn("Sem conexão com a internet para enviar e-mail.");
        return false;
    }

    try {
        console.log("Tentando enviar email para Script:", googleScriptUrl, payload);
        // Utiliza no-cors para evitar bloqueio do navegador (status 0 é esperado)
        await fetch(googleScriptUrl, { 
            method: 'POST', 
            mode: 'no-cors', 
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8' 
            },
            body: JSON.stringify(payload) 
        });
        return true;
    } catch (e) {
        console.error("Erro crítico ao fazer fetch do email:", e);
        return false;
    }
};

// HELPER: Convert Drive URL to Direct Download Link
const convertDriveLink = (url: string): string => {
    // Tenta extrair ID de vários formatos
    const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
    }
    return url;
};

// HELPER: Parse CSV/TXT string to Pedidos
const parseCSV = (csvText: string): Pedido[] => {
    // Remove BOM se existir e espaços extras
    const cleanText = csvText.trim().replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    if (lines.length < 2) return [];

    // Detecção automática de delimitador (Tab, Ponto e Vírgula ou Vírgula)
    const firstLine = lines[0];
    let delimiter = ',';
    
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';')) delimiter = ';';

    const headers = firstLine.toLowerCase().split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Função auxiliar para achar índice
    const getIdx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    const idxNumero = getIdx(['numero', 'pedido', 'nro', 'doc', 'ordem']);
    const idxCliente = getIdx(['cliente', 'nome', 'parceiro']);
    const idxProduto = getIdx(['produto', 'material', 'desc']);
    const idxUnidade = getIdx(['unidade', 'und', 'un']);
    const idxVolume = getIdx(['volume', 'qtd', 'quantidade', 'saldo']);
    const idxValor = getIdx(['valor', 'total', 'montante', 'bruto']);
    const idxVendedor = getIdx(['vendedor', 'rep', 'representante']);
    
    const parsedPedidos: Pedido[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split inteligente baseado no delimitador detectado
        let cols: string[];
        
        if (delimiter === '\t') {
             // Arquivos TXT tabulados geralmente não usam aspas, split simples
             cols = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
        } else if (delimiter === ';') {
             cols = line.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
        } else {
             // Regex para CSV padrão com vírgula e aspas
             cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
        }

        if (cols.length < 3) continue;

        const rawNumero = idxNumero >= 0 ? cols[idxNumero] : cols[0];
        const cliente = idxCliente >= 0 ? cols[idxCliente] : cols[1];
        
        if (!rawNumero || !cliente || String(rawNumero).toLowerCase().includes('total')) continue;
        
        const numero = String(rawNumero).trim();
        const produto = idxProduto >= 0 ? cols[idxProduto] : (cols[2] || 'Produto Geral');
        const unidade = idxUnidade >= 0 ? cols[idxUnidade] : 'TN';
        
        const rawVol = idxVolume >= 0 ? cols[idxVolume] : cols[3];
        const rawVal = idxValor >= 0 ? cols[idxValor] : cols[4];
        
        const cleanNumber = (val: string) => {
            if (!val) return 0;
            // Se tiver vírgula como decimal (formato BR)
            if (val.includes(',') && (val.indexOf(',') > val.indexOf('.') || !val.includes('.'))) {
                return parseFloat(val.replace(/\./g, '').replace(',', '.'));
            }
            return parseFloat(val.replace(/[^\d.-]/g, ''));
        };

        const volume = cleanNumber(rawVol);
        const valor = cleanNumber(rawVal);
        const vendedor = idxVendedor >= 0 ? cols[idxVendedor] : (cols[5] || 'Vendas Internas');
        const codigoVendedor = '00' + (i % 10); 
        const codigoCliente = 'C' + Math.floor(Math.random() * 1000);

        parsedPedidos.push({
            id: numero,
            numero_pedido: numero,
            codigo_cliente: codigoCliente,
            nome_cliente: cliente,
            nome_produto: produto || 'Produto Geral',
            unidade: unidade || 'TN',
            volume_total: volume,
            volume_restante: volume,
            volume_faturado: 0,
            valor_total: valor,
            valor_faturado: 0,
            codigo_vendedor: codigoVendedor,
            nome_vendedor: vendedor,
            status: StatusPedido.PENDENTE,
            data_criacao: new Date().toISOString()
        });
    }
    return parsedPedidos;
};

export const api = {
  checkConnection: async (): Promise<boolean> => {
    try {
      // Check tables to attempt schema cache refresh
      await supabase.from('pedidos').select('id').limit(1);
      await supabase.from('app_users').select('id').limit(1);
      return true;
    } catch (e) { 
      console.error("Erro conexão Supabase (ou Schema Cache):", e);
      return false; 
    }
  },
  
  login: async (email: string, password: string): Promise<User> => {
      // Backdoor Admin Local
      if (email.trim() === 'administrador@grupocropfield.com.br' && password === 'Cp261121@!') {
        return { id: 'u1', name: 'Administrador', role: Role.ADMIN, email: email };
      }
      
      try {
        const { data, error } = await supabase.from('app_users').select('*').eq('email', email).eq('password', password).single();
        if (!error && data) {
            const user = data as User;
            // Atualiza cache local
            const existingIdx = localUsers.findIndex(u => u.id === user.id);
            if (existingIdx !== -1) localUsers[existingIdx] = user;
            else localUsers.push(user);
            saveToStorage(STORAGE_KEYS.USERS, localUsers);
            return user;
        }
      } catch (e) {}
      
      const user = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (user && (!user.password || user.password === password)) return user;
      
      throw new Error('Credenciais inválidas.');
  },
  
  getSystemConfig: async () => { 
    const isConnected = await api.checkConnection();
    return { 
      supabaseUrl: 'https://vvmztpnxpndoaeepxztj.supabase.co', 
      emailServiceUrl: googleScriptUrl, 
      csvUrl: currentConfig.csvUrl || '',
      dbConnected: isConnected 
    }; 
  },
  
  updateSystemConfig: async (config: any) => { 
    if(config.emailServiceUrl) {
        googleScriptUrl = config.emailServiceUrl;
    }
    
    currentConfig = {
        ...currentConfig,
        emailServiceUrl: config.emailServiceUrl || currentConfig.emailServiceUrl,
        csvUrl: config.csvUrl || ''
    };
    
    saveToStorage(STORAGE_KEYS.CONFIG, currentConfig);
    return true; 
  },
  
  sendTestEmail: async (email: string) => { 
    const payload = {
        action: 'test_email',
        to: email,
        subject: 'Teste de Configuração Cropflow',
        body: 'Se você recebeu este e-mail, a integração com o Google Apps Script está funcionando corretamente.'
    };
    
    const sent = await sendEmailToScript(payload);
    
    if (sent) {
        return { success: true, message: "Comando enviado (Verifique sua caixa de entrada/spam)" };
    } else {
        return { success: false, message: "Falha ao conectar com o serviço de e-mail." };
    }
  },
  
  getUsers: async () => { 
    try {
        const { data, error } = await supabase.from('app_users').select('*').order('name');
        if (!error && data) {
            localUsers = data as User[];
            saveToStorage(STORAGE_KEYS.USERS, localUsers);
            return localUsers;
        }
    } catch (e) {
        console.warn("Erro ao buscar usuários do DB, usando cache local.");
    }
    return localUsers; 
  },

  createUser: async (user: any) => { 
    const newUser = { ...user };
    
    // Garante um ID compatível com UUID v4 para PostgreSQL
    if (!newUser.id) {
        newUser.id = generateUUID();
    }

    try {
        // Salva no Banco de Dados
        const { data, error } = await supabase.from('app_users').insert(newUser).select().single();
        if (error) throw error;
        
        const createdUser = data || newUser;

        // Atualiza Cache Local
        localUsers.push(createdUser);
        saveToStorage(STORAGE_KEYS.USERS, localUsers);

        // Dispara E-mail de Boas-Vindas
        if (createdUser.email && createdUser.password) {
            sendEmailToScript({
                to: createdUser.email,
                subject: 'Bem-vindo ao Cropflow - Credenciais de Acesso',
                body: `Olá ${createdUser.name},\n\nSeu cadastro no sistema Cropflow foi realizado com sucesso.\n\nSuas credenciais de acesso:\nLogin: ${createdUser.email}\nSenha: ${createdUser.password}\n\nAcesse o sistema para começar a operar.\n\nAtenciosamente,\nEquipe Cropflow`,
                action: 'welcome_email'
            }).catch(err => console.error("Erro ao enviar email boas-vindas:", err));
        }

        return createdUser;
    } catch (e: any) {
        const errorMsg = e.message || JSON.stringify(e);
        console.error("Erro ao criar usuário no banco (Salvando Localmente):", errorMsg);
        
        // Fallback local se DB falhar - Garante que o usuário é salvo
        if (!localUsers.find(u => u.id === newUser.id)) {
            localUsers.push(newUser);
            saveToStorage(STORAGE_KEYS.USERS, localUsers);
        }
        
        // FIX: Retorna o usuário criado localmente sem lançar erro, permitindo que a interface continue.
        return newUser;
    }
  },

  updateUser: async (user: any) => { 
    try {
        const { error } = await supabase.from('app_users').update(user).eq('id', user.id);
        if (error) throw error;

        // Atualiza local
        const idx = localUsers.findIndex(u => u.id === user.id);
        if (idx !== -1) {
            localUsers[idx] = { ...localUsers[idx], ...user };
            saveToStorage(STORAGE_KEYS.USERS, localUsers);
        }
        return user;
    } catch (e: any) {
        const errorMsg = e.message || JSON.stringify(e);
        console.error("Erro ao atualizar usuário no banco (Salvando Localmente):", errorMsg);
        
        // Fallback local
        const idx = localUsers.findIndex(u => u.id === user.id);
        if (idx !== -1) {
            localUsers[idx] = { ...localUsers[idx], ...user };
            saveToStorage(STORAGE_KEYS.USERS, localUsers);
        }
        return user;
    }
  },

  deleteUser: async (id: string) => { 
      // Deleta local primeiro para feedback imediato
      localUsers = localUsers.filter(u => u.id !== id);
      saveToStorage(STORAGE_KEYS.USERS, localUsers);

      try {
          const { error } = await supabase.from('app_users').delete().eq('id', id);
          if (error) throw error;
      } catch (e: any) {
          const errorMsg = e.message || JSON.stringify(e);
          console.error("Erro ao excluir usuário do banco (Removido Localmente):", errorMsg);
          // Não lança erro, pois já foi removido localmente
      }
  },

  getPedidos: async (user: User): Promise<Pedido[]> => {
    try {
      const { data, error } = await supabase.from('pedidos').select('*');
      if (error) throw error;
      
      const normalizedData = (data || []).map((p: any) => ({
        ...p,
        id: String(p.id).trim(),
        volume_total: Number(p.volume_total),
        volume_restante: Number(p.volume_restante),
        volume_faturado: Number(p.volume_faturado || 0),
        valor_total: Number(p.valor_total),
        valor_faturado: Number(p.valor_faturado || 0)
      })) as Pedido[];

      const validDbData = normalizedData.filter(p => !deletedIds.includes(String(p.id)));
      const dbMap = new Map(validDbData.map(p => [String(p.id).trim(), p]));
      
      localPedidos = localPedidos.map(local => {
         const dbPedido = dbMap.get(String(local.id).trim());
         return dbPedido ? { ...local, ...dbPedido } : local;
      });

      for (const dbPedido of validDbData) {
         if (!localPedidos.find(l => String(l.id).trim() === String(dbPedido.id).trim())) {
             localPedidos.push(dbPedido);
         }
      }

      saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);
      return filterDataByRole(localPedidos, user);
    } catch (e) {
      console.warn("Usando dados locais de pedidos (Offline).");
      return filterDataByRole(localPedidos, user);
    }
  },

  deletePedido: async (id: string) => {
      // 1. Marca como deletado localmente para feedback instantâneo
      deletedIds.push(id);
      saveToStorage(STORAGE_KEYS.DELETED_IDS, deletedIds);
      
      localPedidos = localPedidos.filter(p => p.id !== id);
      saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);

      // 2. Tenta deletar no servidor
      try {
          // Deleta Solicitações vinculadas
          await supabase.from('solicitacoes').delete().eq('pedido_id', id);
          // Deleta Histórico vinculado
          await supabase.from('historico_eventos').delete().eq('pedido_id', id);
          // Deleta o Pedido
          const { error } = await supabase.from('pedidos').delete().eq('id', id);
          if (error) throw error;
      } catch (e) {
          console.error("Erro ao deletar pedido no servidor:", e);
          throw new Error("Erro ao excluir pedido (mas removido localmente).");
      }
  },

  clearAllPedidos: async () => {
      // Limpa LocalStorage
      localStorage.removeItem(STORAGE_KEYS.PEDIDOS);
      localStorage.removeItem(STORAGE_KEYS.SOLICITACOES);
      localStorage.removeItem(STORAGE_KEYS.HISTORICO);
      localStorage.removeItem(STORAGE_KEYS.LOGS);
      
      localPedidos = [];
      localSolicitacoes = [];
      localHistorico = [];
      localLogs = [];
      deletedIds = [];
      
      saveToStorage(STORAGE_KEYS.PEDIDOS, []);
      saveToStorage(STORAGE_KEYS.SOLICITACOES, []);
      saveToStorage(STORAGE_KEYS.HISTORICO, []);
      saveToStorage(STORAGE_KEYS.LOGS, []);
      saveToStorage(STORAGE_KEYS.DELETED_IDS, []);

      // Limpa Supabase
      try {
          await supabase.from('solicitacoes').delete().neq('id', '0'); // Delete all
          await supabase.from('historico_eventos').delete().neq('id', '0'); 
          await supabase.from('app_logs').delete().neq('id', '0');
          await supabase.from('pedidos').delete().neq('id', '0');
      } catch (e) {
          console.error("Erro ao limpar banco de dados:", e);
      }
  },

  getSolicitacoes: async (user: User): Promise<SolicitacaoFaturamento[]> => {
    try {
      const { data, error } = await supabase.from('solicitacoes').select('*');
      if (!error && data) {
         // Hidratação: Como o DB pode não ter as colunas desnormalizadas (nome_produto, cliente, etc)
         // se o schema estiver estrito, nós mesclamos com os dados de Pedidos carregados localmente.
         const hydratedData = data.map((s: any) => {
             const pedido = localPedidos.find(p => p.id === s.pedido_id);
             return {
                 ...s,
                 nome_produto: s.nome_produto || pedido?.nome_produto || 'Produto Geral',
                 nome_cliente: s.nome_cliente || pedido?.nome_cliente || 'Cliente',
                 numero_pedido: s.numero_pedido || pedido?.numero_pedido || '---',
                 unidade: s.unidade || pedido?.unidade || 'TN'
             };
         });

         localSolicitacoes = hydratedData as SolicitacaoFaturamento[];
         saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
      }
    } catch (e) { console.warn("Offline solicitacoes"); }
    
    if (user.role === Role.VENDEDOR) {
      return localSolicitacoes.filter(s => s.criado_por === user.name);
    }
    return localSolicitacoes;
  },

  getSolicitacoesByPedido: async (pedidoId: string): Promise<SolicitacaoFaturamento[]> => {
    try {
      const { data } = await supabase.from('solicitacoes').select('*').eq('pedido_id', pedidoId);
      if (data) {
          // Mesma hidratação aqui
          const pedido = localPedidos.find(p => p.id === pedidoId);
          return data.map((s: any) => ({
              ...s,
              nome_produto: s.nome_produto || pedido?.nome_produto || 'Produto Geral',
              nome_cliente: s.nome_cliente || pedido?.nome_cliente || 'Cliente',
              numero_pedido: s.numero_pedido || pedido?.numero_pedido || '---',
              unidade: s.unidade || pedido?.unidade || 'TN'
          })) as SolicitacaoFaturamento[];
      }
    } catch(e) {}
    return localSolicitacoes.filter(s => s.pedido_id === pedidoId);
  },
  
  getHistoricoPedido: async (pedidoId: string): Promise<HistoricoEvento[]> => {
    try {
        const { data } = await supabase.from('historico_eventos').select('*').eq('pedido_id', pedidoId).order('data_evento', { ascending: false });
        if(data) return data as HistoricoEvento[];
    } catch (e) {}
    return localHistorico.filter(h => h.pedido_id === pedidoId).sort((a,b) => new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime());
  },

  createSolicitacao: async (pedidoId: string, volume: number, user: User, obsVendedor: string) => {
    const pedido = localPedidos.find(p => p.id === pedidoId);
    if (!pedido) throw new Error('Pedido não encontrado');

    if (volume > pedido.volume_restante) {
      throw new Error('Volume solicitado excede o restante disponível');
    }

    const novaSolicitacao: SolicitacaoFaturamento = {
      id: `req-${Date.now()}`, // ID temporário, DB gera UUID real
      pedido_id: pedidoId,
      numero_pedido: pedido.numero_pedido,
      nome_cliente: pedido.nome_cliente,
      nome_produto: pedido.nome_produto,
      unidade: pedido.unidade,
      volume_solicitado: volume,
      status: StatusSolicitacao.PENDENTE,
      criado_por: user.name,
      data_solicitacao: new Date().toISOString(),
      obs_vendedor: obsVendedor || undefined
    };

    // Salva Local
    localSolicitacoes.push(novaSolicitacao);
    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);

    // Salva DB
    try {
      // Remove o ID temporário para o insert no banco, pois o DB deve gerar
      const payload = { ...novaSolicitacao };
      delete (payload as any).id;
      
      // FIX: Remove campos desnivelados que podem não existir no schema do DB
      // Isso evita o erro "Could not find the 'nome_produto' column"
      delete (payload as any).nome_produto;
      delete (payload as any).nome_cliente;
      delete (payload as any).numero_pedido;
      delete (payload as any).unidade;

      const { error } = await supabase.from('solicitacoes').insert(payload);
      
      if (error) {
          // SE FALHAR COM VIOLAÇÃO DE CHAVE ESTRANGEIRA (Código 23503), 
          // significa que o pedido não existe na tabela 'pedidos' do DB.
          // TENTATIVA DE AUTO-CORREÇÃO: Inserir o pedido e tentar de novo.
          if (error.code === '23503') {
             console.warn(`Pedido ${pedidoId} não encontrado no banco de dados. Tentando sincronizar...`);
             const { error: orderError } = await supabase.from('pedidos').upsert(pedido);
             
             if (!orderError) {
                 // Pedido sincronizado, tenta salvar a solicitação novamente
                 const { error: retryError } = await supabase.from('solicitacoes').insert(payload);
                 if (retryError) throw retryError;
             } else {
                 throw orderError; // Falha na sincronização do pedido
             }
          } else {
             throw error; // Outro tipo de erro
          }
      }
    } catch (e: any) {
      // Log detalhado para evitar "[object Object]"
      console.error("Erro ao criar solicitação no DB (salvo localmente):", e.message || JSON.stringify(e));
    }
  },

  updateSolicitacaoStatus: async (
    id: string, 
    status: StatusSolicitacao, 
    user: User, 
    motivoRejeicao?: string,
    blockedByRole?: Role,
    extraData?: { prazo?: string, obs_faturamento?: string }
  ) => {
    const solIndex = localSolicitacoes.findIndex(s => s.id === id);
    if (solIndex === -1) return;

    const updatedSol = { ...localSolicitacoes[solIndex], status };
    
    // Tratamento específico para Rejeição/Bloqueio
    if (status === StatusSolicitacao.REJEITADO && motivoRejeicao) {
       const prefixo = blockedByRole ? `[BLOQUEIO: ${blockedByRole}] ` : '[BLOQUEIO] ';
       updatedSol.motivo_rejeicao = `${prefixo}${motivoRejeicao}`;
       updatedSol.blocked_by = blockedByRole;

       // Disparar E-mail de Notificação
       const solicitante = localUsers.find(u => u.name === updatedSol.criado_por);
       if (solicitante && solicitante.email) {
            const roleLabel = getRoleLabel(blockedByRole || user.role);
            const emailsToSend = [solicitante.email];
            
            // Copia para o gerente se houver
            if (solicitante.manager_id) {
                const manager = localUsers.find(m => m.id === solicitante.manager_id);
                if (manager && manager.email) {
                    emailsToSend.push(manager.email);
                }
            }

            // Envia para cada destinatário
            emailsToSend.forEach(emailAddr => {
                sendEmailToScript({
                    to: emailAddr,
                    subject: `🛑 BLOQUEIO: Pedido ${updatedSol.numero_pedido} - ${updatedSol.nome_cliente} - Motivo: ${motivoRejeicao.substring(0, 30)}...`,
                    body: `
                    Olá,

                    A solicitação do pedido abaixo foi BLOQUEADA/REJEITADA.

                    📦 Pedido: ${updatedSol.numero_pedido}
                    👤 Cliente: ${updatedSol.nome_cliente}
                    🏢 Setor Responsável: ${roleLabel}
                    
                    --------------------------------------
                    ⚠️ MOTIVO DO BLOQUEIO:
                    ${motivoRejeicao}
                    --------------------------------------

                    Acesse o sistema para regularizar a situação ou entre em contato com o setor responsável.

                    Atenciosamente,
                    Sistema Cropflow
                    `,
                    action: 'block_notification'
                }).catch(err => console.error("Falha ao enviar e-mail de bloqueio:", err));
            });
       }
    }

    // Tratamento para Faturamento (Reset de flags)
    if (status === StatusSolicitacao.EM_ANALISE) {
       updatedSol.aprovacao_comercial = false;
       updatedSol.aprovacao_credito = false;
       updatedSol.blocked_by = undefined;
       updatedSol.motivo_rejeicao = undefined;
       updatedSol.obs_comercial = undefined;
       updatedSol.obs_credito = undefined;
       updatedSol.aprovado_por = undefined; // Limpa aprovação anterior
       
       if (extraData) {
           updatedSol.prazo_pedido = extraData.prazo;
           updatedSol.obs_faturamento = extraData.obs_faturamento;
       }
    }
    
    // Tratamento para Finalização (Faturado)
    if (status === StatusSolicitacao.FATURADO) {
       const pedido = localPedidos.find(p => p.id === updatedSol.pedido_id);
       if (pedido) {
         pedido.volume_restante -= updatedSol.volume_solicitado;
         if (pedido.volume_restante < 0) pedido.volume_restante = 0;
         
         pedido.volume_faturado = (pedido.volume_faturado || 0) + updatedSol.volume_solicitado;
         pedido.valor_faturado = (pedido.valor_faturado || 0) + (updatedSol.volume_solicitado * (pedido.valor_total / pedido.volume_total));

         if (pedido.volume_restante < 1) { // Margem de erro float
           pedido.status = StatusPedido.FINALIZADO;
         } else {
           pedido.status = StatusPedido.PARCIALMENTE_FATURADO;
         }
         
         // Atualiza pedido no DB
         try {
             // IMPORTANTE: Removemos volume_faturado e valor_faturado do payload se o schema não suportar
             // O banco pode não ter essas colunas ainda.
             await supabase.from('pedidos').update({
                 volume_restante: pedido.volume_restante,
                 status: pedido.status
             }).eq('id', pedido.id);
         } catch(e) {}
       }
    }

    localSolicitacoes[solIndex] = updatedSol;
    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
    saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);

    // Sync DB
    try {
        const payload = { ...updatedSol };
        // Clean fields that might not be in DB schema
        delete (payload as any).nome_produto;
        delete (payload as any).nome_cliente;
        delete (payload as any).numero_pedido;
        delete (payload as any).unidade;

        await supabase.from('solicitacoes').update(payload).eq('id', id);
    } catch(e) {}

    // Log Evento
    const acaoLabel = status === StatusSolicitacao.EM_ANALISE ? 'Enviado para Análise' :
                      status === StatusSolicitacao.FATURADO ? 'Nota Fiscal Emitida' :
                      status === StatusSolicitacao.REJEITADO ? `Bloqueado (${blockedByRole || 'Geral'})` :
                      status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO ? 'Aprovado para Faturamento' : status;
    
    await logEvento(updatedSol.pedido_id, user, acaoLabel, motivoRejeicao || extraData?.prazo ? `Prazo: ${extraData?.prazo}` : undefined, status === StatusSolicitacao.REJEITADO ? 'ALERTA' : 'SUCESSO');
  },

  approveSolicitacaoStep: async (id: string, role: Role, user: User, obs?: string) => {
    const sol = localSolicitacoes.find(s => s.id === id);
    if (!sol) return;

    const updates: any = {};
    if (role === Role.COMERCIAL) {
        updates.aprovacao_comercial = true;
        updates.obs_comercial = obs;
    }
    if (role === Role.CREDITO) {
        updates.aprovacao_credito = true;
        updates.obs_credito = obs;
    }

    // Aplica atualizações locais
    const index = localSolicitacoes.findIndex(s => s.id === id);
    localSolicitacoes[index] = { ...localSolicitacoes[index], ...updates };
    
    // Verifica se ambos aprovaram para mudar status principal
    const updatedSol = localSolicitacoes[index];
    if (updatedSol.aprovacao_comercial && updatedSol.aprovacao_credito) {
        updatedSol.status = StatusSolicitacao.APROVADO_PARA_FATURAMENTO;
        updates.status = StatusSolicitacao.APROVADO_PARA_FATURAMENTO;
        await logEvento(sol.pedido_id, user, 'Aprovado para Faturamento', 'Aprovação conjunta Comercial/Crédito concluída', 'SUCESSO');
    } else {
        await logEvento(sol.pedido_id, user, `Aprovação Parcial (${role})`, obs, 'INFO');
    }
    
    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);

    try {
        // Here updates only contains flags and observations, which exist in DB
        await supabase.from('solicitacoes').update(updates).eq('id', id);
    } catch(e) {}
  },

  unblockSolicitacao: async (id: string, user: User) => {
      const sol = localSolicitacoes.find(s => s.id === id);
      if (!sol) return;
  
      const updates = {
          status: StatusSolicitacao.PENDENTE,
          blocked_by: null, // Remove bloqueio
          motivo_rejeicao: null, // Limpa motivo
          // Reset approvals to force re-evaluation if needed, or keep them? 
          // Usually unblock means restarting triage or analysis. Let's restart to PENDENTE (Triage)
          aprovacao_comercial: false,
          aprovacao_credito: false,
          obs_comercial: null,
          obs_credito: null
      };
      
      const index = localSolicitacoes.findIndex(s => s.id === id);
      localSolicitacoes[index] = { ...localSolicitacoes[index], ...updates }; // @ts-ignore handles nulls
      
      saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
      
      try {
          await supabase.from('solicitacoes').update(updates).eq('id', id);
      } catch(e) {}
      
      await logEvento(sol.pedido_id, user, 'Desbloqueio Manual', 'Solicitação retornada para Triagem', 'INFO');
  },

  getLogs: async (): Promise<LogSincronizacao[]> => {
    try {
        const { data } = await supabase.from('app_logs').select('*').order('data', { ascending: false });
        if(data) return data as LogSincronizacao[];
    } catch (e) {}
    return localLogs.sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  },
  
  getLastSyncTime: async (): Promise<string | null> => {
    try {
      // Tenta pegar do banco primeiro
      const { data } = await supabase
        .from('app_logs')
        .select('data')
        .eq('sucesso', true)
        .order('data', { ascending: false })
        .limit(1)
        .single();
        
      if (data) return data.data;
    } catch (e) {}
    
    // Fallback local
    const lastSuccess = localLogs.filter(l => l.sucesso).sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
    return lastSuccess ? lastSuccess.data : null;
  },

  triggerManualSync: async (tipo: 'MANUAL' | 'AUTOMATICO' = 'MANUAL') => {
    const csvUrl = currentConfig.csvUrl;
    if (!csvUrl) throw new Error("URL do CSV não configurada.");
    
    // 1. Converter link do drive se necessário
    const directUrl = convertDriveLink(csvUrl);
    
    // Lista de Proxies para tentar em ordem
    const proxies = [
        // AllOrigins: Retorna JSON com o conteúdo na propriedade 'contents'
        (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        // CorsProxy.io: Retorna o arquivo direto (Texto puro)
        (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];

    let csvText = '';
    let lastError = null;

    // Tenta cada proxy até conseguir ou acabar as opções
    for (const proxyGen of proxies) {
        try {
            const proxyUrl = proxyGen(directUrl);
            const response = await fetch(proxyUrl);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            // Tratamento específico por Proxy
            if (proxyUrl.includes('allorigins')) {
                const data = await response.json();
                csvText = data.contents;
            } else {
                csvText = await response.text();
            }
            
            if (csvText && csvText.length > 0) break; // Sucesso, sai do loop
        } catch (e) {
            console.warn(`Proxy falhou:`, e);
            lastError = e;
        }
    }

    // Se após todas as tentativas não tivermos o texto
    if (!csvText) {
        const errorMessage = lastError instanceof Error ? lastError.message : "Erro desconhecido";
        
        // Log de Erro no Sistema
        const logEntry: LogSincronizacao = {
            id: `log-${Date.now()}`,
            data: new Date().toISOString(),
            tipo: tipo,
            arquivo: 'Google Drive Sync',
            sucesso: false,
            mensagens: [`Falha ao baixar arquivo: ${errorMessage}. Verifique se o link é público.`]
        };
        
        localLogs.unshift(logEntry);
        saveToStorage(STORAGE_KEYS.LOGS, localLogs);
        try { await supabase.from('app_logs').insert(logEntry); } catch(e) {}

        throw new Error(`Falha de conexão com o arquivo do Drive. Erro: ${errorMessage}`);
    }

    try {
        // 3. Processar CSV (Já temos o texto)
        const novosPedidos = parseCSV(csvText);
        
        if (novosPedidos.length === 0) throw new Error("Nenhum pedido válido encontrado no arquivo.");

        // 4. Atualizar Base (Merge inteligente)
        let added = 0;
        let updated = 0;

        // Recupera IDs deletados para não recriar
        const currentDeletedIds = loadFromStorage(STORAGE_KEYS.DELETED_IDS, []);

        novosPedidos.forEach(novo => {
            // Se o pedido foi deletado explicitamente, ignora na sincronização
            if (currentDeletedIds.includes(String(novo.id))) return;

            const existsIdx = localPedidos.findIndex(p => String(p.id) === String(novo.id));
            
            if (existsIdx !== -1) {
                // Atualiza existente.
                // Se o pedido no app tem status diferente de PENDENTE (ou seja, já foi mexido), mantemos o status do app.
                // Atualizamos valores e volumes.
                
                const existing = localPedidos[existsIdx];
                const statusToKeep = existing.status !== StatusPedido.PENDENTE ? existing.status : novo.status;
                
                localPedidos[existsIdx] = { 
                    ...novo, 
                    status: statusToKeep,
                    // Preserva dados calculados de faturamento que o app gerencia
                    volume_faturado: existing.volume_faturado,
                    valor_faturado: existing.valor_faturado,
                    volume_restante: existing.volume_restante 
                };
                
                // Recalcula volume restante se o total mudou no CSV
                if (localPedidos[existsIdx].volume_total !== existing.volume_total) {
                    const diff = localPedidos[existsIdx].volume_total - existing.volume_total;
                    localPedidos[existsIdx].volume_restante = (existing.volume_restante || 0) + diff;
                }

                updated++;
            } else {
                localPedidos.push(novo);
                added++;
            }
        });

        saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);

        // 5. Persistir no Banco (Upsert em lotes)
        try {
            const payload = localPedidos.map(p => {
                const safePedido = { ...p };
                // REMOVE CAMPOS QUE NÃO EXISTEM NO BANCO (CORREÇÃO SCHEMA CACHE)
                delete (safePedido as any).valor_faturado;
                delete (safePedido as any).volume_faturado;
                
                return {
                    ...safePedido,
                    volume_total: Number(p.volume_total),
                    valor_total: Number(p.valor_total),
                    volume_restante: Number(p.volume_restante)
                };
            });

            // Upsert em lotes de 100 para não estourar payload
            const batchSize = 100;
            for (let i = 0; i < payload.length; i += batchSize) {
                const batch = payload.slice(i, i + batchSize);
                const { error } = await supabase.from('pedidos').upsert(batch);
                if (error) throw error;
            }

        } catch (e: any) {
             throw new Error(`Erro ao salvar no Supabase: ${e.message}`);
        }

        // Log Sucesso
        const logEntry: LogSincronizacao = {
            id: `log-${Date.now()}`,
            data: new Date().toISOString(),
            tipo: tipo,
            arquivo: 'Google Drive Sync',
            sucesso: true,
            mensagens: [`Sincronização realizada com sucesso.`, `Adicionados: ${added}`, `Atualizados: ${updated}`]
        };
        
        localLogs.unshift(logEntry);
        saveToStorage(STORAGE_KEYS.LOGS, localLogs);
        try { await supabase.from('app_logs').insert(logEntry); } catch(e) {}
        
        return { added, updated };

    } catch (e: any) {
        const errorMsg = e.message || JSON.stringify(e);
        console.error("Erro sync:", errorMsg);
        
        const logEntry: LogSincronizacao = {
            id: `log-${Date.now()}`,
            data: new Date().toISOString(),
            tipo: tipo,
            arquivo: 'Google Drive Sync',
            sucesso: false,
            mensagens: [`Erro: ${errorMsg}`]
        };
        
        localLogs.unshift(logEntry);
        saveToStorage(STORAGE_KEYS.LOGS, localLogs);
        try { await supabase.from('app_logs').insert(logEntry); } catch(e) {}
        
        throw e;
    }
  }
};