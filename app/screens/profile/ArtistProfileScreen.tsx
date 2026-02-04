import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
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
import { useActiveArtistContext } from '../../../contexts/ActiveArtistContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { createArtist } from '../../../services/supabase/artistService';
import { getCurrentUser } from '../../../services/supabase/authService';
import { uploadImageToSupabase } from '../../../services/supabase/imageUploadService';
import { canCreateArtist } from '../../../services/supabase/userService';

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

export default function ArtistProfileScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const fromSettings = params.fromSettings === 'true';
  const { setActiveArtist } = useActiveArtistContext();
  
  const [name, setName] = useState('');
  const [musicalStyle, setMusicalStyle] = useState('');
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showEstilos, setShowEstilos] = useState(false);
  const [createdArtistName, setCreatedArtistName] = useState('');

  const handleSkipArtistCreation = () => {
    Alert.alert(
      'Pular Criação de Artista',
      'Você pode criar seu perfil de artista mais tarde nas configurações.\n\nEnquanto isso, você poderá:\n\n• Receber convites de outros artistas\n• Se tornar colaborador de um artista existente\n• Gerenciar eventos como membro de uma equipe',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Continuar',
          onPress: () => router.replace('/(tabs)/agenda')
        }
      ]
    );
  };

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

    if (!musicalStyle) {
      Alert.alert('Atenção', 'Por favor, selecione o estilo musical');
      return;
    }

    if (name.trim().length > 50) {
      Alert.alert('Atenção', 'O nome do artista deve ter no máximo 50 caracteres');
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
      console.log('🔍 [ArtistProfileScreen] Verificando se pode criar artista...');
      const { canCreate, error: canCreateError } = await canCreateArtist(user.id);
      
      if (canCreateError) {
        console.error('❌ [ArtistProfileScreen] Erro ao verificar permissões:', canCreateError);
        Alert.alert('Erro', 'Erro ao verificar permissões: ' + canCreateError);
        setLoading(false);
        return;
      }

      if (!canCreate) {
        setLoading(false);
        Alert.alert('Limite atingido', 'Você atingiu o limite de 50 artistas.');
        return;
      }

      console.log('✅ [ArtistProfileScreen] Usuário pode criar artista!');

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

      const { success, error, artist } = await createArtist({
        name: name.trim(),
        musical_style: musicalStyle,
        profile_url: finalProfileUrl || undefined,
        user_id: user.id
      });

      console.log('📊 [ArtistProfileScreen] Resposta do createArtist:', {
        success,
        error,
        artist
      });

      if (!success || !artist) {
        console.error('❌ [ArtistProfileScreen] Falha ao criar artista:', error);
        Alert.alert('Atenção', 'Erro ao criar perfil do artista: ' + error);
        return;
      }

      console.log('✅ [ArtistProfileScreen] Artista criado com sucesso!');
      console.log('🔵 [ArtistProfileScreen] Setando artista ativo...');

      // Automaticamente mudar para o novo artista criado (Context API)
      await setActiveArtist({
        id: artist.id,
        name: artist.name,
        role: 'admin', // Criador sempre é admin
        profile_url: finalProfileUrl || undefined,
        musical_style: artist.musical_style || musicalStyle || undefined
      });

      console.log('✅ [ArtistProfileScreen] Artista ativo definido!');
      console.log('🎉 [ArtistProfileScreen] Mostrando modal de sucesso...');

      // Mostrar modal de sucesso personalizado
      setCreatedArtistName(artist.name);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('❌ [ArtistProfileScreen] Erro inesperado:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao criar o perfil do artista');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    if (fromSettings) {
      // Se veio das configurações, voltar para lá
      router.back();
    } else {
      // Senão, ir para a agenda (primeiro acesso)
      router.replace('/(tabs)/agenda');
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
              {fromSettings && (
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => router.back()}
                >
                  <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
              <Text style={[styles.brandName, { color: colors.primary }]}>MarcaAi</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {fromSettings 
                  ? 'Adicione um novo perfil de artista' 
                  : 'Configure o perfil do artista'}
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
                    maxLength={50}
                  />
                </View>
              </View>

              {/* Estilo Musical */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Estilo Musical *</Text>
                <TouchableOpacity
                  style={[styles.inputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => setShowEstilos(true)}
                >
                  <Ionicons name="musical-note-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <Text style={[
                    styles.input, 
                    { color: musicalStyle ? colors.text : colors.textSecondary }
                  ]}>
                    {musicalStyle || 'Selecione o estilo musical'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
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

              {/* Mostrar opções alternativas apenas se NÃO vier das configurações */}
              {!fromSettings && (
                <>
                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.dividerText, { color: colors.textSecondary }]}>ou</Text>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  </View>

                  <TouchableOpacity
                    style={[styles.skipButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={handleSkipArtistCreation}
                  >
                    <Text style={[styles.skipButtonText, { color: colors.primary }]}>Criar Mais Tarde</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Seleção de Estilo Musical */}
      <Modal
        visible={showEstilos}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEstilos(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEstilos(false)}
        >
          <View 
            style={[styles.modalContent, { backgroundColor: colors.surface }]} 
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Selecione o Estilo Musical</Text>
              <TouchableOpacity onPress={() => setShowEstilos(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {estilosMusicais.map((estilo) => (
                <TouchableOpacity
                  key={estilo}
                  style={[
                    styles.modalItem,
                    { borderBottomColor: colors.border },
                    musicalStyle === estilo && { backgroundColor: colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setMusicalStyle(estilo);
                    setShowEstilos(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText, 
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

      {/* Modal de Sucesso */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSuccessModal}
      >
        <View style={styles.successModalOverlay}>
          <View style={[styles.successModalContainer, { backgroundColor: colors.surface }]}>
            {/* Ícone de Sucesso Animado */}
            <View style={[styles.successIconContainer, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={80} color={colors.success} />
            </View>

            {/* Título */}
            <Text style={[styles.successTitle, { color: colors.text }]}>
              Artista Criado! 🎉
            </Text>

            {/* Nome do Artista */}
            <View style={[styles.artistNameCard, { backgroundColor: colors.background }]}>
              <Ionicons name="musical-notes" size={24} color={colors.primary} />
              <Text style={[styles.artistNameText, { color: colors.text }]}>
                {createdArtistName}
              </Text>
            </View>

            {/* Mensagem */}
            <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
              O perfil do artista foi criado com sucesso! Você está agora gerenciando este artista.
            </Text>

            {/* Features */}
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="calendar" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, { color: colors.text }]}>
                  Gerencie eventos e shows
                </Text>
              </View>
              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="cash" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, { color: colors.text }]}>
                  Controle financeiro completo
                </Text>
              </View>
              <View style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="people" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.featureText, { color: colors.text }]}>
                  Convide colaboradores
                </Text>
              </View>
            </View>

            {/* Botão Continuar */}
            <TouchableOpacity
              style={[styles.successButton, { backgroundColor: colors.primary }]}
              onPress={handleCloseSuccessModal}
            >
              <Text style={styles.successButtonText}>Continuar</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
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
    marginBottom: 24,
    marginTop: 10,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: -10,
    left: -10,
    padding: 8,
    zIndex: 10,
  },
  brandName: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 6,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  modalItemText: {
    fontSize: 16,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  artistNameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  artistNameText: {
    fontSize: 20,
    fontWeight: '600',
  },
  successMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  featuresList: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
  },
  successButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
