import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingModal from '../../components/LoadingModal';
import PermissionModal from '../../components/PermissionModal';
import UpgradeModal from '../../components/UpgradeModal';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { generateFinancialReport } from '../../services/financialReportService';
import { getEventsByMonth } from '../../services/supabase/eventService';
import { getExpensesByEvent } from '../../services/supabase/expenseService';
import { canExportData } from '../../services/supabase/userService';
import { useActiveArtist } from '../../services/useActiveArtist';
// import * as FileSystem from 'expo-file-system';
// import * as Sharing from 'expo-sharing';

interface EventWithExpenses {
  id: string;
  name: string;
  event_date: string;
  value?: number;
  expenses: any[];
  totalExpenses: number;
  city?: string;
}

export default function FinanceiroScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventWithExpenses[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { activeArtist, loadActiveArtist } = useActiveArtist();
  
  // Estados para controle de acesso
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();
  

  // Obter usuário atual
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    loadActiveArtist();
  }, []);

  // ✅ Verificar permissões diretamente no banco quando artista mudar
  useEffect(() => {
    checkUserAccess();
  }, [activeArtist]);

  // Log quando hasAccess mudar
  useEffect(() => {
    console.log('🔄 Financeiro: Estado hasAccess MUDOU para:', hasAccess);
  }, [hasAccess]);

  const checkUserAccess = async () => {
    if (!activeArtist) {
      setHasAccess(null);
      setIsCheckingAccess(false);
      return;
    }

    try {
      setIsCheckingAccess(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('🚫 Financeiro: Usuário não autenticado');
        setHasAccess(false);
        setIsCheckingAccess(false);
        return;
      }

      console.log('🔍 Financeiro: Verificando acesso do usuário', {
        userId: user.id,
        artistId: activeArtist.id
      });

      // Buscar role diretamente na tabela artist_members
      const { data: memberData, error } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('artist_id', activeArtist.id)
        .single();

      if (error) {
        console.error('❌ Financeiro: Erro ao verificar permissões:', error);
        setHasAccess(false);
        setIsCheckingAccess(false);
        return;
      }

      const userRole = memberData?.role;
      console.log('📋 Financeiro: Role do usuário:', userRole);

      // ✅ Ocultar valores APENAS para viewers
      const isViewer = userRole === 'viewer';
      const hasPermission = !isViewer; // Todos menos viewer têm acesso
      
      console.log('🔐 Financeiro: Verificação de acesso:', {
        userRole,
        isViewer,
        hasPermission
      });
      
      setHasAccess(hasPermission);
      setIsCheckingAccess(false);
    } catch (error) {
      console.error('❌ Financeiro: Erro ao verificar acesso:', error);
      setHasAccess(false);
      setIsCheckingAccess(false);
    }
  };

  // ✅ Carregar dados financeiros (eventos sempre, valores só com permissão)
  useEffect(() => {
    if (activeArtist && hasAccess !== null) {
      loadFinancialData();
    }
  }, [activeArtist, hasAccess, currentMonth, currentYear]);

  const loadFinancialData = async () => {
    if (!activeArtist) {
      console.log('⚠️ Financeiro: Nenhum artista ativo');
      return;
    }
    
    console.log('💰 Financeiro: Carregando dados...', {
      artistId: activeArtist.id,
      hasAccess
    });
    
    try {
      setIsLoading(true);

      console.log('📅 Financeiro: Buscando eventos do mês:', { year: currentYear, month: currentMonth });
      
      // Buscar eventos do mês usando o artista ativo
      const { events: monthEvents, error: eventsError } = await getEventsByMonth(activeArtist.id, currentYear, currentMonth);
      
      if (eventsError) {
        console.error('❌ Financeiro: Erro ao carregar eventos:', eventsError);
        Alert.alert('Erro ao Carregar Eventos', eventsError || 'Não foi possível carregar os eventos do mês.');
        return;
      }

      console.log(`✅ Financeiro: ${monthEvents?.length || 0} eventos encontrados`);

      // Para cada evento, buscar suas despesas
      const eventsWithExpenses = await Promise.all(
        (monthEvents || []).map(async (event) => {
          const { success, expenses, error: expensesError } = await getExpensesByEvent(event.id);
          
          if (!success || expensesError) {
            console.error('❌ Financeiro: Erro ao carregar despesas do evento:', event.name, expensesError);
          }
          
          const totalExpenses = expenses?.reduce((sum, expense) => sum + expense.value, 0) || 0;
          
          return {
            ...event,
            expenses: expenses || [],
            totalExpenses
          };
        })
      );

      console.log('✅ Financeiro: Dados carregados com sucesso');
      setEvents(eventsWithExpenses);
    } catch (error: any) {
      console.error('💥 Financeiro: Erro inesperado:', error);
      Alert.alert(
        'Erro ao Carregar Finanças', 
        error?.message || 'Ocorreu um erro inesperado ao carregar os dados financeiros. Tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(currentMonth - 1);
    } else {
      newDate.setMonth(currentMonth + 1);
    }
    setSelectedDate(newDate);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) {
      return 'Data não informada';
    }
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR');
  };


  const handleExportFinancialReport = async () => {
    if (!activeArtist || events.length === 0) {
      Alert.alert('Aviso', 'Não há eventos para exportar neste mês.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
      return;
    }
    
    console.log('🔍 Verificando permissões de exportação para usuário:', currentUserId);
    
    // Verificar se o usuário pode exportar dados
    const { canExport, error: canExportError } = await canExportData(currentUserId);
    
    console.log('📊 Resultado da verificação:', { canExport, error: canExportError });
    
    if (canExportError) {
      Alert.alert('Erro', 'Erro ao verificar permissões: ' + canExportError);
      return;
    }

    if (!canExport) {
      console.log('🚫 Usuário não pode exportar - mostrando modal de upgrade');
      setShowUpgradeModal(true);
      return;
    }
    
    console.log('✅ Usuário pode exportar - continuando com exportação');
    
    // Modal melhorado para escolher tipo de relatório
    Alert.alert(
      '📊 Exportar Relatório Financeiro',
      `Período: ${months[currentMonth]} de ${currentYear}\nEventos: ${events.length}\n\nEscolha o tipo de relatório que deseja gerar:`,
      [
        {
          text: '💰 Com Valores Financeiros',
          onPress: () => generateReport(true)
        },
        {
          text: '🔒 Sem Valores Financeiros',
          onPress: () => generateReport(false)
        },
        {
          text: '❌ Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  const generateReport = async (includeFinancials: boolean) => {
    if (!activeArtist) return;
    
    setIsGeneratingReport(true);
    
    try {
      const result = await generateFinancialReport({
        events,
        month: currentMonth,
        year: currentYear,
        artistName: activeArtist.name,
        includeFinancials
      });
      
      if (!result.success) {
        Alert.alert('❌ Erro ao Gerar Relatório', result.error || 'Ocorreu um erro inesperado. Tente novamente.');
      }
    } catch {
      Alert.alert('❌ Erro ao Gerar Relatório', 'Ocorreu um erro inesperado ao gerar o relatório. Verifique sua conexão e tente novamente.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ✅ VERIFICAÇÃO DE SEGURANÇA: Cálculos financeiros só se tiver acesso
  const totalRevenue = hasAccess 
    ? events.reduce((sum, event) => sum + (event.value || 0), 0) 
    : 0;
  const totalExpenses = hasAccess 
    ? events.reduce((sum, event) => sum + event.totalExpenses, 0) 
    : 0;
  const netProfit = totalRevenue - totalExpenses;


  const handleEventPress = (eventId: string) => {
    if (!hasAccess) {
      setShowPermissionModal(true);
      return;
    }
    
    // Navegar para detalhes do evento
    router.push(`/detalhes-evento?id=${eventId}`);
  };

  const renderExpense = ({ item }: { item: any }) => (
    <View style={[styles.expenseItem, { backgroundColor: colors.secondary }]}>
      <View style={styles.expenseInfo}>
        <Text style={[styles.expenseName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.expenseValue, { color: colors.error }]}>{formatCurrency(item.value)}</Text>
      </View>
    </View>
  );


  const renderEvent = ({ item }: { item: EventWithExpenses }) => (
    <TouchableOpacity 
      style={[styles.eventCard, { backgroundColor: colors.surface }]}
      onPress={() => handleEventPress(item.id)}
      activeOpacity={hasAccess ? 0.7 : 1}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventInfo}>
          <View style={styles.eventNameContainer}>
            <Text style={[styles.eventName, { color: colors.text }]}>{item.name}</Text>
            {!hasAccess && (
              <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />
            )}
          </View>
          <Text style={[styles.eventDate, { color: colors.textSecondary }]}>{formatDate(item.event_date)}</Text>
        </View>
        {hasAccess ? (
          <View style={styles.eventValues}>
            <View style={styles.eventValueRow}>
              <Text style={[styles.eventValueLabel, { color: colors.textSecondary }]}>Receita:</Text>
              <Text style={[styles.eventRevenue, { color: colors.success }]}>
                {formatCurrency(item.value || 0)}
              </Text>
            </View>
            {item.totalExpenses > 0 && (
              <View style={styles.eventValueRow}>
                <Text style={[styles.eventValueLabel, { color: colors.textSecondary }]}>Despesas:</Text>
                <Text style={[styles.eventExpenses, { color: colors.error }]}>
                  -{formatCurrency(item.totalExpenses)}
                </Text>
              </View>
            )}
            <View style={[styles.eventValueRow, styles.eventNetRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.eventNetLabel, { color: colors.text }]}>Líquido:</Text>
              <Text style={[styles.eventNet, { color: ((item.value || 0) - item.totalExpenses) >= 0 ? colors.success : colors.error }]}>
                {formatCurrency((item.value || 0) - item.totalExpenses)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.eventValues}>
            <View style={[styles.lockedInfo, { backgroundColor: colors.background }]}>
              <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
              <Text style={[styles.lockedText, { color: colors.textSecondary }]}>Valores ocultos</Text>
            </View>
          </View>
        )}
      </View>
      
      {hasAccess && item.expenses.length > 0 && (
        <View style={[styles.expensesSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.expensesTitle, { color: colors.text }]}>Despesas:</Text>
          <FlatList
            data={item.expenses}
            renderItem={renderExpense}
            keyExtractor={(expense) => expense.id}
            scrollEnabled={false}
          />
        </View>
      )}
    </TouchableOpacity>
  );

  // Se ainda está verificando acesso, mostrar loading
  if (isCheckingAccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { 
          backgroundColor: colors.surface, 
          borderBottomColor: colors.border,
          paddingTop: insets.top + 20
        }]}>
          <Text style={[styles.title, { color: colors.text }]}>Financeiro</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Verificando permissões...</Text>
        </View>
      </View>
    );
  }

  // Se não há artista ativo, mostrar mensagem informativa
  if (!activeArtist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { 
          backgroundColor: colors.surface, 
          borderBottomColor: colors.border,
          paddingTop: insets.top + 20
        }]}>
          <Text style={[styles.title, { color: colors.text }]}>Financeiro</Text>
        </View>
        <View style={styles.noArtistContainer}>
          <View style={[styles.noArtistCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.noArtistIcon, { backgroundColor: colors.background }]}>
              <Ionicons name="musical-notes" size={60} color={colors.primary} />
            </View>
            <Text style={[styles.noArtistTitle, { color: colors.text }]}>
              Nenhum Artista Selecionado
            </Text>
            <Text style={[styles.noArtistMessage, { color: colors.textSecondary }]}>
              Para visualizar dados financeiros, você precisa ter um perfil de artista ativo.
            </Text>
            <Text style={[styles.noArtistSubMessage, { color: colors.textSecondary }]}>
              Após criar seu perfil de artista e começar a adicionar eventos, você poderá acompanhar:
            </Text>
            
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                  Receitas dos seus eventos
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                  Controle de despesas
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                  Relatórios financeiros
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                  Análise de lucratividade
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }


  // Removido o bloqueio total - viewers podem ver a tela mas sem valores

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { 
        backgroundColor: colors.surface, 
        borderBottomColor: colors.border,
        paddingTop: insets.top + 20
      }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.text }]}>Financeiro</Text>
          
          {/* Botão de exportação - apenas para owners e editors */}
          {hasAccess && events.length > 0 && (
            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: colors.primary }]}
              onPress={handleExportFinancialReport}
              disabled={isGeneratingReport}
            >
              <Ionicons 
                name={isGeneratingReport ? "hourglass" : "document-text"} 
                size={20} 
                color="#fff" 
              />
              <Text style={styles.exportButtonText}>
                {isGeneratingReport ? 'Gerando...' : 'Exportar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Navegação de mês */}
        <View style={[styles.monthNavigation, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          
          <Text style={[styles.monthText, { color: colors.text }]}>
            {months[currentMonth]} {currentYear}
          </Text>
          
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
        {/* Resumo financeiro */}
        {hasAccess ? (
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                Lucro Líquido
              </Text>
              <Text 
                style={[styles.summaryValue, { color: netProfit >= 0 ? colors.success : colors.error }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {formatCurrency(netProfit)}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  Receita Bruta
                </Text>
                <Text 
                  style={[styles.summaryItemValue, { color: colors.success }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCurrency(totalRevenue)}
                </Text>
              </View>
              
              <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  Despesas Totais
                </Text>
                <Text 
                  style={[styles.summaryItemValue, { color: colors.error }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCurrency(totalExpenses)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="lock-closed" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Valores Financeiros Ocultos</Text>
              <Text style={[styles.lockedSubtext, { color: colors.textSecondary }]}>
                Apenas gerentes e editores podem visualizar dados financeiros
              </Text>
            </View>
          </View>
        )}

        {/* Lista de eventos */}
        <View style={styles.eventsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Eventos de {months[currentMonth]} ({events.length})
          </Text>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Carregando dados financeiros...
              </Text>
            </View>
          ) : events.length > 0 ? (
            <FlatList
              data={events}
              renderItem={renderEvent}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                Nenhum evento encontrado para este mês
              </Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Modal de Permissão */}
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acesso Restrito"
        message="Apenas gerentes e editores podem visualizar os detalhes e valores financeiros dos eventos. Entre em contato com um gerente para solicitar mais permissões."
        icon="lock-closed"
      />

      {/* Modal de Upgrade */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Seja Premium"
        message="Desbloqueie recursos avançados, usuários ilimitados, relatórios detalhados e suporte prioritário para sua banda."
        feature="finances"
      />

      {/* Modal de Loading durante geração do PDF */}
      <LoadingModal
        visible={isGeneratingReport}
        message="Gerando documento..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 8,
  },
  navButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    padding: 20,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 15,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
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
  summaryItemLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryItemValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  transactionsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  transactionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 14,
    color: '#666',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  eventsSection: {
    padding: 20,
  },
  eventCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
  },
  eventValues: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  eventValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventValueLabel: {
    fontSize: 12,
    marginRight: 8,
  },
  eventRevenue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventExpenses: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventNetRow: {
    borderTopWidth: 1,
    paddingTop: 6,
    marginTop: 4,
    marginBottom: 0,
  },
  eventNetLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  eventNet: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expensesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  expensesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseName: {
    fontSize: 14,
    marginBottom: 2,
  },
  expenseValue: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  noArtistContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  noArtistCard: {
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 400,
    width: '100%',
  },
  noArtistIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noArtistTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  noArtistMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  noArtistSubMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  featuresList: {
    width: '100%',
    alignItems: 'flex-start',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  featureText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  noAccessCard: {
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 400,
    width: '100%',
  },
  noAccessIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noAccessTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  noAccessMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  noAccessSubMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  lockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lockedSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});

