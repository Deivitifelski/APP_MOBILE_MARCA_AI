import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEventsByMonth } from '../../services/supabase/eventService';
import { getExpensesByEvent } from '../../services/supabase/expenseService';
import { useActiveArtist } from '../../services/useActiveArtist';
import { useTheme } from '../../contexts/ThemeContext';
import { getUserPermissions } from '../../services/supabase/permissionsService';
import PermissionModal from '../../components/PermissionModal';
import { supabase } from '../../lib/supabase';
// import * as FileSystem from 'expo-file-system';
// import * as Sharing from 'expo-sharing';

interface EventWithExpenses {
  id: string;
  name: string;
  event_date: string;
  value?: number;
  expenses: any[];
  totalExpenses: number;
}

export default function FinanceiroScreen() {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventWithExpenses[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const { activeArtist, loadActiveArtist } = useActiveArtist();

  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    loadActiveArtist();
  }, []);

  useEffect(() => {
    if (activeArtist) {
      loadUserPermissions();
      loadFinancialData();
    }
  }, [activeArtist, currentMonth, currentYear]);

  const loadUserPermissions = async () => {
    if (!activeArtist) return;
    
    try {
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const permissions = await getUserPermissions(user.id, activeArtist.id);
      setUserPermissions(permissions);
      
      // Se for viewer, mostrar modal de permissão
      if (permissions?.role === 'viewer') {
        setShowPermissionModal(true);
      }
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    }
  };

  const loadFinancialData = async () => {
    if (!activeArtist) return;
    
    // Se for viewer, não carregar dados financeiros
    if (userPermissions?.role === 'viewer') {
      setEvents([]);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);

      // Buscar eventos do mês usando o artista ativo
      const { events: monthEvents, error: eventsError } = await getEventsByMonth(activeArtist.id, currentYear, currentMonth);
      
      if (eventsError) {
        Alert.alert('Erro', 'Erro ao carregar eventos');
        return;
      }

      // Para cada evento, buscar suas despesas
      const eventsWithExpenses = await Promise.all(
        (monthEvents || []).map(async (event) => {
          const { success, expenses, error: expensesError } = await getExpensesByEvent(event.id);
          
          if (!success || expensesError) {
            console.error('Erro ao carregar despesas do evento:', expensesError);
          }
          
          const totalExpenses = expenses?.reduce((sum, expense) => sum + expense.value, 0) || 0;
          
          return {
            ...event,
            expenses: expenses || [],
            totalExpenses
          };
        })
      );

      setEvents(eventsWithExpenses);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar dados financeiros');
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

  const downloadFile = async (url: string, filename: string) => {
    Alert.alert('Download', 'Funcionalidade de download será implementada em breve');
  };

  // Cálculos financeiros
  const totalRevenue = events.reduce((sum, event) => sum + (event.value || 0), 0);
  const totalExpenses = events.reduce((sum, event) => sum + event.totalExpenses, 0);
  const netProfit = totalRevenue - totalExpenses;


  const renderExpense = ({ item }: { item: any }) => (
    <View style={[styles.expenseItem, { backgroundColor: colors.secondary }]}>
      <View style={styles.expenseInfo}>
        <Text style={[styles.expenseName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.expenseValue, { color: colors.error }]}>{formatCurrency(item.value)}</Text>
      </View>
      {item.receipt_url && (
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => downloadFile(item.receipt_url, `${item.name}_comprovante`)}
        >
          <Ionicons name="download" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );


  const renderEvent = ({ item }: { item: EventWithExpenses }) => (
    <View style={[styles.eventCard, { backgroundColor: colors.surface }]}>
      <View style={styles.eventHeader}>
        <View style={styles.eventInfo}>
          <Text style={[styles.eventName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.eventDate, { color: colors.textSecondary }]}>{formatDate(item.event_date)}</Text>
        </View>
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
          <View style={[styles.eventValueRow, styles.eventNetRow]}>
            <Text style={[styles.eventNetLabel, { color: colors.text }]}>Líquido:</Text>
            <Text style={[styles.eventNet, { color: ((item.value || 0) - item.totalExpenses) >= 0 ? colors.success : colors.error }]}>
              {formatCurrency((item.value || 0) - item.totalExpenses)}
            </Text>
          </View>
        </View>
      </View>
      
      {item.expenses.length > 0 && (
        <View style={styles.expensesSection}>
          <Text style={[styles.expensesTitle, { color: colors.text }]}>Despesas:</Text>
          <FlatList
            data={item.expenses}
            renderItem={renderExpense}
            keyExtractor={(expense) => expense.id}
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  );

  if (isLoading) {
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
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando dados financeiros...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { 
        backgroundColor: colors.surface, 
        borderBottomColor: colors.border,
        paddingTop: insets.top + 20
      }]}>
        <Text style={[styles.title, { color: colors.text }]}>Financeiro</Text>
        
        {/* Navegação de mês */}
        <View style={styles.monthNavigation}>
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

      <ScrollView style={styles.content}>
        {/* Resumo financeiro */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Lucro Líquido</Text>
            <Text style={[styles.summaryValue, { color: netProfit >= 0 ? colors.success : colors.error }]}>
              {formatCurrency(netProfit)}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>Receita Bruta</Text>
              <Text style={[styles.summaryItemValue, { color: colors.success }]}>
                {formatCurrency(totalRevenue)}
              </Text>
            </View>
            
            <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>Despesas Totais</Text>
              <Text style={[styles.summaryItemValue, { color: colors.error }]}>
                {formatCurrency(totalExpenses)}
              </Text>
            </View>
          </View>
        </View>

        {/* Lista de eventos */}
        <View style={styles.eventsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Eventos de {months[currentMonth]} ({events.length})
          </Text>
          
          {events.length > 0 ? (
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
        message="Como visualizador, você não tem permissão para acessar dados financeiros. Entre em contato com um administrador para solicitar mais permissões."
        icon="lock-closed"
      />
    </View>
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
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
  },
  navButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#fff',
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
    color: '#666',
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
    backgroundColor: '#fff',
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
    color: '#666',
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
    color: '#333',
    marginBottom: 15,
  },
  transactionCard: {
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#666',
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
    color: '#666',
    marginRight: 8,
  },
  eventRevenue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  eventExpenses: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F44336',
  },
  eventNetRow: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 6,
    marginTop: 4,
    marginBottom: 0,
  },
  eventNetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
    borderTopColor: '#e9ecef',
  },
  expensesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 6,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  expenseValue: {
    fontSize: 12,
    color: '#666',
  },
  downloadButton: {
    padding: 8,
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
});

