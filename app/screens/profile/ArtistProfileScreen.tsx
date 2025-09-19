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
import LimitReachedModal from '../../../components/LimitReachedModal';
import SuccessModal from '../../../components/SuccessModal';
import { setActiveArtist } from '../../../services/artistContext';
import { createArtist } from '../../../services/supabase/artistService';
import { getCurrentUser } from '../../../services/supabase/authService';
import { uploadImageToSupabase } from '../../../services/supabase/imageUploadService';
import { getUsuarioPlano } from '../../../services/supabase/planService';

export default function ArtistProfileScreen() {
  const [name, setName] = useState('');
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdArtist, setCreatedArtist] = useState<any>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{currentCount: number; maxCount: number; planName: string} | null>(null);

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
        console.log('🔍 Erro ao criar artista:', error);
        
        // Verificar se é erro de limite de plano (múltiplas variações)
        if (error && (
          error.includes('atingiu o limite') || 
          error.includes('limite') ||
          error.includes('Você atingiu') ||
          error.includes('artista') && error.includes('plano')
        )) {
          console.log('🔍 Erro de limite detectado, extraindo informações...');
          
          // Tentar extrair informações do erro com regex mais flexível
          let maxCount = 1;
          let currentCount = 1;
          
          // Padrão 1: "Você atingiu o limite de X artista(s). Atualmente você tem Y artista(s)."
          let match = error.match(/Você atingiu o limite de (\d+) artista.*?Atualmente você tem (\d+)/);
          if (match) {
            maxCount = parseInt(match[1]);
            currentCount = parseInt(match[2]);
          } else {
            // Padrão 2: "limite de X artista"
            match = error.match(/limite de (\d+) artista/);
            if (match) {
              maxCount = parseInt(match[1]);
              // Assumir que já tem o máximo
              currentCount = maxCount;
            } else {
              // Padrão 3: Se não conseguir extrair, usar valores padrão para plano Free
              maxCount = 1;
              currentCount = 1;
            }
          }
          
          console.log('🔍 Limite extraído:', { maxCount, currentCount });
          
          // Buscar nome do plano atual
          const { success: planoSuccess, usuarioPlano } = await getUsuarioPlano(user.id);
          const planName = planoSuccess && usuarioPlano ? usuarioPlano.plano.nome : 'Free';
          
          console.log('🔍 Plano encontrado:', planName);
          
          setLimitInfo({
            currentCount,
            maxCount,
            planName
          });
          setShowLimitModal(true);
          return;
        }
        
        Alert.alert('Erro', 'Erro ao criar perfil do artista: ' + error);
        return;
      }

      // Armazenar dados do artista criado
      setCreatedArtist(artist);

      // Definir o novo artista como ativo
      await setActiveArtist({
        id: artist.id,
        name: artist.name,
        role: 'owner'
      });

      // Mostrar modal de sucesso
      setShowSuccessModal(true);
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao criar o perfil do artista');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessModalContinue = async () => {
    setShowSuccessModal(false);
    await navigateBasedOnPlan();
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
  };

  const handleLimitModalUpgrade = () => {
    setShowLimitModal(false);
    router.push('/planos-pagamentos');
  };

  const handleLimitModalCancel = () => {
    setShowLimitModal(false);
  };

  const handleLimitModalClose = () => {
    setShowLimitModal(false);
  };

  // Função auxiliar para verificar plano e navegar
  const navigateBasedOnPlan = async () => {
    try {
      // Verificar se o usuário já tem um plano definido
      const { user, error: userError } = await getCurrentUser();
      
      if (!userError && user) {
        const { success, usuarioPlano } = await getUsuarioPlano(user.id);
        
        if (success && usuarioPlano) {
          // Usuário já tem plano, ir direto para a agenda
          router.replace('/(tabs)/agenda');
          return;
        }
      }
      
      // Usuário não tem plano, ir para seleção de planos
      router.push('/selecionar-plano');
    } catch (error) {
      // Em caso de erro, ir para seleção de planos por segurança
      router.push('/selecionar-plano');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Ionicons name="musical-notes" size={50} color="#667eea" />
              </View>
              <Text style={styles.title}>Criar Perfil do Artista</Text>
              <Text style={styles.subtitle}>
                Configure o perfil do artista que você irá gerenciar
              </Text>
            </View>

            {/* Formulário */}
            <View style={styles.form}>
              {/* Foto de Perfil */}
              <View style={styles.photoSection}>
                <Text style={styles.label}>Foto do Artista</Text>
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
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="camera" size={40} color="#667eea" />
                      <Text style={styles.photoText}>Adicionar Foto</Text>
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
                <Text style={styles.label}>Nome do Artista *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Digite o nome do artista"
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.finalizarButton, loading && styles.finalizarButtonDisabled]}
                onPress={handleFinalizarCadastro}
                disabled={loading}
              >
                <Text style={styles.finalizarButtonText}>
                  {loading ? 'Criando...' : 'Criar Perfil do Artista'}
                </Text>
              </TouchableOpacity>


              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={navigateBasedOnPlan}
              >
                <Text style={styles.skipButtonText}>Criar Mais Tarde</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.inviteButton}
                onPress={navigateBasedOnPlan}
              >
                <Text style={styles.inviteButtonText}>Aguardar Convite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Sucesso */}
      <SuccessModal
        visible={showSuccessModal}
        title="🎉 Artista Criado!"
        message={`Perfil do artista "${createdArtist?.name}" criado com sucesso!`}
        onClose={handleSuccessModalClose}
        onContinue={handleSuccessModalContinue}
        buttonText="Continuar"
        icon="musical-notes"
        iconColor="#667eea"
      />

      {/* Modal de Limite Atingido */}
      {limitInfo && (
        <LimitReachedModal
          visible={showLimitModal}
          currentCount={limitInfo.currentCount}
          maxCount={limitInfo.maxCount}
          planName={limitInfo.planName}
          onClose={handleLimitModalClose}
          onUpgrade={handleLimitModalUpgrade}
          onCancel={handleLimitModalCancel}
        />
      )}
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
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
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
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
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    marginTop: 8,
    fontSize: 12,
    color: '#667eea',
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
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  finalizarButton: {
    backgroundColor: '#667eea',
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
    backgroundColor: '#e9ecef',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#666',
  },
  skipButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  inviteButton: {
    backgroundColor: '#28a745',
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
