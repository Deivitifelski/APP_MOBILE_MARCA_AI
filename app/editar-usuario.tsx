import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUser } from '../services/supabase/authService';
import { getUserProfile, updateUserProfile, UserProfile } from '../services/supabase/userService';
import { uploadImageToSupabaseAlternative, deleteImageFromSupabase, extractFileNameFromUrl } from '../services/supabase/imageUploadService';

export default function EditarUsuarioScreen() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
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

    if (!email.trim()) {
      Alert.alert('Erro', 'Email é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      let finalProfileUrl = profileUrl;

      // Se a imagem foi alterada (nova imagem selecionada)
      console.log('🔍 DEBUG - Verificando se há nova imagem:');
      console.log('🔍 DEBUG - profileUrl atual:', profileUrl);
      console.log('🔍 DEBUG - originalProfileUrl:', originalProfileUrl);
      console.log('🔍 DEBUG - São diferentes?', profileUrl !== originalProfileUrl);
      console.log('🔍 DEBUG - profileUrl não está vazio?', profileUrl.trim() !== '');
      
      if (profileUrl !== originalProfileUrl && profileUrl.trim() !== '') {
        console.log('📤 Nova imagem detectada, fazendo upload...');
        setIsUploadingImage(true);

        // Fazer upload da nova imagem para o Supabase Storage
        console.log('📤 Fazendo upload para Supabase Storage...');
        const uploadResult = await uploadImageToSupabaseAlternative(profileUrl, 'image_users');
        
        if (uploadResult.success && uploadResult.url) {
          console.log('✅ Upload realizado com sucesso:', uploadResult.url);
          finalProfileUrl = uploadResult.url;

          // Se havia uma imagem anterior, remover do storage
          if (originalProfileUrl && originalProfileUrl.trim() !== '' && !originalProfileUrl.startsWith('data:')) {
            const oldFileName = extractFileNameFromUrl(originalProfileUrl);
            if (oldFileName) {
              console.log('🗑️ Removendo imagem anterior:', oldFileName);
              await deleteImageFromSupabase(oldFileName, 'image_users');
            }
          }
        } else {
          console.error('❌ Erro no upload:', uploadResult.error);
          Alert.alert('Erro', `Erro ao fazer upload da imagem: ${uploadResult.error}`);
          return;
        }
      }

      // Atualizar dados do usuário
      console.log('💾 Salvando no banco de dados:', {
        userId: userProfile.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        profile_url: finalProfileUrl.trim() || undefined,
      });

      const { success, error } = await updateUserProfile(userProfile.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        profile_url: finalProfileUrl.trim() || undefined,
      });

      console.log('💾 Resultado do salvamento:', { success, error });

      if (success) {
        console.log('✅ Dados salvos com sucesso!');
        Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        console.error('❌ Erro ao salvar:', error);
        Alert.alert('Erro', error || 'Erro ao atualizar perfil');
      }
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
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
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Editar Perfil</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Carregando dados do usuário...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Editar Perfil</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.saveButton}
          disabled={isSaving || isUploadingImage}
        >
          {isSaving || isUploadingImage ? (
            <ActivityIndicator size="small" color="#667eea" />
          ) : (
            <Text style={styles.saveButtonText}>Salvar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Informações do usuário logado */}
        {userProfile && (
          <View style={styles.userInfoCard}>
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
                  style={styles.userAvatarImage}
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
                <View style={styles.userAvatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#667eea" />
                </View>
              )}
              <View style={styles.editImageOverlay}>
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={20} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userProfile.name}</Text>
              <Text style={styles.userEmail}>{userProfile.email}</Text>
              <Text style={styles.editImageText}>Toque na imagem para alterar</Text>
            </View>
          </View>
        )}


        {/* Formulário */}
        <View style={styles.formContainer}>
          {renderInput(
            'Nome Completo',
            name,
            setName,
            'Digite seu nome completo',
            'default',
            true
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

          {renderInput(
            'Estado',
            state,
            setState,
            'Digite seu estado'
          )}
        </View>

        {/* Informações adicionais */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#667eea" />
          <Text style={styles.infoText}>
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
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
    color: '#333',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#667eea',
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
    color: '#666',
  },
  content: {
    flex: 1,
  },
  userInfoCard: {
    backgroundColor: '#fff',
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
    borderColor: '#667eea',
  },
  userAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#667eea',
  },
  editImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#667eea',
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
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    backgroundColor: '#fff',
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
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
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
    color: '#1976d2',
    lineHeight: 20,
  },
});
