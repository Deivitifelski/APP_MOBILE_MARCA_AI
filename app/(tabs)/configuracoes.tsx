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
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getCurrentUser } from '../../services/supabase/authService';
import { getUserProfile, UserProfile } from '../../services/supabase/userService';
import { getArtists } from '../../services/supabase/artistService';
import { createFeedback } from '../../services/supabase/feedbackService';
import { useTheme } from '../../contexts/ThemeContext';

export default function ConfiguracoesScreen() {
  const { isDarkMode, toggleDarkMode, colors } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [hasArtist, setHasArtist] = useState(false);
  const [currentArtist, setCurrentArtist] = useState<any>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [helpForm, setHelpForm] = useState({
    type: 'bug' as 'bug' | 'improvement',
    subject: '',
    message: '',
  });

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

  const handleHelpSupport = () => {
    setShowHelpModal(true);
  };

  const handleTermsOfUse = () => {
    setShowTermsModal(true);
  };

  const handleSendHelp = async () => {
    if (!helpForm.subject.trim() || !helpForm.message.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      // Salvar feedback no banco de dados
      const feedbackResult = await createFeedback({
        tipo: helpForm.type === 'bug' ? 'bug' : 'melhoria',
        titulo: helpForm.subject,
        descricao: helpForm.message
      });

      if (feedbackResult.success) {
        setShowHelpModal(false);
        setHelpForm({ type: 'bug', subject: '', message: '' });
        Alert.alert('Sucesso', 'Seu feedback foi enviado com sucesso! A equipe de suporte será notificada.');
      } else {
        Alert.alert('Erro', feedbackResult.error || 'Erro ao enviar feedback. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao enviar feedback:', error);
      Alert.alert('Erro', 'Erro ao processar seu feedback. Tente novamente.');
    }
  };


  const handleCopyEmail = async () => {
    try {
      await setStringAsync('contato@marcaai.com');
      Alert.alert('Sucesso', 'Email copiado para a área de transferência!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível copiar o email.');
    }
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
              'Central de ajuda e contato',
              handleHelpSupport
            )}
            
            {renderSettingItem(
              'document-text',
              'Termos de Uso',
              'Termos e condições',
              handleTermsOfUse
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

      {/* Modal de Ajuda e Suporte */}
      <Modal
        visible={showHelpModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <SafeAreaView style={[dynamicStyles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[dynamicStyles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setShowHelpModal(false)}
              style={dynamicStyles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[dynamicStyles.modalTitle, { color: colors.text }]}>Ajuda e Suporte</Text>
            <View style={dynamicStyles.modalPlaceholder} />
          </View>

          <ScrollView style={dynamicStyles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Seção de Contato Direto */}
            <View style={[dynamicStyles.helpSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[dynamicStyles.helpSectionTitle, { color: colors.text }]}>Contato Direto</Text>
              <Text style={[dynamicStyles.helpSectionSubtitle, { color: colors.textSecondary }]}>
                Entre em contato conosco diretamente
              </Text>
              
              {/* Email com ícone de copiar */}
              <View style={[dynamicStyles.emailContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={dynamicStyles.emailInfo}>
                  <Ionicons name="mail" size={20} color={colors.primary} />
                  <Text style={[dynamicStyles.emailText, { color: colors.text }]}>contato@marcaai.com</Text>
                </View>
                <TouchableOpacity
                  style={[dynamicStyles.copyButton, { backgroundColor: colors.primary }]}
                  onPress={handleCopyEmail}
                >
                  <Ionicons name="copy" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Seção de Bug Report / Melhoria */}
            <View style={[dynamicStyles.helpSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[dynamicStyles.helpSectionTitle, { color: colors.text }]}>Reportar Problema ou Sugerir Melhoria</Text>
              <Text style={[dynamicStyles.helpSectionSubtitle, { color: colors.textSecondary }]}>
                Ajude-nos a melhorar o aplicativo
              </Text>

              {/* Tipo de Solicitação */}
              <View style={dynamicStyles.typeSelector}>
                <TouchableOpacity
                  style={[
                    dynamicStyles.typeButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    helpForm.type === 'bug' && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => setHelpForm({ ...helpForm, type: 'bug' })}
                >
                  <Ionicons 
                    name="bug" 
                    size={20} 
                    color={helpForm.type === 'bug' ? '#fff' : colors.text} 
                  />
                  <Text style={[
                    dynamicStyles.typeButtonText,
                    { color: helpForm.type === 'bug' ? '#fff' : colors.text }
                  ]}>
                    Reportar Bug
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    dynamicStyles.typeButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    helpForm.type === 'improvement' && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => setHelpForm({ ...helpForm, type: 'improvement' })}
                >
                  <Ionicons 
                    name="bulb" 
                    size={20} 
                    color={helpForm.type === 'improvement' ? '#fff' : colors.text} 
                  />
                  <Text style={[
                    dynamicStyles.typeButtonText,
                    { color: helpForm.type === 'improvement' ? '#fff' : colors.text }
                  ]}>
                    Sugerir Melhoria
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Assunto */}
              <View style={dynamicStyles.inputGroup}>
                <Text style={[dynamicStyles.inputLabel, { color: colors.text }]}>Assunto *</Text>
                <TextInput
                  style={[dynamicStyles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={helpForm.subject}
                  onChangeText={(text) => setHelpForm({ ...helpForm, subject: text })}
                  placeholder="Descreva brevemente o problema ou sugestão"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Mensagem */}
              <View style={dynamicStyles.inputGroup}>
                <Text style={[dynamicStyles.inputLabel, { color: colors.text }]}>Descrição Detalhada *</Text>
                <TextInput
                  style={[dynamicStyles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={helpForm.message}
                  onChangeText={(text) => setHelpForm({ ...helpForm, message: text })}
                  placeholder="Descreva o problema ou sugestão em detalhes..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>

              {/* Botão Enviar */}
              <TouchableOpacity
                style={[dynamicStyles.sendButton, { backgroundColor: colors.primary }]}
                onPress={handleSendHelp}
              >
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={dynamicStyles.sendButtonText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de Termos de Uso */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <SafeAreaView style={[dynamicStyles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[dynamicStyles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setShowTermsModal(false)}
              style={dynamicStyles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[dynamicStyles.modalTitle, { color: colors.text }]}>Termos de Uso</Text>
          </View>
          
          <ScrollView style={dynamicStyles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={[dynamicStyles.termsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[dynamicStyles.termsTitle, { color: colors.text }]}>Termos de Uso - Marca AI</Text>
              <Text style={[dynamicStyles.termsLastUpdated, { color: colors.textSecondary }]}>
                Última atualização: {new Date().toLocaleDateString('pt-BR')}
              </Text>
              
              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>1. Aceitação dos Termos</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                Ao utilizar o aplicativo Marca AI, você concorda em cumprir e estar sujeito a estes Termos de Uso. 
                Se você não concordar com qualquer parte destes termos, não deve usar nosso aplicativo.
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>2. Descrição do Serviço</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                O Marca AI é uma plataforma digital que conecta artistas musicais com contratantes, facilitando 
                a gestão de eventos, agendamentos e transações financeiras relacionadas a apresentações musicais.
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>3. Contas de Usuário</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                • Você é responsável por manter a confidencialidade de sua conta e senha{'\n'}
                • Você deve fornecer informações precisas e atualizadas{'\n'}
                • Você é responsável por todas as atividades que ocorrem em sua conta{'\n'}
                • Você deve notificar-nos imediatamente sobre qualquer uso não autorizado
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>4. Uso Aceitável</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                Você concorda em não usar o aplicativo para:{'\n'}
                • Atividades ilegais ou não autorizadas{'\n'}
                • Transmitir conteúdo ofensivo, difamatório ou inadequado{'\n'}
                • Interferir no funcionamento do aplicativo{'\n'}
                • Tentar acessar contas de outros usuários{'\n'}
                • Violar direitos de propriedade intelectual
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>5. Pagamentos e Transações</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                • Todas as transações financeiras são processadas de forma segura{'\n'}
                • Os valores são definidos pelos próprios usuários{'\n'}
                • Taxas de transação podem ser aplicadas conforme nossa política{'\n'}
                • Reembolsos são tratados caso a caso
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>6. Propriedade Intelectual</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                O aplicativo e seu conteúdo são protegidos por direitos autorais e outras leis de propriedade 
                intelectual. Você não pode copiar, modificar ou distribuir nosso conteúdo sem autorização.
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>7. Privacidade</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                Sua privacidade é importante para nós. Consulte nossa Política de Privacidade para entender 
                como coletamos, usamos e protegemos suas informações pessoais.
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>8. Limitação de Responsabilidade</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                O Marca AI não se responsabiliza por:{'\n'}
                • Danos diretos, indiretos ou consequenciais{'\n'}
                • Perda de dados ou interrupção de serviços{'\n'}
                • Ações de terceiros ou outros usuários{'\n'}
                • Problemas técnicos ou falhas do sistema
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>9. Modificações dos Termos</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão 
                em vigor imediatamente após a publicação. O uso continuado do aplicativo constitui aceitação 
                dos novos termos.
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>10. Rescisão</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                Podemos suspender ou encerrar sua conta a qualquer momento, com ou sem aviso prévio, por 
                violação destes termos ou por qualquer outro motivo a nosso critério.
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>11. Lei Aplicável</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                Estes termos são regidos pelas leis brasileiras. Qualquer disputa será resolvida nos tribunais 
                competentes do Brasil.
              </Text>

              <Text style={[dynamicStyles.termsSectionTitle, { color: colors.text }]}>12. Contato</Text>
              <Text style={[dynamicStyles.termsText, { color: colors.text }]}>
                Para questões sobre estes Termos de Uso, entre em contato conosco através do email: 
                contato@marcaai.com
              </Text>

              <View style={[dynamicStyles.termsFooter, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[dynamicStyles.termsFooterText, { color: colors.textSecondary }]}>
                  Ao continuar usando o Marca AI, você confirma que leu, entendeu e concorda com estes Termos de Uso.
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  // Estilos do modal de ajuda
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  modalPlaceholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  helpSection: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  helpSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  helpSectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  emailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emailText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  copyButton: {
    padding: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 120,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos para o modal de Termos de Uso
  termsContainer: {
    margin: 20,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  termsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  termsLastUpdated: {
    fontSize: 12,
    marginBottom: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  termsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  termsFooter: {
    marginTop: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  termsFooterText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
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
