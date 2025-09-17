import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { getCurrentUser } from './authService';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}


/**
 * Faz upload de uma imagem para o bucket do Supabase
 * @param imageUri - URI local da imagem
 * @param bucketName - Nome do bucket (padrão: 'image_artists')
 * @param fileName - Nome do arquivo (opcional, será gerado automaticamente se não fornecido)
 * @returns Promise com resultado do upload
 */
export const uploadImageToSupabase = async (
  imageUri: string,
  bucketName: string = 'image_artists',
  fileName?: string
): Promise<UploadResult> => {
  try {
    // Verificar se o usuário está autenticado
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      return {
        success: false,
        error: 'Usuário não autenticado. Faça login novamente.',
      };
    }

    // Gerar nome único para o arquivo se não fornecido
    if (!fileName) {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      fileName = `artist_${timestamp}_${randomId}.jpg`;
    }

    // Ler o arquivo como base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // Converter base64 para ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Fazer upload usando o método do Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Obter URL pública da imagem
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    return {
      success: true,
      url: publicUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no upload',
    };
  }
};

/**
 * Remove uma imagem do bucket do Supabase
 * @param fileName - Nome do arquivo a ser removido
 * @param bucketName - Nome do bucket (padrão: 'image_artists')
 * @returns Promise com resultado da remoção
 */
export const deleteImageFromSupabase = async (
  fileName: string,
  bucketName: string = 'image_artists'
): Promise<UploadResult> => {
  try {
    // Se for uma URL base64 (data:), não precisa remover do storage
    if (fileName.startsWith('data:')) {
      return {
        success: true,
      };
    }

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao remover imagem',
    };
  }
};

/**
 * Extrai o nome do arquivo de uma URL do Supabase Storage
 * @param url - URL da imagem
 * @returns Nome do arquivo ou null se não conseguir extrair
 */
export const extractFileNameFromUrl = (url: string): string | null => {
  try {
    const urlParts = url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    
    // Verificar se é uma URL válida do Supabase Storage
    if (fileName && fileName.includes('.')) {
      return fileName;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Verifica se uma imagem existe no bucket do Supabase Storage
 * @param fileName - Nome do arquivo
 * @param bucketName - Nome do bucket
 * @returns Promise com resultado da verificação
 */
export const checkImageExists = async (
  fileName: string,
  bucketName: string
): Promise<{ exists: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list('', {
        search: fileName
      });

    if (error) {
      return { exists: false, error: error.message };
    }

    const exists = data && data.some(file => file.name === fileName);
    
    return { exists: !!exists };
  } catch (error) {
    return { exists: false, error: 'Erro ao verificar imagem' };
  }
};

/**
 * Função específica para upload de imagem de usuário
 * @param imageUri - URI local da imagem
 * @param userId - ID do usuário (opcional, para logs)
 * @returns Promise com resultado do upload
 */
export const uploadUserImage = async (
  imageUri: string,
  userId?: string
): Promise<UploadResult> => {
  try {
    // Verificar se o usuário está autenticado
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      return {
        success: false,
        error: 'Usuário não autenticado. Faça login novamente.',
      };
    }

    // Upload direto para o bucket image_users

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileName = `user_${timestamp}_${randomId}.jpg`;

    // Ler o arquivo como base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // Converter base64 para ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Fazer upload para o bucket image_users
    const { data, error } = await supabase.storage
      .from('image_users')
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      return {
        success: false,
        error: `Erro no upload: ${error.message}`,
      };
    }

    // Obter URL pública da imagem
    const { data: urlData } = supabase.storage
      .from('image_users')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    return {
      success: true,
      url: publicUrl,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no upload',
    };
  }
};

/**
 * Upload usando método direto com fetch para contornar RLS
 * @param imageUri - URI local da imagem
 * @param bucketName - Nome do bucket
 * @param fileName - Nome do arquivo
 * @returns Promise com resultado do upload
 */
export const uploadImageToSupabaseAlternative = async (
  imageUri: string,
  bucketName: string = 'image_artists',
  fileName?: string
): Promise<UploadResult> => {
  try {
    // Verificar se o usuário está autenticado
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      return {
        success: false,
        error: 'Usuário não autenticado. Faça login novamente.',
      };
    }

    // Gerar nome único para o arquivo se não fornecido
    if (!fileName) {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      // Usar prefixo baseado no bucket para melhor organização
      const prefix = bucketName === 'image_users' ? 'user' : 'artist';
      fileName = `${prefix}_${timestamp}_${randomId}.jpg`;
    }

    // Ler o arquivo como base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    // Converter base64 para ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      return {
        success: false,
        error: `Erro no upload: ${error.message}`,
      };
    }

    // Obter URL pública da imagem
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    return {
      success: true,
      url: publicUrl,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no upload',
    };
  }
};
