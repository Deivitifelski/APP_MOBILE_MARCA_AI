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
import { getCurrentUser } from '../../../services/supabase/authService';
import { uploadUserImage } from '../../../services/supabase/imageUploadService';
import { createUserProfile } from '../../../services/supabase/userService';

const estadosBrasil = [
  'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará',
  'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão',
  'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará',
  'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro',
  'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia',
  'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'
];

export default function UserProfileScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEstados, setShowEstados] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const pickImage = async () => {
    try {
      console.log('🖼️ Iniciando seleção de imagem...');
      
      // Primeiro, vamos tentar abrir diretamente sem verificar permissões
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
        setIsUploadingImage(true);
        
        console.log('📤 Fazendo upload da imagem...');
        
        // Fazer upload da imagem para o Supabase Storage
        const uploadResult = await uploadUserImage(imageUri);
        
        if (uploadResult.success && uploadResult.url) {
          setProfileUrl(uploadResult.url);
          console.log('✅ Upload realizado com sucesso:', uploadResult.url);
          Alert.alert('Sucesso', 'Foto selecionada e salva com sucesso!');
        } else {
          console.error('❌ Erro no upload:', uploadResult.error);
          Alert.alert('Erro', `Erro ao fazer upload da imagem: ${uploadResult.error}`);
          // Manter a URI local como fallback
          setProfileUrl(imageUri);
        }
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
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFinalizarCadastro = async () => {
    if (!name.trim() || !phone.trim() || !city.trim() || !state) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      // Obter o usuário atual
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        router.replace('/login');
        return;
      }

      // Salvar os dados do usuário usando o serviço
      const { success, error } = await createUserProfile({
        id: user.id,
        name: name.trim(),
        email: user.email || '',
        city: city.trim(),
        state: state,
        phone: phone.trim(),
        profile_url: profileUrl || undefined
      });

      if (!success) {
        Alert.alert('Erro', 'Erro ao salvar dados do usuário: ' + error);
        return;
      }

      Alert.alert(
        'Sucesso', 
        'Cadastro de usuário finalizado com sucesso! Agora vamos criar o perfil do artista.',
        [
          {
            text: 'Continuar',
            onPress: () => router.replace('/cadastro-artista')
          }
        ]
      );
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao finalizar o cadastro');
    } finally {
      setLoading(false);
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
                <Ionicons name="person-add" size={50} color="#667eea" />
              </View>
              <Text style={styles.title}>Perfil Pessoal</Text>
              <Text style={styles.subtitle}>
                Complete suas informações pessoais. Em seguida, criaremos seu perfil de artista.
              </Text>
            </View>

            {/* Formulário */}
            <View style={styles.form}>
              {/* Foto de Perfil */}
              <View style={styles.photoSection}>
                <Text style={styles.label}>Foto de Perfil</Text>
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

              {/* Nome Completo */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome Completo *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Digite seu nome completo"
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Telefone */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                </View>
              </View>

              {/* Cidade */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cidade *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="location-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={city}
                    onChangeText={setCity}
                    placeholder="Digite sua cidade"
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Estado */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Estado *</Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() => setShowEstados(!showEstados)}
                >
                  <Ionicons name="map-outline" size={20} color="#666" style={styles.inputIcon} />
                  <Text style={[styles.input, !state && styles.placeholderText]}>
                    {state || 'Selecione seu estado'}
                  </Text>
                  <Ionicons
                    name={showEstados ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                    style={styles.chevronIcon}
                  />
                </TouchableOpacity>

                {showEstados && (
                  <View style={styles.estadosList}>
                    <ScrollView style={styles.estadosScroll} nestedScrollEnabled>
                      {estadosBrasil.map((estadoItem) => (
                        <TouchableOpacity
                          key={estadoItem}
                          style={styles.estadoItem}
                          onPress={() => {
                            setState(estadoItem);
                            setShowEstados(false);
                          }}
                        >
                          <Text style={styles.estadoText}>{estadoItem}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.finalizarButton, loading && styles.finalizarButtonDisabled]}
                onPress={handleFinalizarCadastro}
                disabled={loading}
              >
                <Text style={styles.finalizarButtonText}>
                  {loading ? 'Salvando...' : 'Continuar para Artista'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  placeholderText: {
    color: '#999',
  },
  chevronIcon: {
    marginLeft: 8,
  },
  estadosList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginTop: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  estadosScroll: {
    maxHeight: 200,
  },
  estadoItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  estadoText: {
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
});
