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
import { getCurrentUser } from '../../services/supabase/authService';
import { getEventsByMonth } from '../../services/supabase/eventService';
import { getExpensesByEvent } from '../../services/supabase/expenseService';
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventWithExpenses[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    loadFinancialData();
  }, [currentMonth, currentYear]);

  const loadFinancialData = async () => {
    try {
      setIsLoading(true);
      
      // Obter o usuário atual
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        return;
      }

      // Buscar eventos do mês
      const { events: monthEvents, error: eventsError } = await getEventsByMonth(user.id, currentYear, currentMonth);
      
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

  // Todas as despesas de todos os eventos
  const allExpenses = events.flatMap(event => 
    event.expenses.map(expense => ({
      ...expense,
      eventName: event.name,
      eventDate: event.event_date
    }))
  );

  const renderExpense = ({ item }: { item: any }) => (
    <View style={styles.expenseItem}>
      <View style={styles.expenseInfo}>
        <Text style={styles.expenseName}>{item.name}</Text>
        <Text style={styles.expenseValue}>{formatCurrency(item.value)}</Text>
      </View>
      {item.receipt_url && (
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => downloadFile(item.receipt_url, `${item.name}_comprovante`)}
        >
          <Ionicons name="download" size={16} color="#667eea" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAllExpense = ({ item }: { item: any }) => (
    <View style={styles.allExpenseCard}>
      <View style={styles.allExpenseHeader}>
        <View style={styles.allExpenseInfo}>
          <Text style={styles.allExpenseName}>{item.name}</Text>
          <Text style={styles.allExpenseEvent}>{item.eventName}</Text>
          <Text style={styles.allExpenseDate}>{formatDate(item.eventDate)}</Text>
        </View>
        <View style={styles.allExpenseValue}>
          <Text style={styles.allExpenseAmount}>{formatCurrency(item.value)}</Text>
          {item.receipt_url && (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => downloadFile(item.receipt_url, `${item.name}_comprovante`)}
            >
              <Ionicons name="download" size={16} color="#667eea" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const renderEvent = ({ item }: { item: EventWithExpenses }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.eventInfo}>
          <Text style={styles.eventName}>{item.name}</Text>
          <Text style={styles.eventDate}>{formatDate(item.event_date)}</Text>
        </View>
        <View style={styles.eventValues}>
          <Text style={styles.eventRevenue}>
            {formatCurrency(item.value || 0)}
          </Text>
          <Text style={styles.eventProfit}>
            {formatCurrency((item.value || 0) - item.totalExpenses)}
          </Text>
        </View>
      </View>
      
      {item.expenses.length > 0 && (
        <View style={styles.expensesSection}>
          <Text style={styles.expensesTitle}>Despesas:</Text>
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Financeiro</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando dados financeiros...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Financeiro</Text>
        
        {/* Navegação de mês */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color="#667eea" />
          </TouchableOpacity>
          
          <Text style={styles.monthText}>
            {months[currentMonth]} {currentYear}
          </Text>
          
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color="#667eea" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Resumo financeiro */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Lucro Líquido</Text>
            <Text style={[styles.summaryValue, { color: netProfit >= 0 ? '#4CAF50' : '#F44336' }]}>
              {formatCurrency(netProfit)}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Receita Bruta</Text>
              <Text style={[styles.summaryItemValue, { color: '#4CAF50' }]}>
                {formatCurrency(totalRevenue)}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Despesas Totais</Text>
              <Text style={[styles.summaryItemValue, { color: '#F44336' }]}>
                {formatCurrency(totalExpenses)}
              </Text>
            </View>
          </View>
        </View>

        {/* Lista de eventos */}
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>
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

        {/* Lista de despesas por evento */}
        {allExpenses.length > 0 && (
          <View style={styles.expensesSection}>
            <Text style={styles.sectionTitle}>
              Despesas por Evento ({allExpenses.length})
            </Text>
            
            {events.map((event) => (
              event.expenses.length > 0 && (
                <View key={event.id} style={styles.eventExpensesContainer}>
                  <View style={styles.eventExpensesHeader}>
                    <Text style={styles.eventExpensesTitle}>{event.name}</Text>
                    <Text style={styles.eventExpensesDate}>{formatDate(event.event_date)}</Text>
                    <Text style={styles.eventExpensesTotal}>
                      Total: {formatCurrency(event.totalExpenses)}
                    </Text>
                  </View>
                  
                  <FlatList
                    data={event.expenses}
                    renderItem={renderAllExpense}
                    keyExtractor={(expense) => expense.id}
                    scrollEnabled={false}
                  />
                </View>
              )
            ))}
          </View>
        )}
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
  },
  eventRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 2,
  },
  eventProfit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
  allExpenseCard: {
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
  allExpenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  allExpenseInfo: {
    flex: 1,
  },
  allExpenseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  allExpenseEvent: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 2,
  },
  allExpenseDate: {
    fontSize: 12,
    color: '#666',
  },
  allExpenseValue: {
    alignItems: 'flex-end',
  },
  allExpenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 8,
  },
  eventExpensesContainer: {
    marginBottom: 20,
  },
  eventExpensesHeader: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  eventExpensesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  eventExpensesDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eventExpensesTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336',
  },
});

