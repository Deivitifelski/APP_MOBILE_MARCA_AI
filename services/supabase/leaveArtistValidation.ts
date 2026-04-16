/**
 * Serviço para validar saída de artista
 * Verifica se o usuário é o único colaborador e retorna mensagens apropriadas
 */

import { supabase } from '../../lib/supabase';

export interface LeaveArtistValidation {
  canLeave: boolean;
  isOnlyCollaborator: boolean;
  totalCollaborators: number;
  userRole: string;
  isOnlyAdmin: boolean;
  totalAdmins: number;
  action: 'DELETE_ARTIST' | 'TRANSFER_ADMIN' | 'LEAVE_NORMALLY';
  title: string;
  message: string;
  buttonText: string;
  buttonColor: 'error' | 'warning' | 'primary';
  warning: string[];
}

/**
 * Carrega tudo para a tela "Sair do artista" em uma RPC (melhor performance).
 */
export const fetchLeaveArtistScreenData = async (
  artistId: string,
): Promise<{ validation: LeaveArtistValidation | null; error: string | null }> => {
  try {
    const { data, error } = await supabase.rpc('get_leave_artist_screen_data', {
      p_artist_id: artistId,
    });
    if (error) {
      return { validation: null, error: error.message };
    }
    const row = data as {
      ok?: boolean;
      error?: string | null;
      validation?: Record<string, unknown> | null;
    } | null;
    if (!row || row.ok !== true) {
      const code = row?.error ?? 'unknown';
      const msg =
        code === 'not_authenticated'
          ? 'Faça login novamente.'
          : code === 'not_member'
            ? 'Você não tem acesso a este artista.'
            : code === 'no_collaborators'
              ? 'Nenhum colaborador encontrado.'
              : 'Não foi possível carregar os dados.';
      return { validation: null, error: msg };
    }
    const v = row.validation;
    if (!v || typeof v !== 'object') {
      return { validation: null, error: 'Resposta inválida do servidor.' };
    }
    const warnings = Array.isArray(v.warning)
      ? (v.warning as unknown[]).map((x) => String(x))
      : [];
    const validation: LeaveArtistValidation = {
      canLeave: Boolean(v.canLeave),
      isOnlyCollaborator: Boolean(v.isOnlyCollaborator),
      totalCollaborators: Number(v.totalCollaborators) || 0,
      userRole: String(v.userRole ?? ''),
      isOnlyAdmin: Boolean(v.isOnlyAdmin),
      totalAdmins: Number(v.totalAdmins) || 0,
      action: v.action as LeaveArtistValidation['action'],
      title: String(v.title ?? ''),
      message: String(v.message ?? ''),
      buttonText: String(v.buttonText ?? ''),
      buttonColor: v.buttonColor as LeaveArtistValidation['buttonColor'],
      warning: warnings,
    };
    return { validation, error: null };
  } catch {
    return { validation: null, error: 'Erro de conexão' };
  }
};

/**
 * ✅ Valida se o usuário pode sair do artista e retorna informações detalhadas
 * @param userId - ID do usuário atual
 * @param artistId - ID do artista
 * @returns Objeto com todas as informações de validação
 */
