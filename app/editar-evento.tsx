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
  initialYear 
}: { 
  selectedDate: Date; 
  onDateChange: (date: Date) => void;
  initialMonth?: number;
  initialYear?: number;
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
      <Text style={styles.monthYearLabel}>
        {monthNames[month]} / {year}
      </Text>
      
      <View style={styles.weekdayHeader}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((weekday) => (
          <Text key={weekday} style={styles.weekdayHeaderText}>
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
              dayInfo.day && selectedDay === dayInfo.day ? styles.dayItemSelected : null,
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
    const newTime = new Date();
    newTime.setHours(hour, minute, 0, 0);
    onTimeChange(newTime);
  };

  return (
    <View style={styles.pickerContainer}>
      <View style={styles.pickerColumn}>
        <Text style={styles.pickerLabel}>Hora</Text>
        <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
          {hours.map((hour) => (
            <TouchableOpacity
              key={hour}
              style={[
                styles.pickerItem,
                selectedHour === hour && styles.pickerItemSelected
              ]}
              onPress={() => {
                setSelectedHour(hour);
                updateTime(hour, selectedMinute);
              }}
            >
              <Text style={[
                styles.pickerItemText,
                selectedHour === hour && styles.pickerItemTextSelected
              ]}>
                {hour.toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.pickerColumn}>
        <Text style={styles.pickerLabel}>Minuto</Text>
        <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
          {minutes.map((minute) => (
            <TouchableOpacity
              key={minute}
              style={[
                styles.pickerItem,
                selectedMinute === minute && styles.pickerItemSelected
              ]}
              onPress={() => {
                setSelectedMinute(minute);
                updateTime(selectedHour, minute);
              }}
            >
              <Text style={[
                styles.pickerItemText,
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Editar Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando evento...</Text>
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
        <Text style={styles.title}>Editar Evento</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Nome do Evento */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome do Evento *</Text>
          <TextInput
            style={styles.input}
            value={form.nome}
            onChangeText={(text) => updateForm('nome', text)}
            placeholder="Ex: Rock in Rio 2025"
            placeholderTextColor="#999"
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Valor */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Valor (R$) *</Text>
          <TextInput
            style={styles.input}
            value={form.valor}
            onChangeText={(text) => {
              const formatted = formatCurrency(text);
              updateForm('valor', formatted);
            }}
            placeholder="R$ 0,00"
            placeholderTextColor="#999"
            keyboardType="default"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            blurOnSubmit={true}
          />
        </View>

        {/* Cidade */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.input}
            value={form.cidade}
            onChangeText={(text) => updateForm('cidade', text)}
            placeholder="Ex: Rio de Janeiro"
            placeholderTextColor="#999"
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Telefone do Contratante */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Telefone do Contratante</Text>
          <TextInput
            style={styles.input}
            value={form.telefoneContratante}
            onChangeText={(text) => updateForm('telefoneContratante', text)}
            placeholder="Ex: (21) 99999-9999"
            placeholderTextColor="#999"
            keyboardType="default"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        {/* Descrição */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Descrição (Opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.descricao}
            onChangeText={(text) => updateForm('descricao', text)}
            placeholder="Detalhes sobre o evento..."
            placeholderTextColor="#999"
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
          <Text style={styles.label}>Data do Evento *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDateModal(true)}
          >
            <Ionicons name="calendar" size={20} color="#667eea" />
            <Text style={styles.dateButtonText}>{formatDate(form.data)}</Text>
            <Ionicons name="chevron-down" size={16} color="#667eea" style={styles.chevronIcon} />
          </TouchableOpacity>
        </View>

        {/* Horário de Início */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Horário de Início</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowTimeInicioModal(true)}
          >
            <Ionicons name="time" size={20} color="#667eea" />
            <Text style={styles.dateButtonText}>{formatTime(form.horarioInicio)}</Text>
            <Ionicons name="chevron-down" size={16} color="#667eea" style={styles.chevronIcon} />
          </TouchableOpacity>
        </View>

        {/* Horário de Fim */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Horário de Fim</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowTimeFimModal(true)}
          >
            <Ionicons name="time" size={20} color="#667eea" />
            <Text style={styles.dateButtonText}>{formatTime(form.horarioFim)}</Text>
            <Ionicons name="chevron-down" size={16} color="#667eea" style={styles.chevronIcon} />
          </TouchableOpacity>
        </View>

        {/* Status */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusContainer}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                form.status === 'confirmado' && styles.statusButtonActive
              ]}
              onPress={() => updateForm('status', 'confirmado')}
            >
              <Ionicons 
                name="checkmark-circle" 
                size={20} 
                color={form.status === 'confirmado' ? '#fff' : '#4CAF50'} 
              />
              <Text style={[
                styles.statusButtonText,
                form.status === 'confirmado' && styles.statusButtonTextActive
              ]}>
                Confirmado
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                form.status === 'a_confirmar' && styles.statusButtonActive
              ]}
              onPress={() => updateForm('status', 'a_confirmar')}
            >
              <Ionicons 
                name="time" 
                size={20} 
                color={form.status === 'a_confirmar' ? '#fff' : '#FF9800'} 
              />
              <Text style={[
                styles.statusButtonText,
                form.status === 'a_confirmar' && styles.statusButtonTextActive
              ]}>
                A Confirmar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tipo de Evento (Tag) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tipo de Evento</Text>
          <View style={styles.tagContainer}>
            <TouchableOpacity
              style={[
                styles.tagButton,
                {
                  backgroundColor: form.tag === 'ensaio' ? '#10B981' : '#fff',
                  borderColor: form.tag === 'ensaio' ? '#10B981' : '#e9ecef'
                }
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
                { color: form.tag === 'ensaio' ? '#fff' : '#333' }
              ]}>
                Ensaio
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tagButton,
                {
                  backgroundColor: form.tag === 'evento' ? '#667eea' : '#fff',
                  borderColor: form.tag === 'evento' ? '#667eea' : '#e9ecef'
                }
              ]}
              onPress={() => updateForm('tag', 'evento')}
            >
              <Ionicons 
                name="mic" 
                size={20} 
                color={form.tag === 'evento' ? '#fff' : '#667eea'} 
              />
              <Text style={[
                styles.tagButtonText,
                { color: form.tag === 'evento' ? '#fff' : '#333' }
              ]}>
                Evento
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tagButton,
                {
                  backgroundColor: form.tag === 'reunião' ? '#F59E0B' : '#fff',
                  borderColor: form.tag === 'reunião' ? '#F59E0B' : '#e9ecef'
                }
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
                { color: form.tag === 'reunião' ? '#fff' : '#333' }
              ]}>
                Reunião
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botões */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
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
                selectedDate={form.data}
                onDateChange={(date) => updateForm('data', date)}
                initialMonth={form.data.getMonth()}
                initialYear={form.data.getFullYear()}
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Horário de Início</Text>
              <TouchableOpacity
                onPress={() => setShowTimeInicioModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TimePickerComponent
              selectedTime={form.horarioInicio}
              onTimeChange={(time) => updateForm('horarioInicio', time)}
            />
            
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Horário de Fim</Text>
              <TouchableOpacity
                onPress={() => setShowTimeFimModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TimePickerComponent
              selectedTime={form.horarioFim}
              onTimeChange={(time) => updateForm('horarioFim', time)}
            />
            
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
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    color: '#333',
  },
  dateButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  statusButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
    color: '#333',
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
    backgroundColor: '#fff',
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
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#667eea',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#ddd',
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
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#333',
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
    color: '#666',
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
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  dayItemEmpty: {
    backgroundColor: 'transparent',
  },
  dayNumberText: {
    fontSize: 16,
    color: '#333',
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
    color: '#333',
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
    backgroundColor: '#667eea',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#666',
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
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
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
