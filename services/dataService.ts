
import { Pedido, SolicitacaoFaturamento, LogSincronizacao, StatusPedido, StatusSolicitacao, Role, User } from '../types';
import { supabase } from './supabaseClient';

/* 
  === ARQUITETURA: SUPABASE + IA STUDIO ===
  
  --- SQL DE CORREÇÃO (Executar no Supabase SQL Editor) ---
  
  -- 1. Tabela de Usuários do Sistema (App Users)
  create table if not exists app_users (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    email text not null unique,
    role text not null,
    created_at timestamp with time zone default now()
  );

  -- 2. Políticas de Segurança
  alter table app_users enable row level security;
  create policy "Public Access Users" on app_users for all using (true) with check (true);

  -- 3. Inserir usuário Admin inicial (se vazio)
  insert into app_users (name, email, role)
  select 'Administrador', 'admin@cropfield.com', 'ADMIN'
  where not exists (select 1 from app_users where email = 'admin@cropfield.com');
*/

// --- DADOS REAIS PRÉ-CARREGADOS (FALLBACK) ---
const PRE_LOADED_PEDIDOS: Pedido[] = [
  {
    id: "42207551002959",
    numero_pedido: "426251",
    codigo_cliente: "222131",
    nome_cliente: "VIERA AGROCEREAIS LTDA",
    nome_produto: "ADJUVANTE - ZOM - B20",
    unidade: "B20",
    volume_total: 225,
    volume_restante: 225,
    valor_total: 63000,
    codigo_vendedor: "251932",
    nome_vendedor: "A. J. DEBONI & CIA LTDA",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-10-23"
  },
  {
    id: "42289761010756",
    numero_pedido: "427102",
    codigo_cliente: "80001",
    nome_cliente: "COMERCIO E REPRESENTACOES AGRICOLAS GOI SCARTON LTDA",
    nome_produto: "GLUFOSINATO AMONIO 880 SG (SILVER SG) - K10",
    unidade: "K10",
    volume_total: 1,
    volume_restante: 1,
    valor_total: 570,
    codigo_vendedor: "251932",
    nome_vendedor: "A. J. DEBONI & CIA LTDA",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-11-11"
  },
  {
    id: "42177831010921",
    numero_pedido: "425875",
    codigo_cliente: "222131",
    nome_cliente: "VIERA AGROCEREAIS LTDA",
    nome_produto: "DICLOSULAM 65 + FLUMIOXAZINA 145 + IMAZETAPIR 200 (PREDECESSOR) - G05",
    unidade: "GL",
    volume_total: 40,
    volume_restante: 40,
    valor_total: 42000,
    codigo_vendedor: "251932",
    nome_vendedor: "A. J. DEBONI & CIA LTDA",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-10-17"
  },
  {
    id: "42196251005444",
    numero_pedido: "426126",
    codigo_cliente: "215949",
    nome_cliente: "BOTTEGA & CIA LTDA",
    nome_produto: "BIOFIX FORCE BLUE - GL5",
    unidade: "G05",
    volume_total: 10,
    volume_restante: 10,
    valor_total: 1600,
    codigo_vendedor: "251932",
    nome_vendedor: "A. J. DEBONI & CIA LTDA",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-10-21"
  },
  {
    id: "41910581010819",
    numero_pedido: "422099",
    codigo_cliente: "80001",
    nome_cliente: "COMERCIO E REPRESENTACOES AGRICOLAS GOI SCARTON LTDA",
    nome_produto: "PICOXISTROBINA 200 + CIPROCONAZOL 80 (KROMSTAR) - G05",
    unidade: "G05",
    volume_total: 300,
    volume_restante: 300,
    valor_total: 198000,
    codigo_vendedor: "251932",
    nome_vendedor: "A. J. DEBONI & CIA LTDA",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-08-19"
  },
  {
    id: "42354481004309",
    numero_pedido: "427930",
    codigo_cliente: "253213",
    nome_cliente: "D-FARM DIST. DE ESPECIALIDADES LTDA",
    nome_produto: "GLUFOSINATO DE AMONIO 200 (OFF ROAD) - B20",
    unidade: "B20",
    volume_total: 150,
    volume_restante: 150,
    valor_total: 46500,
    codigo_vendedor: "745842",
    nome_vendedor: "DANTE LUIS DAMIANI",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-11-26"
  },
  {
    id: "42212011010077",
    numero_pedido: "426291",
    codigo_cliente: "243683",
    nome_cliente: "EVOLUCAO AGRICOLA LTDA",
    nome_produto: "LAMBDA CIALOTRINA 250 (JUDOKA SUPER 250 CS) - G10",
    unidade: "G10",
    volume_total: 3,
    volume_restante: 3,
    valor_total: 1350,
    codigo_vendedor: "745842",
    nome_vendedor: "DANTE LUIS DAMIANI",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-10-24"
  },
  {
    id: "41994901010819",
    numero_pedido: "423449",
    codigo_cliente: "253213",
    nome_cliente: "D-FARM DIST. DE ESPECIALIDADES LTDA",
    nome_produto: "PICOXISTROBINA 200 + CIPROCONAZOL 80 (KROMSTAR) - G05",
    unidade: "G05",
    volume_total: 200,
    volume_restante: 200,
    valor_total: 112500,
    codigo_vendedor: "745842",
    nome_vendedor: "DANTE LUIS DAMIANI",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-09-09"
  },
  {
    id: "42156701011052",
    numero_pedido: "425586",
    codigo_cliente: "258626",
    nome_cliente: "PITANGA COMERCIO IMPORTACAO E EXPORTACAO DE PRODUTOS AGROPECUARIOS LTDA",
    nome_produto: "INOCULANTE CROPBIO SOJA BRADYRHIZOBIUM JAPONICUM",
    unidade: "F3",
    volume_total: 52,
    volume_restante: 52,
    valor_total: 3120,
    codigo_vendedor: "238772",
    nome_vendedor: "FABIO DA ROCHA CORBELLINI EIRELI",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-10-13"
  },
  {
    id: "42030701005444",
    numero_pedido: "423925",
    codigo_cliente: "258626",
    nome_cliente: "PITANGA COMERCIO IMPORTACAO E EXPORTACAO",
    nome_produto: "BIOFIX FORCE BLUE - GL5",
    unidade: "G05",
    volume_total: 12,
    volume_restante: 12,
    valor_total: 3600,
    codigo_vendedor: "238772",
    nome_vendedor: "FABIO DA ROCHA CORBELLINI EIRELI",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-09-17"
  },
  {
    id: "42208461009684",
    numero_pedido: "426261",
    codigo_cliente: "255698",
    nome_cliente: "INAGRO INSUMOS AGRICOLAS E COM DE GRAOS LTDA",
    nome_produto: "TIOFANATO METILICO 350 + FLUAZINAM 52,50 (TORINO) - GL5",
    unidade: "GL",
    volume_total: 60,
    volume_restante: 60,
    valor_total: 30000,
    codigo_vendedor: "255340",
    nome_vendedor: "DESESSARDS E VIEIRA REPRESENTACOES LTDA",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-10-23"
  },
  {
    id: "42060351002959",
    numero_pedido: "424305",
    codigo_cliente: "216790",
    nome_cliente: "PLANTECNICA SOLUCOES AGRICOLAS LTDA",
    nome_produto: "ADJUVANTE - ZOM - B20",
    unidade: "B20",
    volume_total: 45,
    volume_restante: 45,
    valor_total: 13500,
    codigo_vendedor: "255340",
    nome_vendedor: "DESESSARDS E VIEIRA REPRESENTACOES LTDA",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-09-23"
  },
  {
    id: "42228861010773",
    numero_pedido: "426449",
    codigo_cliente: "287844",
    nome_cliente: "AGROCEREAIS VAN RIEL LTDA",
    nome_produto: "PICOXISTROBINA 200 + PROTIOCONAZOL 240 (DOTTE) - G05",
    unidade: "G05",
    volume_total: 40,
    volume_restante: 40,
    valor_total: 59200,
    codigo_vendedor: "242075",
    nome_vendedor: "VALDECIR ALVES DE OLIVEIRA-ME",
    status: StatusPedido.PENDENTE,
    data_criacao: "2025-10-29"
  }
];

