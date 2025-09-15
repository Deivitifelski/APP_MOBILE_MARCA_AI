import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getExpensesByEvent, getTotalExpensesByEvent, deleteExpense, Expense } from '../services/supabase/expenseService';

export default function DespesasEventoScreen() {
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;
  const eventName = params.eventName as string;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadExpenses = async () => {
    try {
      const [expensesResult, totalResult] = await Promise.all([
        getExpensesByEvent(eventId),
        getTotalExpensesByEvent(eventId)
      ]);

      if (expensesResult.success) {
        setExpenses(expensesResult.expenses || []);
      } else {
        Alert.alert('Erro', expensesResult.error || 'Erro ao carregar despesas');
      }

      if (totalResult.success) {
        setTotalExpenses(totalResult.total || 0);
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar despesas');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [eventId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  const handleDeleteExpense = (expenseId: string, expenseName: string) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir a despesa "${expenseName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteExpense(expenseId);
            if (result.success) {
              loadExpenses();
            } else {
              Alert.alert('Erro', result.error || 'Erro ao excluir despesa');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const renderExpenseItem = (expense: Expense) => (
    <View key={expense.id} style={styles.expenseItem}>
      <View style={styles.expenseHeader}>
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseName}>{expense.name}</Text>
          <Text style={styles.expenseValue}>{formatCurrency(expense.value)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteExpense(expense.id, expense.name)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash" size={20} color="#ff4444" />
        </TouchableOpacity>
      </View>
      
      
      {expense.receipt_url && (
        <View style={styles.fileContainer}>
          <Ionicons 
            name="document" 
            size={16} 
            color="#667eea" 
          />
          <Text style={styles.fileText}>
            Comprovante anexado
          </Text>
        </View>
      )}
      
      <Text style={styles.expenseDate}>{formatDate(expense.created_at)}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Despesas do Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando despesas...</Text>
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
        <Text style={styles.title}>Despesas do Evento</Text>
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/adicionar-despesa',
            params: { eventId, eventName }
          })}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#667eea" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Resumo */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumo das Despesas</Text>
          <Text style={styles.summaryEvent}>{eventName}</Text>
          <Text style={styles.summaryTotal}>
            Total: {formatCurrency(totalExpenses)}
          </Text>
          <Text style={styles.summaryCount}>
            {expenses.length} {expenses.length === 1 ? 'despesa' : 'despesas'}
          </Text>
        </View>

        {/* Lista de Despesas */}
        {expenses.length > 0 ? (
          <View style={styles.expensesList}>
            {expenses.map(renderExpenseItem)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Nenhuma despesa cadastrada</Text>
            <Text style={styles.emptySubtitle}>
              Adicione despesas para acompanhar os gastos do evento
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push({
                pathname: '/adicionar-despesa',
                params: { eventId, eventName }
              })}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Adicionar Primeira Despesa</Text>
            </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
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
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  summaryEvent: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  summaryTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: 14,
    color: '#999',
  },
  expensesList: {
    gap: 12,
  },
  expenseItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  expenseValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  deleteButton: {
    padding: 4,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileText: {
    fontSize: 14,
    color: '#667eea',
    marginLeft: 6,
  },
  expenseDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
