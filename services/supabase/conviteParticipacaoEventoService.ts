import { supabase } from '../../lib/supabase';

export type StatusConviteParticipacao = 'pendente' | 'aceito' | 'recusado' | 'cancelado';

export interface ConviteParticipacaoEventoRow {
  id: string;
  evento_origem_id: string;
  artista_que_convidou_id: string;
  artista_convidado_id: string;
  status: StatusConviteParticipacao;
  mensagem: string | null;
  motivo_cancelamento?: string | null;
  nome_evento: string;
  data_evento: string;
  hora_inicio: string;
  hora_fim: string;
  cache_valor: number | null;
  cidade: string | null;
  telefone_contratante: string | null;
  descricao: string | null;
  funcao_participacao: string | null;
  evento_criado_convidado_id: string | null;
  usuario_que_enviou_id: string;
  respondido_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ArtistaBuscaConvite {
  id: string;
  name: string;
  profile_url: string | null;
  /** URL para exibir na busca: foto do artista ou, se vazia, foto de um membro (ex.: owner). */
  image_url?: string | null;
}

export async function buscarArtistasParaConvite(
  termo: string,
  excluirArtistaId: string
): Promise<{ artists: ArtistaBuscaConvite[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('buscar_artistas_para_convite', {
      p_termo: termo?.trim() || '',
      p_excluir_artista_id: excluirArtistaId,
    });
    if (error) return { artists: [], error: error.message };
    return { artists: (data as ArtistaBuscaConvite[]) || [], error: null };
  } catch {
    return { artists: [], error: 'Erro de conexão' };
  }
}

export async function listarConvitesDoEvento(
  eventoOrigemId: string
): Promise<{ convites: ConviteParticipacaoEventoRow[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('convite_participacao_evento')
      .select('*')
      .eq('evento_origem_id', eventoOrigemId)
      .order('criado_em', { ascending: false });
    if (error) return { convites: [], error: error.message };
    return { convites: (data as ConviteParticipacaoEventoRow[]) || [], error: null };
  } catch {
    return { convites: [], error: 'Erro de conexão' };
  }
}

export async function listarConvitesPendentesRecebidos(
  artistaConvidadoId: string
): Promise<{ convites: ConviteParticipacaoEventoRow[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('convite_participacao_evento')
      .select('*')
      .eq('artista_convidado_id', artistaConvidadoId)
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false });
    if (error) return { convites: [], error: error.message };
    return { convites: (data as ConviteParticipacaoEventoRow[]) || [], error: null };
  } catch {
    return { convites: [], error: 'Erro de conexão' };
  }
}

export async function obterConvitePorId(
  id: string
): Promise<{ convite: ConviteParticipacaoEventoRow | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('convite_participacao_evento')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return { convite: null, error: error.message };
    return { convite: data as ConviteParticipacaoEventoRow | null, error: null };
  } catch {
    return { convite: null, error: 'Erro de conexão' };
  }
}

export interface EnviarConviteParticipacaoInput {
  eventoOrigemId: string;
  artistaQueConvidaId: string;
  artistaConvidadoId: string;
  usuarioQueEnviaId: string;
  funcaoParticipacao: string;
  mensagem?: string | null;
  nomeEvento: string;
  dataEvento: string;
  horaInicio: string;
  horaFim: string;
  cacheValor?: number | null;
  cidade?: string | null;
  telefoneContratante?: string | null;
  descricao?: string | null;
}

type RpcSimpleResult = {
  success: boolean;
  error: string | null;
};

