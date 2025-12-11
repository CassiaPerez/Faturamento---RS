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
  // VENDEDORES COM CÓDIGOS REAIS (Baseados na imagem enviada)
  { id: 'v1', name: 'DESESSARDS E VIEIRA REPRESENTACOES LTDA', role: Role.VENDEDOR, email: 'desessards@cropflow.com', password: '123', sales_codes: ['85400', '255340'] },
  { id: 'v2', name: 'EDUARDO FATTORE E CIA LTDA', role: Role.VENDEDOR, email: 'eduardo@cropflow.com', password: '123', sales_codes: ['107806', '275706', '80732', '251623'] },
  { id: 'v3', name: 'DANIEL LORENZONI LTDA', role: Role.VENDEDOR, email: 'daniel@cropflow.com', password: '123', sales_codes: ['76147', '247945'] },
  { id: 'v4', name: 'AGRO RUPPENTHAL SERVICOS DE INFORMATICA LTDA', role: Role.VENDEDOR, email: 'maurel@cropflow.com', password: '123', sales_codes: ['108530', '276266'] },
  { id: 'v5', name: 'A. J. DEBONI & CIA LTDA', role: Role.VENDEDOR, email: 'deboni@cropflow.com', password: '123', sales_codes: ['81125', '251932'] },
  { id: 'v6', name: 'GLOWACKI AGENCIAMENTOS', role: Role.VENDEDOR, email: 'glowacki@cropflow.com', password: '123', sales_codes: ['25821', '745893'] },
  { id: 'v7', name: 'MARCIO BLANGER', role: Role.VENDEDOR, email: 'marcio@cropflow.com', password: '123', sales_codes: ['18872', '212085'] },
  { id: 'v8', name: 'CROPFIELD DO BRASIL S.A.', role: Role.VENDEDOR, email: 'matriz@cropflow.com', password: '123', sales_codes: ['23795', '216023'] },
  { id: 'v9', name: 'PEDRO HENRIQUE DE BONA', role: Role.VENDEDOR, email: 'pedro@cropflow.com', password: '123', sales_codes: ['11577', '101471'] },
  { id: 'v10', name: 'RODRIGO LUIS DA SILVA', role: Role.VENDEDOR, email: 'rodrigo.silva@cropflow.com', password: '123', sales_codes: ['21183', '214231'] },
  { id: 'v11', name: 'RODRIGO DARIVA', role: Role.VENDEDOR, email: 'rodrigo.dariva@cropflow.com', password: '123', sales_codes: ['23119', '215538'] },
  { id: 'v12', name: 'LARISSA WILKE TEIXEIRA', role: Role.VENDEDOR, email: 'larissa@cropflow.com', password: '123', sales_codes: ['43269', '230157'] },
  { id: 'v13', name: 'DANTE LUIS DAMIANI', role: Role.VENDEDOR, email: 'dante@cropflow.com', password: '123', sales_codes: ['25764', '745842', '87229', '256841', '89980', '259032', '45733', '232007'] },
  { id: 'v14', name: 'FABIO DA ROCHA CORBELLINI', role: Role.VENDEDOR, email: 'fabio@cropflow.com', password: '123', sales_codes: ['54318', '238772'] },
  { id: 'v15', name: 'RONALDO ROSSLER RIBAS', role: Role.VENDEDOR, email: 'ronaldo@cropflow.com', password: '123', sales_codes: ['77730', '249228'] },
  { id: 'v16', name: 'ROBSON SUHRE DE CAMPOS', role: Role.VENDEDOR, email: 'robson@cropflow.com', password: '123', sales_codes: ['59984', '242974'] },
  { id: 'v17', name: 'VALDECIR ALVES DE OLIVEIRA', role: Role.VENDEDOR, email: 'valdecir@cropflow.com', password: '123', sales_codes: ['58785', '242075'] },
  { id: 'v18', name: 'VEIT CONSULTORIA AGRICOLA', role: Role.VENDEDOR, email: 'andre.veit@cropflow.com', password: '123', sales_codes: ['54506', '238910'] },
  { id: 'v19', name: 'BAGUAL AGRO PARTICIPACOES', role: Role.VENDEDOR, email: 'bagual@cropflow.com', password: '123', sales_codes: ['34849', '223797'] },
  { id: 'v20', name: 'CASSIO MARQUES FERREIRA', role: Role.VENDEDOR, email: 'cassio@cropflow.com', password: '123', sales_codes: ['29994', '220363'] },
  { id: 'v21', name: 'LEONARDO WILKE TEIXEIRA', role: Role.VENDEDOR, email: 'leonardo@cropflow.com', password: '123', sales_codes: ['91532', '260263'] }
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

