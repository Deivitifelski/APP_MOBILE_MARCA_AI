import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getCurrentUser } from '../services/supabase/authService';
import { getArtists, updateArtist } from '../services/supabase/artistService';

export default function ConfiguracoesArtistaScreen() {
  const [artist, setArtist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
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
        Alert.alert('Erro', 'Nenhum artista encontrado.');
        router.back();
        return;
      }

      const currentArtist = artists[0];
      setArtist(currentArtist);
      setName(currentArtist.name || '');
      setProfileUrl(currentArtist.profile_url || '');
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar dados do artista');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!artist) return;

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
        Alert.alert('Sucesso', 'Dados do artista atualizados com sucesso!');
        setIsEditing(false);
        loadArtistData(); // Recarregar dados
      } else {
        Alert.alert('Erro', error || 'Erro ao atualizar dados do artista');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setName(artist?.name || '');
    setProfileUrl(artist?.profile_url || '');
    setIsEditing(false);
  };

  const handleManageCollaborators = () => {
    router.push('/colaboradores-artista');
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon as any} size={20} color="#667eea" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Configurações do Artista</Text>
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
        <Text style={styles.title}>Configurações do Artista</Text>
        {!isEditing ? (
          <TouchableOpacity 
            onPress={() => setIsEditing(true)}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Editar</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity 
              onPress={handleCancel}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleSave}
              style={styles.saveButton}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Informações do artista */}
        {artist && (
          <View style={styles.artistCard}>
            <View style={styles.artistAvatar}>
              {artist.profile_url ? (
                <Text style={styles.avatarPlaceholder}>Foto</Text>
              ) : (
                <Ionicons name="musical-notes" size={40} color="#667eea" />
              )}
            </View>
            <View style={styles.artistInfo}>
              <Text style={styles.artistName}>{artist.name}</Text>
              <Text style={styles.artistRole}>
                {artist.role === 'owner' ? 'Proprietário' : 'Colaborador'}
              </Text>
            </View>
          </View>
        )}

        {/* Formulário de edição */}
        {isEditing && (
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nome do Artista *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Digite o nome do artista"
                editable={isEditing}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>URL da Foto de Perfil</Text>
              <TextInput
                style={styles.input}
                value={profileUrl}
                onChangeText={setProfileUrl}
                placeholder="URL da foto (opcional)"
                editable={isEditing}
              />
            </View>
          </View>
        )}

        {/* Configurações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gerenciamento</Text>
          
          {renderSettingItem(
            'people',
            'Colaboradores',
            'Gerenciar colaboradores do artista',
            handleManageCollaborators
          )}
          
          {renderSettingItem(
            'calendar',
            'Eventos',
            'Ver todos os eventos do artista'
          )}
          
          {renderSettingItem(
            'analytics',
            'Relatórios',
            'Relatórios de performance'
          )}
        </View>

        {/* Configurações do artista */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configurações</Text>
          
          {renderSettingItem(
            'notifications',
            'Notificações',
            'Configurar notificações de eventos'
          )}
          
          {renderSettingItem(
            'share',
            'Compartilhamento',
            'Configurar compartilhamento do perfil'
          )}
          
          {renderSettingItem(
            'shield-checkmark',
            'Privacidade',
            'Configurações de privacidade'
          )}
        </View>

        {/* Informações adicionais */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#667eea" />
          <Text style={styles.infoText}>
            Como proprietário, você pode gerenciar colaboradores e configurar todas as opções do artista.
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
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#667eea',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
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
    width: 60,
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
  artistCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  artistAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarPlaceholder: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
  },
  artistInfo: {
    flex: 1,
  },
  artistName: {
    fontSize: 20,
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
    shadowOffset: { width: 0, height: 2 },
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  settingItem: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
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