let localPedidos: Pedido[] = [...PRE_LOADED_PEDIDOS];
let localSolicitacoes: SolicitacaoFaturamento[] = [];
let localLogs: LogSincronizacao[] = [];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Administrador', role: Role.ADMIN, email: 'admin@cropfield.com' },
  { id: 'u2', name: 'Gerente Comercial', role: Role.GERENTE, email: 'gerente@cropfield.com' },
  { id: 'u3', name: 'Analista Faturamento', role: Role.FATURAMENTO, email: 'faturamento@cropfield.com' },
  { id: 'u4', name: 'A. J. DEBONI & CIA LTDA', role: Role.VENDEDOR, email: 'deboni@cropfield.com' },
  { id: 'u5', name: 'DANTE LUIS DAMIANI', role: Role.VENDEDOR, email: 'dante@cropfield.com' },
];

let localUsers: User[] = [...MOCK_USERS];

// Link direto para download do Google Drive
const FILE_ID = '1ifetFw_-dbBGrUQrupy9luJqxuD6sMVy';
const DRIVE_EXPORT_URL = `https://drive.google.com/uc?export=download&id=${FILE_ID}`;
const CORS_PROXY = 'https://corsproxy.io/?';

const getErrorMessage = (error: any): string => {
  if (!error) return 'Erro desconhecido';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return JSON.stringify(error);
};