function pickRpcRow<T extends object>(data: T[] | T | null): T | null {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

export async function enviarConviteParticipacao(
  input: EnviarConviteParticipacaoInput
): Promise<{ success: boolean; error: string | null; conviteId?: string }> {
  try {
    if (input.artistaQueConvidaId === input.artistaConvidadoId) {
      return { success: false, error: 'Não é possível convidar o mesmo artista.' };
    }
    if (input.cacheValor == null || Number(input.cacheValor) <= 0) {
      return { success: false, error: 'Informe o cachê do convite (obrigatório).' };
    }
    if (!input.funcaoParticipacao?.trim()) {
      return { success: false, error: 'Informe a função do participante (obrigatório).' };
    }
    const { data, error } = await supabase.rpc('rpc_app_enviar_convite_participacao_evento', {
      p_evento_origem_id: input.eventoOrigemId,
      p_artista_convidado_id: input.artistaConvidadoId,
      p_cache_valor: Number(input.cacheValor),
      p_telefone_contratante: input.telefoneContratante?.trim() || null,
      p_funcao_participacao: input.funcaoParticipacao.trim(),
      p_mensagem: input.mensagem?.trim() || null,
    });

    if (error) return { success: false, error: error.message };

    const row = pickRpcRow<{ success: boolean; error: string | null; convite_id: string | null }>(data);
    if (!row) return { success: false, error: 'Resposta inválida ao enviar convite.' };
    if (!row.success) return { success: false, error: row.error || 'Não foi possível enviar o convite.' };

    // Mantém notificação + push no app para atualizar badge em tempo real.
    void notificarConvidadoPrincipal(input).catch((err) =>
      console.warn('[convite participação] Erro ao notificar convidado principal (convite já salvo):', err)
    );

    return { success: true, error: null, conviteId: row.convite_id ?? undefined };
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}

/**
 * Notifica apenas o destinatário principal do artista convidado (não toda a equipe).
 * Prioridade de seleção: owner -> admin -> editor -> viewer.
 */
async function notificarConvidadoPrincipal(input: EnviarConviteParticipacaoInput): Promise<void> {
  const { data: lastInviteRows } = await supabase
    .from('convite_participacao_evento')
    .select('id')
    .eq('evento_origem_id', input.eventoOrigemId)
    .eq('artista_convidado_id', input.artistaConvidadoId)
    .order('criado_em', { ascending: false })
    .limit(1);

  const conviteId = lastInviteRows?.[0]?.id;
  if (!conviteId) return;

  const { data: notifyData, error: notifyErr } = await supabase.rpc('rpc_app_notificar_convite_participacao_evento', {
    p_convite_id: conviteId,
  });

  if (notifyErr) {
    console.warn('[convite participação] Falha RPC de notificação:', notifyErr.message);
    return;
  }

  const row = pickRpcRow<{
    success: boolean;
    error: string | null;
    token_fcm: string | null;
    title: string | null;
    message: string | null;
  }>(notifyData);

  if (!row?.success) {
    console.warn('[convite participação] RPC não notificou:', row?.error || 'erro desconhecido');
    return;
  }

  const tokenFcm = row.token_fcm;
  if (!tokenFcm) return;

  // Payload `data` do FCM: dados do convite (sem cidade/descrição). WhatsApp só se foi informado no envio.
  const { data: conviteRow } = await supabase
    .from('convite_participacao_evento')
    .select(
      'nome_evento, data_evento, hora_inicio, hora_fim, funcao_participacao, mensagem, cache_valor, telefone_contratante',
    )
    .eq('id', conviteId)
    .maybeSingle();

  const pushData: Record<string, string> = {
    screen: 'convites_participacao',
    type: 'convite_participacao_evento',
    convite_id: conviteId,
  };
  if (conviteRow) {
    if (conviteRow.nome_evento != null) pushData.nome_evento = String(conviteRow.nome_evento);
    if (conviteRow.data_evento != null) pushData.data_evento = String(conviteRow.data_evento);
    if (conviteRow.hora_inicio != null) pushData.hora_inicio = String(conviteRow.hora_inicio);
    if (conviteRow.hora_fim != null) pushData.hora_fim = String(conviteRow.hora_fim);
    if (conviteRow.funcao_participacao != null) pushData.funcao_participacao = String(conviteRow.funcao_participacao);
    if (conviteRow.mensagem != null && String(conviteRow.mensagem).trim() !== '') {
      pushData.mensagem = String(conviteRow.mensagem);
    }
    if (conviteRow.cache_valor != null) pushData.cache_valor = String(conviteRow.cache_valor);
    const tel = conviteRow.telefone_contratante != null ? String(conviteRow.telefone_contratante).trim() : '';
    if (tel !== '') pushData.telefone_whatsapp = tel;
  }

  const { error: pushErr } = await supabase.functions.invoke('send-push-single', {
    body: {
      token: tokenFcm,
      title: row.title || 'Convite de participação em evento',
      body: row.message || 'Você recebeu um novo convite de participação.',
      data: pushData,
    },
  });

  if (pushErr) {
    // Fallback legado, caso a função nova ainda não tenha sido deployada.
    const { error: legacyPushErr } = await supabase.functions.invoke('send-push-notification', {
      body: {
        token: tokenFcm,
        title: row.title || 'Convite de participação em evento',
        body: row.message || 'Você recebeu um novo convite de participação.',
        data: pushData,
      },
    });
    if (legacyPushErr) {
      console.warn('[convite participação] Falha no push do convidado principal:', legacyPushErr.message);
    }
  }
}

export async function recusarConviteParticipacao(
  conviteId: string,
  options?: { motivo?: string | null; usuarioRecusouId?: string | null }
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('rpc_app_recusar_convite_participacao_evento', {
      p_convite_id: conviteId,
      p_motivo: options?.motivo?.trim() || null,
    });
    if (error) return { success: false, error: error.message };

    const row = pickRpcRow<RpcSimpleResult>(data);
    if (!row) return { success: false, error: 'Resposta inválida ao recusar convite.' };
    return { success: row.success, error: row.error };
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}

export async function cancelarConviteParticipacao(
  conviteId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('rpc_app_cancelar_convite_pendente_participacao_evento', {
      p_convite_id: conviteId,
    });
    if (error) return { success: false, error: error.message };

    const row = pickRpcRow<RpcSimpleResult>(data);
    if (!row) return { success: false, error: 'Resposta inválida ao cancelar convite.' };
    return { success: row.success, error: row.error };
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}

/** Cancela uma participação já aceita (lado do convidado), exigindo motivo. */
export async function cancelarParticipacaoAceita(
  conviteId: string,
  motivo: string,
  usuarioCancelaId?: string | null
): Promise<{ success: boolean; error: string | null }> {
  try {
    void usuarioCancelaId;
    const motivoLimpo = motivo?.trim() || '';
    if (!motivoLimpo) return { success: false, error: 'Informe o motivo do cancelamento.' };

    const { data, error } = await supabase.rpc('rpc_app_cancelar_participacao_aceita_evento', {
      p_convite_id: conviteId,
      p_motivo: motivoLimpo,
    });
    if (error) return { success: false, error: error.message };

    const row = pickRpcRow<RpcSimpleResult>(data);
    if (!row) return { success: false, error: 'Resposta inválida ao cancelar participação.' };
    return { success: row.success, error: row.error };
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}

/** Remove participação já aceita (lado do organizador do evento): despesa, evento do convidado e notificação. */
export async function removerParticipacaoAceitaPeloOrganizador(
  conviteId: string,
  motivo: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const motivoLimpo = motivo?.trim() || '';
    if (!motivoLimpo) return { success: false, error: 'Informe o motivo da remoção.' };

    const { data, error } = await supabase.rpc('rpc_app_cancelar_participacao_aceita_pelo_anfitriao_evento', {
      p_convite_id: conviteId,
      p_motivo: motivoLimpo,
    });
    if (error) return { success: false, error: error.message };

    const row = pickRpcRow<RpcSimpleResult>(data);
    if (!row) return { success: false, error: 'Resposta inválida ao remover participação.' };
    return { success: row.success, error: row.error };
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}

/** Aceita o convite: cria linha em `events` na agenda do convidado e atualiza o convite. */
export async function aceitarConviteParticipacao(
  conviteId: string,
  userId: string,
  artistaConvidadoId: string,
  options?: { funcaoParticipacao?: string | null }
): Promise<{ success: boolean; error: string | null; eventoId?: string }> {
  try {
    void userId;
    void artistaConvidadoId;
    void options;

    const { data, error } = await supabase.rpc('rpc_app_aceitar_convite_participacao_evento', {
      p_convite_id: conviteId,
    });
    if (error) return { success: false, error: error.message };

    const row = pickRpcRow<{ success: boolean; error: string | null; evento_id: string | null }>(data);
    if (!row) return { success: false, error: 'Resposta inválida ao aceitar convite.' };
    return { success: row.success, error: row.error, eventoId: row.evento_id ?? undefined };
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}

export async function obterNomeArtista(artistId: string): Promise<string | null> {
  const { data } = await supabase.from('artists').select('name').eq('id', artistId).maybeSingle();
  return data?.name ?? null;
}
