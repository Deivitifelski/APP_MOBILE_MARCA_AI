import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import UpgradeModal from '../../../components/UpgradeModal';
import { useTheme } from '../../../contexts/ThemeContext';
import { setActiveArtist } from '../../../services/artistContext';
import { createArtist } from '../../../services/supabase/artistService';
import { getCurrentUser } from '../../../services/supabase/authService';
import { uploadImageToSupabase } from '../../../services/supabase/imageUploadService';
import { canCreateArtist } from '../../../services/supabase/userService';

export default function ArtistProfileScreen() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const pickImage = async () => {
    try {
      console.log('🖼️ Iniciando seleção de imagem do artista...');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('📸 Resultado da seleção:', result);

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // Apenas salvar a URI local - upload será feito no submit
        setSelectedImageUri(imageUri);
        setProfileUrl(imageUri); // Para preview
        console.log('✅ Imagem selecionada (upload será feito no submit):', imageUri);
      } else {
        console.log('❌ Seleção cancelada pelo usuário');
      }
    } catch (error) {
      console.error('❌ Erro ao selecionar imagem:', error);
      
      try {
        const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
        
        if (status !== 'granted') {
          Alert.alert(
            'Permissão Necessária',
            'É necessário permitir o acesso à galeria para selecionar uma imagem. Vá em Configurações > Privacidade > Fotos e permita o acesso para este app.',
            [{ text: 'OK', style: 'default' }]
          );
        } else {
          Alert.alert(
            'Erro', 
            `Erro ao selecionar imagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Tente novamente.`
          );
        }
      } catch (permError) {
        console.error('❌ Erro ao verificar permissões:', permError);
        Alert.alert(
          'Erro', 
          `Erro ao acessar galeria: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Tente novamente.`
        );
      }
    }
  };

  const handleFinalizarCadastro = async () => {
    if (!name.trim()) {
      Alert.alert('Erro', 'Por favor, preencha o nome do artista');
      return;
    }

    setLoading(true);
    try {
      // Obter o usuário atual
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        return;
      }

      // Verificar se o usuário pode criar mais artistas
      const { canCreate, error: canCreateError } = await canCreateArtist(user.id);
      
      if (canCreateError) {
        Alert.alert('Erro', 'Erro ao verificar permissões: ' + canCreateError);
        setLoading(false);
        return;
      }

      if (!canCreate) {
        setLoading(false);
        setShowUpgradeModal(true);
        return;
      }

      let finalProfileUrl = null;

      // Se há uma imagem selecionada, fazer upload agora
      if (selectedImageUri) {
        console.log('📤 Fazendo upload da imagem do artista no momento do cadastro...');
        setIsUploadingImage(true);
        
        const uploadResult = await uploadImageToSupabase(selectedImageUri, 'image_artists');
        
        if (uploadResult.success && uploadResult.url) {
          finalProfileUrl = uploadResult.url;
          console.log('✅ Upload realizado com sucesso:', uploadResult.url);
        } else {
          console.error('❌ Erro no upload:', uploadResult.error);
          Alert.alert('Erro', `Erro ao fazer upload da imagem: ${uploadResult.error}`);
          setIsUploadingImage(false);
          setLoading(false);
          return;
        }
        setIsUploadingImage(false);
      }

      // Criar o perfil do artista
      const { success, error, artist } = await createArtist({
        name: name.trim(),
        profile_url: finalProfileUrl,
        user_id: user.id
      });

      if (!success || !artist) {
        Alert.alert('Erro', 'Erro ao criar perfil do artista: ' + error);
        return;
      }

      // Automaticamente mudar para o novo artista criado
      await setActiveArtist({
        id: artist.id,
        name: artist.name,
        role: 'admin' // Criador sempre é admin
      });

      Alert.alert(
        'Sucesso', 
        `Perfil do artista "${artist.name}" criado com sucesso! Você está agora gerenciando este artista.`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/agenda')
          }
        ]
      );
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao criar o perfil do artista');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              <View style={[styles.logoContainer, { backgroundColor: colors.surface }]}>
                <Ionicons name="musical-notes" size={50} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Criar Perfil do Artista</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Configure o perfil do artista que você irá gerenciar
              </Text>
            </View>

            {/* Formulário */}
            <View style={[styles.form, { backgroundColor: colors.surface }]}>
              {/* Foto de Perfil */}
              <View style={styles.photoSection}>
                <Text style={[styles.label, { color: colors.text }]}>Foto do Artista</Text>
                <TouchableOpacity 
                  style={styles.photoContainer} 
                  onPress={pickImage}
                  disabled={isUploadingImage}
                >
                  {profileUrl ? (
                    <Image 
                      source={{ 
                        uri: `${profileUrl}${profileUrl.includes('?') ? '&' : '?'}t=${Date.now()}`,
                        cache: 'reload'
                      }} 
                      style={styles.photo} 
                    />
                  ) : (
                    <View style={[styles.photoPlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Ionicons name="camera" size={40} color={colors.primary} />
                      <Text style={[styles.photoText, { color: colors.primary }]}>Adicionar Foto</Text>
                    </View>
                  )}
                  {isUploadingImage && (
                    <View style={styles.uploadOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Nome do Artista */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Nome do Artista *</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Digite o nome do artista"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.finalizarButton, 
                  { backgroundColor: colors.primary },
                  loading && styles.finalizarButtonDisabled
                ]}
                onPress={handleFinalizarCadastro}
                disabled={loading}
              >
                <Text style={styles.finalizarButtonText}>
                  {loading ? 'Criando...' : 'Criar Perfil do Artista'}
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textSecondary }]}>ou</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <TouchableOpacity
                style={[styles.skipButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => router.replace('/(tabs)/agenda')}
              >
                <Text style={[styles.skipButtonText, { color: colors.primary }]}>Criar Mais Tarde</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.inviteButton, { backgroundColor: colors.success }]}
                onPress={() => router.replace('/(tabs)/agenda')}
              >
                <Text style={styles.inviteButtonText}>Aguardar Convite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Seja Premium"
        message="Desbloqueie recursos avançados, usuários ilimitados, relatórios detalhados e suporte prioritário para sua banda."
        feature="artists"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: 8,
    zIndex: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoContainer: {
    marginTop: 10,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  finalizarButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  finalizarButtonDisabled: {
    backgroundColor: '#ccc',
  },
  finalizarButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  skipButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inviteButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
