import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { getCurrentUser } from './authService';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Função auxiliar para fallback para base64
const fallbackToBase64 = async (imageUri: string): Promise<UploadResult> => {
  try {
    console.log('🔄 Usando fallback para base64...');
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });
    
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    console.log('✅ Base64 gerado, tamanho:', dataUrl.length, 'caracteres');
    
    return {
      success: true,
      url: dataUrl,
    };
  } catch (base64Error) {
    console.error('❌ Erro ao gerar base64:', base64Error);
    return {
      success: false,
      error: 'Erro ao processar imagem',
    };
  }
};

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

    // Verificar se o bucket existe, se não, criar
    console.log('🔍 Verificando se o bucket existe...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError);
      // Fallback para base64
      return await fallbackToBase64(imageUri);
    }
    
    const bucketExists = buckets?.find(bucket => bucket.id === bucketName);
    
    if (!bucketExists) {
      console.log('📦 Bucket não existe, criando...');
      const { data: newBucket, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });
      
      if (createError) {
        console.error('❌ Erro ao criar bucket:', createError);
        // Fallback para base64
        return await fallbackToBase64(imageUri);
      }
      
      console.log('✅ Bucket criado com sucesso:', newBucket);
    } else {
      console.log('✅ Bucket existe:', bucketExists);
    }

    // Gerar nome único para o arquivo se não fornecido
    if (!fileName) {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      fileName = `user_${timestamp}_${randomId}.jpg`;
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
      console.log('🔄 Tentando fallback para base64...');
      return await fallbackToBase64(imageUri);
    }

    console.log('✅ Upload via Supabase Storage realizado com sucesso:', data);

    // Obter URL pública da imagem
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log('🔗 URL pública gerada:', publicUrl);
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
