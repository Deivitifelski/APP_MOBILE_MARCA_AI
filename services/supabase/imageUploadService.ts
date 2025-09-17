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
    console.log('📤 Iniciando upload da imagem para Supabase...');
    console.log('📁 Bucket:', bucketName);
    console.log('🖼️ URI da imagem:', imageUri);

    // Verificar se o usuário está autenticado
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      console.error('❌ Usuário não autenticado:', authError);
      return {
        success: false,
        error: 'Usuário não autenticado. Faça login novamente.',
      };
    }

    console.log('✅ Usuário autenticado:', user.id);

    // Gerar nome único para o arquivo se não fornecido
    if (!fileName) {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      fileName = `artist_${timestamp}_${randomId}.jpg`;
    }

    console.log('📝 Nome do arquivo:', fileName);

    // Ler o arquivo como base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    console.log('📊 Tamanho do arquivo base64:', base64.length, 'caracteres');

    // Fazer upload usando o método do Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, base64, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '3600',
      });

    if (error) {
      console.error('❌ Erro no upload via Supabase Storage:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('✅ Upload via Supabase Storage realizado com sucesso:', data);

    // Obter URL pública da imagem
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log('🔗 URL pública gerada:', publicUrl);

    return {
      success: true,
      url: publicUrl,
    };
  } catch (error) {
    console.error('❌ Erro geral no upload:', error);
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
    console.log('🗑️ Removendo imagem do Supabase...');
    console.log('📁 Bucket:', bucketName);
    console.log('📝 Arquivo:', fileName);

    // Se for uma URL base64 (data:), não precisa remover do storage
    if (fileName.startsWith('data:')) {
      console.log('ℹ️ URL base64 detectada, não precisa remover do storage');
      return {
        success: true,
      };
    }

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error('❌ Erro ao remover imagem:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('✅ Imagem removida com sucesso');
    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Erro geral ao remover imagem:', error);
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
    console.error('❌ Erro ao extrair nome do arquivo:', error);
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
    console.log('🔍 Verificando se imagem existe:', fileName, 'no bucket:', bucketName);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list('', {
        search: fileName
      });

    if (error) {
      console.error('❌ Erro ao verificar imagem:', error);
      return { exists: false, error: error.message };
    }

    const exists = data && data.some(file => file.name === fileName);
    console.log('🔍 Imagem existe?', exists);
    
    return { exists: !!exists };
  } catch (error) {
    console.error('❌ Erro geral ao verificar imagem:', error);
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
    console.log('📤 Iniciando upload direto para Supabase Storage...');
    console.log('🔍 DEBUG - imageUri:', imageUri);
    console.log('🔍 DEBUG - bucketName:', bucketName);
    console.log('🔍 DEBUG - fileName:', fileName);
    console.log('🔍 DEBUG - Tipo do imageUri:', typeof imageUri);
    console.log('🔍 DEBUG - imageUri é string?', typeof imageUri === 'string');
    console.log('🔍 DEBUG - imageUri não está vazio?', imageUri && imageUri.trim() !== '');
    
    // Verificar se o usuário está autenticado
    const { user, error: authError } = await getCurrentUser();
    if (authError || !user) {
      console.error('❌ Usuário não autenticado:', authError);
      return {
        success: false,
        error: 'Usuário não autenticado. Faça login novamente.',
      };
    }

    // Assumir que o bucket existe (foi criado via SQL)
    console.log('📦 Fazendo upload direto para o bucket:', bucketName);

    // Gerar nome único para o arquivo se não fornecido
    if (!fileName) {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      // Usar prefixo baseado no bucket para melhor organização
      const prefix = bucketName === 'image_users' ? 'user' : 'artist';
      fileName = `${prefix}_${timestamp}_${randomId}.jpg`;
    }

    console.log('📝 Nome do arquivo:', fileName);

    // Ler o arquivo como base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    console.log('📊 Tamanho do arquivo base64:', base64.length, 'caracteres');

    // Converter base64 para ArrayBuffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('📦 ArrayBuffer criado, tamanho:', bytes.length, 'bytes');

    // Fazer upload usando o método do Supabase Storage
    console.log('📤 Iniciando upload para o bucket:', bucketName);
    console.log('📝 Nome do arquivo para upload:', fileName);
    console.log('🔐 Usuário autenticado:', user.id);
    
    // Assumir que o bucket existe (foi criado via SQL)
    console.log('📦 Fazendo upload direto para o bucket:', bucketName);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, bytes, {
        contentType: 'image/jpeg',
        upsert: true, // Permitir sobrescrever se existir
        cacheControl: '3600',
      });

    if (error) {
      console.error('❌ Erro no upload via Supabase Storage:', error);
      return {
        success: false,
        error: `Erro no upload: ${error.message}`,
      };
    }

    console.log('✅ Upload via Supabase Storage realizado com sucesso:', data);

    // Obter URL pública da imagem
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log('🔗 URL pública gerada:', publicUrl);
    console.log('📁 Bucket usado:', bucketName);
    console.log('📝 Arquivo salvo:', fileName);
    console.log('✅ Upload concluído com sucesso!');

    return {
      success: true,
      url: publicUrl,
    };

  } catch (error) {
    console.error('❌ Erro geral no upload direto:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no upload',
    };
  }
};
