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
import { useTheme } from '../contexts/ThemeContext';
import { getCurrentUser } from '../services/supabase/authService';
import { cacheService } from '../services/cacheService';
import { deleteImageFromSupabase, extractFileNameFromUrl, uploadUserImage } from '../services/supabase/imageUploadService';
import { getUserProfile, updateUserProfile, UserProfile } from '../services/supabase/userService';

const estadosBrasil = [
  'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará',
  'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão',
  'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará',
  'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro',
  'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia',
  'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'
];

export default function EditarUsuarioScreen() {
  const { colors } = useTheme();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showEstados, setShowEstados] = useState(false);
  
  // Campos do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [originalProfileUrl, setOriginalProfileUrl] = useState('');


  useEffect(() => {
    loadUserProfile();
  }, []);


  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      
      // Obter o usuário atual
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        router.back();
        return;
      }

      // Buscar perfil do usuário
      const { profile, error: profileError } = await getUserProfile(user.id);
      
      if (profileError) {
        Alert.alert('Erro', 'Erro ao carregar perfil do usuário');
        router.back();
        return;
      }

      if (profile) {
        setUserProfile(profile);
        setName(profile.name || '');
        setEmail(profile.email || '');
        setPhone(profile.phone || '');
        setCity(profile.city || '');
        setState(profile.state || '');
        setProfileUrl(profile.profile_url || '');
        setOriginalProfileUrl(profile.profile_url || '');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar dados do usuário');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectImage = async () => {
    try {
      console.log('🖼️ Iniciando seleção de imagem...');
      
      // Primeiro, vamos tentar abrir diretamente sem verificar permissões
      // para ver se o problema é na verificação ou na abertura
      console.log('📸 Tentando abrir galeria diretamente...');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('📸 Resultado da seleção:', result);

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setProfileUrl(imageUri);
        setImageLoadError(false);
        console.log('✅ Nova imagem selecionada:', imageUri);
      } else {
        console.log('❌ Seleção cancelada pelo usuário');
      }
    } catch (error) {
      console.error('❌ Erro ao selecionar imagem:', error);
      
      // Se der erro, vamos tentar verificar permissões
      try {
        console.log('🔐 Verificando permissões após erro...');
        const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
        console.log('📋 Status da permissão:', status);
        
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
      } catch (permError) {
        console.error('❌ Erro ao verificar permissões:', permError);
        Alert.alert(
          'Erro', 
          `Erro ao acessar galeria: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Tente novamente.`
        );
      }
    }
  };

  const handleSave = async () => {
    if (!userProfile) return;

    // Validações básicas
    if (!name.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return;
    }

    if (name.trim().length > 50) {
      Alert.alert('Atenção', 'O nome deve ter no máximo 50 caracteres');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Erro', 'Email é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      let finalProfileUrl = profileUrl;

      // Se a imagem foi alterada (nova imagem selecionada)
      if (profileUrl !== originalProfileUrl && profileUrl.trim() !== '') {
        setIsUploadingImage(true);

        // Fazer upload da nova imagem para o Supabase Storage usando função específica
        const uploadResult = await uploadUserImage(profileUrl, userProfile.id);
        
        if (uploadResult.success && uploadResult.url) {
          finalProfileUrl = uploadResult.url;

          // Se havia uma imagem anterior, remover do storage
          if (originalProfileUrl && originalProfileUrl.trim() !== '' && !originalProfileUrl.startsWith('data:')) {
            const oldFileName = extractFileNameFromUrl(originalProfileUrl);
            if (oldFileName) {
              await deleteImageFromSupabase(oldFileName, 'image_users');
            }
          }
        } else {
          Alert.alert('Erro', `Erro ao fazer upload da imagem: ${uploadResult.error}`);
          return;
        }
      }

      // Atualizar dados do usuário
      const { success, error } = await updateUserProfile(userProfile.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        profile_url: finalProfileUrl.trim() || undefined,
      });

      if (success) {
        await cacheService.invalidateUserData(userProfile.id);
        await cacheService.invalidateImageData(`user_${userProfile.id}`);

        await cacheService.setUserData(userProfile.id, {
          ...userProfile,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          profile_url: finalProfileUrl.trim() || null,
        });

        Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert('Erro', error || 'Erro ao atualizar perfil');
      }
    } catch (error) {
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
          <Text style={[styles.title, { color: colors.text }]}>Editar Perfil</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando dados do usuário...</Text>
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
        <Text style={[styles.title, { color: colors.text }]}>Editar Perfil</Text>
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
        {/* Informações do usuário logado */}
        {userProfile && (
          <View style={[styles.userInfoCard, { backgroundColor: colors.surface }]}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handleSelectImage}
              activeOpacity={0.7}
              disabled={isUploadingImage}
            >
              {profileUrl && profileUrl.trim() !== '' && !imageLoadError ? (
                <Image
                  source={{
                    uri: `${profileUrl}${profileUrl.includes('?') ? '&' : '?'}t=${Date.now()}`,
                    cache: 'reload'
                  }}
                  style={[styles.userAvatarImage, { borderColor: colors.primary }]}
                  resizeMode="cover"
                  onError={(error) => {
                    console.log('❌ Erro ao carregar imagem do usuário na edição:', profileUrl);
                    console.log('❌ Detalhes:', error.nativeEvent?.error);
                    setImageLoadError(true);
                  }}
                  onLoad={() => {
                    console.log('✅ Imagem do usuário carregada na edição:', profileUrl);
                    setImageLoadError(false);
                  }}
                />
              ) : (
                <View style={[styles.userAvatarPlaceholder, { backgroundColor: colors.background, borderColor: colors.primary }]}>
                  <Ionicons name="person" size={40} color={colors.primary} />
                </View>
              )}
              <View style={[styles.editImageOverlay, { backgroundColor: colors.primary }]}>
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={20} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>{userProfile.name}</Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{userProfile.email}</Text>
              <Text style={[styles.editImageText, { color: colors.textSecondary }]}>Toque na imagem para alterar</Text>
            </View>
          </View>
        )}


        {/* Formulário */}
        <View style={[styles.formContainer, { backgroundColor: colors.surface }]}>
          {renderInput(
            'Nome Completo',
            name,
            setName,
            'Digite seu nome completo',
            'default',
            true,
            50
          )}

          {renderInput(
            'Email',
            email,
            setEmail,
            'Digite seu email',
            'email-address',
            true
          )}

          {renderInput(
            'Telefone',
            phone,
            setPhone,
            'Digite seu telefone',
            'phone-pad'
          )}

          {renderInput(
            'Cidade',
            city,
            setCity,
            'Digite sua cidade'
          )}

          {/* Estado - Seletor */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Estado <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.estadoSelector, { 
                borderColor: colors.border, 
                backgroundColor: colors.surface,
              }]}
              onPress={() => setShowEstados(!showEstados)}
            >
              <Text style={[styles.estadoText, { color: state ? colors.text : colors.textSecondary }]}>
                {state || 'Selecione seu estado'}
              </Text>
              <Ionicons
                name={showEstados ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {showEstados && (
              <View style={[styles.estadosList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ScrollView style={styles.estadosScroll} nestedScrollEnabled>
                  {estadosBrasil.map((estadoItem) => (
                    <TouchableOpacity
                      key={estadoItem}
                      style={[styles.estadoItem, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setState(estadoItem);
                        setShowEstados(false);
                      }}
                    >
                      <Text style={[styles.estadoItemText, { color: colors.text }]}>
                        {estadoItem}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
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
  userInfoCard: {
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
  userAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  userAvatarPlaceholder: {
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
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
  estadoSelector: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  estadoText: {
    fontSize: 16,
    flex: 1,
  },
  estadosList: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    overflow: 'hidden',
  },
  estadosScroll: {
    maxHeight: 200,
  },
  estadoItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  estadoItemText: {
    fontSize: 16,
  },
});
