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
  DELETED_IDS: 'cropflow_deleted_ids_v2' // Atualizado v2
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

// MOCK USERS (Mantido)
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Administrador', role: Role.ADMIN, email: 'administrador@grupocropfield.com.br', password: '123' },
  { id: 'u2', name: 'Gerente Comercial', role: Role.GERENTE, email: 'gerente@cropflow.com', password: '123' },
  { id: 'u3', name: 'Analista Faturamento', role: Role.FATURAMENTO, email: 'faturamento@cropflow.com', password: '123' },
  { id: 'u6', name: 'Diretor Comercial', role: Role.COMERCIAL, email: 'comercial@cropflow.com', password: '123' },
  { id: 'u7', name: 'Analista Crédito', role: Role.CREDITO, email: 'credito@cropflow.com', password: '123' },
  { id: 'u4', name: 'A. J. DEBONI & CIA LTDA', role: Role.VENDEDOR, email: 'deboni@cropflow.com', manager_id: 'u2', password: '123' },
  { id: 'u5', name: 'DANTE LUIS DAMIANI', role: Role.VENDEDOR, email: 'dante@cropflow.com', manager_id: 'u2', password: '123' },
];
let localUsers: User[] = [...MOCK_USERS];

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
        // Utiliza no-cors para evitar bloqueio do navegador, mas isso torna a resposta opaca (status 0)
        // O Google Apps Script deve estar publicado como Web App com acesso "Anyone" ou "Anyone with Google Account"
        await fetch(googleScriptUrl, { 
            method: 'POST', 
            mode: 'no-cors', 
            headers: { 
                // text/plain evita preflight OPTIONS que o GAS as vezes rejeita
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

// HELPER: Parse CSV string to Pedidos
const parseCSV = (csvText: string): Pedido[] => {
    // Remove BOM se existir e espaços extras
    const cleanText = csvText.trim().replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    if (lines.length < 2) return [];

    // Detecção automática de delimitador (vírgula ou ponto e vírgula)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

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

        // Split inteligente (respeitando aspas duplas, mas simples para este caso)
        let cols: string[];
        if (delimiter === ';') {
             cols = line.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
        } else {
             // Regex para split por virgula ignorando aspas
             cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
        }

        if (cols.length < 3) continue; // Linha inválida

        // Fallback posicional se header falhar: 0:Num, 1:Cliente, 2:Prod, 3:Vol, 4:Val, 5:Vend
        const rawNumero = idxNumero >= 0 ? cols[idxNumero] : cols[0];
        const cliente = idxCliente >= 0 ? cols[idxCliente] : cols[1];
        
        // Se não tiver número ou cliente, pula
        if (!rawNumero || !cliente || rawNumero.toLowerCase().includes('total')) continue;
        
        // NORMALIZAÇÃO IMPORTANTE DO ID: Remove espaços e converte para string pura
        const numero = String(rawNumero).trim();

        const produto = idxProduto >= 0 ? cols[idxProduto] : (cols[2] || 'Produto Geral');
        const unidade = idxUnidade >= 0 ? cols[idxUnidade] : 'TN';
        
        // Parsing numérico seguro (pt-BR ou en-US)
        const rawVol = idxVolume >= 0 ? cols[idxVolume] : cols[3];
        const rawVal = idxValor >= 0 ? cols[idxValor] : cols[4];
        
        // Remove R$, espaços, e trata decimal
        const cleanNumber = (val: string) => {
            if (!val) return 0;
            // Se tem vírgula como separador decimal (formato BR: 1.000,00)
            if (val.includes(',') && val.indexOf(',') > val.indexOf('.')) {
                return parseFloat(val.replace(/\./g, '').replace(',', '.'));
            }
            return parseFloat(val.replace(/[^\d.-]/g, '')); // Formato US
        };

        const volume = cleanNumber(rawVol);
        const valor = cleanNumber(rawVal);
        
        const vendedor = idxVendedor >= 0 ? cols[idxVendedor] : (cols[5] || 'Vendas Internas');
        const codigoVendedor = '00' + (i % 10); 
        const codigoCliente = 'C' + Math.floor(Math.random() * 1000);

        parsedPedidos.push({
            id: numero, // Usa numero do pedido normalizado como ID
            numero_pedido: numero,
            codigo_cliente: codigoCliente,
            nome_cliente: cliente,
            nome_produto: produto || 'Produto Geral',
            unidade: unidade || 'TN',
            volume_total: volume,
            volume_restante: volume, // Inicialmente igual ao total (reset)
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
      // Teste simples de conexão (Select limit 1)
      const { data, error } = await supabase.from('pedidos').select('id').limit(1);
      if (error) {
        console.error("Erro de conexão Supabase:", error);
        return false;
      }
      return true;
    } catch (e) { 
      console.error("Erro crítico Supabase:", e);
      return false; 
    }
  },
  
  login: async (email: string, password: string): Promise<User> => {
      if (email.trim() === 'administrador@grupocropfield.com.br' && password === 'Cp261121@!') {
        return localUsers.find(u => u.email === email) || { id: 'u1', name: 'Administrador', role: Role.ADMIN, email: email };
      }
      try {
        const { data, error } = await supabase.from('app_users').select('*').eq('email', email).eq('password', password).single();
        if (data && !error) return data as User;
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
    
    // Atualiza config local
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
  
  getUsers: async () => { return localUsers; },
  createUser: async (user: any) => { localUsers.push({...user, id: `u-${Date.now()}`}); return user; },
  updateUser: async (user: any) => { return user; },
  deleteUser: async (id: string) => { },

  getPedidos: async (user: User): Promise<Pedido[]> => {
    try {
      const { data, error } = await supabase.from('pedidos').select('*');
      if (error) throw error;
      
      const normalizedData = (data || []).map((p: any) => ({
        ...p,
        id: String(p.id).trim(), // NORMALIZA ID PARA STRING PARA EVITAR ERROS DE TIPO
        volume_total: Number(p.volume_total),
        volume_restante: Number(p.volume_restante),
        volume_faturado: Number(p.volume_faturado || 0),
        valor_total: Number(p.valor_total),
        valor_faturado: Number(p.valor_faturado || 0)
      })) as Pedido[];

      // 1. Filtrar dados do banco que estão na lista de excluídos
      const validDbData = normalizedData.filter(p => !deletedIds.includes(String(p.id)));

      const dbMap = new Map(validDbData.map(p => [String(p.id).trim(), p]));
      
      // 2. Atualizar dados locais com base no banco (merge)
      localPedidos = localPedidos.map(local => {
         const dbPedido = dbMap.get(String(local.id).trim());
         if (dbPedido) {
             return { ...local, ...dbPedido }; 
         }
         return local;
      });
      
      // 3. Adicionar novos do DB (desde que não estejam deletados localmente)
      validDbData.forEach(dbP => {
          if (!localPedidos.find(lp => String(lp.id).trim() === String(dbP.id).trim())) {
              localPedidos.push(dbP);
          }
      });

      // 4. Limpeza final: garantir que nenhum deletado permaneça
      localPedidos = localPedidos.filter(p => !deletedIds.includes(String(p.id)));

      saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);
      return filterDataByRole(localPedidos, user);
    } catch (error) {
      console.warn("Usando Pedidos Locais (Offline Mode)");
      // Garante filtro também no modo offline
      localPedidos = localPedidos.filter(p => !deletedIds.includes(String(p.id)));
      return filterDataByRole(localPedidos, user);
    }
  },

  deletePedido: async (id: string): Promise<boolean> => {
      const targetId = String(id).trim();
      
      // 1. Adicionar à blacklist de exclusão
      if (!deletedIds.includes(targetId)) {
          deletedIds.push(targetId);
          saveToStorage(STORAGE_KEYS.DELETED_IDS, deletedIds);
      }

      // 2. Remover Localmente com comparação robusta de string
      const initialLength = localPedidos.length;
      localPedidos = localPedidos.filter(p => String(p.id).trim() !== targetId);
      
      // 3. Cascading Delete Local
      localSolicitacoes = localSolicitacoes.filter(s => String(s.pedido_id).trim() !== targetId);
      localHistorico = localHistorico.filter(h => String(h.pedido_id).trim() !== targetId);

      // 4. Salvar no Storage
      saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);
      saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
      saveToStorage(STORAGE_KEYS.HISTORICO, localHistorico);

      // 5. Tentar limpar no DB se conectado
      try {
          if (await api.checkConnection()) {
              await supabase.from('historico_eventos').delete().eq('pedido_id', targetId);
              await supabase.from('solicitacoes').delete().eq('pedido_id', targetId);
              await supabase.from('pedidos').delete().eq('id', targetId);
          }
      } catch (e) {
          console.warn("Erro ao deletar do Supabase (ignorado pois já foi deletado localmente):", e);
      }

      return true;
  },

  // Nova função para zerar a carteira
  clearAllPedidos: async (): Promise<boolean> => {
      // 1. Capturar IDs atuais para garantir que não voltem caso a exclusão de DB falhe
      const currentIds = localPedidos.map(p => String(p.id).trim());
      deletedIds = [...new Set([...deletedIds, ...currentIds])];
      
      // 2. Limpar variáveis em memória
      localPedidos = [];
      localSolicitacoes = [];
      localHistorico = [];
      localLogs = [];
      
      // 3. Salvar no storage (Mantendo a blacklist atualizada para evitar ressurreição)
      saveToStorage(STORAGE_KEYS.PEDIDOS, []);
      saveToStorage(STORAGE_KEYS.SOLICITACOES, []);
      saveToStorage(STORAGE_KEYS.HISTORICO, []);
      saveToStorage(STORAGE_KEYS.LOGS, []);
      saveToStorage(STORAGE_KEYS.DELETED_IDS, deletedIds);
      
      // 4. Tentar limpar o Banco de Dados Realmente
      try {
          const isConnected = await api.checkConnection();
          if (isConnected) {
              console.log("Tentando limpar banco de dados remoto...");
              // Removemos registros. Supabase pode ter restrições, mas tentamos o melhor esforço
              // Usamos um filtro "dummy" (id not equal to impossible value) para tentar deletar todos
              await supabase.from('historico_eventos').delete().neq('id', 'uuid-invalido-000');
              await supabase.from('solicitacoes').delete().neq('id', 'uuid-invalido-000');
              await supabase.from('pedidos').delete().neq('id', 'uuid-invalido-000');
              
              // Se conseguiu limpar o banco, podemos limpar a blacklist local também
              deletedIds = [];
              saveToStorage(STORAGE_KEYS.DELETED_IDS, []);
          }
      } catch (e) {
          console.warn("Erro ao limpar dados remotos. Usando blacklist local para ocultar dados.", e);
      }

      return true;
  },

  getHistoricoPedido: async (pedidoId: string): Promise<HistoricoEvento[]> => {
    let dbData: any[] = [];
    try {
      const { data, error } = await supabase.from('historico_eventos').select('*').eq('pedido_id', pedidoId).order('data_evento', { ascending: false });
      if (!error && data) dbData = data;
    } catch (e) {}
    
    // Mesclar com local
    const localEvts = localHistorico.filter(h => h.pedido_id === pedidoId);
    const allEvents = [...dbData, ...localEvts];
    const uniqueEvents = allEvents.filter((evt, index, self) => 
      index === self.findIndex((t) => (t.id === evt.id || (t.data_evento === evt.data_evento && t.acao === evt.acao)))
    );

    return uniqueEvents.sort((a, b) => new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime());
  },

  getSolicitacoes: async (user: User): Promise<SolicitacaoFaturamento[]> => {
    try {
      const { data, error } = await supabase.from('solicitacoes').select('*').order('data_solicitacao', { ascending: false });
      if (error) throw error;

      const dbList = (data as SolicitacaoFaturamento[] || []);
      
      // Sync DB to Local
      const dbIds = new Set(dbList.map(s => s.id));
      
      // Update existing locals with DB data
      localSolicitacoes = localSolicitacoes.map(local => {
          const remote = dbList.find(d => d.id === local.id);
          return remote ? remote : local;
      });

      // Add new from DB
      dbList.forEach(remote => {
          if (!localSolicitacoes.find(l => l.id === remote.id)) {
              localSolicitacoes.push(remote);
          }
      });
      
      saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
      return localSolicitacoes.sort((a, b) => new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime());
    } catch (error) {
      console.warn("Usando Solicitações Locais (Offline Mode)");
      return localSolicitacoes.sort((a, b) => new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime());
    }
  },

  getSolicitacoesByPedido: async (pedidoId: string): Promise<SolicitacaoFaturamento[]> => {
      const all = await api.getSolicitacoes({ role: Role.ADMIN } as User); 
      return all.filter(s => s.pedido_id === pedidoId);
  },

  getLogs: async () => { return localLogs; },

  createSolicitacao: async (pedidoId: string, volume: number, user: User, obsVendedor?: string) => {
    const volumeNumber = Number(volume);
    
    let pedido = localPedidos.find(p => p.id === pedidoId);
    
    if (!pedido) throw new Error("Pedido não encontrado.");

    const saldoAtual = Number(pedido.volume_restante);
    if (volumeNumber > (saldoAtual + 0.0001)) {
        throw new Error(`Volume solicitado (${volumeNumber}) excede o saldo (${saldoAtual}).`);
    }

    const novoVolume = Number((saldoAtual - volumeNumber).toFixed(4));
    const novoStatusPedido = novoVolume <= 0.0001 ? StatusPedido.AGUARDANDO_EMISSAO : StatusPedido.PARCIALMENTE_FATURADO;

    const newSolicitacao: SolicitacaoFaturamento = {
        id: `temp-${Date.now()}`, 
        pedido_id: pedidoId, 
        numero_pedido: pedido.numero_pedido, 
        nome_cliente: pedido.nome_cliente,
        nome_produto: pedido.nome_produto || 'Produto Padrão',
        unidade: pedido.unidade || 'UN', 
        volume_solicitado: volumeNumber, 
        status: StatusSolicitacao.PENDENTE,
        status_pedido: novoStatusPedido,
        criado_por: user.name, 
        data_solicitacao: new Date().toISOString().split('T')[0],
        aprovacao_comercial: false, 
        aprovacao_credito: false,
        obs_vendedor: obsVendedor || undefined,
        motivo_rejeicao: undefined
    };

    localSolicitacoes.push(newSolicitacao);
    
    const pIndex = localPedidos.findIndex(p => p.id === pedidoId);
    if (pIndex >= 0) {
        localPedidos[pIndex] = {
            ...localPedidos[pIndex],
            volume_restante: novoVolume,
            status: novoStatusPedido,
            setor_atual: Role.FATURAMENTO,
            motivo_status: 'Aguardando Triagem'
        };
    }
    
    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
    saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);

    try {
        const { id, ...payload } = newSolicitacao;
        const { data, error } = await supabase.from('solicitacoes').insert(payload).select().single();
        if (error) throw error;
        
        if (data) {
            const idx = localSolicitacoes.findIndex(s => s.id === newSolicitacao.id);
            if (idx !== -1) localSolicitacoes[idx] = data;
        }
        
        await supabase.from('pedidos').update({ 
            volume_restante: novoVolume, 
            status: novoStatusPedido,
            setor_atual: Role.FATURAMENTO,
            motivo_status: 'Aguardando Triagem'
        }).eq('id', pedidoId);

        await logEvento(pedidoId, user, 'Solicitação Criada', `Volume: ${volumeNumber}`, 'SUCESSO');
    } catch (e) {
        console.warn("Operação offline (Create Solicitacao):", e);
        await logEvento(pedidoId, user, 'Solicitação Criada', `Volume: ${volumeNumber}`, 'SUCESSO', true);
    }
    
    return newSolicitacao;
  },

  approveSolicitacaoStep: async (id: string, role: Role, user: User, observation?: string) => {
    const idx = localSolicitacoes.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Solicitação não encontrada");

    const sol = localSolicitacoes[idx];
    const updates: any = {};

    if (role === Role.COMERCIAL) {
        updates.aprovacao_comercial = true;
        if (observation) updates.obs_comercial = observation;
    } else if (role === Role.CREDITO) {
        updates.aprovacao_credito = true;
        if (observation) updates.obs_credito = observation;
    }

    const updatedSol = { ...sol, ...updates };
    
    if (updatedSol.aprovacao_comercial && updatedSol.aprovacao_credito) {
        updatedSol.status = StatusSolicitacao.APROVADO_PARA_FATURAMENTO;
    }

    localSolicitacoes[idx] = updatedSol;
    
    const pIdx = localPedidos.findIndex(p => p.id === sol.pedido_id);
    if (pIdx >= 0) {
        if (updatedSol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO) {
            localPedidos[pIdx].setor_atual = Role.FATURAMENTO;
            localPedidos[pIdx].motivo_status = "Aprovado para Emissão";
        } else {
            const faltaComercial = !updatedSol.aprovacao_comercial;
            const faltaCredito = !updatedSol.aprovacao_credito;
            let setor = Role.FATURAMENTO; 
            if (faltaComercial) setor = Role.COMERCIAL;
            else if (faltaCredito) setor = Role.CREDITO;
            
            localPedidos[pIdx].setor_atual = setor;
            localPedidos[pIdx].motivo_status = `Aguardando: ${faltaComercial ? 'Comercial' : ''} ${faltaComercial && faltaCredito ? '&' : ''} ${faltaCredito ? 'Crédito' : ''}`;
        }
    }

    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
    saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);

    const actionLabel = `Aprovação ${getRoleLabel(role)}`;

    try {
       // PROTEÇÃO: Se for ID temporário, não envia update para o banco
       if (id.startsWith('temp-')) {
           console.warn("Item apenas local (ID temporário), pulando atualização no DB.");
           await logEvento(sol.pedido_id, user, actionLabel, observation || 'Sem obs', 'SUCESSO', true);
           return;
       }

       const { error } = await supabase.from('solicitacoes').update(updates).eq('id', id);
       if (error) throw error;
       
       if (updatedSol.status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO) {
           await supabase.from('solicitacoes').update({ status: StatusSolicitacao.APROVADO_PARA_FATURAMENTO }).eq('id', id);
           await supabase.from('pedidos').update({ 
               setor_atual: Role.FATURAMENTO, 
               motivo_status: "Aprovado para Emissão" 
           }).eq('id', sol.pedido_id);
       } else {
           const p = localPedidos[pIdx];
           await supabase.from('pedidos').update({ 
               setor_atual: p.setor_atual, 
               motivo_status: p.motivo_status 
           }).eq('id', sol.pedido_id);
       }
       
       await logEvento(sol.pedido_id, user, actionLabel, observation || 'Sem obs', 'SUCESSO');
    } catch (e) {
       console.warn("Operação offline (Approve Step):", e);
       await logEvento(sol.pedido_id, user, actionLabel, observation, 'SUCESSO', true);
    }
  },

  unblockSolicitacao: async (id: string, user: User) => {
    const idx = localSolicitacoes.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Solicitação não encontrada");
    
    const sol = localSolicitacoes[idx];
    
    if (user.role !== Role.ADMIN && sol.blocked_by && sol.blocked_by !== user.role) {
        throw new Error(`Apenas o setor ${sol.blocked_by} pode desbloquear.`);
    }

    const updates = { 
        status: StatusSolicitacao.EM_ANALISE, 
        motivo_rejeicao: undefined, 
        blocked_by: undefined,
        aprovacao_comercial: sol.blocked_by === Role.COMERCIAL ? false : sol.aprovacao_comercial,
        aprovacao_credito: sol.blocked_by === Role.CREDITO ? false : sol.aprovacao_credito
    };

    localSolicitacoes[idx] = { ...sol, ...updates };
    
    const pIdx = localPedidos.findIndex(p => p.id === sol.pedido_id);
    if (pIdx >= 0) {
        localPedidos[pIdx].setor_atual = Role.COMERCIAL;
        localPedidos[pIdx].motivo_status = "Desbloqueado - Em Reanálise";
    }

    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
    saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);

    try {
        // PROTEÇÃO: Se for ID temporário, não envia update para o banco
        if (id.startsWith('temp-')) {
           console.warn("Item apenas local (ID temporário), pulando desbloqueio no DB.");
           await logEvento(sol.pedido_id, user, 'Desbloqueio', 'Reiniciando fluxo', 'ALERTA', true);
           return;
        }

        const dbUpdates = {
            status: StatusSolicitacao.EM_ANALISE,
            motivo_rejeicao: null,
            blocked_by: null,
            aprovacao_comercial: updates.aprovacao_comercial,
            aprovacao_credito: updates.aprovacao_credito
        };
        const { error } = await supabase.from('solicitacoes').update(dbUpdates).eq('id', id);
        if (error) throw error;
        
        await supabase.from('pedidos').update({
            setor_atual: Role.COMERCIAL,
            motivo_status: "Desbloqueado - Em Reanálise"
        }).eq('id', sol.pedido_id);
        
        await logEvento(sol.pedido_id, user, 'Desbloqueio', 'Reiniciando fluxo', 'ALERTA');
    } catch (e) {
        console.warn("Operação offline (Unblock):", e);
        await logEvento(sol.pedido_id, user, 'Desbloqueio', 'Reiniciando fluxo', 'ALERTA', true);
    }
  },

  updateSolicitacaoStatus: async (id: string, status: StatusSolicitacao, user: User, motivoRejeicao?: string, forceBlockerRole?: Role) => {
    const idx = localSolicitacoes.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Solicitação não encontrada");

    const sol = localSolicitacoes[idx];
    const updateData: any = { status };
    let blockedByRole: Role | undefined = undefined;
    let formattedReason = motivoRejeicao;

    let actionLabel = `Status alterado: ${status}`;

    if (status === StatusSolicitacao.REJEITADO && motivoRejeicao) {
        blockedByRole = forceBlockerRole || user.role;
        formattedReason = `[BLOQUEIO: ${getRoleLabel(blockedByRole)}] ${motivoRejeicao}`;
        updateData.motivo_rejeicao = formattedReason;
        updateData.blocked_by = blockedByRole;
        actionLabel = `Bloqueado por ${getRoleLabel(blockedByRole)}`;
    } else if (status === StatusSolicitacao.EM_ANALISE) {
        actionLabel = `Enviado para Análise`;
    } else if (status === StatusSolicitacao.FATURADO) {
        actionLabel = `Faturamento Realizado`;
    }

    // LOCAL UPDATE: Use undefined to clean local state if needed (or false)
    if (status === StatusSolicitacao.EM_ANALISE) {
        updateData.blocked_by = undefined;
        updateData.motivo_rejeicao = undefined;
        updateData.aprovacao_comercial = false;
        updateData.aprovacao_credito = false;
        updateData.obs_comercial = undefined;
        updateData.obs_credito = undefined;
        updateData.aprovado_por = undefined;
    }
    
    if (status === StatusSolicitacao.FATURADO) {
        updateData.aprovado_por = user.name;
    }

    localSolicitacoes[idx] = { ...sol, ...updateData };
    
    const pIdx = localPedidos.findIndex(p => p.id === sol.pedido_id);
    if (pIdx >= 0) {
        const pedido = localPedidos[pIdx];
        if (status === StatusSolicitacao.REJEITADO) {
            const restored = Number((Number(pedido.volume_restante) + Number(sol.volume_solicitado)).toFixed(4));
            localPedidos[pIdx].volume_restante = restored;
            localPedidos[pIdx].status = restored >= (pedido.volume_total - 0.001) ? StatusPedido.PENDENTE : StatusPedido.PARCIALMENTE_FATURADO;
            localPedidos[pIdx].setor_atual = blockedByRole;
            localPedidos[pIdx].motivo_status = formattedReason;
        } else if (status === StatusSolicitacao.EM_ANALISE) {
            localPedidos[pIdx].setor_atual = Role.COMERCIAL;
            localPedidos[pIdx].motivo_status = "Em Análise (Comercial & Crédito)";
        } else if (status === StatusSolicitacao.FATURADO) {
            const precoUnitario = pedido.valor_total / pedido.volume_total;
            localPedidos[pIdx].volume_faturado = (localPedidos[pIdx].volume_faturado || 0) + sol.volume_solicitado;
            localPedidos[pIdx].valor_faturado = (localPedidos[pIdx].valor_faturado || 0) + (sol.volume_solicitado * precoUnitario);
            
            localPedidos[pIdx].status = localPedidos[pIdx].volume_restante <= 0.0001 ? StatusPedido.FINALIZADO : StatusPedido.PARCIALMENTE_FATURADO;
            localPedidos[pIdx].setor_atual = Role.FATURAMENTO;
            localPedidos[pIdx].motivo_status = "Nota Fiscal Emitida";
        }
    }

    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
    saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);

    try {
        // PROTEÇÃO: Se for ID temporário, não envia update para o banco
        if (id.startsWith('temp-')) {
           console.warn("Item apenas local (ID temporário), pulando atualização no DB.");
           await logEvento(sol.pedido_id, user, actionLabel, formattedReason || '', status === StatusSolicitacao.REJEITADO ? 'ERRO' : 'INFO', true);
           
           if (status === StatusSolicitacao.REJEITADO) {
                // Passa o motivo cru (sem prefixo) para o email formatar bonito
                sendRejectionNotification(sol, motivoRejeicao || "Motivo não informado", user, blockedByRole);
           }
           return;
        }

        const dbUpdateData = { ...updateData };
        
        // CRITICAL FIX: Explicitly send NULL for fields that must be cleared in DB
        // Supabase/Postgres ignores 'undefined' in updates, but respects 'null'.
        if (status === StatusSolicitacao.EM_ANALISE) {
            dbUpdateData.blocked_by = null;
            dbUpdateData.motivo_rejeicao = null;
            dbUpdateData.obs_comercial = null;
            dbUpdateData.obs_credito = null;
            dbUpdateData.aprovado_por = null;
            // approval flags are boolean false, which is fine
        } else {
             // For other statuses, safety checks
             if (dbUpdateData.blocked_by === undefined) delete dbUpdateData.blocked_by;
        }

        const { error } = await supabase.from('solicitacoes').update(dbUpdateData).eq('id', id);
        if (error) throw error;
        
        if (pIdx >= 0) {
            const p = localPedidos[pIdx];
            await supabase.from('pedidos').update({
                volume_restante: p.volume_restante,
                volume_faturado: p.volume_faturado,
                valor_faturado: p.valor_faturado,
                status: p.status,
                setor_atual: p.setor_atual,
                motivo_status: p.motivo_status
            }).eq('id', p.id);
        }

        await logEvento(sol.pedido_id, user, actionLabel, formattedReason || '', status === StatusSolicitacao.REJEITADO ? 'ERRO' : 'INFO');
        
        if (status === StatusSolicitacao.REJEITADO) {
            // Passa o motivo cru (sem prefixo) para o email formatar bonito
            sendRejectionNotification(sol, motivoRejeicao || "Motivo não informado", user, blockedByRole);
        }

    } catch (e: any) {
        console.warn("Operação offline (Update Status) ou Erro DB:", e);
        // Se falhou no DB, tentamos garantir que o log reflete a tentativa
        await logEvento(sol.pedido_id, user, actionLabel, formattedReason || ('Erro DB: ' + e.message), status === StatusSolicitacao.REJEITADO ? 'ERRO' : 'ALERTA', true);
        
        if (status === StatusSolicitacao.REJEITADO) {
            sendRejectionNotification(sol, motivoRejeicao || "Motivo não informado", user, blockedByRole);
        }
    }
  },

  triggerManualSync: async (): Promise<LogSincronizacao> => {
     // Inicializa logs para garantir que erros sejam capturados
     const logs: string[] = ['Iniciando protocolo de sincronização...'];
     let success = false;

     try {
         // Simula delay de rede para feedback visual
         await new Promise(r => setTimeout(r, 1000));
         
         if (!navigator.onLine) {
             throw new Error("Sem conexão com a internet para acessar o Google Drive.");
         }

         if (currentConfig.csvUrl && currentConfig.csvUrl.startsWith('http')) {
             const directUrl = convertDriveLink(currentConfig.csvUrl);
             logs.push(`URL Original: ${currentConfig.csvUrl.substring(0, 30)}...`);
             
             let response: Response | null = null;
             let csvText = '';

             // TENTATIVA 1: Download Direto
             try {
                logs.push(`Tentativa 1: Download Direto...`);
                response = await fetch(directUrl);
                if (response.ok) {
                    csvText = await response.text();
                } else {
                    logs.push(`Falha download direto: ${response.status}`);
                }
             } catch(e) {
                 logs.push(`Erro fetch direto (CORS provável): ${e}`);
             }

             // TENTATIVA 2: Fallback via CORS Proxy (Necessário para Drive sem "Publish to Web")
             if (!csvText || csvText.includes('<!DOCTYPE html>')) {
                 logs.push(`Tentativa 2: Usando CORS Proxy seguro...`);
                 const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(directUrl);
                 try {
                     response = await fetch(proxyUrl);
                     if (response.ok) {
                         csvText = await response.text();
                         logs.push(`Download via Proxy realizado com sucesso.`);
                     }
                 } catch (proxyError) {
                     logs.push(`Falha no Proxy: ${proxyError}`);
                 }
             }

             if (csvText && !csvText.trim().startsWith('<!DOCTYPE html>')) {
                 const novosPedidos = parseCSV(csvText);
                 if (novosPedidos.length > 0) {
                     logs.push(`${novosPedidos.length} pedidos válidos identificados.`);
                     
                     // MAPA DE UNICIDADE: Prepara mapa dos pedidos atuais para evitar O(N^2)
                     const existingOrdersMap = new Map(localPedidos.map(p => [String(p.numero_pedido).trim(), p]));
                     const actuallyNew: Pedido[] = [];
                     const seenInThisBatch = new Set<string>();

                     let updatedCount = 0;
                     let newCount = 0;
                     let duplicateSkipped = 0;

                     novosPedidos.forEach(np => {
                         const normalizedId = String(np.numero_pedido).trim();

                         // 1. Checar se já vimos este ID neste mesmo CSV (Duplicidade no arquivo)
                         if (seenInThisBatch.has(normalizedId)) {
                             return; 
                         }
                         seenInThisBatch.add(normalizedId);

                         // 2. Checar se está na blacklist de excluídos
                         if (deletedIds.includes(normalizedId)) {
                             return;
                         }

                         const existing = existingOrdersMap.get(normalizedId);

                         if (existing) {
                             // Se pedido já existe, atualiza dados cadastrais se ainda for PENDENTE
                             // Isso evita sobrescrever status de faturamento
                             if (existing.status === StatusPedido.PENDENTE) {
                                 const idx = localPedidos.findIndex(p => String(p.id).trim() === normalizedId);
                                 if (idx !== -1) {
                                     localPedidos[idx] = { 
                                         ...localPedidos[idx], 
                                         valor_total: np.valor_total,
                                         volume_total: np.volume_total,
                                         volume_restante: np.volume_total, // Reset de volume se ainda pendente
                                         unidade: np.unidade,
                                         nome_cliente: np.nome_cliente,
                                         nome_produto: np.nome_produto
                                     };
                                     updatedCount++;
                                 }
                             } else {
                                 // Se já tem movimentação, ignora ou apenas atualiza nome
                                 duplicateSkipped++;
                             }
                         } else {
                             // Novo Pedido Real
                             actuallyNew.push(np);
                             existingOrdersMap.set(normalizedId, np); // Add to map to prevent duplicates
                             newCount++;
                         }
                     });
                     
                     // Adiciona os realmente novos
                     if (actuallyNew.length > 0) {
                         localPedidos = [...localPedidos, ...actuallyNew];
                     }

                     saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);
                     logs.push(`Sincronização concluída: ${newCount} novos adicionados, ${updatedCount} atualizados.`);
                     if (duplicateSkipped > 0) logs.push(`${duplicateSkipped} pedidos existentes ignorados (em andamento/finalizados).`);
                     success = true;
                 } else {
                     logs.push('AVISO: O arquivo foi baixado mas nenhum pedido foi extraído. Verifique o formato CSV.');
                 }
             } else {
                 logs.push('ERRO CRÍTICO: Não foi possível obter o CSV legível.');
                 logs.push('Motivo: Bloqueio de segurança do Google (CORS) ou link incorreto.');
                 logs.push('Solução: No Google Sheets, use "Arquivo > Compartilhar > Publicar na Web > CSV".');
             }
         } else {
             logs.push('Nenhuma URL CSV válida configurada.');
         }

     } catch (e: any) {
         logs.push(`Erro fatal na sincronização: ${e.message}`);
         success = false;
     }

     const newLog: LogSincronizacao = {
         id: `sync-${Date.now()}`,
         data: new Date().toISOString(),
         tipo: 'MANUAL',
         arquivo: 'carteira_pedidos.csv',
         sucesso: success,
         mensagens: logs
     };

     // Adiciona ao topo e garante limite
     localLogs.unshift(newLog);
     if (localLogs.length > 50) localLogs = localLogs.slice(0, 50);
     saveToStorage(STORAGE_KEYS.LOGS, localLogs);
     
     // Retorna o log mesmo em caso de erro, para que a UI possa exibir
     return newLog; 
  },
  
  resetDatabase: async () => {
    localStorage.clear();
    location.reload(); 
    return { success: true, message: "" }; 
  }
};