export const validateLeaveArtist = async (
  userId: string,
  artistId: string
): Promise<{ validation: LeaveArtistValidation | null; error: string | null }> => {
  try {
    // 1. Buscar TODOS os colaboradores do artista
    const { data: collaborators, error: collabError } = await supabase
      .from('artist_members')
      .select('user_id, role')
      .eq('artist_id', artistId);

    if (collabError) {
      console.error('❌ Erro ao buscar colaboradores:', collabError);
      return { validation: null, error: collabError.message };
    }

    if (!collaborators || collaborators.length === 0) {
      return { validation: null, error: 'Nenhum colaborador encontrado' };
    }

    // 2. Calcular estatísticas
    const totalCollaborators = collaborators.length;
    const totalAdmins = collaborators.filter(c => c.role === 'admin').length;
    const currentUser = collaborators.find(c => c.user_id === userId);
    const userRole = currentUser?.role || '';
    const isAdmin = userRole === 'admin';

    // 3. Verificar cenários baseado em ADMIN

    // 🟢 CENÁRIO 1: Usuário NÃO é admin - Pode sair normalmente
    if (!isAdmin) {
      return {
        validation: {
          canLeave: true,
          isOnlyCollaborator: false,
          totalCollaborators,
          userRole,
          isOnlyAdmin: false,
          totalAdmins,
          action: 'LEAVE_NORMALLY',
          title: 'Sair do Artista',
          message: 'Ao sair, você perderá acesso a todos os dados e funcionalidades deste artista.',
          buttonText: 'Sair do Artista',
          buttonColor: 'primary',
          warning: [
            'Você será removido da lista de colaboradores',
            'Perderá acesso aos eventos do artista',
            'Não poderá mais visualizar ou editar dados',
            `O artista continuará existindo para os outros ${totalCollaborators - 1} colaboradores`
          ]
        },
        error: null
      };
    }

    // 🔴 CENÁRIO 2: Admin é o ÚNICO COLABORADOR - Ao sair, deleta o artista
    if (isAdmin && totalCollaborators === 1) {
      return {
        validation: {
          canLeave: false, // Precisa deletar, não pode sair normalmente
          isOnlyCollaborator: true,
          totalCollaborators,
          userRole,
          isOnlyAdmin: true,
          totalAdmins,
          action: 'DELETE_ARTIST',
          title: '⚠️ Você é o Único Colaborador',
          message: 'Ao sair deste artista, ele será deletado permanentemente junto com todos os dados associados.',
          buttonText: 'Deletar Artista',
          buttonColor: 'error',
          warning: [
            `Artista será deletado permanentemente`,
            'Todos os eventos serão removidos',
            'Todas as despesas serão removidas',
            'Todos os dados financeiros serão perdidos',
            'Esta ação NÃO PODE SER DESFEITA'
          ]
        },
        error: null
      };
    }

    // 🟢 CENÁRIO 3: Admin com outros colaboradores E há outro admin - Pode sair normalmente
    if (isAdmin && totalAdmins > 1 && totalCollaborators > 1) {
      return {
        validation: {
          canLeave: true,
          isOnlyCollaborator: false,
          totalCollaborators,
          userRole,
          isOnlyAdmin: false,
          totalAdmins,
          action: 'LEAVE_NORMALLY',
          title: 'Sair do Artista',
          message: 'Ao sair, você perderá acesso a todos os dados e funcionalidades deste artista.',
          buttonText: 'Sair do Artista',
          buttonColor: 'primary',
          warning: [
            'Você será removido da lista de colaboradores',
            'Perderá acesso aos eventos do artista',
            `Outro admin continuará gerenciando o artista`,
            `O artista continuará existindo para os outros ${totalCollaborators - 1} colaboradores`
          ]
        },
        error: null
      };
    }

    // 🟡 CENÁRIO 4: ÚNICO ADMIN com outros colaboradores - Transferir admin ou deletar
    if (isAdmin && totalAdmins === 1 && totalCollaborators > 1) {
      return {
        validation: {
          canLeave: false, // Precisa transferir admin primeiro ou deletar
          isOnlyCollaborator: false,
          totalCollaborators,
          userRole,
          isOnlyAdmin: true,
          totalAdmins,
          action: 'TRANSFER_ADMIN',
          title: '⚠️ Você é o Único Administrador',
          message: 'Para sair, você deve indicar outro colaborador para ser admin ou deletar o artista.',
          buttonText: 'Escolher Ação',
          buttonColor: 'warning',
          warning: [
            `Existem ${totalCollaborators - 1} outros colaboradores no artista`,
            'Você precisa escolher um novo admin',
            'Ou pode deletar o artista e remover todos os dados'
          ]
        },
        error: null
      };
    }

    // 🟢 CENÁRIO 5: Caso padrão - Pode sair normalmente
    return {
      validation: {
        canLeave: true,
        isOnlyCollaborator: false,
        totalCollaborators,
        userRole,
        isOnlyAdmin: false,
        totalAdmins,
        action: 'LEAVE_NORMALLY',
        title: 'Sair do Artista',
        message: 'Ao sair, você perderá acesso a todos os dados e funcionalidades deste artista.',
        buttonText: 'Sair do Artista',
        buttonColor: 'primary',
        warning: [
          'Você será removido da lista de colaboradores',
          'Perderá acesso aos eventos do artista',
          'Não poderá mais visualizar ou editar dados',
          `O artista continuará existindo para os outros ${totalCollaborators - 1} colaboradores`
        ]
      },
      error: null
    };

  } catch (error) {
    console.error('❌ Erro ao validar saída:', error);
    return { validation: null, error: 'Erro ao validar saída do artista' };
  }
};

/**
 * ✅ Função simplificada: apenas verifica se é único colaborador
 * @param artistId - ID do artista
 * @returns boolean indicando se há apenas 1 colaborador
 */
export const isOnlyCollaborator = async (
  artistId: string
): Promise<{ isOnly: boolean; total: number; error: string | null }> => {
  try {
    const { count, error } = await supabase
      .from('artist_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('artist_id', artistId);

    if (error) {
      console.error('❌ Erro ao contar colaboradores:', error);
      return { isOnly: false, total: 0, error: error.message };
    }

    const total = count || 0;
    return { isOnly: total === 1, total, error: null };

  } catch (error) {
    console.error('❌ Erro ao verificar único colaborador:', error);
    return { isOnly: false, total: 0, error: 'Erro de conexão' };
  }
};

/**
 * ✅ Obter contagem de colaboradores por role
 * @param artistId - ID do artista
 */
export const getCollaboratorsStats = async (
  artistId: string
): Promise<{
  stats: {
    total: number;
    admins: number;
    editors: number;
    viewers: number;
  } | null;
  error: string | null;
}> => {
  try {
    const { data, error } = await supabase
      .from('artist_members')
      .select('role')
      .eq('artist_id', artistId);

    if (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      return { stats: null, error: error.message };
    }

    const stats = {
      total: data?.length || 0,
      admins: data?.filter((c) => c.role === 'admin').length || 0,
      editors: data?.filter(c => c.role === 'editor').length || 0,
      viewers: data?.filter(c => c.role === 'viewer').length || 0,
    };

    return { stats, error: null };

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    return { stats: null, error: 'Erro de conexão' };
  }
};

