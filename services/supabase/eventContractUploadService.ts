import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from './authService';

const BUCKET = 'event_contracts';

export type EventContractUploadResult = {
  success: boolean;
  url?: string;
  error?: string;
};

function extractStoragePathFromPublicUrl(url: string): string | null {
  // Ex: https://<ref>.supabase.co/storage/v1/object/public/event_contracts/<path>
  // Ex: https://<ref>.supabase.co/storage/v1/object/sign/event_contracts/<path>?token=...
  const clean = url.split('?')[0]?.split('#')[0] ?? url;
  const m = clean.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const bucket = m[1];
  const path = m[2];
  if (bucket !== BUCKET) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export async function removeEventContractByUrl(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const path = extractStoragePathFromPublicUrl(url);
    if (!path) {
      return { success: false, error: 'Não foi possível identificar o caminho do arquivo no Storage.' };
    }
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao remover arquivo do Storage.' };
  }
}

function sanitizeBaseName(name: string | undefined): string {
  const raw = (name ?? '')
    .split('/')
    .pop()
    ?.split('\\')
    .pop()
    ?.replace(/\.[^/.]+$/, '') // remove extensão
    ?.trim();

  const cleaned = (raw || 'contrato')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return (cleaned || 'contrato').slice(0, 48);
}

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
    const base = sanitizeBaseName(options?.fileName ?? undefined);
    const rand = Math.random().toString(36).slice(2, 11);
    const filePath = `${user.id}/${Date.now()}_${base}_${rand}.${ext}`;

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