const sendRejectionNotification = async (solicitacao: SolicitacaoFaturamento, motivo: string, quemRejeitou: User, sectorRole?: Role) => {
    // Verificação simplificada de conexão apenas via Navigator (Ignora status do DB)
    if (!navigator.onLine) {
        console.log(`[EMAIL ADIADO] Sem conexão de internet para enviar alerta para ${solicitacao.criado_por}`);
        return;
    }

    const normalize = (str: string) => str.trim().toLowerCase();
    
    // 1. Encontrar o Vendedor
    let vendedor: User | undefined = localUsers.find(u => normalize(u.name) === normalize(solicitacao.criado_por));
    
    if (!vendedor) {
        try {
            const { data } = await supabase.from('app_users').select('*').ilike('name', solicitacao.criado_por).single();
            if (data) vendedor = data as User;
        } catch (e) {}
    }
    
    if (!vendedor || !vendedor.email) return;
    
    let emailTo = vendedor.email;
    let emailCc = '';
    let managerName = '';

    // 2. Encontrar o Gerente vinculado
    if (vendedor.manager_id) {
        let manager: User | undefined = localUsers.find(u => u.id === vendedor?.manager_id);
        
        if (!manager) {
            try {
                const { data } = await supabase.from('app_users').select('*').eq('id', vendedor?.manager_id).single();
                if (data) manager = data as User;
            } catch (e) {}
        }

        if (manager && manager.email) {
            emailCc = manager.email;
            managerName = manager.name;
        }
    }

    const subject = `[BLOQUEIO] Pedido ${solicitacao.numero_pedido} - ${solicitacao.nome_cliente}`;
    
    // Fallback de texto simples
    const textBody = `
Olá, ${vendedor.name}

Informamos que a solicitação de faturamento abaixo sofreu um apontamento de bloqueio e requer sua atenção.

DETALHES
Pedido: ${solicitacao.numero_pedido}
Cliente: ${solicitacao.nome_cliente}
Produto: ${solicitacao.nome_produto}
Volume: ${solicitacao.volume_solicitado} ${solicitacao.unidade}

MOTIVO DO BLOQUEIO
Setor: ${getRoleLabel(sectorRole || quemRejeitou.role)}
Responsável: ${quemRejeitou.name}
Motivo: "${motivo}"

Acesse o sistema Cropflow para regularizar.
    `.trim();

    // Template HTML Visual - Enhanced
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Notificação de Bloqueio</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); margin-top: 40px; margin-bottom: 40px;">
          
          <!-- Header Branding -->
          <div style="background-color: #0f172a; padding: 20px 40px; text-align: center; border-bottom: 1px solid #1e293b;">
             <span style="color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 2px;">CROPFLOW</span>
          </div>

          <!-- Alert Banner -->
          <div style="background-color: #ef4444; padding: 30px 40px; text-align: center;">
            <div style="background-color: rgba(255,255,255,0.2); width: 48px; height: 48px; border-radius: 50%; margin: 0 auto 15px auto; display: flex; align-items: center; justify-content: center; line-height: 48px; font-size: 24px; color: white;">
               !
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Pedido Bloqueado</h1>
            <p style="color: #fecaca; margin: 8px 0 0 0; font-size: 14px; font-weight: 500;">Ação necessária para prosseguir com o faturamento</p>
          </div>

          <!-- Content -->
          <div style="padding: 40px;">
            <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.6;">
              Olá, <strong>${vendedor.name}</strong>.<br>
              A solicitação abaixo foi analisada e recebeu um apontamento de <strong style="color: #ef4444;">bloqueio</strong>.
            </p>

            <!-- Order Details Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0; overflow: hidden; margin-bottom: 30px;">
               <div style="background-color: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
                  Resumo do Pedido
               </div>
               <div style="padding: 20px;">
                  <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
                    <tr>
                      <td style="padding-bottom: 12px; color: #64748b; font-size: 13px; font-weight: 500; width: 30%;">Número</td>
                      <td style="padding-bottom: 12px; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${solicitacao.numero_pedido}</td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 12px; color: #64748b; font-size: 13px; font-weight: 500;">Cliente</td>
                      <td style="padding-bottom: 12px; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${solicitacao.nome_cliente}</td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 12px; color: #64748b; font-size: 13px; font-weight: 500;">Produto</td>
                      <td style="padding-bottom: 12px; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${solicitacao.nome_produto}</td>
                    </tr>
                    <tr>
                      <td style="padding-top: 12px; border-top: 1px dashed #e2e8f0; color: #64748b; font-size: 13px; font-weight: 500;">Volume</td>
                      <td style="padding-top: 12px; border-top: 1px dashed #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${solicitacao.volume_solicitado} ${solicitacao.unidade}</td>
                    </tr>
                  </table>
               </div>
            </div>

            <!-- Reason Box -->
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 25px;">
               <p style="margin: 0 0 10px 0; color: #b91c1c; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Motivo do Bloqueio</p>
               <p style="margin: 0 0 20px 0; color: #7f1d1d; font-size: 16px; font-weight: 600; line-height: 1.5;">"${motivo}"</p>
               
               <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                     Setor: ${getRoleLabel(sectorRole || quemRejeitou.role)}
                  </div>
                  <div style="color: #991b1b; font-size: 13px;">
                     Resp: <strong>${quemRejeitou.name}</strong>
                  </div>
               </div>
            </div>

            <div style="margin-top: 30px; text-align: center;">
               <a href="#" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">Acessar Cropflow</a>
            </div>
            
            <p style="text-align: center; margin-top: 24px; color: #94a3b8; font-size: 12px; line-height: 1.5;">
              Este é um email automático. Por favor, não responda.<br>
              Acesse o sistema para regularizar a pendência.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
             <p style="margin: 0; color: #cbd5e1; font-size: 11px; font-weight: 500;">&copy; ${new Date().getFullYear()} Grupo Cropflow • Gestão Inteligente</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailBody = {
        action: 'notify_rejection', 
        pedido: solicitacao.numero_pedido,
        cliente: solicitacao.nome_cliente,
        produto: solicitacao.nome_produto,
        motivo: motivo,
        setor: getRoleLabel(sectorRole || quemRejeitou.role),
        responsavel_bloqueio: quemRejeitou.name,
        to: emailTo,
        cc: emailCc,
        vendedor_nome: vendedor.name,
        gerente_nome: managerName,
        subject: subject, 
        body: textBody,      // Fallback para scripts simples
        htmlBody: htmlBody   // Conteúdo rico para scripts que suportam HTML
    };

    await sendEmailToScript(emailBody);
};