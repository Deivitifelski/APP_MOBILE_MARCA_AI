import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { PRESS_KIT_MAX_FILE_BYTES, PRESS_KIT_STORAGE_BUCKET } from './pressKitConstants';
import { getCurrentUser } from './authService';

export type ArtistPressKitUploadResult = {
  success: boolean;
  url?: string;
  storagePath?: string;
  error?: string;
};

const LEGACY_CONTRACTS_BUCKET = 'event_contracts';

function extractBucketAndPathFromPublicUrl(url: string): { bucket: string; path: string } | null {
  const clean = url.split('?')[0]?.split('#')[0] ?? url;
  const m = clean.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (!m) return null;
  try {
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return { bucket: m[1], path: m[2] };
  }
}

function sanitizeBaseName(name: string | undefined): string {
  const raw = (name ?? '')
    .split('/')
    .pop()
    ?.split('\\')
    .pop()
    ?.replace(/\.[^/.]+$/, '')
    ?.trim();

  const cleaned = (raw || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return (cleaned || 'arquivo').slice(0, 48);
}

function sanitizeExtension(name: string | undefined, mime: string | undefined): string {
  const fromName = name?.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) {
    return fromName;
  }
  if (mime?.includes('pdf')) return 'pdf';
  if (mime?.includes('png')) return 'png';
  if (mime?.includes('jpeg') || mime?.includes('jpg')) return 'jpg';
  if (mime?.includes('zip')) return 'zip';
  return 'bin';
}

/**
 * Envia arquivo para o bucket `press_kit`.
 * Caminho: `{user_id}/press_kit/{artist_id}/{timestamp}_{nome}_{rand}.{ext}`
 */
export async function uploadArtistPressKitFile(
  artistId: string,
  localUri: string,
  options?: { mimeType?: string | null; fileName?: string | null }
): Promise<ArtistPressKitUploadResult> {
  try {
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    const ext = sanitizeExtension(options?.fileName ?? undefined, options?.mimeType ?? undefined);
    const base = sanitizeBaseName(options?.fileName ?? undefined);
    const rand = Math.random().toString(36).slice(2, 11);
    const filePath = `${user.id}/press_kit/${artistId}/${Date.now()}_${base}_${rand}.${ext}`;

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      return { success: false, error: 'Arquivo não encontrado.' };
    }
    if (typeof fileInfo.size === 'number' && fileInfo.size > PRESS_KIT_MAX_FILE_BYTES) {
      return {
        success: false,
        error: 'O arquivo é muito grande. O limite é 50 MB.',
      };
    }

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    });

    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      return { success: false, error: 'Sessão expirada. Faça login novamente e tente enviar o arquivo.' };
    }

    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const contentType = options?.mimeType?.trim() || 'application/octet-stream';

    const { error: uploadError } = await supabase.storage.from(PRESS_KIT_STORAGE_BUCKET).upload(filePath, body, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });

    if (uploadError) {
      const msg = uploadError.message;
      const rls =
        /row-level security|violates row-level security|RLS/i.test(msg) ||
        /new row violates/i.test(msg);
      return {
        success: false,
        error: rls
          ? `${msg}\n\nSe você já criou o bucket press_kit, rode de novo o script database/STORAGE_PRESS_KIT_BUCKET.sql no Supabase (políticas de INSERT).`
          : msg,
      };
    }

    const { data: urlData } = supabase.storage.from(PRESS_KIT_STORAGE_BUCKET).getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;
    const bucketSegment = `/object/public/${PRESS_KIT_STORAGE_BUCKET}/`;
    if (!publicUrl.includes(bucketSegment)) {
      return {
        success: false,
        error: `Resposta inesperada do Storage (esperado bucket ${PRESS_KIT_STORAGE_BUCKET}). Confira se o app está atualizado.`,
      };
    }
    return { success: true, url: publicUrl, storagePath: filePath };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro no upload do arquivo',
    };
  }
}

/** Remove arquivo do press kit (bucket `press_kit` ou legado em `event_contracts/.../press_kit/...`). */
export async function removeArtistPressKitFileByUrl(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = extractBucketAndPathFromPublicUrl(url);
    if (!parsed) {
      return { success: false, error: 'Não foi possível identificar o caminho do arquivo no Storage.' };
    }
    if (parsed.bucket === PRESS_KIT_STORAGE_BUCKET) {
      const { error } = await supabase.storage.from(PRESS_KIT_STORAGE_BUCKET).remove([parsed.path]);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }
    if (parsed.bucket === LEGACY_CONTRACTS_BUCKET && parsed.path.includes('/press_kit/')) {
      const { error } = await supabase.storage.from(LEGACY_CONTRACTS_BUCKET).remove([parsed.path]);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }
    return { success: false, error: 'URL de armazenamento não reconhecida para o press kit.' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao remover arquivo do Storage.' };
  }
}