// Função auxiliar para converter string PT-BR (1.000,00) para float JS (1000.00)
const parseBrazilianNumber = (value: string): number => {
  if (!value) return 0;
  // Se já for numérico (do JS/JSON), retorna direto
  if (typeof value === 'number') return value;
  
  // Remove pontos de milhar e substitui vírgula decimal por ponto
  const cleanValue = value.replace(/\./g, '').replace(',', '.');
  const number = parseFloat(cleanValue);
  return isNaN(number) ? 0 : number;
};

const parsePedidosFromCSV = (csvData: string): any[] => {
  const lines = csvData.trim().split('\n');
  // Detecta se a primeira linha é cabeçalho
  const startIndex = lines[0].includes('ID;') || lines[0].includes('COD_EMPRESA') ? 1 : 0;
  const parsedPedidos: any[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    const cols = line.split(';');
    
    // Validação básica de colunas
    if (cols.length < 18) continue;

    // Normalização de Vendedor
    let nomeVendedor = cols[11];
    const upperVendor = nomeVendedor?.trim().toUpperCase();
    if (['VENDEDOR INATIVO 001', 'CROPFIELD'].includes(upperVendor)) {
      nomeVendedor = 'DANTE LUIS DAMIANI';
    }

    const volume = parseBrazilianNumber(cols[17]);
    const valor = parseBrazilianNumber(cols[18]);
    const unidade = cols[15] || 'UN'; // Coluna 15 é a Unidade (B20, GL5, etc)

    const pedido = {
      // Mapeando para as colunas do Banco de Dados (Supabase)
      id: cols[0] || `auto-${i}-${Date.now()}`, 
      numero_pedido: cols[3],
      codigo_cliente: cols[5],
      nome_cliente: cols[6],
      nome_produto: cols[16],
      unidade: unidade,
      volume_total: volume,
      volume_restante: volume, // Inicialmente igual ao total
      valor_total: valor,
      codigo_vendedor: cols[12],
      nome_vendedor: nomeVendedor,
      status: StatusPedido.PENDENTE,
      data_criacao: cols[4]?.split(' ')[0] || new Date().toISOString().split('T')[0]
    };
    parsedPedidos.push(pedido);
  }
  return parsedPedidos;
};

// Helper para filtrar pedidos (usado tanto no Supabase quanto no Fallback)
const filterDataByRole = (data: Pedido[], user: User) => {
  if (user.role === Role.VENDEDOR) {
    return data.filter(p => 
      p.nome_vendedor && p.nome_vendedor.toLowerCase().includes(user.name.toLowerCase())
    );
  }
  return data;
};

