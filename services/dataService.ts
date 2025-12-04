import { Pedido, SolicitacaoFaturamento, LogSincronizacao, StatusPedido, StatusSolicitacao, Role, User } from '../types';
import { supabase } from './supabaseClient';

/* 
  === ARQUITETURA: SUPABASE + IA STUDIO ===
  
  --- SQL DE CORREÇÃO CRÍTICA (Executar no Supabase SQL Editor) ---
  
  1. Adicionar colunas faltantes para o fluxo de aprovação e correções:
  
  ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS unidade text;
  ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS aprovacao_comercial boolean DEFAULT false;
  ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS aprovacao_credito boolean DEFAULT false;
  ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS obs_comercial text;
  ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS obs_credito text;
  ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS motivo_rejeicao text;
  
  2. Atualizar Políticas de Segurança (RLS) para permitir atualizações:
  
  drop policy if exists "Public Access Pedidos" on pedidos;
  drop policy if exists "Public Access Solicitacoes" on solicitacoes;
  
  create policy "Public Access Pedidos" on pedidos for all using (true) with check (true);
  create policy "Public Access Solicitacoes" on solicitacoes for all using (true) with check (true);
*/

// --- DADOS REAIS PRÉ-CARREGADOS (FALLBACK) ---
const PRE_LOADED_PEDIDOS: Pedido[] = []; // Lista limpa para forçar sincronização real

let localPedidos: Pedido[] = [...PRE_LOADED_PEDIDOS];
let localSolicitacoes: SolicitacaoFaturamento[] = [];
let localLogs: LogSincronizacao[] = [];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Administrador', role: Role.ADMIN, email: 'administrador@grupocropfield.com.br' },
  { id: 'u2', name: 'Gerente Comercial', role: Role.GERENTE, email: 'gerente@cropflow.com' },
  { id: 'u3', name: 'Analista Faturamento', role: Role.FATURAMENTO, email: 'faturamento@cropflow.com' },
  { id: 'u6', name: 'Diretor Comercial', role: Role.COMERCIAL, email: 'comercial@cropflow.com' },
  { id: 'u7', name: 'Analista Crédito', role: Role.CREDITO, email: 'credito@cropflow.com' },
  { id: 'u4', name: 'A. J. DEBONI & CIA LTDA', role: Role.VENDEDOR, email: 'deboni@cropflow.com' },
  { id: 'u5', name: 'DANTE LUIS DAMIANI', role: Role.VENDEDOR, email: 'dante@cropflow.com' },
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

// Função auxiliar mais inteligente para converter números
const parseBrazilianNumber = (value: string): number => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  
  const strVal = String(value).trim();
  
  // Se contém vírgula, assume formato BR (1.000,00) -> remove ponto milhar, troca virgula por ponto
  if (strVal.includes(',')) {
    const cleanValue = strVal.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  }
  
  // Se não tem vírgula, assume formato Internacional/Banco (1000.00) -> mantém o ponto
  return parseFloat(strVal) || 0;
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

// Auxiliar para obter rótulo do cargo
const getRoleLabel = (role: Role) => {
  switch(role) {
    case Role.FATURAMENTO: return 'FATURAMENTO';
    case Role.COMERCIAL: return 'COMERCIAL';
    case Role.CREDITO: return 'CRÉDITO';
    case Role.ADMIN: return 'ADMINISTRADOR';
    default: return 'SISTEMA';
  }
};

