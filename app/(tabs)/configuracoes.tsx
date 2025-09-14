import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getCurrentUser } from '../../services/supabase/authService';
import { getUserProfile, UserProfile } from '../../services/supabase/userService';
import { getArtists } from '../../services/supabase/artistService';

export default function ConfiguracoesScreen() {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [hasArtist, setHasArtist] = useState(false);
  const [currentArtist, setCurrentArtist] = useState<any>(null);

  useEffect(() => {
    loadUserProfile();
    loadArtistData();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoadingProfile(true);
      
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        console.error('Erro ao obter usuário atual:', userError);
        return;
      }

      const { profile, error: profileError } = await getUserProfile(user.id);
      
      if (profileError) {
        console.error('Erro ao carregar perfil:', profileError);
        return;
      }

      setUserProfile(profile);
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadArtistData = async () => {
    try {
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        return;
      }

      const { artists, error: artistsError } = await getArtists(user.id);
      
      if (!artistsError && artists && artists.length > 0) {
        setHasArtist(true);
        setCurrentArtist(artists[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do artista:', error);
    }
  };

  const handleEditUser = () => {
    router.push('/editar-usuario');
  };

  const handleArtistSettings = () => {
    router.push('/configuracoes-artista');
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza que deseja sair?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => {
            // TODO: Implementar logout do Supabase
            router.replace('/login');
          },
        },
      ]
    );
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Seção: Usuário */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usuário</Text>
          
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={40} color="#667eea" />
            </View>
            <View style={styles.profileInfo}>
              {isLoadingProfile ? (
                <ActivityIndicator size="small" color="#667eea" />
              ) : (
                <>
                  <Text style={styles.profileName}>
                    {userProfile?.name || 'Usuário Marca AI'}
                  </Text>
                  <Text style={styles.profileEmail}>
                    {userProfile?.email || 'usuario@marcaai.com'}
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity style={styles.editButton} onPress={handleEditUser}>
              <Ionicons name="pencil" size={16} color="#667eea" />
            </TouchableOpacity>
          </View>

          {renderSettingItem(
            'swap-horizontal',
            'Selecionar Artista',
            'Alternar entre artistas colaboradores',
            () => router.push('/selecionar-artista')
          )}

          {renderSettingItem(
            'person-circle',
            'Perfil do Usuário',
            'Editar informações pessoais',
            handleEditUser
          )}
        </View>

        {/* Seção: Artista */}
        {hasArtist && currentArtist && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Artista</Text>
            
            <View style={styles.artistCard}>
              <View style={styles.artistAvatar}>
                <Ionicons name="musical-notes" size={24} color="#667eea" />
              </View>
              <View style={styles.artistInfo}>
                <Text style={styles.artistName}>{currentArtist.name}</Text>
                <Text style={styles.artistRole}>
                  {currentArtist.role === 'owner' ? 'Proprietário' : 'Colaborador'}
                </Text>
              </View>
              <TouchableOpacity style={styles.editButton} onPress={handleArtistSettings}>
                <Ionicons name="settings" size={16} color="#667eea" />
              </TouchableOpacity>
            </View>

            {renderSettingItem(
              'people',
              'Colaboradores',
              'Gerenciar colaboradores do artista',
              () => router.push('/colaboradores-artista')
            )}
            
            {renderSettingItem(
              'musical-notes',
              'Configurações do Artista',
              'Editar informações do artista',
              handleArtistSettings
            )}

            {renderSettingItem(
              'mail',
              'Convites Enviados',
              'Ver e gerenciar convites',
              () => router.push('/convites-enviados')
            )}
          </View>
        )}

        {/* Seção: Preferências do App */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferências do App</Text>
          
          {renderSettingItem(
            'notifications',
            'Notificações',
            'Receber notificações sobre shows',
            undefined,
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#f0f0f0', true: '#667eea' }}
              thumbColor={notifications ? '#fff' : '#f4f3f4'}
            />
          )}
          
          {renderSettingItem(
            'moon',
            'Modo Escuro',
            'Usar tema escuro',
            undefined,
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#f0f0f0', true: '#667eea' }}
              thumbColor={darkMode ? '#fff' : '#f4f3f4'}
            />
          )}
          
          {renderSettingItem(
            'sync',
            'Sincronização Automática',
            'Sincronizar dados automaticamente',
            undefined,
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: '#f0f0f0', true: '#667eea' }}
              thumbColor={autoSync ? '#fff' : '#f4f3f4'}
            />
          )}
        </View>

        {/* Conta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>
          
          {renderSettingItem(
            'person-circle',
            'Perfil',
            'Editar informações pessoais',
            handleEditUser
          )}
          
          {renderSettingItem(
            'lock-closed',
            'Segurança',
            'Alterar senha e configurações de segurança'
          )}
          
          {renderSettingItem(
            'card',
            'Pagamentos',
            'Gerenciar métodos de pagamento'
          )}
        </View>

        {/* Aplicativo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aplicativo</Text>
          
          {renderSettingItem(
            'help-circle',
            'Ajuda e Suporte',
            'Central de ajuda e contato'
          )}
          
          {renderSettingItem(
            'document-text',
            'Termos de Uso',
            'Termos e condições'
          )}
          
          {renderSettingItem(
            'shield-checkmark',
            'Política de Privacidade',
            'Como protegemos seus dados'
          )}
          
          {renderSettingItem(
            'information-circle',
            'Sobre o App',
            'Versão 1.0.0'
          )}
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="#F44336" />
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </TouchableOpacity>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
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
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  artistCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 16,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  artistInfo: {
    flex: 1,
  },
  artistName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  artistRole: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
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
  logoutButton: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginLeft: 8,
  },
});