export const api = {
  // --- USERS MANAGEMENT ---
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('app_users').select('*').order('name');
      if (error) throw error;
      if (data && data.length > 0) {
        localUsers = data as User[];
        return data as User[];
      }
      return localUsers;
    } catch (e) {
      console.warn("Using Local Users (Fallback):", getErrorMessage(e));
      return localUsers;
    }
  },

  createUser: async (user: Omit<User, 'id'>): Promise<User> => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .insert(user)
        .select()
        .single();
      
      if (error) throw error;
      localUsers.push(data as User);
      return data as User;
    } catch (e) {
      console.warn("Creating User Locally (Fallback):", getErrorMessage(e));
      const newUser = { ...user, id: `loc-u-${Date.now()}` };
      localUsers.push(newUser);
      return newUser;
    }
  },

  updateUser: async (user: User): Promise<User> => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .update({ name: user.name, email: user.email, role: user.role })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      // Update local cache
      const index = localUsers.findIndex(u => u.id === user.id);
      if (index !== -1) localUsers[index] = data as User;
      
      return data as User;
    } catch (e) {
      console.warn("Updating User Locally (Fallback):", getErrorMessage(e));
      const index = localUsers.findIndex(u => u.id === user.id);
      if (index !== -1) {
        localUsers[index] = user;
        return user;
      }
      throw e;
    }
  },

  deleteUser: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from('app_users').delete().eq('id', id);
      if (error) throw error;
      localUsers = localUsers.filter(u => u.id !== id);
    } catch (e) {
      console.warn("Deleting User Locally (Fallback):", getErrorMessage(e));
      localUsers = localUsers.filter(u => u.id !== id);
    }
  },

  // --- PEDIDOS & SOLICITAÇÕES ---

  getPedidos: async (user: User): Promise<Pedido[]> => {
    try {
      const { data, error } = await supabase.from('pedidos').select('*');
      if (error) {
        throw error;
      }
      if (!data || data.length === 0) {
        return filterDataByRole(localPedidos, user);
      }
      localPedidos = data as Pedido[];
      return filterDataByRole(data as Pedido[], user);
    } catch (error) {
      console.warn("Modo Offline (Pedidos):", getErrorMessage(error));
      return filterDataByRole(localPedidos, user);
    }
  },

  getSolicitacoes: async (user: User): Promise<SolicitacaoFaturamento[]> => {
    try {
      const { data, error } = await supabase.from('solicitacoes').select('*');
      if (error) throw error;
      localSolicitacoes = data as SolicitacaoFaturamento[];
      return data as SolicitacaoFaturamento[];
    } catch (error) {
      console.warn("Modo Offline (Solicitacoes):", getErrorMessage(error));
      return localSolicitacoes;
    }
  },

  // NOVA FUNÇÃO: Buscar solicitações de um pedido específico
  getSolicitacoesByPedido: async (pedidoId: string): Promise<SolicitacaoFaturamento[]> => {
    try {
      const { data, error } = await supabase
        .from('solicitacoes')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('data_solicitacao', { ascending: false });
      
      if (error) throw error;
      return data as SolicitacaoFaturamento[];
    } catch (error) {
      console.warn("Modo Offline (Solicitacoes Pedido):", getErrorMessage(error));
      return localSolicitacoes.filter(s => s.pedido_id === pedidoId);
    }
  },

  getLogs: async (): Promise<LogSincronizacao[]> => {
    try {
      const { data, error } = await supabase
        .from('logs_sincronizacao')
        .select('*')
        .order('data', { ascending: false });
      
      if (error) throw error;
      return data as LogSincronizacao[];
    } catch (error) {
      console.warn("Modo Offline (Logs):", getErrorMessage(error));
      return [...localLogs].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    }
  },

  createSolicitacao: async (pedidoId: string, volume: number, user: User) => {
    let dbPedido: Pedido | null = null;

    try {
      // 1. Tentar buscar no Supabase
      const { data: pedidoData, error: fetchError } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single();

      if (!fetchError && pedidoData) {
        dbPedido = pedidoData as Pedido;
        const pedido = dbPedido;

        if (volume > pedido.volume_restante) {
          throw new Error(`Volume solicitado (${volume}) excede o saldo (${pedido.volume_restante})`);
        }

        const newSolicitacao = {
          pedido_id: pedidoId,
          numero_pedido: pedido.numero_pedido,
          nome_cliente: pedido.nome_cliente,
          unidade: pedido.unidade || 'UN',
          volume_solicitado: volume,
          status: StatusSolicitacao.PENDENTE,
          criado_por: user.name,
          data_solicitacao: new Date().toISOString().split('T')[0]
        };

        const { data: created, error: insertError } = await supabase
          .from('solicitacoes')
          .insert(newSolicitacao)
          .select()
          .single();
        
        if (insertError) {
          console.error("DB Insert Error:", insertError);
          throw new Error(`Erro ao salvar solicitação no banco: ${insertError.message}`);
        }

        // Atualizar Pedido no Banco
        const novoVolume = Number((pedido.volume_restante - volume).toFixed(4));
        const novoStatus = novoVolume === 0 ? StatusPedido.FATURADO : StatusPedido.PARCIALMENTE_FATURADO;

        const { error: updateError } = await supabase.from('pedidos').update({ 
          volume_restante: novoVolume, 
          status: novoStatus 
        }).eq('id', pedidoId);

        if (updateError) {
           console.error("DB Update Error:", updateError);
           // Não lançamos erro fatal aqui pois a solicitação foi criada, mas logamos
        }

        return created;
      } else {
        throw new Error(fetchError ? `Erro ao buscar pedido: ${getErrorMessage(fetchError)}` : "Pedido não encontrado no banco");
      }

    } catch (error: any) {
      console.warn("Fallback createSolicitacao triggered due to:", getErrorMessage(error));
      
      // AUTO-REPAIR LOCAL MEMORY
      if (dbPedido) {
        const existsLocally = localPedidos.some(p => p.id === dbPedido!.id);
        if (!existsLocally) {
          localPedidos.push(dbPedido);
        } else {
          const idx = localPedidos.findIndex(p => p.id === dbPedido!.id);
          localPedidos[idx] = dbPedido;
        }
      }

      // FALLBACK LOGIC
      const pedidoIndex = localPedidos.findIndex(p => p.id === pedidoId);
      if (pedidoIndex === -1) throw new Error(`Pedido não encontrado na memória local (ID: ${pedidoId}). Tente sincronizar novamente.`);
      
      const pedido = localPedidos[pedidoIndex];
      if (volume > pedido.volume_restante) throw new Error(`Saldo insuficiente (Local). Disp: ${pedido.volume_restante}`);

      const newSol: SolicitacaoFaturamento = {
        id: `sol-${Date.now()}`,
        pedido_id: pedidoId,
        numero_pedido: pedido.numero_pedido,
        nome_cliente: pedido.nome_cliente,
        unidade: pedido.unidade || 'UN',
        volume_solicitado: volume,
        status: StatusSolicitacao.PENDENTE,
        criado_por: user.name,
        data_solicitacao: new Date().toISOString().split('T')[0]
      };
      
      localSolicitacoes.push(newSol);
      
      // Update local pedido
      localPedidos[pedidoIndex].volume_restante = Number((pedido.volume_restante - volume).toFixed(4));
      if (localPedidos[pedidoIndex].volume_restante === 0) {
        localPedidos[pedidoIndex].status = StatusPedido.FATURADO;
      } else {
        localPedidos[pedidoIndex].status = StatusPedido.PARCIALMENTE_FATURADO;
      }

      return newSol;
    }
  },

  updateSolicitacaoStatus: async (id: string, status: StatusSolicitacao, user: User) => {
    try {
      const { data: sol, error: fetchError } = await supabase.from('solicitacoes').select('*').eq('id', id).single();
      
      if (sol && !fetchError) {
        const updateData: any = { status };
        if (status === StatusSolicitacao.APROVADO || status === StatusSolicitacao.FATURADO) {
          updateData.aprovado_por = user.name;
        }
        await supabase.from('solicitacoes').update(updateData).eq('id', id);

        if (status === StatusSolicitacao.REJEITADO) {
          const { data: pedido } = await supabase.from('pedidos').select('*').eq('id', sol.pedido_id).single();
          if (pedido) {
            const restored = Number((pedido.volume_restante + sol.volume_solicitado).toFixed(4));
            const st = restored >= pedido.volume_total ? StatusPedido.PENDENTE : StatusPedido.PARCIALMENTE_FATURADO;
            await supabase.from('pedidos').update({ volume_restante: restored, status: st }).eq('id', pedido.id);
          }
        }
        return;
      }
      throw new Error("Supabase unavailable for update");

    } catch (e) {
      console.warn("Fallback updateSolicitacaoStatus");
      const idx = localSolicitacoes.findIndex(s => s.id === id);
      if (idx !== -1) {
        localSolicitacoes[idx].status = status;
        if (status === StatusSolicitacao.APROVADO || status === StatusSolicitacao.FATURADO) {
          localSolicitacoes[idx].aprovado_por = user.name;
        }
        
        if (status === StatusSolicitacao.REJEITADO) {
           const pIdx = localPedidos.findIndex(p => p.id === localSolicitacoes[idx].pedido_id);
           if (pIdx !== -1) {
             const p = localPedidos[pIdx];
             const restored = Number((p.volume_restante + localSolicitacoes[idx].volume_solicitado).toFixed(4));
             localPedidos[pIdx].volume_restante = restored;
             localPedidos[pIdx].status = restored >= p.volume_total ? StatusPedido.PENDENTE : StatusPedido.PARCIALMENTE_FATURADO;
           }
        }
      }
    }
  },

  triggerManualSync: async (): Promise<LogSincronizacao> => {
    const logId = `LOG-${Date.now()}`;
    const logData = {
      id: logId,
      data: new Date().toISOString(),
      tipo: 'MANUAL' as const,
      arquivo: 'carteira_pedidos.csv',
      sucesso: false,
      mensagens: [] as string[]
    };

    try {
      console.log("Iniciando sync...");
      logData.mensagens.push("Conectando ao Google Drive...");

      const response = await fetch(CORS_PROXY + encodeURIComponent(DRIVE_EXPORT_URL));
      if (!response.ok) throw new Error(`Falha no download (Status: ${response.status})`);
      
      const csvText = await response.text();
      
      if (csvText.trim().toLowerCase().startsWith('<!doctype html')) {
        throw new Error("O Google Drive retornou uma página HTML. Link de download inválido ou arquivo muito grande.");
      }

      logData.mensagens.push("Arquivo baixado. Processando...");

      const novosPedidos = parsePedidosFromCSV(csvText);
      if (novosPedidos.length === 0) throw new Error("CSV vazio ou inválido");

      logData.mensagens.push(`${novosPedidos.length} pedidos encontrados.`);

      const BATCH_SIZE = 100;
      let upsertedCount = 0;
      let errorOccurred = false;
      let errorMessage = "";

      for (let i = 0; i < novosPedidos.length; i += BATCH_SIZE) {
        const batch = novosPedidos.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('pedidos').upsert(batch, { onConflict: 'id' });
        
        if (error) {
          errorOccurred = true;
          errorMessage = getErrorMessage(error);
          break; 
        }
        upsertedCount += batch.length;
      }
      
      if (errorOccurred) {
        logData.mensagens.push(`Aviso: Erro ao sincronizar com banco (${errorMessage}). Usando memória local.`);
        console.warn("Supabase Sync Failed:", errorMessage);
        
        novosPedidos.forEach(np => {
          const existingIdx = localPedidos.findIndex(lp => lp.id === np.id);
          if (existingIdx === -1) {
            localPedidos.push(np);
          }
        });
      } else {
        logData.mensagens.push(`Sucesso: ${upsertedCount} pedidos sincronizados no banco.`);
      }

      logData.sucesso = true;
      localLogs.unshift(logData as any);

      const { error: logDbError } = await supabase.from('logs_sincronizacao').insert(logData);
      if (logDbError) console.warn("Falha ao salvar log:", logDbError);

      return logData as any;

    } catch (error: any) {
      console.error("Sync Error Critical:", error);
      logData.sucesso = false;
      logData.mensagens.push("Erro crítico: " + getErrorMessage(error));
      localLogs.unshift(logData as any);
      return logData as any;
    }
  }
};
