import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PermissionModal from '../components/PermissionModal';
import { useTheme } from '../contexts/ThemeContext';
import { artistImageUpdateService } from '../services/artistImageUpdateService';
import { getArtistById, updateArtist } from '../services/supabase/artistService';
import { getCurrentUser } from '../services/supabase/authService';
import { deleteImageFromSupabase, extractFileNameFromUrl, uploadImageToSupabase } from '../services/supabase/imageUploadService';
import { getUserPermissions } from '../services/supabase/permissionsService';
import { useActiveArtist } from '../services/useActiveArtist';

export default function EditarArtistaScreen() {
  const { colors } = useTheme();
  const { activeArtist, loadActiveArtist } = useActiveArtist();
  const [artist, setArtist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Campos do formulário
  const [name, setName] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [originalProfileUrl, setOriginalProfileUrl] = useState('');

  useEffect(() => {
    if (activeArtist) {
      loadArtistData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArtist]);

  const loadArtistData = async () => {
    try {
      setIsLoading(true);
      
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        router.back();
        return;
      }

      // Verificar se há artista ativo
      if (!activeArtist) {
        Alert.alert('Erro', 'Nenhum artista ativo selecionado');
        router.back();
        return;
      }

      // Buscar dados atualizados do artista diretamente pelo ID
      const { artist: currentArtist, error: artistError } = await getArtistById(activeArtist.id);
      
      if (artistError || !currentArtist) {
        Alert.alert('Erro', 'Erro ao carregar dados do artista');
        router.back();
        return;
      }
      
      // Carregar permissões
      const permissions = await getUserPermissions(
        user.id,
        currentArtist.id
      );

      if (!permissions) {
        Alert.alert('Erro', 'Erro ao carregar permissões');
        router.back();
        return;
      }

      setUserPermissions(permissions);

      // Verificar se o usuário tem permissão para editar (apenas owner ou admin)
      const userRole = permissions.role;
      const canEdit = userRole === 'owner' || userRole === 'admin';
      
      if (!canEdit || !permissions.permissions.canManageArtist) {
        Alert.alert(
          'Acesso Negado', 
          'Apenas gerentes e administradores podem editar as informações do artista.',
          [
            {
              text: 'Entendi',
              onPress: () => router.back(),
            },
          ]
        );
        return;
      }

      // Se tem permissão, carregar os dados do artista
      setArtist(currentArtist);
      setName(currentArtist.name || '');
      setProfileUrl(currentArtist.profile_url || '');
      setOriginalProfileUrl(currentArtist.profile_url || '');

    } catch {
      Alert.alert('Erro', 'Erro ao carregar dados do artista');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setProfileUrl(imageUri);
        setImageLoadError(false);
      }
    } catch (error) {
      try {
        const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
          Alert.alert(
            'Permissão Necessária',
            'É necessário permitir o acesso à galeria para selecionar uma imagem. Vá em Configurações > Privacidade > Fotos e permita o acesso para este app.',
            [
              { text: 'OK', style: 'default' }
            ]
          );
        } else {
          Alert.alert(
            'Erro', 
            `Erro ao selecionar imagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Tente novamente.`
          );
        }
      } catch (err) {
        Alert.alert(
          'Erro', 
          `Erro ao acessar galeria: ${err instanceof Error ? err.message : 'Erro desconhecido'}. Tente novamente.`
        );
      }
    }
  };

  const handleSave = async () => {
    if (!artist) return;

    // Verificar permissões - apenas owner ou admin
    const userRole = userPermissions?.role;
    const canEdit = userRole === 'owner' || userRole === 'admin';
    
    if (!canEdit || !userPermissions?.permissions.canManageArtist) {
      Alert.alert(
        'Acesso Negado',
        'Apenas gerentes e administradores podem editar as informações do artista.'
      );
      return;
    }

    if (!name.trim()) {
      Alert.alert('Erro', 'Nome do artista é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      let finalProfileUrl = profileUrl;

      // Se a imagem foi alterada (nova imagem selecionada)
      if (profileUrl !== originalProfileUrl && profileUrl.trim() !== '') {
        setIsUploadingImage(true);

        // Fazer upload da nova imagem para o Supabase Storage
        const uploadResult = await uploadImageToSupabase(profileUrl, 'image_artists');
        
        if (uploadResult.success && uploadResult.url) {
          finalProfileUrl = uploadResult.url;

          // Se havia uma imagem anterior, remover do storage
          if (originalProfileUrl && originalProfileUrl.trim() !== '' && !originalProfileUrl.startsWith('data:')) {
            const oldFileName = extractFileNameFromUrl(originalProfileUrl);
            if (oldFileName) {
              await deleteImageFromSupabase(oldFileName, 'image_artists');
            }
          }
        } else {
          Alert.alert('Erro', `Erro ao fazer upload da imagem: ${uploadResult.error}`);
          return;
        }
      }

      const { success } = await updateArtist(artist.id, {
        name: name.trim(),
        profile_url: finalProfileUrl.trim() || undefined,
      });

      if (success) {
        // 1. Atualizar AsyncStorage com os novos dados
        const { setActiveArtist: saveToStorage } = await import('../services/artistContext');
        await saveToStorage({
          id: artist.id,
          name: name.trim(),
          role: userPermissions?.role || 'owner',
          profile_url: finalProfileUrl.trim() || undefined
        });

        // 2. Notificar que a imagem foi atualizada
        if (finalProfileUrl !== originalProfileUrl) {
          artistImageUpdateService.notifyArtistImageUpdated(artist.id, finalProfileUrl);
        }

        // 3. Recarregar hook para propagar mudanças
        await loadActiveArtist();
        
        Alert.alert('Sucesso', 'Dados do artista atualizados com sucesso!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert('Erro', 'Erro ao atualizar dados do artista');
      }
    } catch {
      Alert.alert('Erro', 'Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
      setIsUploadingImage(false);
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    keyboardType: 'default' | 'email-address' | 'phone-pad' = 'default',
    required: boolean = false
  ) => (
    <View style={styles.inputContainer}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, { 
          borderColor: colors.border, 
          backgroundColor: colors.surface,
          color: colors.text 
        }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Editar Artista</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando dados do artista...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Editar Artista</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          disabled={isSaving || isUploadingImage}
        >
          {isSaving || isUploadingImage ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Salvar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Informações do artista */}
        {artist && (
          <View style={[styles.artistInfoCard, { backgroundColor: colors.surface }]}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handleSelectImage}
              activeOpacity={0.7}
            >
              {profileUrl && profileUrl.trim() !== '' && !imageLoadError ? (
                <Image
                  source={{
                    uri: `${profileUrl}${profileUrl.includes('?') ? '&' : '?'}t=${Date.now()}`,
                    cache: 'reload'
                  }}
                  style={[styles.artistAvatarImage, { borderColor: colors.primary }]}
                  resizeMode="cover"
                  onError={() => {
                    setImageLoadError(true);
                  }}
                  onLoad={() => {
                    setImageLoadError(false);
                  }}
                />
              ) : (
                <View style={[styles.artistAvatarPlaceholder, { backgroundColor: colors.background, borderColor: colors.primary }]}>
                  <Ionicons name="musical-notes" size={40} color={colors.primary} />
                </View>
              )}
              <View style={[styles.editImageOverlay, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={styles.artistInfo}>
              <Text style={[styles.artistName, { color: colors.text }]}>{artist.name}</Text>
              <Text style={[styles.artistRole, { color: colors.primary }]}>
                {userPermissions?.role === 'owner' ? 'Gerente' : 'Colaborador'}
              </Text>
              <Text style={[styles.editImageText, { color: colors.textSecondary }]}>Toque na imagem para alterar</Text>
            </View>
          </View>
        )}

        {/* Formulário */}
        <View style={[styles.formContainer, { backgroundColor: colors.surface }]}>
          {renderInput(
            'Nome do Artista',
            name,
            setName,
            'Digite o nome do artista',
            'default',
            true
          )}
        </View>

        {/* Informações adicionais */}
        <View style={[styles.infoCard, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            Campos marcados com * são obrigatórios. As alterações serão salvas automaticamente.
          </Text>
        </View>
      </ScrollView>

      {/* Modal de permissão */}
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acesso Restrito"
        message="Você não possui permissão para editar as informações deste artista. Entre em contato com um administrador para solicitar acesso."
        icon="lock-closed"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  artistInfoCard: {
    margin: 20,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  artistAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  artistAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  editImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editImageText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  artistInfo: {
    flex: 1,
  },
  artistName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  artistRole: {
    fontSize: 14,
    fontWeight: '600',
  },
  formContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  infoCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
});
