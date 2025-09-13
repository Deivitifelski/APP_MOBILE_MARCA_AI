import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

export interface UploadImageResult {
  success: boolean;
  error: string | null;
  url?: string;
}

// Solicitar permissões para acessar a galeria
export const requestImagePermissions = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Erro ao solicitar permissões:', error);
    return false;
  }
};

// Selecionar imagem da galeria
export const pickImageFromGallery = async (): Promise<{ 
  success: boolean; 
  uri?: string; 
  error?: string 
}> => {
  try {
    const hasPermission = await requestImagePermissions();
    
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permissão para acessar a galeria negada'
      };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });

    if (result.canceled) {
      return {
        success: false,
        error: 'Seleção cancelada'
      };
    }

    if (result.assets && result.assets[0] && result.assets[0].uri) {
      return {
        success: true,
        uri: result.assets[0].uri
      };
    }

    return {
      success: false,
      error: 'Nenhuma imagem selecionada'
    };
  } catch (error) {
    console.error('Erro ao selecionar imagem:', error);
    return {
      success: false,
      error: 'Erro ao selecionar imagem'
    };
  }
};

// Upload de imagem para o Supabase Storage
export const uploadImageToStorage = async (
  imageUri: string, 
  bucket: 'image_users' | 'image_artists',
  fileName: string
): Promise<UploadImageResult> => {
  try {
    // Converter URI para blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Criar nome único para o arquivo
    const timestamp = Date.now();
    const fileExtension = imageUri.split('.').pop() || 'jpg';
    const uniqueFileName = `${fileName}_${timestamp}.${fileExtension}`;

    // Upload para o Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(uniqueFileName, blob, {
        contentType: blob.type,
        upsert: false
      });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    // Obter URL pública da imagem
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(uniqueFileName);

    return {
      success: true,
      error: null,
      url: publicUrl
    };
  } catch (error) {
    console.error('Erro no upload:', error);
    return {
      success: false,
      error: 'Erro no upload da imagem'
    };
  }
};

// Deletar imagem do storage
export const deleteImageFromStorage = async (
  bucket: 'image_users' | 'image_artists',
  fileName: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      error: 'Erro ao deletar imagem'
    };
  }
};

// Função completa: selecionar e fazer upload
export const selectAndUploadImage = async (
  bucket: 'image_users' | 'image_artists',
  fileName: string
): Promise<UploadImageResult> => {
  try {
    // Selecionar imagem
    const pickResult = await pickImageFromGallery();
    
    if (!pickResult.success || !pickResult.uri) {
      return {
        success: false,
        error: pickResult.error || 'Erro ao selecionar imagem'
      };
    }

    // Fazer upload
    return await uploadImageToStorage(pickResult.uri, bucket, fileName);
  } catch (error) {
    console.error('Erro no processo completo:', error);
    return {
      success: false,
      error: 'Erro no processo de upload'
    };
  }
};
