import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getEventById, updateEvent, UpdateEventData } from '../services/supabase/eventService';

interface EventoForm {
  nome: string;
  valor: string;
  cidade: string;
  telefoneContratante: string;
  data: Date;
  horarioInicio: Date;
  horarioFim: Date;
  status: 'confirmado' | 'a_confirmar';
  descricao: string;
  tag: 'ensaio' | 'evento' | 'reunião';
}

// Componente para seleção de data
const DatePickerComponent = ({ 
  selectedDate, 
  onDateChange, 
  initialMonth, 
  initialYear,
  colors
}: { 
  selectedDate: Date; 
  onDateChange: (date: Date) => void;
  initialMonth?: number;
  initialYear?: number;
  colors: any;
}) => {
  const [selectedDay, setSelectedDay] = useState(selectedDate.getDate());

  React.useEffect(() => {
    setSelectedDay(selectedDate.getDate());
  }, [selectedDate]);

  const currentDate = new Date();
  const year = initialYear || currentDate.getFullYear();
  const month = initialMonth !== undefined ? initialMonth : currentDate.getMonth();

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const daysInSelectedMonth = getDaysInMonth(year, month);
  
  const firstDayOfMonth = new Date(year, month, 1);
  const firstDayWeekday = firstDayOfMonth.getDay();
  
  const calendarDays: Array<{ day: number | null; weekday: null; date: Date | null }> = [];
  
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push({ day: null, weekday: null, date: null });
  }
  
  for (let day = 1; day <= daysInSelectedMonth; day++) {
    const date = new Date(year, month, day);
    calendarDays.push({
      day: day,
      weekday: null,
      date: date
    });
  }

  const updateDate = (day: number) => {
    const newDate = new Date(year, month, day);
    onDateChange(newDate);
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <View style={styles.datePickerContainer}>
      <Text style={[styles.monthYearLabel, { color: colors.text }]}>
        {monthNames[month]} / {year}
      </Text>
      
      <View style={styles.weekdayHeader}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((weekday) => (
          <Text key={weekday} style={[styles.weekdayHeaderText, { color: colors.textSecondary }]}>
            {weekday}
          </Text>
        ))}
      </View>
      
      <View style={styles.daysGrid}>
        {calendarDays.map((dayInfo, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayItem,
              { backgroundColor: colors.background },
              dayInfo.day && selectedDay === dayInfo.day ? [styles.dayItemSelected, { backgroundColor: colors.primary }] : null,
              !dayInfo.day ? styles.dayItemEmpty : null
            ]}
            onPress={() => {
              if (dayInfo.day) {
                setSelectedDay(dayInfo.day);
                updateDate(dayInfo.day);
              }
            }}
            disabled={!dayInfo.day}
          >
            {dayInfo.day && (
              <Text style={[
                styles.dayNumberText,
                { color: colors.text },
                selectedDay === dayInfo.day && styles.dayNumberTextSelected
              ]}>
                {dayInfo.day}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Componente para seleção de horário
const TimePickerComponent = ({ selectedTime, onTimeChange, colors }: { selectedTime: Date; onTimeChange: (time: Date) => void; colors: any }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const [selectedHour, setSelectedHour] = useState(selectedTime.getHours());
  const [selectedMinute, setSelectedMinute] = useState(selectedTime.getMinutes());

  React.useEffect(() => {
    setSelectedHour(selectedTime.getHours());
    setSelectedMinute(selectedTime.getMinutes());
  }, [selectedTime]);

  const updateTime = (hour: number, minute: number) => {
    const newTime = new Date();
    newTime.setHours(hour, minute, 0, 0);
    onTimeChange(newTime);
  };

  return (
    <View style={styles.pickerContainer}>
      <View style={styles.pickerColumn}>
        <Text style={[styles.pickerLabel, { color: colors.text }]}>Hora</Text>
        <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
          {hours.map((hour) => (
            <TouchableOpacity
              key={hour}
              style={[
                styles.pickerItem,
                { backgroundColor: colors.background },
                selectedHour === hour && [styles.pickerItemSelected, { backgroundColor: colors.primary }]
              ]}
              onPress={() => {
                setSelectedHour(hour);
                updateTime(hour, selectedMinute);
              }}
            >
              <Text style={[
                styles.pickerItemText,
                { color: colors.text },
                selectedHour === hour && styles.pickerItemTextSelected
              ]}>
                {hour.toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.pickerColumn}>
        <Text style={[styles.pickerLabel, { color: colors.text }]}>Minuto</Text>
        <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
          {minutes.map((minute) => (
            <TouchableOpacity
              key={minute}
              style={[
                styles.pickerItem,
                { backgroundColor: colors.background },
                selectedMinute === minute && [styles.pickerItemSelected, { backgroundColor: colors.primary }]
              ]}
              onPress={() => {
                setSelectedMinute(minute);
                updateTime(selectedHour, minute);
              }}
            >
              <Text style={[
                styles.pickerItemText,
                { color: colors.text },
                selectedMinute === minute && styles.pickerItemTextSelected
              ]}>
                {minute.toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

export default function EditarEventoScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;

  const [form, setForm] = useState<EventoForm>({
    nome: '',
    valor: '',
    cidade: '',
    telefoneContratante: '',
    data: new Date(),
    horarioInicio: new Date(),
    horarioFim: new Date(),
    status: 'a_confirmar',
    descricao: '',
    tag: 'evento', // Valor padrão
  });

  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeInicioModal, setShowTimeInicioModal] = useState(false);
  const [showTimeFimModal, setShowTimeFimModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);

  // Carregar dados do evento
  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    try {
      const result = await getEventById(eventId);
      
      if (result.success && result.event) {
        const event = result.event;
        
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

        setForm({
          nome: event.name,
          valor: event.value ? formatCurrency((event.value * 100).toString()) : '',
          cidade: event.city || '',
          telefoneContratante: event.contractor_phone || '',
          data: eventDate,
          horarioInicio: startTime,
          horarioFim: endTime,
          status: (event.confirmed ? 'confirmado' : 'a_confirmar') as 'confirmado' | 'a_confirmar',
          descricao: event.description || '',
          tag: event.tag || 'evento', // Carregar tag existente ou usar padrão
        });
      } else {
        Alert.alert('Erro', result.error || 'Erro ao carregar evento');
        router.back();
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar dados do evento');
      router.back();
    } finally {
      setIsLoadingEvent(false);
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      Alert.alert('Erro', 'Nome do evento é obrigatório');
      return;
    }
    if (!form.valor.trim()) {
      Alert.alert('Erro', 'Valor é obrigatório');
      return;
    }

    const numericValue = extractNumericValue(form.valor);
    if (!numericValue || isNaN(parseFloat(numericValue))) {
      Alert.alert('Erro', 'Valor deve ser um número válido');
      return;
    }

    setIsLoading(true);

    try {
      const updateData: UpdateEventData = {
        name: form.nome.trim(),
        description: form.descricao.trim() || undefined,
        value: parseFloat(numericValue),
        city: form.cidade.trim() || undefined,
        contractor_phone: form.telefoneContratante.trim() || undefined,
        event_date: form.data.toISOString().split('T')[0],
        start_time: form.horarioInicio.toTimeString().split(' ')[0].substring(0, 5),
        end_time: form.horarioFim.toTimeString().split(' ')[0].substring(0, 5),
        confirmed: form.status === 'confirmado',
        tag: form.tag,
      };

      const result = await updateEvent(eventId, updateData);

      if (result.success) {
        Alert.alert(
          'Sucesso',
          'Evento atualizado com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Erro', result.error || 'Erro ao atualizar evento');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao atualizar evento');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const updateForm = (field: keyof EventoForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    
    if (!numericValue) return '';
    
    const amount = parseInt(numericValue) / 100;
    
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const extractNumericValue = (formattedValue: string) => {
    const numericValue = formattedValue.replace(/\D/g, '');
    return numericValue ? (parseInt(numericValue) / 100).toString() : '';
  };

  if (isLoadingEvent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Editar Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando evento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Editar Evento</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Nome do Evento */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Nome do Evento *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={form.nome}
            onChangeText={(text) => updateForm('nome', text)}
            placeholder="Ex: Rock in Rio 2025"
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Valor */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Valor (R$) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={form.valor}
            onChangeText={(text) => {
              const formatted = formatCurrency(text);
              updateForm('valor', formatted);
            }}
            placeholder="R$ 0,00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="default"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            blurOnSubmit={true}
          />
        </View>

        {/* Cidade */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Cidade</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={form.cidade}
            onChangeText={(text) => updateForm('cidade', text)}
            placeholder="Ex: Rio de Janeiro"
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Telefone do Contratante */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Telefone do Contratante</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={form.telefoneContratante}
            onChangeText={(text) => updateForm('telefoneContratante', text)}
            placeholder="Ex: (21) 99999-9999"
            placeholderTextColor={colors.textSecondary}
            keyboardType="default"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        {/* Descrição */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Descrição (Opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={form.descricao}
            onChangeText={(text) => updateForm('descricao', text)}
            placeholder="Detalhes sobre o evento..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoCorrect={false}
            autoCapitalize="sentences"
            returnKeyType="default"
          />
        </View>

        {/* Data */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Data do Evento *</Text>
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowDateModal(true)}
          >
            <Ionicons name="calendar" size={20} color={colors.primary} />
            <Text style={[styles.dateButtonText, { color: colors.text }]}>{formatDate(form.data)}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} style={styles.chevronIcon} />
          </TouchableOpacity>
        </View>

        {/* Horário de Início */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Horário de Início</Text>
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowTimeInicioModal(true)}
          >
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={[styles.dateButtonText, { color: colors.text }]}>{formatTime(form.horarioInicio)}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} style={styles.chevronIcon} />
          </TouchableOpacity>
        </View>

        {/* Horário de Fim */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Horário de Fim</Text>
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowTimeFimModal(true)}
          >
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={[styles.dateButtonText, { color: colors.text }]}>{formatTime(form.horarioFim)}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} style={styles.chevronIcon} />
          </TouchableOpacity>
        </View>

        {/* Status */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Status</Text>
          <View style={styles.statusContainer}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                form.status === 'a_confirmar' && [styles.statusButtonActive, { backgroundColor: colors.warning, borderColor: colors.warning }]
              ]}
              onPress={() => updateForm('status', 'a_confirmar')}
            >
              <Ionicons 
                name="time" 
                size={20} 
                color={form.status === 'a_confirmar' ? '#fff' : colors.warning} 
              />
              <Text style={[
                styles.statusButtonText,
                { color: form.status === 'a_confirmar' ? '#fff' : colors.text },
                form.status === 'a_confirmar' && styles.statusButtonTextActive
              ]}>
                A Confirmar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                form.status === 'confirmado' && [styles.statusButtonActive, { backgroundColor: colors.success, borderColor: colors.success }]
              ]}
              onPress={() => updateForm('status', 'confirmado')}
            >
              <Ionicons 
                name="checkmark-circle" 
                size={20} 
                color={form.status === 'confirmado' ? '#fff' : colors.success} 
              />
              <Text style={[
                styles.statusButtonText,
                { color: form.status === 'confirmado' ? '#fff' : colors.text },
                form.status === 'confirmado' && styles.statusButtonTextActive
              ]}>
                Confirmado
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tipo de Evento (Tag) */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Tipo de Evento</Text>
          <View style={styles.tagContainer}>
            <TouchableOpacity
              style={[
                styles.tagButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                form.tag === 'ensaio' && { backgroundColor: '#10B981', borderColor: '#10B981' }
              ]}
              onPress={() => updateForm('tag', 'ensaio')}
            >
              <Ionicons 
                name="musical-notes" 
                size={20} 
                color={form.tag === 'ensaio' ? '#fff' : '#10B981'} 
              />
              <Text style={[
                styles.tagButtonText,
                { color: form.tag === 'ensaio' ? '#fff' : colors.text }
              ]}>
                Ensaio
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tagButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                form.tag === 'evento' && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => updateForm('tag', 'evento')}
            >
              <Ionicons 
                name="mic" 
                size={20} 
                color={form.tag === 'evento' ? '#fff' : colors.primary} 
              />
              <Text style={[
                styles.tagButtonText,
                { color: form.tag === 'evento' ? '#fff' : colors.text }
              ]}>
                Evento
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tagButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                form.tag === 'reunião' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }
              ]}
              onPress={() => updateForm('tag', 'reunião')}
            >
              <Ionicons 
                name="people" 
                size={20} 
                color={form.tag === 'reunião' ? '#fff' : '#F59E0B'} 
              />
              <Text style={[
                styles.tagButtonText,
                { color: form.tag === 'reunião' ? '#fff' : colors.text }
              ]}>
                Reunião
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botões */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.back()}
            disabled={isLoading}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.saveButtonText}>Salvando...</Text>
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Salvar Alterações</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal para seleção de data */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Selecionar Data</Text>
              <TouchableOpacity
                onPress={() => setShowDateModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <DatePickerComponent
                selectedDate={form.data}
                onDateChange={(date) => updateForm('data', date)}
                initialMonth={form.data.getMonth()}
                initialYear={form.data.getFullYear()}
                colors={colors}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: colors.primary }]}
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
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Horário de Início</Text>
              <TouchableOpacity
                onPress={() => setShowTimeInicioModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <TimePickerComponent
              selectedTime={form.horarioInicio}
              onTimeChange={(time) => updateForm('horarioInicio', time)}
              colors={colors}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: colors.primary }]}
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
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Horário de Fim</Text>
              <TouchableOpacity
                onPress={() => setShowTimeFimModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <TimePickerComponent
              selectedTime={form.horarioFim}
              onTimeChange={(time) => updateForm('horarioFim', time)}
              colors={colors}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowTimeFimModal(false)}
              >
                <Text style={styles.modalConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
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
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  dateButton: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  chevronIcon: {
    marginLeft: 'auto',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonActive: {
    // Cores aplicadas dinamicamente
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  tagContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tagButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  textArea: {
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalBody: {
    padding: 0,
  },
  datePickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  monthYearLabel: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  weekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  weekdayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '14.28%',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayItem: {
    width: '14.28%',
    aspectRatio: 1,
    marginBottom: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayItemSelected: {
    borderRadius: 8,
  },
  dayItemEmpty: {
    backgroundColor: 'transparent',
  },
  dayNumberText: {
    fontSize: 16,
    fontWeight: '500',
  },
  dayNumberTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    height: 200,
    paddingHorizontal: 20,
  },
  pickerColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  pickerScroll: {
    flex: 1,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerItemSelected: {
    // Cores aplicadas dinamicamente
  },
  pickerItemText: {
    fontSize: 16,
  },
  pickerItemTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtons: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 34,
  },
  modalConfirmButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
