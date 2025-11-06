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
  isOnlyOwner: boolean;
  totalOwners: number;
  action: 'DELETE_ARTIST' | 'TRANSFER_OWNERSHIP' | 'LEAVE_NORMALLY';
  title: string;
  message: string;
  buttonText: string;
  buttonColor: 'error' | 'warning' | 'primary';
  warning: string[];
}

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
    const totalOwners = collaborators.filter(c => c.role === 'owner').length;
    const currentUser = collaborators.find(c => c.user_id === userId);
    const userRole = currentUser?.role || '';
    const isOwner = userRole === 'owner';

    // 3. Verificar cenários

    // 🔴 CENÁRIO 1: ÚNICO COLABORADOR - Ao sair, deleta o artista
    if (totalCollaborators === 1) {
      return {
        validation: {
          canLeave: false, // Precisa deletar, não pode sair normalmente
          isOnlyCollaborator: true,
          totalCollaborators,
          userRole,
          isOnlyOwner: isOwner,
          totalOwners,
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

    // 🟡 CENÁRIO 2: ÚNICO OWNER com outros colaboradores - Transferir propriedade
    if (isOwner && totalOwners === 1 && totalCollaborators > 1) {
      return {
        validation: {
          canLeave: false, // Precisa transferir propriedade primeiro
          isOnlyCollaborator: false,
          totalCollaborators,
          userRole,
          isOnlyOwner: true,
          totalOwners,
          action: 'TRANSFER_OWNERSHIP',
          title: '⚠️ Você é o Único Proprietário',
          message: 'Para sair, você deve transferir a propriedade para outro colaborador antes.',
          buttonText: 'Transferir Propriedade',
          buttonColor: 'warning',
          warning: [
            `Existem ${totalCollaborators - 1} outros colaboradores no artista`,
            'Você precisa escolher um novo proprietário',
            'Após transferir, você poderá sair do artista'
          ]
        },
        error: null
      };
    }

    // 🟢 CENÁRIO 3: Pode sair normalmente
    return {
      validation: {
        canLeave: true,
        isOnlyCollaborator: false,
        totalCollaborators,
        userRole,
        isOnlyOwner: false,
        totalOwners,
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
    owners: number;
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
      owners: data?.filter(c => c.role === 'owner').length || 0,
      admins: data?.filter(c => c.role === 'admin').length || 0,
      editors: data?.filter(c => c.role === 'editor').length || 0,
      viewers: data?.filter(c => c.role === 'viewer').length || 0,
    };

    return { stats, error: null };

  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    return { stats: null, error: 'Erro de conexão' };
  }
};

