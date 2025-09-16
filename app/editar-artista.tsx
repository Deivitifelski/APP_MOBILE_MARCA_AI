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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getCurrentUser } from '../services/supabase/authService';
import { getArtists, updateArtist } from '../services/supabase/artistService';
import { getUserPermissions } from '../services/supabase/permissionsService';
import PermissionModal from '../components/PermissionModal';

export default function EditarArtistaScreen() {
  const [artist, setArtist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  
  // Campos do formulário
  const [name, setName] = useState('');
  const [profileUrl, setProfileUrl] = useState('');

  useEffect(() => {
    loadArtistData();
  }, []);

  const loadArtistData = async () => {
    try {
      setIsLoading(true);
      
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        router.back();
        return;
      }

      const { artists, error: artistsError } = await getArtists(user.id);
      
      if (artistsError || !artists || artists.length === 0) {
        Alert.alert('Erro', 'Nenhum artista encontrado');
        router.back();
        return;
      }

      // Usar o primeiro artista (artista ativo)
      const currentArtist = artists[0];
      
      // Carregar permissões primeiro
      const permissions = await getUserPermissions(
        user.id,
        currentArtist.id
      );

      if (!permissions) {
        console.error('Erro ao carregar permissões');
        Alert.alert('Erro', 'Erro ao carregar permissões');
        router.back();
        return;
      }

      setUserPermissions(permissions);

      // Verificar se o usuário tem permissão para gerenciar o artista
      if (!permissions.permissions.canManageArtist) {
        Alert.alert(
          'Acesso Negado', 
          'Você não tem permissão para editar as informações deste artista.',
          [
            {
              text: 'OK',
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

    } catch (error) {
      console.error('Erro ao carregar dados do artista:', error);
      Alert.alert('Erro', 'Erro ao carregar dados do artista');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!artist) return;

    // Verificar permissões
    if (!userPermissions?.permissions.canManageArtist) {
      setShowPermissionModal(true);
      return;
    }

    if (!name.trim()) {
      Alert.alert('Erro', 'Nome do artista é obrigatório');
      return;
    }

    try {
      setIsSaving(true);

      const { success, error } = await updateArtist(artist.id, {
        name: name.trim(),
        profile_url: profileUrl.trim() || undefined,
      });

      if (success) {
        Alert.alert('Sucesso', 'Dados do artista atualizados com sucesso!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert('Erro', error || 'Erro ao atualizar dados do artista');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
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
          <Text style={styles.title}>Editar Artista</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Carregando dados do artista...</Text>
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
        <Text style={styles.title}>Editar Artista</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.saveButton}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#667eea" />
          ) : (
            <Text style={styles.saveButtonText}>Salvar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Informações do artista */}
        {artist && (
          <View style={styles.artistInfoCard}>
            <View style={styles.artistAvatar}>
              <Ionicons name="musical-notes" size={40} color="#667eea" />
            </View>
            <View style={styles.artistInfo}>
              <Text style={styles.artistName}>{artist.name}</Text>
              <Text style={styles.artistRole}>
                {userPermissions?.role === 'owner' ? 'Proprietário' : 'Colaborador'}
              </Text>
            </View>
          </View>
        )}

        {/* Formulário */}
        <View style={styles.formContainer}>
          {renderInput(
            'Nome do Artista',
            name,
            setName,
            'Digite o nome do artista',
            'default',
            true
          )}

          {renderInput(
            'URL do Perfil',
            profileUrl,
            setProfileUrl,
            'Digite a URL do perfil (opcional)',
            'default'
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

      {/* Modal de permissão */}
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Permissão Insuficiente"
        message="Você não tem permissão para editar as informações deste artista."
        icon="lock-closed"
      />
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
  artistInfoCard: {
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
  artistAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  artistInfo: {
    flex: 1,
  },
  artistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  artistRole: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
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
