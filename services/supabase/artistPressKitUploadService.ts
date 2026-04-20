import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { getCurrentUser } from './authService';
import { removeEventContractByUrl } from './eventContractUploadService';

const BUCKET = 'event_contracts';

export type ArtistPressKitUploadResult = {
  success: boolean;
  url?: string;
  storagePath?: string;
  error?: string;
};

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
 * Envia arquivo de press kit para o bucket `event_contracts`, pasta press_kit por artista.
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
    return { success: true, url: urlData.publicUrl, storagePath: filePath };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro no upload do arquivo',
    };
  }
}

export async function removeArtistPressKitFileByUrl(url: string): Promise<{ success: boolean; error?: string }> {
  return removeEventContractByUrl(url);
}