export const api = {
  // --- AUTHENTICATION ---
  checkConnection: async (): Promise<boolean> => {
    try {
      const { error } = await supabase.from('pedidos').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  },

  login: async (email: string, password: string): Promise<User> => {
    if (email.trim() === 'administrador@grupocropfield.com.br' && password === 'Cp261121@!') {
      const adminUser = localUsers.find(u => u.email === email) || {
        id: 'u1',
        name: 'Administrador',
        role: Role.ADMIN,
        email: email
      };
      return adminUser;
    }

    const user = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (user && user.role !== Role.ADMIN) {
      return user;
    }

    throw new Error('Credenciais inválidas ou usuário não encontrado.');
  },

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
      // CORREÇÃO: Sincroniza memória local com DB para garantir fallback funcional
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
      // CORREÇÃO: Sincroniza memória local com DB
      localSolicitacoes = data as SolicitacaoFaturamento[];
      return data as SolicitacaoFaturamento[];
    } catch (error) {
      console.warn("Modo Offline (Solicitacoes):", getErrorMessage(error));
      return localSolicitacoes;
    }
  },

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
          data_solicitacao: new Date().toISOString().split('T')[0],
          aprovacao_comercial: false,
          aprovacao_credito: false
        };

        const { data: created, error: insertError } = await supabase
          .from('solicitacoes')
          .insert(newSolicitacao)
          .select()
          .single();
        
        if (insertError) {
          console.error("DB Insert Error (Likely Missing Columns):", JSON.stringify(insertError));
          // Se falhar no insert (ex: schema desatualizado), forçamos erro para cair no catch e salvar localmente
          throw new Error(`Erro ao salvar solicitação no banco: ${insertError.message || JSON.stringify(insertError)}`);
        }

        // Atualizar Pedido no Banco
        const novoVolume = Number((pedido.volume_restante - volume).toFixed(4));
        const novoStatus = novoVolume === 0 ? StatusPedido.FATURADO : StatusPedido.PARCIALMENTE_FATURADO;

        await supabase.from('pedidos').update({ 
          volume_restante: novoVolume, 
          status: novoStatus 
        }).eq('id', pedidoId);

        return created;
      } else {
        throw new Error(fetchError ? `Erro ao buscar pedido: ${getErrorMessage(fetchError)}` : "Pedido não encontrado no banco");
      }

    } catch (error: any) {
      console.warn("Ativando modo de fallback para Solicitação:", getErrorMessage(error));
      
      // AUTO-REPAIR LOCAL MEMORY (Fundamental para o Fallback funcionar)
      if (dbPedido) {
        const existsLocally = localPedidos.some(p => p.id === dbPedido!.id);
        if (!existsLocally) {
          localPedidos.push(dbPedido);
        } else {
          // Atualiza dados locais com o que veio do banco antes de falhar
          const idx = localPedidos.findIndex(p => p.id === dbPedido!.id);
          localPedidos[idx] = dbPedido;
        }
      }

      // FALLBACK LOGIC
      const pedidoIndex = localPedidos.findIndex(p => p.id === pedidoId);
      if (pedidoIndex === -1) throw new Error(`Pedido não encontrado na memória local (ID: ${pedidoId}). Tente sincronizar novamente.`);
      
      // --- SELF-HEALING FIX: Recalcula saldo antes de validar ---
      // Garante que o saldo local está correto subtraindo apenas solicitações ativas
      const activeSolicitacoes = localSolicitacoes.filter(s => 
        s.pedido_id === pedidoId && 
        s.status !== StatusSolicitacao.REJEITADO
      );
      const consumed = activeSolicitacoes.reduce((acc, curr) => acc + curr.volume_solicitado, 0);
      const currentRestante = Number((localPedidos[pedidoIndex].volume_total - consumed).toFixed(4));
      
      // Atualiza o objeto local com o saldo real calculado
      localPedidos[pedidoIndex].volume_restante = currentRestante;
      if (currentRestante <= 0 && localPedidos[pedidoIndex].volume_total > 0) {
         localPedidos[pedidoIndex].status = StatusPedido.FATURADO;
      } else if (consumed > 0) {
         localPedidos[pedidoIndex].status = StatusPedido.PARCIALMENTE_FATURADO;
      }
      // -----------------------------------------------------------

      const pedido = localPedidos[pedidoIndex];
      
      if (volume > pedido.volume_restante) {
        throw new Error(`Saldo insuficiente. Disp: ${pedido.volume_restante} ${pedido.unidade}. (Tentativa: ${volume})`);
      }

      const newSol: SolicitacaoFaturamento = {
        id: `sol-local-${Date.now()}`,
        pedido_id: pedidoId,
        numero_pedido: pedido.numero_pedido,
        nome_cliente: pedido.nome_cliente,
        unidade: pedido.unidade || 'UN',
        volume_solicitado: volume,
        status: StatusSolicitacao.PENDENTE,
        criado_por: user.name,
        data_solicitacao: new Date().toISOString().split('T')[0],
        aprovacao_comercial: false,
        aprovacao_credito: false
      };
      
      localSolicitacoes.push(newSol);
      
      localPedidos[pedidoIndex].volume_restante = Number((pedido.volume_restante - volume).toFixed(4));
      if (localPedidos[pedidoIndex].volume_restante === 0) {
        localPedidos[pedidoIndex].status = StatusPedido.FATURADO;
      } else {
        localPedidos[pedidoIndex].status = StatusPedido.PARCIALMENTE_FATURADO;
      }

      return newSol;
    }
  },

  // FUNÇÃO ESPECIALIZADA PARA APROVAÇÃO PARALELA
  approveSolicitacaoStep: async (id: string, role: Role, user: User, observation?: string) => {
    try {
      const { data: sol, error } = await supabase.from('solicitacoes').select('*').eq('id', id).single();
      if (error || !sol) throw new Error("Solicitação não encontrada");

      const updateData: any = {};
      
      if (role === Role.COMERCIAL) {
        updateData.aprovacao_comercial = true;
        if (observation) updateData.obs_comercial = observation;
      }
      if (role === Role.CREDITO) {
        updateData.aprovacao_credito = true;
        if (observation) updateData.obs_credito = observation;
      }

      const isComercialNowApproved = role === Role.COMERCIAL ? true : sol.aprovacao_comercial;
      const isCreditoNowApproved = role === Role.CREDITO ? true : sol.aprovacao_credito;

      if (isComercialNowApproved && isCreditoNowApproved) {
        updateData.status = StatusSolicitacao.APROVADO_PARA_FATURAMENTO;
      }

      await supabase.from('solicitacoes').update(updateData).eq('id', id);

    } catch (e) {
      console.warn("Fallback approveStep");
      const idx = localSolicitacoes.findIndex(s => s.id === id);
      if (idx !== -1) {
        if (role === Role.COMERCIAL) {
          localSolicitacoes[idx].aprovacao_comercial = true;
          if (observation) localSolicitacoes[idx].obs_comercial = observation;
        }
        if (role === Role.CREDITO) {
          localSolicitacoes[idx].aprovacao_credito = true;
          if (observation) localSolicitacoes[idx].obs_credito = observation;
        }
        
        if (localSolicitacoes[idx].aprovacao_comercial && localSolicitacoes[idx].aprovacao_credito) {
          localSolicitacoes[idx].status = StatusSolicitacao.APROVADO_PARA_FATURAMENTO;
        }
      }
    }
  },

  updateSolicitacaoStatus: async (id: string, status: StatusSolicitacao, user: User, motivoRejeicao?: string) => {
    let formattedReason = motivoRejeicao;
    
    if (status === StatusSolicitacao.REJEITADO && motivoRejeicao) {
      const prefix = getRoleLabel(user.role);
      formattedReason = `[BLOQUEIO: ${prefix}] ${motivoRejeicao}`;
    }

    try {
      const { data: sol, error: fetchError } = await supabase.from('solicitacoes').select('*').eq('id', id).single();
      
      if (sol && !fetchError) {
        const updateData: any = { status };
        
        if (status === StatusSolicitacao.FATURADO) {
          updateData.aprovado_por = user.name; 
        }

        if (status === StatusSolicitacao.REJEITADO && formattedReason) {
          updateData.motivo_rejeicao = formattedReason;
        }
        
        await supabase.from('solicitacoes').update(updateData).eq('id', id);

        if (status === StatusSolicitacao.REJEITADO) {
          const { data: pedido } = await supabase.from('pedidos').select('*').eq('id', sol.pedido_id).single();
          if (pedido) {
            const restored = Number((pedido.volume_restante + sol.volume_solicitado).toFixed(4));
            const st = restored >= pedido.volume_total ? StatusPedido.PENDENTE : StatusPedido.PARCIALMENTE_FATURADO;
            await supabase.from('pedidos').update({ volume_restante: restored, status: st }).eq('id', pedido.id);
          }
          
          // DISPARAR NOTIFICAÇÃO
          sendRejectionNotification(sol, formattedReason || "Motivo não informado", user);
        }
        return;
      }
      throw new Error("Supabase unavailable for update");

    } catch (e) {
      console.warn("Fallback updateSolicitacaoStatus");
      const idx = localSolicitacoes.findIndex(s => s.id === id);
      if (idx !== -1) {
        localSolicitacoes[idx].status = status;
        if (status === StatusSolicitacao.FATURADO) {
          localSolicitacoes[idx].aprovado_por = user.name;
        }
        if (status === StatusSolicitacao.REJEITADO && formattedReason) {
          localSolicitacoes[idx].motivo_rejeicao = formattedReason;
        }
        
        if (status === StatusSolicitacao.REJEITADO) {
           const pIdx = localPedidos.findIndex(p => p.id === localSolicitacoes[idx].pedido_id);
           if (pIdx !== -1) {
             const p = localPedidos[pIdx];
             const restored = Number((p.volume_restante + localSolicitacoes[idx].volume_solicitado).toFixed(4));
             localPedidos[pIdx].volume_restante = restored;
             localPedidos[pIdx].status = restored >= p.volume_total ? StatusPedido.PENDENTE : StatusPedido.PARCIALMENTE_FATURADO;
           }
           // DISPARAR NOTIFICAÇÃO (Fallback)
           sendRejectionNotification(localSolicitacoes[idx], formattedReason || "Motivo não informado", user);
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
          } else {
            localPedidos[existingIdx] = np;
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

// Função auxiliar para simular envio de e-mail
const sendRejectionNotification = async (solicitacao: SolicitacaoFaturamento, motivo: string, quemRejeitou: User) => {
  // 1. Encontrar e-mails dos Gerentes
  const gerentes = localUsers.filter(u => u.role === Role.GERENTE);
  const emailsGerentes = gerentes.map(g => g.email);

  // 2. Encontrar e-mail do Vendedor
  // Tenta achar o usuário pelo nome gravado em 'criado_por' ou pelo codigo_vendedor se disponível
  const vendedor = localUsers.find(u => u.name === solicitacao.criado_por || u.role === Role.VENDEDOR); 
  const emailVendedor = vendedor ? vendedor.email : 'vendedor@cropflow.com';

  const destinatarios = [...emailsGerentes, emailVendedor].join(', ');

  const emailSubject = `🚫 BLOQUEIO: Pedido ${solicitacao.numero_pedido} - ${solicitacao.nome_cliente}`;
  const emailBody = `
    Olá,
    
    A solicitação de faturamento para o pedido ${solicitacao.numero_pedido} foi BLOQUEADA/REJEITADA.
    
    Cliente: ${solicitacao.nome_cliente}
    Volume: ${solicitacao.volume_solicitado} ${solicitacao.unidade}
    
    Bloqueado por: ${quemRejeitou.name} (${getRoleLabel(quemRejeitou.role)})
    Motivo: ${motivo}
    
    Acesse o sistema para regularizar ou cancelar a solicitação.
  `;

  // SIMULAÇÃO DO ENVIO (Aqui entraria a chamada para API de E-mail real: Resend/SendGrid)
  console.group('📧 DISPARO DE E-MAIL AUTOMÁTICO');
  console.log(`DE: sistema@cropflow.com`);
  console.log(`PARA: ${destinatarios}`);
  console.log(`ASSUNTO: ${emailSubject}`);
  console.log(`CORPO: \n${emailBody}`);
  console.groupEnd();
};