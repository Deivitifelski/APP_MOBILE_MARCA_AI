import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from './authService';

const BUCKET = 'event_contracts';

export type EventContractUploadResult = {
  success: boolean;
  url?: string;
  error?: string;
};

function sanitizeExtension(name: string | undefined, mime: string | undefined): string {
  const fromName = name?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) {
    return fromName;
  }
  if (mime?.includes('pdf')) return 'pdf';
  if (mime?.includes('png')) return 'png';
  if (mime?.includes('jpeg') || mime?.includes('jpg')) return 'jpg';
  return 'pdf';
}

/**
 * Envia contrato/comprovante para o bucket `event_contracts`.
 * O bucket deve existir no projeto Supabase e estar configurado para leitura (público ou assinado).
 */
export async function uploadEventContractFile(
  localUri: string,
  options?: { mimeType?: string | null; fileName?: string | null }
): Promise<EventContractUploadResult> {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const ext = sanitizeExtension(options?.fileName ?? undefined, options?.mimeType ?? undefined);
    const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${ext}`;

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    });

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const contentType = options?.mimeType?.trim() || 'application/octet-stream';

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, bytes, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return { success: true, url: urlData.publicUrl };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro no upload do contrato',
    };
  }
}
