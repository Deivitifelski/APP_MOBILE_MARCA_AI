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
import { useTheme } from '../../contexts/ThemeContext';

export default function ConfiguracoesScreen() {
  const { isDarkMode, toggleDarkMode, colors } = useTheme();
  const [notifications, setNotifications] = useState(true);
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

  const handleCreateNewArtist = () => {
    // Navegar diretamente para a tela de cadastro do artista
    router.push('/cadastro-artista');
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
      style={dynamicStyles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={dynamicStyles.settingLeft}>
        <View style={dynamicStyles.settingIcon}>
          <Ionicons name={icon as any} size={20} color="#667eea" />
        </View>
        <View style={dynamicStyles.settingText}>
          <Text style={dynamicStyles.settingTitle}>{title}</Text>
          {subtitle && <Text style={dynamicStyles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (
        <Ionicons name="chevron-forward" size={20} color={isDarkMode ? "#666" : "#ccc"} />
      )}
    </TouchableOpacity>
  );

  // Estilos dinâmicos baseados no modo escuro
  const dynamicStyles = createDynamicStyles(isDarkMode, colors);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.title}>Configurações</Text>
      </View>

      <ScrollView style={dynamicStyles.content}>
        {/* Seção: Usuário */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Usuário</Text>
          
          <View style={dynamicStyles.profileCard}>
            <View style={dynamicStyles.profileAvatar}>
              <Ionicons name="person" size={40} color="#667eea" />
            </View>
            <View style={dynamicStyles.profileInfo}>
              {isLoadingProfile ? (
                <ActivityIndicator size="small" color="#667eea" />
              ) : (
                <>
                  <Text style={dynamicStyles.profileName}>
                    {userProfile?.name || 'Usuário Marca AI'}
                  </Text>
                  <Text style={dynamicStyles.profileEmail}>
                    {userProfile?.email || 'usuario@marcaai.com'}
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity style={dynamicStyles.editButton} onPress={handleEditUser}>
              <Ionicons name="pencil" size={16} color="#667eea" />
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.settingsCard}>
            {renderSettingItem(
              'swap-horizontal',
              'Selecionar Artista',
              'Alternar entre artistas colaboradores',
              () => router.push('/selecionar-artista')
            )}
          </View>
        </View>

        {/* Seção: Artista */}
        {hasArtist && currentArtist && (
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Artista</Text>
            
            <View style={dynamicStyles.artistCard}>
              <View style={dynamicStyles.artistAvatar}>
                <Ionicons name="musical-notes" size={24} color="#667eea" />
              </View>
              <View style={dynamicStyles.artistInfo}>
                <Text style={dynamicStyles.artistName}>{currentArtist.name}</Text>
                <Text style={dynamicStyles.artistRole}>
                  {currentArtist.role === 'owner' ? 'Proprietário' : 'Colaborador'}
                </Text>
              </View>
              <TouchableOpacity style={dynamicStyles.editButton} onPress={handleArtistSettings}>
                <Ionicons name="settings" size={16} color="#667eea" />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.settingsCard}>
              {renderSettingItem(
                'add-circle',
                'Criar Novo Artista',
                'Criar um novo perfil de artista',
                handleCreateNewArtist
              )}

              {renderSettingItem(
                'people',
                'Colaboradores',
                'Gerenciar colaboradores do artista',
                () => router.push('/colaboradores-artista')
              )}

              {renderSettingItem(
                'log-out',
                'Sair do Artista',
                'Remover-se do artista atual',
                () => router.push('/sair-artista')
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
          </View>
        )}

        {/* Seção: Preferências do App */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Preferências</Text>
          
          <View style={dynamicStyles.settingsCard}>
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
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: '#f0f0f0', true: '#667eea' }}
                thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
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
        </View>

        {/* Conta */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Conta</Text>
          
          <View style={dynamicStyles.settingsCard}>
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
        </View>

        {/* Aplicativo */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Aplicativo</Text>
          
          <View style={dynamicStyles.settingsCard}>
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
        </View>

        {/* Logout */}
        <View style={dynamicStyles.section}>
          <TouchableOpacity style={dynamicStyles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color="#F44336" />
            <Text style={dynamicStyles.logoutText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Função para criar estilos dinâmicos baseados no modo escuro
const createDynamicStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  profileCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.secondary,
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
    color: colors.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  artistCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  artistAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.secondary,
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
    color: colors.text,
    marginBottom: 4,
  },
  artistRole: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  settingItem: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.secondary,
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
    color: colors.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  logoutButton: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
    marginLeft: 8,
  },
});

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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  settingsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  profileCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 15,
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