// --- FUNÇÃO CRÍTICA DE FILTRAGEM ---
// Normaliza códigos para evitar erro de zeros à esquerda (ex: "085400" == "85400")
const normalizeCode = (c: string | number | undefined) => {
    if (!c) return '';
    // Converte para string, remove espaços e remove zeros do início
    return String(c).trim().replace(/^0+/, '');
};

const filterDataByRole = (data: Pedido[], user: User) => {
  if (user.role === Role.VENDEDOR) {
    // 1. Prioridade: Filtrar por Códigos de Venda (Array) se existirem
    if (user.sales_codes && user.sales_codes.length > 0) {
        // Normaliza os códigos do usuário (remove zeros a esquerda)
        const userCodes = user.sales_codes.map(normalizeCode);
        
        return data.filter(p => {
            // Normaliza o código do pedido
            const orderCode = normalizeCode(p.codigo_vendedor);
            return userCodes.includes(orderCode);
        });
    }
    // 2. Fallback: Filtrar por Nome (Legado)
    return data.filter(p => p.nome_vendedor && p.nome_vendedor.toLowerCase().includes(user.name.toLowerCase()));
  }
  // Se for Gerente, Admin, etc, vê tudo
  return data;
};

const logEvento = async (pedidoId: string, user: User, acao: string, detalhes?: string, tipo: 'SUCESSO' | 'ERRO' | 'INFO' | 'ALERTA' = 'INFO', forceLocal: boolean = false) => {
  const evento: any = {
    // Se o banco gera UUID, não mandamos ID. Se for local, geramos temp.
    pedido_id: pedidoId,
    data_evento: new Date().toISOString(),
    usuario: user.name,
    setor: user.role,
    acao,
    detalhes: detalhes || '',
    tipo
  };

  // Salva no estado de sessão (memória)
  const tempId = `temp-${Date.now()}-${Math.random()}`;
  sessionEvents.push({ ...evento, id: tempId });

  // Fallback Local Persistence
  localHistorico.push({ ...evento, id: tempId });
  saveToStorage(STORAGE_KEYS.HISTORICO, localHistorico);

  // Tenta salvar no DB
  if (!forceLocal) {
    try {
      const { error } = await supabase.from('historico_eventos').insert(evento);
      if (error) {
        console.warn("Falha ao inserir evento no Supabase (mantido local):", error.message);
      }
    } catch (e) {
      console.warn("Log evento offline:", e);
    }
  }
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
    if (lines.length < 5) return [];

    // Header Sniffing: Procura a linha de cabeçalho nas primeiras 20 linhas
    let headerIndex = -1;
    let delimiter = '';

    // Palavras-chave obrigatórias para identificar o cabeçalho
    const requiredKeywords = ['pedido', 'cliente']; 
    
    for(let i=0; i < Math.min(lines.length, 20); i++) {
        const lineLower = lines[i].toLowerCase();
        
        // Tenta detectar delimitador na linha
        const hasTab = lineLower.includes('\t');
        const hasSemi = lineLower.includes(';');
        const hasComma = lineLower.includes(',');

        // Conta quantas palavras chave existem na linha
        const matchCount = requiredKeywords.reduce((acc, keyword) => acc + (lineLower.includes(keyword) ? 1 : 0), 0);

        if (matchCount >= 1) {
             headerIndex = i;
             if (hasTab) delimiter = '\t';
             else if (hasSemi) delimiter = ';';
             else delimiter = ','; // Default fallback
             break;
        }
    }

    if (headerIndex === -1) {
        // Fallback: Assume linha 0 se não achar nada
        headerIndex = 0;
        delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    }

    const headers = lines[headerIndex].toLowerCase().split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Função auxiliar para achar índice
    const getIdx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    const idxNumero = getIdx(['numero', 'pedido', 'nro', 'doc', 'ordem']);
    const idxCliente = getIdx(['cliente', 'nome', 'parceiro']);
    // Expandido sinônimos para Produto
    const idxProduto = getIdx(['produto', 'material', 'desc', 'item', 'mercadoria', 'especificacao', 'denominação']);
    const idxUnidade = getIdx(['unidade', 'und', 'un']);
    const idxVolume = getIdx(['volume', 'qtd', 'quantidade', 'saldo']);
    const idxValor = getIdx(['valor', 'total', 'montante', 'bruto']);
    const idxVendedor = getIdx(['vendedor', 'rep', 'representante']);
    // Tenta achar coluna de código vendedor se existir
    const idxCodVendedor = getIdx(['cod_vend', 'codigo_vendedor', 'cod.vend', 'cd_vend', 'vendedor_id']);
    
    const parsedPedidos: Pedido[] = [];

    // Começa a ler APÓS a linha de cabeçalho detectada
    for (let i = headerIndex + 1; i < lines.length; i++) {
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
        
        // Ignora linhas de total, rodapé, paginação
        const ignoreTerms = ['total', 'página', 'relatório', 'impresso', 'emitido'];
        if (!rawNumero || !cliente || ignoreTerms.some(term => String(rawNumero).toLowerCase().includes(term) || String(cliente).toLowerCase().includes(term))) continue;
        
        const numero = String(rawNumero).trim().replace(/\s/g, ''); // Remove espaços do número
        
        // Fallback robusto para Produto
        let produto = 'Produto Geral';
        if (idxProduto >= 0 && cols[idxProduto]) {
             produto = cols[idxProduto];
        } else if (cols[2] && cols[2].length > 3 && !cols[2].match(/^\d/)) {
             // Tenta adivinhar coluna 2 se for texto longo e não número
             produto = cols[2];
        }

        const unidade = idxUnidade >= 0 ? cols[idxUnidade] : 'TN';
        
        const rawVol = idxVolume >= 0 ? cols[idxVolume] : cols[3];
        const rawVal = idxValor >= 0 ? cols[idxValor] : cols[4];
        
        const cleanNumber = (val: string) => {
            if (!val) return 0;
            // Se tiver vírgula como decimal (formato BR) e ponto como milhar
            if (val.includes(',') && (val.indexOf('.') < val.indexOf(','))) {
                 // Ex: 1.000,00 -> Remove ponto, troca virgula por ponto
                 return parseFloat(val.replace(/\./g, '').replace(',', '.'));
            }
             // Se tiver apenas virgula (1000,00)
            if (val.includes(',') && !val.includes('.')) {
                return parseFloat(val.replace(',', '.'));
            }
            return parseFloat(val.replace(/[^\d.-]/g, ''));
        };

        const volume = cleanNumber(rawVol);
        const valor = cleanNumber(rawVal);
        const vendedor = idxVendedor >= 0 ? cols[idxVendedor] : (cols[5] || 'Vendas Internas');
        
        // Prioriza coluna explícita de código, senão gera um dummy ou tenta extrair
        let codigoVendedor = '000';
        if (idxCodVendedor >= 0 && cols[idxCodVendedor]) {
            codigoVendedor = cols[idxCodVendedor].trim();
        } else {
            // Tenta extrair número de dentro do nome do vendedor (ex: "85400 - NOME" ou "NOME 85400")
            // Procura sequência de 4 a 8 dígitos
            const match = vendedor.match(/(\d{4,8})/);
            if (match) {
                codigoVendedor = match[1];
            } else {
                codigoVendedor = '000'; // Não encontrou código
            }
        }
        
        // Sanitização final do código
        codigoVendedor = normalizeCode(codigoVendedor);

        const codigoCliente = 'C' + Math.floor(Math.random() * 1000);

        parsedPedidos.push({
            id: numero,
            numero_pedido: numero,
            codigo_cliente: codigoCliente,
            nome_cliente: cliente,
            nome_produto: produto,
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
            // Template HTML de Boas-vindas
            const htmlWelcome = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #0f172a; padding: 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Bem-vindo ao Cropflow</h1>
                </div>
                <div style="padding: 32px; background-color: #ffffff;">
                    <p style="color: #334155; font-size: 16px; margin-bottom: 24px;">Olá, <strong>${createdUser.name}</strong>.</p>
                    <p style="color: #334155; line-height: 1.6; margin-bottom: 24px;">Seu cadastro no sistema de gestão foi realizado com sucesso. Abaixo estão suas credenciais de acesso:</p>
                    
                    <div style="background-color: #f1f5f9; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
                        <p style="margin: 8px 0; color: #475569; font-size: 14px;">📧 <strong>Login:</strong> ${createdUser.email}</p>
                        <p style="margin: 8px 0; color: #475569; font-size: 14px;">🔑 <strong>Senha:</strong> ${createdUser.password}</p>
                    </div>
                    
                    <a href="https://cropflow.app" style="display: block; width: 100%; padding: 12px 0; background-color: #2563eb; color: #ffffff; text-align: center; text-decoration: none; border-radius: 6px; font-weight: bold;">Acessar Sistema</a>
                </div>
            </div>
            `;

            sendEmailToScript({
                to: createdUser.email,
                subject: 'Bem-vindo ao Cropflow - Credenciais de Acesso',
                body: htmlWelcome,
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
        valor_faturado: Number(p.valor_faturado || 0),
        // Garante que o código seja string para comparação correta
        codigo_vendedor: normalizeCode(String(p.codigo_vendedor))
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

      // Limpa Supabase com UUID válido para evitar erro de sintaxe
      const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
      try {
          // Como temos ON DELETE CASCADE nas chaves estrangeiras, 
          // deletar PEDIDOS deve limpar tudo. Mas por segurança limpamos os filhos antes.
          try { await supabase.from('solicitacoes').delete().neq('id', ZERO_UUID); } catch(e) {}
          try { await supabase.from('historico_eventos').delete().neq('id', ZERO_UUID); } catch(e) {}
          try { await supabase.from('app_logs').delete().neq('id', '0'); } catch(e) {} // logs usa text id
          try { await supabase.from('pedidos').delete().neq('id', '0'); } catch(e) {} // pedidos usa text id
      } catch (e) {
          console.error("Erro ao limpar banco de dados (ignorando se já vazio):", e);
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
    let dbEvents: HistoricoEvento[] = [];
    
    // 1. Tenta buscar do DB
    try {
        const { data } = await supabase.from('historico_eventos').select('*').eq('pedido_id', pedidoId);
        if(data) dbEvents = data as HistoricoEvento[];
    } catch (e) {
        console.warn("Erro ao buscar histórico do DB, usando local.", e);
    }

    // 2. Busca do LocalStorage
    const localEvents = localHistorico.filter(h => h.pedido_id === pedidoId);

    // 3. Mesclar listas (Removendo duplicatas baseadas no ID se possível, ou Timestamp)
    // Priorizamos o que veio do banco, e adicionamos o local apenas se não existir
    const mergedEvents = [...dbEvents];
    
    localEvents.forEach(localEvt => {
        // Verifica se já existe um evento similar no DB (mesma ação)
        // Isso evita duplicação visual quando o sync do DB é lento ou quando o formato da data difere (ISO string vs timestamp)
        // Usamos uma tolerância de 2 segundos para considerar o mesmo evento
        const exists = mergedEvents.some(dbEvt => 
            dbEvt.id === localEvt.id || 
            (
                dbEvt.acao === localEvt.acao && 
                Math.abs(new Date(dbEvt.data_evento).getTime() - new Date(localEvt.data_evento).getTime()) < 2000
            )
        );
        
        if (!exists) {
            mergedEvents.push(localEvt);
        }
    });

    // 4. Ordenação Final
    return mergedEvents.sort((a,b) => new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime());
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

    // FIX: Gravar evento na linha do tempo COM A OBSERVAÇÃO DO VENDEDOR
    const detalhesLog = `Volume: ${volume} ${pedido.unidade}${obsVendedor ? ` | Obs: ${obsVendedor}` : ''}`;
    await logEvento(pedidoId, user, 'Solicitação Criada', detalhesLog, 'SUCESSO');
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

       // Disparar E-mail de Notificação (SOMENTE AQUI - BLOQUEIO)
       // Primeiro tenta buscar o usuário pelo nome (criado_por)
       let solicitante = localUsers.find(u => u.name === updatedSol.criado_por);
       
       // Se não tiver email no usuário local ou não achar, tenta buscar do DB para garantir
       if (!solicitante || !solicitante.email) {
           try {
               const { data } = await supabase.from('app_users').select('*').eq('name', updatedSol.criado_por).single();
               if (data) solicitante = data as User;
           } catch(e) { console.warn("Não foi possível buscar email do solicitante no DB."); }
       }

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

            // HTML Template para o E-mail de Bloqueio
            const htmlContent = `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
                <div style="background-color: #ef4444; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
                   <h1 style="color: white; margin: 0; font-size: 24px;">🛑 Solicitação Bloqueada</h1>
                </div>
                <div style="border: 1px solid #e2e8f0; border-top: none; padding: 32px; border-radius: 0 0 12px 12px; background-color: #ffffff;">
                   <p style="font-size: 16px; margin-bottom: 24px;">Olá,</p>
                   <p style="margin-bottom: 24px; line-height: 1.5;">Informamos que a solicitação abaixo foi <strong>bloqueada</strong> pelo setor responsável.</p>
                   
                   <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                      <p style="margin: 5px 0;"><strong>Pedido:</strong> ${updatedSol.numero_pedido}</p>
                      <p style="margin: 5px 0;"><strong>Cliente:</strong> ${updatedSol.nome_cliente}</p>
                      <p style="margin: 5px 0;"><strong>Produto:</strong> ${updatedSol.nome_produto || 'N/A'}</p>
                      <p style="margin: 5px 0;"><strong>Volume:</strong> ${updatedSol.volume_solicitado} ${updatedSol.unidade}</p>
                   </div>

                   <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; padding: 20px; border-radius: 4px;">
                      <p style="margin: 0 0 8px 0; color: #991b1b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Bloqueado por: ${roleLabel}</p>
                      <p style="margin: 0; color: #7f1d1d; font-size: 16px;">${motivoRejeicao}</p>
                   </div>
                   
                   <p style="margin-top: 32px; font-size: 14px; color: #94a3b8; text-align: center;">Acesse o sistema Cropflow para mais detalhes.</p>
                </div>
              </div>
            `;

            // Envia para cada destinatário com Layout HTML
            emailsToSend.forEach(emailAddr => {
                sendEmailToScript({
                    to: emailAddr,
                    subject: `🛑 BLOQUEIO: Pedido ${updatedSol.numero_pedido} - ${updatedSol.nome_cliente}`,
                    body: htmlContent, // Envia o HTML no corpo
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
         
         // REMOVIDO DISPARO DE EMAIL AQUI - APENAS BLOQUEIOS SÃO NOTIFICADOS
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

    // Log Evento (ENRIQUECIDO COM OBSERVAÇÕES)
    const acaoLabel = status === StatusSolicitacao.EM_ANALISE ? 'Enviado para Análise' :
                      status === StatusSolicitacao.FATURADO ? 'Nota Fiscal Emitida' :
                      status === StatusSolicitacao.REJEITADO ? `Bloqueado (${blockedByRole || 'Geral'})` :
                      status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO ? 'Aprovado para Faturamento' : status;
    
    let detalhesLog = motivoRejeicao;
    
    // Se estiver enviando para análise, incluir Prazo e Obs do Faturamento no log
    if (status === StatusSolicitacao.EM_ANALISE && extraData) {
        const parts = [];
        if (extraData.prazo) parts.push(`Prazo: ${extraData.prazo}`);
        if (extraData.obs_faturamento) parts.push(`Obs: ${extraData.obs_faturamento}`);
        if (parts.length > 0) detalhesLog = parts.join(' | ');
    }

    await logEvento(updatedSol.pedido_id, user, acaoLabel, detalhesLog, status === StatusSolicitacao.REJEITADO ? 'ALERTA' : 'SUCESSO');
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
        
        // Log de sucesso final (incluindo observação final se houver)
        const obsFinal = obs ? ` | Obs Final: ${obs}` : '';
        await logEvento(sol.pedido_id, user, 'Aprovado para Faturamento', `Aprovação conjunta Comercial/Crédito concluída${obsFinal}`, 'SUCESSO');
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
  
      let newStatus = StatusSolicitacao.PENDENTE;
      let newAprovComercial = false;
      let newAprovCredito = false;
      let logMessage = 'Solicitação retornada para Triagem (Início)';

      // LOGICA DE RETORNO BASEADA NO SETOR QUE BLOQUEOU
      if (sol.blocked_by === Role.FATURAMENTO) {
          // Bloqueio do Faturamento volta para o início (Triagem)
          newStatus = StatusSolicitacao.PENDENTE;
          newAprovComercial = false;
          newAprovCredito = false;
          logMessage = 'Desbloqueio Faturamento: Retornado para Triagem';
      } 
      else if (sol.blocked_by === Role.COMERCIAL) {
          // Bloqueio do Comercial volta para Em Análise, mantendo aprovação do Crédito se existir
          newStatus = StatusSolicitacao.EM_ANALISE;
          newAprovComercial = false; // Reseta Comercial (precisa aprovar de novo)
          newAprovCredito = sol.aprovacao_credito || false; // Mantém Crédito
          logMessage = 'Desbloqueio Comercial: Retornado para Análise Comercial';
      }
      else if (sol.blocked_by === Role.CREDITO) {
          // Bloqueio do Crédito volta para Em Análise, mantendo aprovação do Comercial se existir
          newStatus = StatusSolicitacao.EM_ANALISE;
          newAprovComercial = sol.aprovacao_comercial || false; // Mantém Comercial
          newAprovCredito = false; // Reseta Crédito (precisa aprovar de novo)
          logMessage = 'Desbloqueio Crédito: Retornado para Análise de Crédito';
      }
      else {
          // Fallback (Admin ou sem bloqueio definido) - Reinicia tudo para garantir segurança
          newStatus = StatusSolicitacao.PENDENTE;
          newAprovComercial = false;
          newAprovCredito = false;
      }
      
      const updates = {
          status: newStatus,
          blocked_by: null, // Remove bloqueio
          motivo_rejeicao: null, // Limpa motivo
          aprovacao_comercial: newAprovComercial,
          aprovacao_credito: newAprovCredito,
          // Força reset da observação do setor que bloqueou para exigir nova análise limpa, 
          // mas mantém a do outro setor.
          obs_comercial: sol.blocked_by === Role.COMERCIAL ? null : sol.obs_comercial,
          obs_credito: sol.blocked_by === Role.CREDITO ? null : sol.obs_credito
      };
      
      const index = localSolicitacoes.findIndex(s => s.id === id);
      localSolicitacoes[index] = { ...localSolicitacoes[index], ...updates }; // @ts-ignore handles nulls
      
      saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
      
      try {
          await supabase.from('solicitacoes').update(updates).eq('id', id);
      } catch(e) {}
      
      await logEvento(sol.pedido_id, user, 'Desbloqueio Manual', logMessage, 'INFO');
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
        // CodeTabs: Muito confiável para arquivos grandes, não corta dados
        (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
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
            
            if (csvText && csvText.length > 50) break; // Sucesso, sai do loop (Length check to ensure not empty error msg)
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
        
        if (novosPedidos.length === 0) throw new Error("Nenhum pedido válido encontrado no arquivo (Verifique o formato).");

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

        // 5. Persistir no Banco (Upsert em lotes pequenos com retry)
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

            // Upsert em lotes de 50 para não estourar payload e reduzir chance de timeout
            const batchSize = 50;
            
            for (let i = 0; i < payload.length; i += batchSize) {
                const batch = payload.slice(i, i + batchSize);
                
                // Sistema de Retry (Tentativa Automática)
                let attempts = 0;
                const maxAttempts = 3;
                let saved = false;
                let lastError = null;

                while (attempts < maxAttempts && !saved) {
                    try {
                        attempts++;
                        const { error } = await supabase.from('pedidos').upsert(batch);
                        if (error) throw error;
                        saved = true;
                    } catch (err: any) {
                        lastError = err;
                        console.warn(`Sync tentativa ${attempts} falhou para lote ${i}: ${err.message}. Tentando novamente...`);
                        // Espera exponencial: 1s, 2s, 4s...
                        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempts - 1)));
                    }
                }

                if (!saved && lastError) {
                    throw lastError; // Se falhar 3x, aborta
                }
            }

        } catch (e: any) {
             throw new Error(`Erro ao salvar no Supabase: ${e.message || e}`);
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