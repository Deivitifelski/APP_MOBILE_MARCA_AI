import { supabase } from '../../lib/supabase';

export async function getArtistMonthRevenueGoal(
  artistId: string,
  year: number,
  month: number
): Promise<{ goal: number | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('meta_mensal_artista')
      .select('goal_amount')
      .eq('artist_id', artistId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      return { goal: null, error: error.message };
    }
    if (!data?.goal_amount) {
      return { goal: null, error: null };
    }
    const n = Number(data.goal_amount);
    if (!Number.isFinite(n) || n <= 0) {
      return { goal: null, error: null };
    }
    return { goal: n, error: null };
  } catch {
    return { goal: null, error: 'Erro de conexão' };
  }
}

export async function upsertArtistMonthRevenueGoal(
  artistId: string,
  year: number,
  month: number,
  goalAmount: number,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
    return { success: false, error: 'Valor inválido' };
  }
  try {
    const { error } = await supabase.from('meta_mensal_artista').upsert(
      {
        artist_id: artistId,
        year,
        month,
        goal_amount: goalAmount,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'artist_id,year,month' }
    );

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}

export async function deleteArtistMonthRevenueGoal(
  artistId: string,
  year: number,
  month: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('meta_mensal_artista')
      .delete()
      .eq('artist_id', artistId)
      .eq('year', year)
      .eq('month', month);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch {
    return { success: false, error: 'Erro de conexão' };
  }
}
