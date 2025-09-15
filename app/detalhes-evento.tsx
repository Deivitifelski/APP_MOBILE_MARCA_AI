import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getEventById, Event, updateEvent, UpdateEventData } from '../services/supabase/eventService';
import { getTotalExpensesByEvent } from '../services/supabase/expenseService';

// Componente para seleção de data
const DatePickerComponent = ({ 
  selectedDate, 
  onDateChange, 
  initialMonth, 
  initialYear 
}: { 
  selectedDate: Date; 
  onDateChange: (date: Date) => void;
  initialMonth: number;
  initialYear: number;
}) => {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedDay, setSelectedDay] = useState(selectedDate.getDate());

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const updateDate = (day: number) => {
    setSelectedDay(day);
    const newDate = new Date(selectedYear, selectedMonth, day);
    onDateChange(newDate);
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfWeek = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDayOfWeek = getFirstDayOfWeek(selectedMonth, selectedYear);
    const days = [];

    // Adicionar dias vazios no início
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // Adicionar dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const calendarDays = renderCalendar();

  return (
    <View style={styles.calendarContainer}>
      {/* Header do calendário */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          onPress={() => {
            if (selectedMonth === 0) {
              setSelectedMonth(11);
              setSelectedYear(selectedYear - 1);
            } else {
              setSelectedMonth(selectedMonth - 1);
            }
          }}
          style={styles.calendarNavButton}
        >
          <Ionicons name="chevron-back" size={24} color="#667eea" />
        </TouchableOpacity>
        
        <Text style={styles.calendarMonthYear}>
          {monthNames[selectedMonth]} {selectedYear}
        </Text>
        
        <TouchableOpacity
          onPress={() => {
            if (selectedMonth === 11) {
              setSelectedMonth(0);
              setSelectedYear(selectedYear + 1);
            } else {
              setSelectedMonth(selectedMonth + 1);
            }
          }}
          style={styles.calendarNavButton}
        >
          <Ionicons name="chevron-forward" size={24} color="#667eea" />
        </TouchableOpacity>
      </View>

      {/* Dias da semana */}
      <View style={styles.weekdayHeader}>
        {dayNames.map((day, index) => (
          <Text key={index} style={styles.weekdayText}>{day}</Text>
        ))}
      </View>

      {/* Grid de dias */}
      <View style={styles.daysGrid}>
        {calendarDays.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayItem,
              day === selectedDay && styles.selectedDay,
              !day && styles.dayItemEmpty
            ]}
            onPress={() => day && updateDate(day)}
            disabled={!day}
          >
            {day && (
              <Text style={[
                styles.dayText,
                day === selectedDay && styles.selectedDayText
              ]}>
                {day}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Componente para seleção de horário
const TimePickerComponent = ({ selectedTime, onTimeChange }: { selectedTime: Date; onTimeChange: (time: Date) => void }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const [selectedHour, setSelectedHour] = useState(selectedTime.getHours());
  const [selectedMinute, setSelectedMinute] = useState(selectedTime.getMinutes());

  React.useEffect(() => {
    setSelectedHour(selectedTime.getHours());
    setSelectedMinute(selectedTime.getMinutes());
  }, [selectedTime]);

  const updateTime = (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    const newTime = new Date(selectedTime);
    newTime.setHours(hour, minute, 0, 0);
    onTimeChange(newTime);
  };

  return (
    <View style={styles.timePickerContainer}>
      <View style={styles.timePickerRow}>
        {/* Seletor de horas */}
        <View style={styles.timePickerColumn}>
          <Text style={styles.timePickerLabel}>Hora</Text>
          <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
            {hours.map((hour) => (
              <TouchableOpacity
                key={hour}
                style={[
                  styles.timePickerItem,
                  hour === selectedHour && styles.selectedTimeItem
                ]}
                onPress={() => updateTime(hour, selectedMinute)}
              >
                <Text style={[
                  styles.timePickerText,
                  hour === selectedHour && styles.selectedTimeText
                ]}>
                  {hour.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Separador */}
        <Text style={styles.timeSeparator}>:</Text>

        {/* Seletor de minutos */}
        <View style={styles.timePickerColumn}>
          <Text style={styles.timePickerLabel}>Minuto</Text>
          <ScrollView style={styles.timePickerScroll} showsVerticalScrollIndicator={false}>
            {minutes.map((minute) => (
              <TouchableOpacity
                key={minute}
                style={[
                  styles.timePickerItem,
                  minute === selectedMinute && styles.selectedTimeItem
                ]}
                onPress={() => updateTime(selectedHour, minute)}
              >
                <Text style={[
                  styles.timePickerText,
                  minute === selectedMinute && styles.selectedTimeText
                ]}>
                  {minute.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

export default function DetalhesEventoScreen() {
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: '',
    valor: '',
    cidade: '',
    telefoneContratante: '',
    data: new Date(),
    horarioInicio: new Date(),
    horarioFim: new Date(),
    status: 'a_confirmar' as 'confirmado' | 'a_confirmar',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeInicioModal, setShowTimeInicioModal] = useState(false);
  const [showTimeFimModal, setShowTimeFimModal] = useState(false);

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


  const formatDate = (dateString: string) => {
    // Parse da data sem conversão de fuso horário
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR');
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // HH:MM
  };

  const formatCurrency = (value: string) => {
    // Remove tudo que não é número
    const numericValue = value.replace(/\D/g, '');
    
    if (!numericValue) return '';
    
    // Converte para número e formata
    const number = parseInt(numericValue, 10);
    return `R$ ${(number / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const extractNumericValue = (formattedValue: string) => {
    const numericValue = formattedValue.replace(/\D/g, '');
    return numericValue ? parseInt(numericValue, 10) / 100 : 0;
  };

  const openEditModal = () => {
    if (event) {
      // Parse da data
      const [year, month, day] = event.event_date.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);
      
      // Parse dos horários
      const [startHour, startMinute] = event.start_time.split(':').map(Number);
      const [endHour, endMinute] = event.end_time.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(startHour, startMinute, 0, 0);
      const endTime = new Date();
      endTime.setHours(endHour, endMinute, 0, 0);

      setEditForm({
        nome: event.name,
        valor: event.value ? formatCurrency((event.value * 100).toString()) : '',
        cidade: event.city || '',
        telefoneContratante: event.contractor_phone || '',
        data: eventDate,
        horarioInicio: startTime,
        horarioFim: endTime,
        status: (event.confirmed ? 'confirmado' : 'a_confirmar') as 'confirmado' | 'a_confirmar',
      });
      setShowEditModal(true);
    }
  };

  const handleSaveEvent = async () => {
    if (!editForm.nome.trim()) {
      Alert.alert('Erro', 'Nome do evento é obrigatório');
      return;
    }

    if (!editForm.valor.trim()) {
      Alert.alert('Erro', 'Valor do evento é obrigatório');
      return;
    }

    if (!editForm.data) {
      Alert.alert('Erro', 'Data do evento é obrigatória');
      return;
    }

    setIsSaving(true);

    try {
      // Verificar se houve mudanças na data/hora
      let dateString = event?.event_date; // Manter data original se não mudou
      let startTimeString = event?.start_time; // Manter horário original se não mudou
      let endTimeString = event?.end_time; // Manter horário original se não mudou

      // Se a data foi alterada, converter para string YYYY-MM-DD
      if (editForm.data) {
        dateString = editForm.data.toISOString().split('T')[0];
      }
      
      // Se os horários foram alterados, converter para string HH:MM
      if (editForm.horarioInicio) {
        startTimeString = `${editForm.horarioInicio.getHours().toString().padStart(2, '0')}:${editForm.horarioInicio.getMinutes().toString().padStart(2, '0')}`;
      }
      
      if (editForm.horarioFim) {
        endTimeString = `${editForm.horarioFim.getHours().toString().padStart(2, '0')}:${editForm.horarioFim.getMinutes().toString().padStart(2, '0')}`;
      }

      const updateData: UpdateEventData = {
        nome: editForm.nome,
        valor: extractNumericValue(editForm.valor),
        city: editForm.cidade || undefined,
        telefone_contratante: editForm.telefoneContratante || undefined,
        data: dateString,
        horario_inicio: startTimeString,
        horario_fim: endTimeString,
        status: editForm.status,
      };

      const result = await updateEvent(eventId, updateData);

      if (result.success) {
        Alert.alert('Sucesso', 'Evento atualizado com sucesso!');
        setShowEditModal(false);
        loadEventData(); // Recarregar dados
      } else {
        Alert.alert('Erro', result.error || 'Erro ao atualizar evento');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao atualizar evento');
    } finally {
      setIsSaving(false);
    }
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
    <>
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
            <Text style={styles.financialValue}>{formatCurrency((event.value || 0).toString())}</Text>
          </View>

          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Total de Despesas:</Text>
            <Text style={[styles.financialValue, { color: '#ff4444' }]}>
              -{formatCurrency(totalExpenses.toString())}
            </Text>
          </View>

          <View style={[styles.financialRow, styles.financialTotal]}>
            <Text style={styles.financialTotalLabel}>Lucro Líquido:</Text>
            <Text style={[
              styles.financialTotalValue,
              { color: profit >= 0 ? '#4CAF50' : '#ff4444' }
            ]}>
              {formatCurrency(profit.toString())}
            </Text>
          </View>
        </View>



        {/* Ações */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={openEditModal}
          >
            <Ionicons name="create" size={24} color="#FF9800" />
            <Text style={styles.actionButtonText}>Editar Evento</Text>
            <Ionicons name="chevron-forward" size={20} color="#FF9800" />
          </TouchableOpacity>

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


      {/* Modal de Edição */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Editar Evento</Text>
              <TouchableOpacity
                onPress={handleSaveEvent}
                style={[styles.modalSaveButton, isSaving && styles.modalSaveButtonDisabled]}
                disabled={isSaving}
              >
                <Text style={styles.modalSaveButtonText}>
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Nome */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.nome}
                  onChangeText={(text) => setEditForm({ ...editForm, nome: text })}
                  placeholder="Nome do evento"
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              {/* Valor */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Valor *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.valor}
                  onChangeText={(text) => setEditForm({ ...editForm, valor: formatCurrency(text) })}
                  placeholder="R$ 0,00"
                  keyboardType="default"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              {/* Cidade */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cidade</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.cidade}
                  onChangeText={(text) => setEditForm({ ...editForm, cidade: text })}
                  placeholder="Cidade do evento"
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              {/* Telefone */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Telefone do Contratante</Text>
                <TextInput
                  style={styles.textInput}
                  value={editForm.telefoneContratante}
                  onChangeText={(text) => setEditForm({ ...editForm, telefoneContratante: text })}
                  placeholder="(11) 99999-9999"
                  keyboardType="default"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              {/* Data e Horários */}
              <View style={styles.dateTimeSection}>
                <Text style={styles.sectionTitle}>Data e Horários</Text>
                
                {/* Data */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Data do Evento *</Text>
                  <TouchableOpacity
                    style={styles.dateTimeButton}
                    onPress={() => setShowDateModal(true)}
                  >
                    <View style={styles.dateTimeButtonContent}>
                      <Ionicons name="calendar-outline" size={20} color="#667eea" />
                      <Text style={styles.dateTimeButtonText}>
                        {editForm.data.toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#999" />
                  </TouchableOpacity>
                </View>

                {/* Horários em linha */}
                <View style={styles.timeRow}>
                  {/* Horário Início */}
                  <View style={styles.timeInputGroup}>
                    <Text style={styles.inputLabel}>Início</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => setShowTimeInicioModal(true)}
                    >
                      <View style={styles.dateTimeButtonContent}>
                        <Ionicons name="time-outline" size={18} color="#667eea" />
                        <Text style={styles.timeButtonText}>
                          {editForm.horarioInicio.toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Separador */}
                  <View style={styles.timeSeparator}>
                    <Text style={styles.timeSeparatorText}>até</Text>
                  </View>

                  {/* Horário Fim */}
                  <View style={styles.timeInputGroup}>
                    <Text style={styles.inputLabel}>Fim</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => setShowTimeFimModal(true)}
                    >
                      <View style={styles.dateTimeButtonContent}>
                        <Ionicons name="time-outline" size={18} color="#667eea" />
                        <Text style={styles.timeButtonText}>
                          {editForm.horarioFim.toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Status */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.statusContainer}>
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      editForm.status === 'confirmado' && styles.statusButtonActive
                    ]}
                    onPress={() => setEditForm({ ...editForm, status: 'confirmado' })}
                  >
                    <Text style={[
                      styles.statusButtonText,
                      editForm.status === 'confirmado' && styles.statusButtonTextActive
                    ]}>
                      Confirmado
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      editForm.status === 'a_confirmar' && styles.statusButtonActive
                    ]}
                    onPress={() => setEditForm({ ...editForm, status: 'a_confirmar' })}
                  >
                    <Text style={[
                      styles.statusButtonText,
                      editForm.status === 'a_confirmar' && styles.statusButtonTextActive
                    ]}>
                      A Confirmar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>

    {/* Modais de data/hora - completamente independentes */}
    {/* Modal para seleção de data */}
    <Modal
      visible={showDateModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowDateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar Data</Text>
            <TouchableOpacity
              onPress={() => setShowDateModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            <DatePickerComponent
              selectedDate={editForm.data}
              onDateChange={(date) => setEditForm({ ...editForm, data: date })}
              initialMonth={editForm.data.getMonth()}
              initialYear={editForm.data.getFullYear()}
            />
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => setShowDateModal(false)}
            >
              <Text style={styles.modalConfirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Modal para seleção de horário de início */}
    <Modal
      visible={showTimeInicioModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowTimeInicioModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Horário de Início</Text>
            <TouchableOpacity
              onPress={() => setShowTimeInicioModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            <TimePickerComponent
              selectedTime={editForm.horarioInicio}
              onTimeChange={(time) => setEditForm({ ...editForm, horarioInicio: time })}
            />
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => setShowTimeInicioModal(false)}
            >
              <Text style={styles.modalConfirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Modal para seleção de horário de fim */}
    <Modal
      visible={showTimeFimModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowTimeFimModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Horário de Fim</Text>
            <TouchableOpacity
              onPress={() => setShowTimeFimModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalBody}>
            <TimePickerComponent
              selectedTime={editForm.horarioFim}
              onTimeChange={(time) => setEditForm({ ...editForm, horarioFim: time })}
            />
          </View>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalConfirmButton}
              onPress={() => setShowTimeFimModal(false)}
            >
              <Text style={styles.modalConfirmText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  modalSaveButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  // Estilos para seção de data/hora
  dateTimeSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timeButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  timeSeparator: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  timeSeparatorText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  // Estilos para botões de data/hora
  dateTimeButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  // Estilos para modais de data/hora (igual à página de adicionar evento)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalBody: {
    padding: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  modalConfirmButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
  // Estilos para calendário
  calendarContainer: {
    padding: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  calendarNavButton: {
    padding: 8,
  },
  calendarMonthYear: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  weekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekdayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    width: '14.28%',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 2,
  },
  dayItem: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayItemEmpty: {
    opacity: 0,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
  },
  selectedDay: {
    backgroundColor: '#667eea',
    borderRadius: 20,
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Estilos para seletor de horário
  timePickerContainer: {
    padding: 20,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  timePickerScroll: {
    height: 200,
    width: '100%',
  },
  timePickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  selectedTimeItem: {
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  timePickerText: {
    fontSize: 18,
    color: '#333',
  },
  selectedTimeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
