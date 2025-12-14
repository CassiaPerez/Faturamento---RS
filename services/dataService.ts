import { Pedido, PedidoItem, ItemSolicitado, SolicitacaoFaturamento, LogSincronizacao, StatusPedido, StatusSolicitacao, Role, User, HistoricoEvento } from '../types';
import { supabase } from './supabaseClient';

/* 
  === ARQUITETURA: HÍBRIDA (SUPABASE + LOCAL STORAGE) ===
  Melhoria: Persistência local para garantir funcionamento mesmo sem conexão DB.
*/

// --- MOCK DATA PARA INICIALIZAÇÃO OFFLINE ---
const MOCK_PEDIDOS: Pedido[] = [];

// --- STORAGE HELPERS ---
const STORAGE_KEYS = {
  PEDIDOS: 'cropflow_pedidos_v3',       // Atualizado v3 para nova estrutura de itens
  SOLICITACOES: 'cropflow_solicitacoes_v2',
  HISTORICO: 'cropflow_historico_v2',
  LOGS: 'cropflow_logs_v2',
  CONFIG: 'cropflow_config_v1',
  DELETED_IDS: 'cropflow_deleted_ids_v2',
  USERS: 'cropflow_users_v1'
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

// Helper simples para UUID v4
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

const normalizeCode = (c: string | number | undefined) => {
    if (!c) return '';
    return String(c).trim().replace(/^0+/, '');
};

const cleanString = (val: any) => {
    if (!val) return undefined;
    const str = String(val).trim();
    return str === '' ? undefined : str;
};

// Filter Data Logic
const filterDataByRole = (data: Pedido[], user: User) => {
  if (user.role === Role.VENDEDOR) {
    if (user.sales_codes && user.sales_codes.length > 0) {
        const userCodes = user.sales_codes.map(normalizeCode);
        return data.filter(p => {
            const orderCode = normalizeCode(p.codigo_vendedor);
            return userCodes.includes(orderCode);
        });
    }
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
    detalhes: detalhes || '',
    tipo
  };

  const tempId = `temp-${Date.now()}-${Math.random()}`;
  sessionEvents.push({ ...evento, id: tempId });
  localHistorico.push({ ...evento, id: tempId });
  saveToStorage(STORAGE_KEYS.HISTORICO, localHistorico);

  if (!forceLocal) {
    try {
      const { error } = await supabase.from('historico_eventos').insert(evento);
      if (error) console.warn("Falha log supabase:", error.message);
    } catch (e) { }
  }
};

// --- FUNÇÃO GERADORA DE TEMPLATE HTML PARA E-MAIL ---
const generateBlockEmailTemplate = (data: {
  vendorName: string;
  managerName?: string;
  orderNumber: string;
  clientName: string;
  reason: string;
  blockerName: string;
  blockerRole: string;
  rejectedItems?: string;
}) => {
  const currentYear = new Date().getFullYear();
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notificação Cropflow</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
        body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Inter', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f1f5f9; padding-bottom: 40px; }
        .webkit { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #15803d 0%, #166534 100%); padding: 32px 40px; text-align: center; }
        .brand { color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin: 0; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .status-bar { background-color: #fee2e2; color: #991b1b; padding: 12px; text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #fecaca; }
        .content { padding: 40px 40px 30px 40px; }
        .greeting { font-size: 18px; color: #0f172a; margin-bottom: 8px; font-weight: 600; }
        .intro { font-size: 15px; color: #64748b; line-height: 1.6; margin-top: 0; margin-bottom: 30px; }
        
        .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 25px; }
        .info-row { padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .info-row:last-child { border-bottom: none; }
        .info-col { width: 48%; }
        .label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }
        .value { font-size: 14px; font-weight: 600; color: #334155; margin: 0; display: block; }
        
        .reason-box { background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 25px; border-radius: 6px; margin-bottom: 30px; }
        .reason-title { color: #be123c; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; }
        .reason-text { color: #881337; font-size: 15px; line-height: 1.5; font-weight: 500; }
        
        .items-section { margin-top: 15px; padding-top: 15px; border-top: 1px solid #fecdd3; }
        .items-title { font-size: 12px; font-weight: 700; color: #be123c; margin-bottom: 5px; }
        .items-text { font-size: 13px; color: #9f1239; line-height: 1.4; background: rgba(255,255,255,0.5); padding: 8px; border-radius: 4px; }

        .btn-container { text-align: center; margin-top: 10px; margin-bottom: 10px; }
        .btn { display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); transition: all 0.2s; }
        
        .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 30px; text-align: center; }
        .footer-text { font-size: 12px; color: #94a3b8; margin-bottom: 5px; }
        .footer-sub { font-size: 11px; color: #cbd5e1; }
        
        /* Mobile fixes */
        @media only screen and (max-width: 600px) {
          .info-row { display: block; }
          .info-col { width: 100%; margin-bottom: 15px; }
          .info-col:last-child { margin-bottom: 0; }
          .content { padding: 30px 20px; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="webkit">
          <div class="header">
            <h1 class="brand">CROPFLOW</h1>
          </div>
          
          <div class="status-bar">
            ⚠️ Pedido Bloqueado / Devolvido
          </div>
          
          <div class="content">
            <p class="greeting">Olá, ${data.vendorName}</p>
            ${data.managerName ? `<p style="font-size:12px; color:#94a3b8; margin-top:-5px; margin-bottom:15px;">(Cópia para: ${data.managerName})</p>` : ''}
            
            <p class="intro">Identificamos uma pendência que impede o prosseguimento do faturamento. Por favor, verifique os detalhes abaixo e tome as providências necessárias.</p>
            
            <div class="info-card">
              <div class="info-row">
                <div class="info-col">
                  <span class="label">Número do Pedido</span>
                  <span class="value" style="font-family: monospace; font-size: 15px;">${data.orderNumber}</span>
                </div>
                <div class="info-col">
                  <span class="label">Cliente</span>
                  <span class="value">${data.clientName}</span>
                </div>
              </div>
              <div class="info-row">
                <div class="info-col">
                  <span class="label">Bloqueado Por</span>
                  <span class="value">${data.blockerName}</span>
                </div>
                <div class="info-col">
                  <span class="label">Setor Responsável</span>
                  <span class="value" style="color: #ef4444;">${data.blockerRole}</span>
                </div>
              </div>
            </div>

            <div class="reason-box">
              <div class="reason-title">
                Motivo da Devolução
              </div>
              <div class="reason-text">
                ${data.reason}
              </div>
              
              ${data.rejectedItems ? `
                <div class="items-section">
                  <div class="items-title">Itens Afetados:</div>
                  <div class="items-text">${data.rejectedItems}</div>
                </div>
              ` : ''}
            </div>

            <div class="btn-container">
              <a href="https://cropflow-app.vercel.app/" class="btn">Acessar Sistema para Corrigir</a>
            </div>
          </div>
          
          <div class="footer">
            <p class="footer-text">&copy; ${currentYear} Grupo Cropfield. Todos os direitos reservados.</p>
            <p class="footer-sub">Mensagem automática gerada pelo sistema Cropflow.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendEmailToScript = async (payload: any) => {
    if (!navigator.onLine) return false;
    try {
        await fetch(googleScriptUrl, { 
            method: 'POST', 
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload) 
        });
        return true;
    } catch (e) {
        return false;
    }
};

const convertDriveLink = (url: string): string => {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
    return url;
};

// --- NOVO PARSER COM SUPORTE A ITENS ---
const parseCSV = (csvText: string): Pedido[] => {
    const cleanText = csvText.trim().replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/);
    if (lines.length < 5) return [];

    let headerIndex = -1;
    let delimiter = '';
    const requiredKeywords = ['pedido', 'cliente']; 
    
    for(let i=0; i < Math.min(lines.length, 20); i++) {
        const lineLower = lines[i].toLowerCase();
        const hasTab = lineLower.includes('\t');
        const hasSemi = lineLower.includes(';');
        const hasComma = lineLower.includes(',');
        const matchCount = requiredKeywords.reduce((acc, keyword) => acc + (lineLower.includes(keyword) ? 1 : 0), 0);

        if (matchCount >= 1) {
             headerIndex = i;
             delimiter = hasTab ? '\t' : (hasSemi ? ';' : ',');
             break;
        }
    }

    if (headerIndex === -1) {
        headerIndex = 0;
        delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    }

    const headers = lines[headerIndex].toLowerCase().split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
    const getIdx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    // MAPA DE COLUNAS - APRIMORADO
    const idxNumero = getIdx(['numero', 'pedido', 'nro', 'doc', 'ordem', 'nr_pedido']);
    const idxCliente = getIdx(['cliente', 'nome', 'parceiro']);
    
    // CRÍTICO: Remover 'item' genérico para evitar match com 'COD_ITEM'
    // Priorizar 'descricao', 'descrição', 'produto', 'material'
    const idxProduto = getIdx(['descricao', 'descrição', 'produto', 'material', 'especificacao', 'mercadoria', 'texto']);
    
    const idxUnidade = getIdx(['unidade', 'und', 'un']);
    const idxVolume = getIdx(['volume', 'qtd', 'quantidade', 'saldo']);
    const idxValor = getIdx(['valor', 'total', 'montante', 'bruto', 'liquido']);
    const idxVendedor = getIdx(['vendedor', 'rep', 'representante']);
    const idxCodVendedor = getIdx(['cod_vend', 'codigo_vendedor', 'cod.vend', 'cd_vend', 'vendedor_id']);
    
    // Map para agrupar itens pelo número do pedido
    const pedidosMap = new Map<string, Pedido>();

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let cols: string[];
        if (delimiter === '\t') cols = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
        else if (delimiter === ';') cols = line.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
        else cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));

        if (cols.length < 3) continue;

        const rawNumero = idxNumero >= 0 ? cols[idxNumero] : cols[0];
        const cliente = idxCliente >= 0 ? cols[idxCliente] : cols[1];
        
        const ignoreTerms = ['total', 'página', 'relatório', 'impresso', 'emitido'];
        if (!rawNumero || !cliente || ignoreTerms.some(term => String(rawNumero).toLowerCase().includes(term) || String(cliente).toLowerCase().includes(term))) continue;
        
        const numeroPedido = String(rawNumero).trim().replace(/\s/g, '');
        
        // Produto Logic - Fallback inteligente se a coluna exata não for encontrada
        let produto = 'Produto Geral';
        if (idxProduto >= 0 && cols[idxProduto] && cols[idxProduto].trim()) {
             produto = cols[idxProduto].trim();
        } else if (cols.length > 16 && cols[16] && cols[16].length > 3) {
             // Tenta pegar a coluna 16 (DESCRICAO no arquivo de exemplo)
             produto = cols[16].trim();
        } else if (cols[2] && cols[2].length > 5 && !cols[2].match(/^\d/)) {
             // Fallback legado
             produto = cols[2].trim();
        }

        const unidade = idxUnidade >= 0 ? cols[idxUnidade] : 'TN';
        const rawVol = idxVolume >= 0 ? cols[idxVolume] : cols[3];
        const rawVal = idxValor >= 0 ? cols[idxValor] : cols[4];
        
        const cleanNumber = (val: string) => {
            if (!val) return 0;
            if (val.includes(',') && (val.indexOf('.') < val.indexOf(','))) {
                 return parseFloat(val.replace(/\./g, '').replace(',', '.'));
            }
            if (val.includes(',') && !val.includes('.')) {
                return parseFloat(val.replace(',', '.'));
            }
            return parseFloat(val.replace(/[^\d.-]/g, ''));
        };

        const volume = cleanNumber(rawVol);
        const valor = cleanNumber(rawVal);
        const vendedor = idxVendedor >= 0 ? cols[idxVendedor] : (cols[5] || 'Vendas Internas');
        
        // Código Vendedor Logic
        let codigoVendedor = '000';
        if (idxCodVendedor >= 0 && cols[idxCodVendedor]) {
            codigoVendedor = cols[idxCodVendedor].trim();
        } else {
            const match = vendedor.match(/(\d{4,8})/);
            if (match) codigoVendedor = match[1];
        }
        codigoVendedor = normalizeCode(codigoVendedor);

        // --- GROUPING LOGIC ---
        // Se o pedido já existe, adiciona item. Se não, cria.
        if (pedidosMap.has(numeroPedido)) {
            const existingPedido = pedidosMap.get(numeroPedido)!;
            
            // Adiciona novo item
            existingPedido.itens.push({
                id: `${numeroPedido}-${existingPedido.itens.length + 1}`,
                nome_produto: produto,
                unidade: unidade,
                volume_total: volume,
                volume_restante: volume, // Inicialmente igual ao total
                volume_faturado: 0,
                valor_total: valor,
                valor_unitario: volume > 0 ? valor / volume : 0
            });

            // Atualiza totais do cabeçalho
            existingPedido.volume_total += volume;
            existingPedido.volume_restante += volume;
            existingPedido.valor_total += valor;
            
            // Atualiza resumo de produtos se for diferente
            if (!existingPedido.nome_produto.includes('Mix') && existingPedido.nome_produto !== produto) {
                existingPedido.nome_produto = "Mix de Produtos";
            }

        } else {
            // Novo Pedido
            const novoPedido: Pedido = {
                id: numeroPedido,
                numero_pedido: numeroPedido,
                codigo_cliente: 'C' + Math.floor(Math.random() * 1000),
                nome_cliente: cliente,
                nome_produto: produto, // Primeiro produto
                unidade: unidade,
                
                // Totais iniciais
                volume_total: volume,
                volume_restante: volume,
                volume_faturado: 0,
                valor_total: valor,
                valor_faturado: 0,
                
                codigo_vendedor: codigoVendedor,
                nome_vendedor: vendedor,
                status: StatusPedido.PENDENTE,
                data_criacao: new Date().toISOString(),
                
                // Array de itens inicial
                itens: [{
                    id: `${numeroPedido}-1`,
                    nome_produto: produto,
                    unidade: unidade,
                    volume_total: volume,
                    volume_restante: volume,
                    volume_faturado: 0,
                    valor_total: valor,
                    valor_unitario: volume > 0 ? valor / volume : 0
                }]
            };
            pedidosMap.set(numeroPedido, novoPedido);
        }
    }
    
    return Array.from(pedidosMap.values());
};

export const api = {
  checkConnection: async (): Promise<boolean> => {
    try {
      await supabase.from('pedidos').select('id').limit(1);
      await supabase.from('app_users').select('id').limit(1);
      return true;
    } catch (e) { return false; }
  },
  
  login: async (email: string, password: string): Promise<User> => {
      if (email.trim() === 'administrador@grupocropfield.com.br' && password === 'Cp261121@!') {
        return { id: 'u1', name: 'Administrador', role: Role.ADMIN, email: email };
      }
      try {
        const { data, error } = await supabase.from('app_users').select('*').eq('email', email).eq('password', password).single();
        if (!error && data) {
            const user = data as User;
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
    return { 
      supabaseUrl: 'https://vvmztpnxpndoaeepxztj.supabase.co', 
      emailServiceUrl: googleScriptUrl, 
      csvUrl: currentConfig.csvUrl || '',
      dbConnected: await api.checkConnection()
    }; 
  },
  
  updateSystemConfig: async (config: any) => { 
    if(config.emailServiceUrl) googleScriptUrl = config.emailServiceUrl;
    currentConfig = { ...currentConfig, emailServiceUrl: config.emailServiceUrl || currentConfig.emailServiceUrl, csvUrl: config.csvUrl || '' };
    saveToStorage(STORAGE_KEYS.CONFIG, currentConfig);
    return true; 
  },
  
  sendTestEmail: async (email: string) => { 
    const sent = await sendEmailToScript({ action: 'test_email', to: email, subject: 'Teste Cropflow', body: 'Teste de integração.' });
    return { success: sent, message: sent ? "Comando enviado" : "Falha na conexão" };
  },
  
  getUsers: async () => { 
    try {
        const { data } = await supabase.from('app_users').select('*').order('name');
        if (data) {
            localUsers = data as User[];
            saveToStorage(STORAGE_KEYS.USERS, localUsers);
        }
    } catch (e) {}
    return localUsers; 
  },

  createUser: async (user: any) => { 
    const newUser = { ...user, id: user.id || generateUUID() };
    try {
        const { data, error } = await supabase.from('app_users').insert(newUser).select().single();
        if (error) throw error;
        localUsers.push(data || newUser);
        saveToStorage(STORAGE_KEYS.USERS, localUsers);
        
        if (newUser.email && newUser.password) {
            sendEmailToScript({ to: newUser.email, subject: 'Acesso Cropflow', body: `Login: ${newUser.email} | Senha: ${newUser.password}`, action: 'welcome_email' }).catch(()=>{});
        }
        return data || newUser;
    } catch (e) {
        if (!localUsers.find(u => u.id === newUser.id)) { localUsers.push(newUser); saveToStorage(STORAGE_KEYS.USERS, localUsers); }
        return newUser;
    }
  },

  updateUser: async (user: any) => { 
    try {
        await supabase.from('app_users').update(user).eq('id', user.id);
        const idx = localUsers.findIndex(u => u.id === user.id);
        if (idx !== -1) { localUsers[idx] = { ...localUsers[idx], ...user }; saveToStorage(STORAGE_KEYS.USERS, localUsers); }
        return user;
    } catch (e) {
        const idx = localUsers.findIndex(u => u.id === user.id);
        if (idx !== -1) { localUsers[idx] = { ...localUsers[idx], ...user }; saveToStorage(STORAGE_KEYS.USERS, localUsers); }
        return user;
    }
  },

  deleteUser: async (id: string) => { 
      localUsers = localUsers.filter(u => u.id !== id);
      saveToStorage(STORAGE_KEYS.USERS, localUsers);
      try { await supabase.from('app_users').delete().eq('id', id); } catch (e) {}
  },

  getPedidos: async (user: User): Promise<Pedido[]> => {
    // Carrega localmente e retorna. O DB é usado apenas para sync.
    // Garantir que localPedidos tenham a estrutura correta (migração on-the-fly se necessário)
    const safePedidos = localPedidos.map(p => {
        if (!p.itens) {
            // Migração: Se não tiver itens, cria baseado no cabeçalho
            return {
                ...p,
                itens: [{
                    id: `${p.id}-1`,
                    nome_produto: p.nome_produto || 'Produto Geral',
                    unidade: p.unidade,
                    volume_total: p.volume_total,
                    volume_restante: p.volume_restante,
                    volume_faturado: p.volume_faturado,
                    valor_total: p.valor_total,
                    valor_unitario: p.volume_total > 0 ? p.valor_total / p.volume_total : 0
                }]
            };
        }
        return p;
    });
    
    // Atualiza cache se houve migração
    if (JSON.stringify(safePedidos) !== JSON.stringify(localPedidos)) {
        localPedidos = safePedidos;
        saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);
    }

    return filterDataByRole(localPedidos, user);
  },

  deletePedido: async (id: string) => {
      deletedIds.push(id);
      saveToStorage(STORAGE_KEYS.DELETED_IDS, deletedIds);
      localPedidos = localPedidos.filter(p => p.id !== id);
      saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);
      try {
          await supabase.from('solicitacoes').delete().eq('pedido_id', id);
          await supabase.from('historico_eventos').delete().eq('pedido_id', id);
          await supabase.from('pedidos').delete().eq('id', id);
      } catch (e) {}
  },

  clearAllPedidos: async () => {
      localStorage.removeItem(STORAGE_KEYS.PEDIDOS);
      localStorage.removeItem(STORAGE_KEYS.SOLICITACOES);
      localStorage.removeItem(STORAGE_KEYS.HISTORICO);
      localStorage.removeItem(STORAGE_KEYS.LOGS);
      localPedidos = []; localSolicitacoes = []; localHistorico = []; localLogs = []; deletedIds = [];
      saveToStorage(STORAGE_KEYS.PEDIDOS, []);
      saveToStorage(STORAGE_KEYS.SOLICITACOES, []);
      saveToStorage(STORAGE_KEYS.DELETED_IDS, []);
      const ZERO = '00000000-0000-0000-0000-000000000000';
      try {
          await supabase.from('solicitacoes').delete().neq('id', ZERO);
          await supabase.from('historico_eventos').delete().neq('id', ZERO);
          await supabase.from('app_logs').delete().neq('id', '0');
          await supabase.from('pedidos').delete().neq('id', '0');
      } catch (e) {}
  },

  getSolicitacoes: async (user: User): Promise<SolicitacaoFaturamento[]> => {
    // Retorna local. Sync com DB é feito em background se necessário.
    const solicitacoes = user.role === Role.VENDEDOR 
        ? localSolicitacoes.filter(s => s.criado_por === user.name) 
        : localSolicitacoes;
    return solicitacoes;
  },

  getSolicitacoesByPedido: async (pedidoId: string): Promise<SolicitacaoFaturamento[]> => {
    return localSolicitacoes.filter(s => s.pedido_id === pedidoId);
  },
  
  getHistoricoPedido: async (pedidoId: string): Promise<HistoricoEvento[]> => {
    return localHistorico.filter(h => h.pedido_id === pedidoId).sort((a,b) => new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime());
  },

  // --- NOVA ASSINATURA PARA SUPORTAR MÚLTIPLOS ITENS ---
  createSolicitacao: async (pedidoId: string, itensSolicitados: { nome_produto: string, volume: number, unidade: string }[], user: User, obsVendedor: string) => {
    const pedido = localPedidos.find(p => p.id === pedidoId);
    if (!pedido) throw new Error('Pedido não encontrado');

    // Validação de volume por item e Cálculo do Valor
    let volumeTotalSolicitado = 0;
    let valorTotalSolicitado = 0;
    
    // Atualiza volume restante nos itens do pedido
    for (const itemReq of itensSolicitados) {
        const itemOriginal = pedido.itens.find(i => i.nome_produto === itemReq.nome_produto);
        if (!itemOriginal) continue; // Skip if invalid

        if (itemReq.volume > (itemOriginal.volume_restante + 0.001)) {
            throw new Error(`Volume solicitado para ${itemReq.nome_produto} excede o disponível.`);
        }
        
        // Deduz imediatamente ao criar a solicitação
        itemOriginal.volume_restante -= itemReq.volume;
        
        volumeTotalSolicitado += itemReq.volume;
        valorTotalSolicitado += itemReq.volume * itemOriginal.valor_unitario;
    }
    
    // Atualiza totais globais do pedido
    pedido.volume_restante = pedido.itens.reduce((acc, i) => acc + i.volume_restante, 0);

    // Cria string de resumo para compatibilidade com paineis legados
    const resumoProdutos = itensSolicitados.map(i => `${i.nome_produto}: ${i.volume} ${i.unidade}`).join(' | ');

    const novaSolicitacao: SolicitacaoFaturamento = {
      id: `req-${Date.now()}`,
      pedido_id: pedidoId,
      numero_pedido: pedido.numero_pedido,
      nome_cliente: pedido.nome_cliente,
      
      // Campos de compatibilidade
      nome_produto: resumoProdutos,
      unidade: itensSolicitados[0]?.unidade || 'TN', 
      volume_solicitado: volumeTotalSolicitado,
      valor_solicitado: valorTotalSolicitado, // Novo campo
      
      // Novo campo detalhado
      itens_solicitados: itensSolicitados,

      status: StatusSolicitacao.PENDENTE,
      criado_por: user.name,
      data_solicitacao: new Date().toISOString(),
      obs_vendedor: obsVendedor || undefined
    };

    localSolicitacoes.push(novaSolicitacao);
    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
    saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos); // Salva pedido atualizado

    try {
      const payload = { ...novaSolicitacao };
      delete (payload as any).id; // DB gera ID
      delete (payload as any).itens_solicitados; // Remove complex object if DB schema is strict text
      
      // Tenta salvar campos básicos no Supabase (se schema permitir JSON, poderíamos mandar itens_solicitados)
      await supabase.from('solicitacoes').insert(payload);
    } catch (e) {
      console.warn("Offline createSolicitacao");
    }

    const detalhesLog = `Itens: ${resumoProdutos}${obsVendedor ? ` | Obs: ${obsVendedor}` : ''}`;
    await logEvento(pedidoId, user, 'Solicitação Criada', detalhesLog, 'SUCESSO');
  },

  updateSolicitacaoStatus: async (
    id: string, 
    status: StatusSolicitacao, 
    user: User, 
    motivoRejeicao?: string,
    blockedByRole?: Role,
    extraData?: { prazo?: string, obs_faturamento?: string },
    itensAtendidos?: { nome_produto: string, volume: number, unidade: string }[]
  ) => {
    const solIndex = localSolicitacoes.findIndex(s => s.id === id);
    if (solIndex === -1) return;

    const updatedSol = { ...localSolicitacoes[solIndex], status };
    
    if (status === StatusSolicitacao.REJEITADO && motivoRejeicao) {
       const prefixo = blockedByRole ? `[BLOQUEIO: ${blockedByRole}] ` : '[BLOQUEIO] ';
       updatedSol.motivo_rejeicao = `${prefixo}${motivoRejeicao}`;
       updatedSol.blocked_by = blockedByRole;
       
       // --- DISPARO DE EMAIL PARA O VENDEDOR E GERENTE ---
       const creatorUser = localUsers.find(u => u.name === updatedSol.criado_por);
       let managerUser: User | undefined;

       if (creatorUser) {
           // Busca o Gerente se houver vínculo
           if (creatorUser.manager_id) {
               managerUser = localUsers.find(u => u.id === creatorUser.manager_id);
           }

           const recipients = [creatorUser.email];
           if (managerUser && managerUser.email) {
               recipients.push(managerUser.email);
           }

           if (recipients.length > 0 && recipients[0]) {
               const htmlContent = generateBlockEmailTemplate({
                   vendorName: creatorUser.name,
                   managerName: managerUser ? managerUser.name : undefined,
                   orderNumber: updatedSol.numero_pedido,
                   clientName: updatedSol.nome_cliente,
                   reason: motivoRejeicao,
                   blockerName: user.name,
                   blockerRole: getRoleLabel(user.role)
               });

               const emailBody = `
                 Olá ${creatorUser.name}${managerUser ? ` (C/C: ${managerUser.name})` : ''},
                 
                 A solicitação de faturamento para o pedido ${updatedSol.numero_pedido} foi BLOQUEADA.
                 
                 Cliente: ${updatedSol.nome_cliente}
                 Motivo: ${motivoRejeicao}
                 Responsável pelo Bloqueio: ${user.name} (${getRoleLabel(user.role)})
                 
                 Por favor, verifique no sistema para mais detalhes.
               `;
               
               sendEmailToScript({
                   to: recipients.join(','),
                   subject: `🚫 Bloqueio: Pedido ${updatedSol.numero_pedido} - Cropflow`,
                   body: emailBody,
                   htmlBody: htmlContent, // Envia o HTML rico
                   action: 'notification'
               }).catch(err => console.error("Falha ao enviar email de bloqueio", err));
           }
       }
    }

    // Lógica para envio para análise (Triagem do Faturamento) com revisão de itens
    if (status === StatusSolicitacao.EM_ANALISE) {
       updatedSol.aprovacao_comercial = false;
       updatedSol.aprovacao_credito = false;
       updatedSol.blocked_by = undefined;
       updatedSol.motivo_rejeicao = undefined;
       updatedSol.obs_comercial = undefined;
       updatedSol.obs_credito = undefined;
       updatedSol.aprovado_por = undefined;
       if (extraData) {
           updatedSol.prazo_pedido = extraData.prazo;
           updatedSol.obs_faturamento = extraData.obs_faturamento;
       }

       // Se houver itens revisados (itensAtendidos sendo usado como payload de itens aprovados na triagem)
       if (itensAtendidos && updatedSol.itens_solicitados) {
           const pedido = localPedidos.find(p => p.id === updatedSol.pedido_id);
           if (pedido) {
               const itensRejeitados: ItemSolicitado[] = [];
               let novoValorAprovado = 0;
               let valorRejeitado = 0;
               let detalheRejeicaoTexto = "";

               // 1. Identifica quais itens foram rejeitados (não selecionados ou volume reduzido)
               // e Devolve o saldo total original para a carteira temporariamente
               updatedSol.itens_solicitados.forEach(orig => {
                   const itemP = pedido.itens.find(pItem => pItem.nome_produto === orig.nome_produto);
                   
                   // Retorno para carteira (re-adicionar)
                   if (itemP) {
                       itemP.volume_restante += orig.volume;
                   }

                   // Verificação de rejeição
                   const aprovado = itensAtendidos.find(a => a.nome_produto === orig.nome_produto);
                   if (!aprovado) {
                       // Item totalmente removido na triagem
                       itensRejeitados.push({
                           ...orig,
                           obs: 'Cancelado na triagem do Faturamento'
                       });
                       if (itemP) {
                           valorRejeitado += orig.volume * itemP.valor_unitario;
                           detalheRejeicaoTexto += `${orig.nome_produto} (${orig.volume} ${orig.unidade}); `;
                       }
                   } else if (aprovado.volume < orig.volume) {
                       // Volume reduzido na triagem
                       const diff = orig.volume - aprovado.volume;
                       itensRejeitados.push({
                           ...orig,
                           volume: diff,
                           obs: `Volume reduzido na triagem (Solicitado: ${orig.volume})`
                       });
                       if (itemP) {
                           valorRejeitado += diff * itemP.valor_unitario;
                           detalheRejeicaoTexto += `${orig.nome_produto} (Corte: ${diff} ${orig.unidade}); `;
                       }
                   }
               });

               // 2. Abater APENAS o que foi confirmado na triagem do saldo que acabamos de restaurar
               itensAtendidos.forEach(aprovado => {
                   const itemP = pedido.itens.find(pItem => pItem.nome_produto === aprovado.nome_produto);
                   if (itemP) {
                       itemP.volume_restante = Math.max(0, itemP.volume_restante - aprovado.volume);
                       novoValorAprovado += aprovado.volume * itemP.valor_unitario;
                   }
               });

               // 3. SE HOUVER ITENS REJEITADOS: Criar um registro de "REJEIÇÃO" separado para aparecer no painel do vendedor
               if (itensRejeitados.length > 0) {
                   const rejeicao: SolicitacaoFaturamento = {
                       ...updatedSol,
                       id: `req-rej-${Date.now()}`, // ID novo
                       itens_solicitados: itensRejeitados,
                       volume_solicitado: itensRejeitados.reduce((acc, i) => acc + i.volume, 0),
                       valor_solicitado: valorRejeitado, // Atualiza valor dos rejeitados
                       nome_produto: "Devolução: " + itensRejeitados.map(i => i.nome_produto).join(', '),
                       status: StatusSolicitacao.REJEITADO,
                       blocked_by: Role.FATURAMENTO,
                       motivo_rejeicao: `[CORTE DE ESTOQUE] Itens devolvidos: ${detalheRejeicaoTexto}`,
                       data_solicitacao: new Date().toISOString()
                   };
                   localSolicitacoes.push(rejeicao);
                   
                   // Tenta salvar no Supabase também
                   try {
                       const rejPayload = { ...rejeicao };
                       delete (rejPayload as any).id;
                       delete (rejPayload as any).itens_solicitados; 
                       await supabase.from('solicitacoes').insert(rejPayload);
                   } catch (e) {}
               }

               // 4. Atualizar a solicitação original com a nova lista limpa (apenas aprovados)
               updatedSol.itens_solicitados = itensAtendidos;
               
               // 5. Recalcular totais globais
               pedido.volume_restante = pedido.itens.reduce((acc, i) => acc + i.volume_restante, 0);
               updatedSol.volume_solicitado = itensAtendidos.reduce((acc, i) => acc + i.volume, 0);
               updatedSol.valor_solicitado = novoValorAprovado; // Atualiza o valor financeiro do aprovado
               
               // Atualiza resumo
               updatedSol.nome_produto = itensAtendidos.map(i => `${i.nome_produto}: ${i.volume} ${i.unidade}`).join(' | ');
           }
       }
    }
    
    // Tratamento para Faturamento Final (Atualiza estoque dos itens específicos e finaliza)
    if (status === StatusSolicitacao.FATURADO) {
       const pedido = localPedidos.find(p => p.id === updatedSol.pedido_id);
       if (pedido) {
         
         // Se o usuário do faturamento editou os itens NA HORA DA EMISSÃO (itensAtendidos), usamos essa lista.
         const itensParaProcessar = itensAtendidos || updatedSol.itens_solicitados || [];
         
         if (itensAtendidos) {
             updatedSol.itens_atendidos = itensAtendidos;
             
             // Se houve alteração no momento do faturamento (diferente da análise), precisamos ajustar o saldo novamente
             if (updatedSol.itens_solicitados) {
                 updatedSol.itens_solicitados.forEach(solicitado => {
                     const faturado = itensAtendidos.find(f => f.nome_produto === solicitado.nome_produto);
                     const volFaturado = faturado ? faturado.volume : 0;
                     const diferenca = solicitado.volume - volFaturado;
                     
                     if (diferenca > 0) {
                         const itemP = pedido.itens.find(p => p.nome_produto === solicitado.nome_produto);
                         if (itemP) {
                             // Como o volume da solicitação já estava deduzido, devolvemos a diferença
                             itemP.volume_restante += diferenca;
                         }
                     }
                 });
             }
         }

         // Registra o faturamento nos itens do pedido
         let valorTotalFaturadoNesta = 0;
         itensParaProcessar.forEach(proc => {
             const itemP = pedido.itens.find(p => p.nome_produto === proc.nome_produto);
             if (itemP) {
                 itemP.volume_faturado = (itemP.volume_faturado || 0) + proc.volume;
                 // Cálculo de valor exato baseado no item unitário
                 valorTotalFaturadoNesta += (proc.volume * itemP.valor_unitario);
             }
         });

         // Recalcula totais do pedido baseados nos itens
         pedido.volume_restante = pedido.itens.reduce((acc, i) => acc + i.volume_restante, 0);
         pedido.volume_faturado = pedido.itens.reduce((acc, i) => acc + (i.volume_faturado || 0), 0);
         
         // Atualiza o valor faturado acumulado com o cálculo preciso desta emissão
         pedido.valor_faturado = (pedido.valor_faturado || 0) + valorTotalFaturadoNesta;

         if (pedido.volume_restante < 1) { 
           pedido.status = StatusPedido.FINALIZADO;
         } else {
           pedido.status = StatusPedido.PARCIALMENTE_FATURADO;
         }
       }
    }

    localSolicitacoes[solIndex] = updatedSol;
    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
    saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);

    try {
        const payload = { ...updatedSol };
        delete (payload as any).itens_solicitados; 
        delete (payload as any).itens_atendidos; // não envia complexo se DB n suportar
        delete (payload as any).nome_produto; 
        delete (payload as any).nome_cliente;
        delete (payload as any).numero_pedido;
        delete (payload as any).unidade;
        await supabase.from('solicitacoes').update(payload).eq('id', id);
    } catch(e) {}

    const acaoLabel = status === StatusSolicitacao.EM_ANALISE ? 'Enviado para Análise' :
                      status === StatusSolicitacao.FATURADO ? 'Nota Fiscal Emitida' :
                      status === StatusSolicitacao.REJEITADO ? `Bloqueado (${blockedByRole || 'Geral'})` :
                      status === StatusSolicitacao.APROVADO_PARA_FATURAMENTO ? 'Aprovado para Faturamento' : status;
    
    // Log com detalhes extras se houver corte de volume
    let detalhesLog = motivoRejeicao;
    if (status === StatusSolicitacao.FATURADO && itensAtendidos) {
       const resumoAtendido = itensAtendidos.map(i => `${i.nome_produto}: ${i.volume}`).join(', ');
       detalhesLog = `Faturado Parcial/Total: ${resumoAtendido}`;
    }
    if (status === StatusSolicitacao.EM_ANALISE && itensAtendidos) {
       const resumoTriagem = itensAtendidos.map(i => `${i.nome_produto}: ${i.volume}`).join(', ');
       detalhesLog = `Triagem realizada. Itens para análise: ${resumoTriagem}`;
    }

    await logEvento(updatedSol.pedido_id, user, acaoLabel, detalhesLog, status === StatusSolicitacao.REJEITADO ? 'ALERTA' : 'SUCESSO');
  },

  approveSolicitacaoStep: async (
    id: string, 
    role: Role, 
    user: User, 
    obs?: string,
    itensAprovados?: { nome_produto: string, volume: number, unidade: string }[],
    itensRejeitados?: { nome_produto: string, volume: number, unidade: string, obs: string }[]
  ) => {
    const sol = localSolicitacoes.find(s => s.id === id);
    if (!sol) return;

    const updates: any = {};
    if (role === Role.COMERCIAL) { updates.aprovacao_comercial = true; updates.obs_comercial = obs; }
    if (role === Role.CREDITO) { updates.aprovacao_credito = true; updates.obs_credito = obs; }

    const index = localSolicitacoes.findIndex(s => s.id === id);
    let updatedSol = { ...localSolicitacoes[index], ...updates };

    // LÓGICA DE SPLIT (APROVAÇÃO PARCIAL)
    // Se houver itens rejeitados, cria nova solicitação rejeitada e remove da atual
    if (itensRejeitados && itensRejeitados.length > 0 && itensAprovados) {
        const pedido = localPedidos.find(p => p.id === sol.pedido_id);
        
        // 1. Criar solicitação REJEITADA com os itens negados
        const rejectionItems: ItemSolicitado[] = itensRejeitados.map(i => ({
             nome_produto: i.nome_produto,
             volume: i.volume,
             unidade: i.unidade,
             obs: i.obs
        }));
        
        let valorRejeitado = 0;
        let nomesRejeitados = "";
        
        // Devolve volume para o pedido e calcula valor rejeitado
        if (pedido) {
            itensRejeitados.forEach(rej => {
                const itemP = pedido.itens.find(p => p.nome_produto === rej.nome_produto);
                if (itemP) {
                    itemP.volume_restante += rej.volume;
                    valorRejeitado += rej.volume * itemP.valor_unitario;
                    nomesRejeitados += `${rej.nome_produto} (${rej.obs}); `;
                }
            });
            // Recalcula totais do pedido
            pedido.volume_restante = pedido.itens.reduce((acc, i) => acc + i.volume_restante, 0);
        }

        const novaRejeitada: SolicitacaoFaturamento = {
            ...sol,
            id: `req-rej-${Date.now()}`,
            itens_solicitados: rejectionItems,
            volume_solicitado: rejectionItems.reduce((acc, i) => acc + i.volume, 0),
            valor_solicitado: valorRejeitado,
            nome_produto: "Devolução: " + rejectionItems.map(i => i.nome_produto).join(', '),
            status: StatusSolicitacao.REJEITADO,
            blocked_by: role,
            motivo_rejeicao: `[${role}] Itens reprovados durante análise: ${nomesRejeitados}`,
            data_solicitacao: new Date().toISOString(),
            // Limpa aprovações na nova (ela nasce morta/rejeitada)
            aprovacao_comercial: false,
            aprovacao_credito: false
        };
        localSolicitacoes.push(novaRejeitada);
        
        // --- ENVIO DE E-MAIL DA REJEIÇÃO PARCIAL ---
        const creatorUser = localUsers.find(u => u.name === sol.criado_por);
        let managerUser: User | undefined;
        if (creatorUser) {
            if (creatorUser.manager_id) managerUser = localUsers.find(u => u.id === creatorUser.manager_id);
            const recipients = [creatorUser.email];
            if (managerUser && managerUser.email) recipients.push(managerUser.email);

            if (recipients.length > 0 && recipients[0]) {
               const htmlContent = generateBlockEmailTemplate({
                   vendorName: creatorUser.name,
                   managerName: managerUser ? managerUser.name : undefined,
                   orderNumber: sol.numero_pedido,
                   clientName: sol.nome_cliente,
                   reason: `[${role}] Devolução parcial na conferência`,
                   blockerName: user.name,
                   blockerRole: getRoleLabel(user.role),
                   rejectedItems: nomesRejeitados
               });

               const emailBody = `
                 Olá ${creatorUser.name}${managerUser ? ` (C/C: ${managerUser.name})` : ''},
                 
                 Houve uma REJEIÇÃO PARCIAL no pedido ${sol.numero_pedido} durante a conferência comercial.
                 
                 Itens Devolvidos: ${nomesRejeitados}
                 Responsável: ${user.name}
                 
                 O restante do pedido segue aprovado.
               `;
               sendEmailToScript({
                   to: recipients.join(','),
                   subject: `⚠️ Devolução Parcial: Pedido ${sol.numero_pedido} - Cropflow`,
                   body: emailBody,
                   htmlBody: htmlContent, // HTML formatado
                   action: 'notification'
               }).catch(err => console.error("Falha ao enviar email de bloqueio parcial", err));
            }
        }
        
        try {
           const rejPayload = { ...novaRejeitada };
           delete (rejPayload as any).id;
           delete (rejPayload as any).itens_solicitados; 
           await supabase.from('solicitacoes').insert(rejPayload);
        } catch(e) {}

        // 2. Atualizar a solicitação ATUAL apenas com os aprovados
        const aprovadosItems: ItemSolicitado[] = itensAprovados.map(i => ({
            nome_produto: i.nome_produto,
            volume: i.volume,
            unidade: i.unidade
        }));

        let novoValorAprovado = 0;
        if (pedido) {
            aprovadosItems.forEach(ap => {
                const itemP = pedido.itens.find(p => p.nome_produto === ap.nome_produto);
                if (itemP) novoValorAprovado += ap.volume * itemP.valor_unitario;
            });
        }

        updatedSol.itens_solicitados = aprovadosItems;
        updatedSol.volume_solicitado = aprovadosItems.reduce((acc, i) => acc + i.volume, 0);
        updatedSol.valor_solicitado = novoValorAprovado;
        updatedSol.nome_produto = aprovadosItems.map(i => `${i.nome_produto}: ${i.volume} ${i.unidade}`).join(' | ');
        
        // Atualiza pedido salvo
        saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);
    }

    localSolicitacoes[index] = updatedSol;
    
    // Verifica aprovação total
    if (updatedSol.aprovacao_comercial && updatedSol.aprovacao_credito) {
        updatedSol.status = StatusSolicitacao.APROVADO_PARA_FATURAMENTO;
        updates.status = StatusSolicitacao.APROVADO_PARA_FATURAMENTO;
        await logEvento(sol.pedido_id, user, 'Aprovado para Faturamento', `Aprovação conjunta OK${obs ? ` | ${obs}` : ''}`, 'SUCESSO');
    } else {
        await logEvento(sol.pedido_id, user, `Aprovação Parcial (${role})`, obs, 'INFO');
    }
    
    saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
    try { 
        const payload = { ...updatedSol };
        // Limpa campos complexos antes de enviar update
        delete (payload as any).itens_solicitados;
        delete (payload as any).nome_produto; 
        delete (payload as any).nome_cliente;
        delete (payload as any).numero_pedido;
        delete (payload as any).unidade;
        await supabase.from('solicitacoes').update(payload).eq('id', id); 
    } catch(e) {}
  },

  unblockSolicitacao: async (id: string, user: User) => {
      const sol = localSolicitacoes.find(s => s.id === id);
      if (!sol) return;
      let newStatus = StatusSolicitacao.PENDENTE;
      let newAprovComercial = false;
      let newAprovCredito = false;

      if (sol.blocked_by === Role.FATURAMENTO) { newStatus = StatusSolicitacao.PENDENTE; } 
      else if (sol.blocked_by === Role.COMERCIAL) { newStatus = StatusSolicitacao.EM_ANALISE; newAprovCredito = sol.aprovacao_credito || false; }
      else if (sol.blocked_by === Role.CREDITO) { newStatus = StatusSolicitacao.EM_ANALISE; newAprovComercial = sol.aprovacao_comercial || false; }
      else { newStatus = StatusSolicitacao.PENDENTE; }
      
      const updates = {
          status: newStatus,
          blocked_by: null, motivo_rejeicao: null,
          aprovacao_comercial: newAprovComercial, aprovacao_credito: newAprovCredito,
          obs_comercial: sol.blocked_by === Role.COMERCIAL ? null : sol.obs_comercial,
          obs_credito: sol.blocked_by === Role.CREDITO ? null : sol.obs_credito
      };
      
      const index = localSolicitacoes.findIndex(s => s.id === id);
      localSolicitacoes[index] = { ...localSolicitacoes[index], ...updates }; // @ts-ignore
      saveToStorage(STORAGE_KEYS.SOLICITACOES, localSolicitacoes);
      try { await supabase.from('solicitacoes').update(updates).eq('id', id); } catch(e) {}
      await logEvento(sol.pedido_id, user, 'Desbloqueio Manual', 'Solicitação retornada', 'INFO');
  },

  getLogs: async (): Promise<LogSincronizacao[]> => { return localLogs.sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime()); },
  getLastSyncTime: async (): Promise<string | null> => { 
      const lastSuccess = localLogs.filter(l => l.sucesso).sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
      return lastSuccess ? lastSuccess.data : null;
  },

  triggerManualSync: async (tipo: 'MANUAL' | 'AUTOMATICO' = 'MANUAL') => {
    const csvUrl = currentConfig.csvUrl;
    if (!csvUrl) throw new Error("URL do CSV não configurada.");
    const directUrl = convertDriveLink(csvUrl);
    const proxies = [
        (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];

    let csvText = '';
    let lastError = null;

    for (const proxyGen of proxies) {
        try {
            const proxyUrl = proxyGen(directUrl);
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (proxyUrl.includes('allorigins')) { const data = await response.json(); csvText = data.contents; } 
            else { csvText = await response.text(); }
            if (csvText && csvText.length > 50) break;
        } catch (e) { lastError = e; }
    }

    if (!csvText) {
        const errorMessage = lastError instanceof Error ? lastError.message : "Erro desconhecido";
        const logEntry: LogSincronizacao = { id: `log-${Date.now()}`, data: new Date().toISOString(), tipo, arquivo: 'Google Drive Sync', sucesso: false, mensagens: [`Falha: ${errorMessage}`] };
        localLogs.unshift(logEntry); saveToStorage(STORAGE_KEYS.LOGS, localLogs);
        throw new Error(`Sync falhou: ${errorMessage}`);
    }

    try {
        const novosPedidos = parseCSV(csvText);
        if (novosPedidos.length === 0) throw new Error("Nenhum pedido válido encontrado.");

        let added = 0; let updated = 0;
        const currentDeletedIds = loadFromStorage(STORAGE_KEYS.DELETED_IDS, []);

        novosPedidos.forEach(novo => {
            if (currentDeletedIds.includes(String(novo.id))) return;
            const existsIdx = localPedidos.findIndex(p => String(p.id) === String(novo.id));
            if (existsIdx !== -1) {
                const existing = localPedidos[existsIdx];
                // Mesclar itens mantendo volumes já consumidos
                const itensMesclados = novo.itens.map(novoItem => {
                    const itemExistente = existing.itens.find(ie => ie.nome_produto === novoItem.nome_produto);
                    if (itemExistente) {
                        const diferencaVolume = novoItem.volume_total - itemExistente.volume_total;
                        return {
                            ...novoItem,
                            volume_restante: itemExistente.volume_restante + diferencaVolume,
                            volume_faturado: itemExistente.volume_faturado
                        };
                    }
                    return novoItem;
                });

                localPedidos[existsIdx] = { 
                    ...novo, 
                    itens: itensMesclados,
                    status: existing.status !== StatusPedido.PENDENTE ? existing.status : novo.status,
                    volume_faturado: existing.volume_faturado,
                    valor_faturado: existing.valor_faturado,
                    volume_restante: existing.volume_restante 
                };
                
                // Recalcula totais globais do pedido baseados nos itens mesclados
                localPedidos[existsIdx].volume_restante = itensMesclados.reduce((acc, i) => acc + i.volume_restante, 0);
                
                updated++;
            } else {
                localPedidos.push(novo);
                added++;
            }
        });

        saveToStorage(STORAGE_KEYS.PEDIDOS, localPedidos);
        
        const logEntry: LogSincronizacao = { id: `log-${Date.now()}`, data: new Date().toISOString(), tipo, arquivo: 'Google Drive Sync', sucesso: true, mensagens: [`Add: ${added}`, `Upd: ${updated}`] };
        localLogs.unshift(logEntry); saveToStorage(STORAGE_KEYS.LOGS, localLogs);
        
        return { added, updated };
    } catch (e: any) {
        const errorMsg = e.message || JSON.stringify(e);
        const logEntry: LogSincronizacao = { id: `log-${Date.now()}`, data: new Date().toISOString(), tipo, arquivo: 'Google Drive Sync', sucesso: false, mensagens: [`Erro: ${errorMsg}`] };
        localLogs.unshift(logEntry); saveToStorage(STORAGE_KEYS.LOGS, localLogs);
        throw e;
    }
  }
};