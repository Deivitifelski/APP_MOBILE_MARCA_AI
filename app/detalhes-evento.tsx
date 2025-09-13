import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getEventById, Event } from '../services/supabase/eventService';
import { getTotalExpensesByEvent } from '../services/supabase/expenseService';

export default function DetalhesEventoScreen() {
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadEventData = async () => {
    try {
      const [eventResult, expensesResult] = await Promise.all([
        getEventById(eventId),
        getTotalExpensesByEvent(eventId)
      ]);

      if (eventResult.success) {
        setEvent(eventResult.event || null);
      } else {
        Alert.alert('Erro', eventResult.error || 'Erro ao carregar evento');
      }

      if (expensesResult.success) {
        setTotalExpenses(expensesResult.total || 0);
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar dados do evento');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEventData();
  }, [eventId]);

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

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // HH:MM
  };


  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Detalhes do Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando evento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Detalhes do Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ff4444" />
          <Text style={styles.errorTitle}>Evento não encontrado</Text>
          <Text style={styles.errorSubtitle}>
            O evento solicitado não foi encontrado ou foi removido.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const profit = (event.value || 0) - totalExpenses;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Detalhes do Evento</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Informações do Evento */}
        <View style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventName}>{event.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: event.confirmed ? '#4CAF50' : '#FF9800' }]}>
              <Ionicons 
                name={event.confirmed ? 'checkmark-circle' : 'time'} 
                size={16} 
                color="#fff" 
              />
              <Text style={styles.statusText}>{event.confirmed ? 'Confirmado' : 'A Confirmar'}</Text>
            </View>
          </View>

          <View style={styles.eventDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={20} color="#667eea" />
              <Text style={styles.detailText}>{formatDate(event.event_date)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time" size={20} color="#667eea" />
              <Text style={styles.detailText}>
                {formatTime(event.start_time)} - {formatTime(event.end_time)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color="#667eea" />
              <Text style={styles.detailText}>{event.city || 'Não informado'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="call" size={20} color="#667eea" />
              <Text style={styles.detailText}>{event.contractor_phone || 'Não informado'}</Text>
            </View>
          </View>
        </View>

        {/* Resumo Financeiro */}
        <View style={styles.financialCard}>
          <Text style={styles.financialTitle}>Resumo Financeiro</Text>
          
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Valor do Evento:</Text>
            <Text style={styles.financialValue}>{formatCurrency(event.value || 0)}</Text>
          </View>

          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Total de Despesas:</Text>
            <Text style={[styles.financialValue, { color: '#ff4444' }]}>
              -{formatCurrency(totalExpenses)}
            </Text>
          </View>

          <View style={[styles.financialRow, styles.financialTotal]}>
            <Text style={styles.financialTotalLabel}>Lucro Líquido:</Text>
            <Text style={[
              styles.financialTotalValue,
              { color: profit >= 0 ? '#4CAF50' : '#ff4444' }
            ]}>
              {formatCurrency(profit)}
            </Text>
          </View>
        </View>

        {/* Ações */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push({
              pathname: '/despesas-evento',
              params: { 
                eventId: event.id, 
                eventName: event.name 
              }
            })}
          >
            <Ionicons name="receipt" size={24} color="#667eea" />
            <Text style={styles.actionButtonText}>Gerenciar Despesas</Text>
            <Ionicons name="chevron-forward" size={20} color="#667eea" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push({
              pathname: '/adicionar-despesa',
              params: { 
                eventId: event.id, 
                eventName: event.name 
              }
            })}
          >
            <Ionicons name="add-circle" size={24} color="#4CAF50" />
            <Text style={styles.actionButtonText}>Adicionar Despesa</Text>
            <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eventName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  eventDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  financialCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  financialTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  financialLabel: {
    fontSize: 16,
    color: '#666',
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  financialTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
    marginTop: 8,
  },
  financialTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  financialTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 40,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    marginLeft: 12,
  },
});
