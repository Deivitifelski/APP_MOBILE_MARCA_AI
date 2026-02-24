import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PermissionModal from '../components/PermissionModal';
import { useActiveArtistContext } from '../contexts/ActiveArtistContext';
import { useTheme } from '../contexts/ThemeContext';
import { artistImageUpdateService } from '../services/artistImageUpdateService';
import { getArtistById, updateArtist } from '../services/supabase/artistService';
import { getCurrentUser } from '../services/supabase/authService';
import { deleteImageFromSupabase, extractFileNameFromUrl, uploadImageToSupabase } from '../services/supabase/imageUploadService';
import { getUserPermissions } from '../services/supabase/permissionsService';

const estilosMusicais = [
  'Alternative',
  'Arrocha',
  'Artista Solo',
  'Axé',
  'Baião',
  'Bailão',
  'Bandas do Sul',
  'Bandinhas',
  'Blues',
  'Bossa Nova',
  'Brega',
  'Choro',
  'Country',
  'DJ',
  'Eletrônica',
  'Emo',
  'Folk',
  'Forró',
  'Forró Eletrônico',
  'Frevo',
  'Funk',
  'Funk Carioca',
  'Funk Melody',
  'Gospel',
  'Gospel Contemporâneo',
  'Hard Rock',
  'Hip Hop',
  'House',
  'Indie',
  'Instrumental',
  'Jazz',
  'Maracatu',
  'Metal',
  'MPB',
  'Música Clássica',
  'Música Gaúcha',
  'Pagode',
  'Piseiro',
  'Pop',
  'Pop Rock',
  'Punk',
  'R&B',
  'Rap',
  'Reggae',
  'Reggaeton',
  'Rock',
  'Rock Nacional',
  'Samba',
  'Samba Rock',
  'Sertanejo',
  'Sertanejo Raiz',
  'Sertanejo Universitário',
  'Ska',
  'Soul',
  'Techno',
  'Tradicionalista',
  'Trap',
  'Vanera',
  'Xote',
  'Outros'
];

export default function EditarArtistaScreen() {
  const { colors } = useTheme();
  const { activeArtist, setActiveArtist: setActiveArtistContext } = useActiveArtistContext();
  const [artist, setArtist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showEstilos, setShowEstilos] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Campos do formulário
  const [name, setName] = useState('');
  const [musicalStyle, setMusicalStyle] = useState('');
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
      setMusicalStyle(currentArtist.musical_style || '');
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

    if (name.trim().length > 50) {
      Alert.alert('Atenção', 'O nome do artista deve ter no máximo 50 caracteres');
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

      console.log('📤 EDITAR ARTISTA - Enviando update:', {
        artistId: artist.id,
        name: name.trim(),
        profileUrl: finalProfileUrl,
        originalProfileUrl: originalProfileUrl
      });

      const updateResult = await updateArtist(artist.id, {
        name: name.trim(),
        musical_style: musicalStyle.trim() || undefined,
        profile_url: finalProfileUrl,
      });

      console.log('📥 EDITAR ARTISTA - Resultado do update:', updateResult);

      if (updateResult.success) {
        console.log('✅ EDITAR ARTISTA - Update bem-sucedido, atualizando estados...');

        // Usar os dados do formulário (update funcionou, mas select pode estar bloqueado por RLS)
        const updatedData = {
          id: artist.id,
          name: name.trim(),
          role: userPermissions?.role || 'owner',
          profile_url: finalProfileUrl || undefined,
          musical_style: musicalStyle.trim() || undefined
        };

        console.log('💾 EDITAR ARTISTA - Atualizando Context:', updatedData);

        // 1. Atualizar Context (salva no AsyncStorage e propaga para todas as telas)
        await setActiveArtistContext(updatedData);

        // 2. Notificar que a imagem foi atualizada
        if (finalProfileUrl !== originalProfileUrl) {
          console.log('🖼️ EDITAR ARTISTA - Notificando mudança de imagem');
          artistImageUpdateService.notifyArtistImageUpdated(artist.id, finalProfileUrl);
        }
        
        console.log('🎉 EDITAR ARTISTA - Processo completo!');
        
        // Mostrar modal de sucesso
        setShowSuccessModal(true);
      } else {
        Alert.alert('Erro', updateResult.error || 'Erro ao atualizar dados do artista');
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
    required: boolean = false,
    maxLength?: number
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
        maxLength={maxLength}
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
            true,
            50
          )}
          
          {/* Estilo Musical */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Estilo Musical
            </Text>
            <TouchableOpacity
              style={[styles.input, { 
                borderColor: colors.border, 
                backgroundColor: colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }]}
              onPress={() => setShowEstilos(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="musical-note-outline" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <Text style={[
                  { color: musicalStyle ? colors.text : colors.textSecondary, fontSize: 16 }
                ]}>
                  {musicalStyle || 'Selecione o estilo musical'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
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

      {/* Modal de Seleção de Estilo Musical */}
      <Modal
        visible={showEstilos}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEstilos(false)}
      >
        <TouchableOpacity 
          style={styles.estilosModalOverlay}
          activeOpacity={1}
          onPress={() => setShowEstilos(false)}
        >
          <View 
            style={[styles.estilosModalContent, { backgroundColor: colors.surface }]} 
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.estilosModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.estilosModalTitle, { color: colors.text }]}>Selecione o Estilo Musical</Text>
              <TouchableOpacity onPress={() => setShowEstilos(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.estilosModalList}>
              {estilosMusicais.map((estilo) => (
                <TouchableOpacity
                  key={estilo}
                  style={[
                    styles.estilosModalItem,
                    { borderBottomColor: colors.border },
                    musicalStyle === estilo && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setMusicalStyle(estilo);
                    setShowEstilos(false);
                  }}
                >
                  <Text style={[
                    styles.estilosModalItemText, 
                    { color: musicalStyle === estilo ? colors.primary : colors.text }
                  ]}>
                    {estilo}
                  </Text>
                  {musicalStyle === estilo && (
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de sucesso */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalIconContainer}>
              <View style={[styles.modalIcon, { backgroundColor: '#10B981' + '20' }]}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              </View>
            </View>
            
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sucesso!</Text>
            
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Dados do artista atualizados com sucesso!
            </Text>
            
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.1,
    shadowRadius: Platform.OS === 'android' ? 0 : 3.84,
    elevation: Platform.OS === 'android' ? 0 : 5,
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
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.1,
    shadowRadius: Platform.OS === 'android' ? 0 : 3.84,
    elevation: Platform.OS === 'android' ? 0 : 5,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 320,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.25,
    shadowRadius: Platform.OS === 'android' ? 0 : 3.84,
    elevation: Platform.OS === 'android' ? 0 : 5,
  },
  modalIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    borderRadius: 50,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  estilosModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  estilosModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  estilosModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  estilosModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  estilosModalList: {
    maxHeight: 400,
  },
  estilosModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  estilosModalItemText: {
    fontSize: 16,
  },
});
