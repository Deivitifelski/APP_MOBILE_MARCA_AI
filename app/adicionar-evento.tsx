import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getArtists } from '../services/supabase/artistService';
import { getCurrentUser } from '../services/supabase/authService';
import { createEvent, CreateExpenseData } from '../services/supabase/eventService';
import { useActiveArtist } from '../services/useActiveArtist';

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

interface DespesaForm {
  nome: string;
  valor: string;
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

  // Atualizar dia selecionado quando selectedDate mudar
  React.useEffect(() => {
    setSelectedDay(selectedDate.getDate());
  }, [selectedDate]);

  // Sempre usar dados atualizados - priorizar parâmetros ou usar data atual
  const currentDate = new Date();
  const year = initialYear || currentDate.getFullYear();
  const month = initialMonth !== undefined ? initialMonth : currentDate.getMonth();

  // Calcular quantos dias tem o mês selecionado
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const daysInSelectedMonth = getDaysInMonth(year, month);
  
  // Criar calendário completo com dias vazios no início
  // Usar fuso horário local para evitar problemas
  const firstDayOfMonth = new Date(year, month, 1);
  const firstDayWeekday = firstDayOfMonth.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  
  
  // Criar array com dias vazios no início + dias do mês
  const calendarDays = [];
  
  // Adicionar dias vazios no início para alinhar com o primeiro dia do mês
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push({ day: null, weekday: null, date: null });
  }
  
  // Adicionar dias do mês
  for (let day = 1; day <= daysInSelectedMonth; day++) {
    const date = new Date(year, month, day);
    calendarDays.push({
      day: day,
      weekday: null,
      date: date
    });
    
  }


  const updateDate = (day: number) => {
    // Criar data usando fuso horário local
    const newDate = new Date(year, month, day);
    onDateChange(newDate);
  };

  // Obter nome do mês
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <View style={styles.datePickerContainer}>
      <Text style={[styles.monthYearLabel, { color: colors.text }]}>
        {monthNames[month]} / {year}
      </Text>
      
      {/* Cabeçalho dos dias da semana */}
      <View style={styles.weekdayHeader}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((weekday) => (
          <Text key={weekday} style={[styles.weekdayHeaderText, { color: colors.textSecondary }]}>
            {weekday}
          </Text>
        ))}
      </View>
      
      {/* Grid dos dias */}
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

  // Sincronizar com o selectedTime quando ele mudar
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

export default function AdicionarEventoScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  
  // Sempre usar dados atualizados - data atual como padrão
  const currentDate = new Date();
  const selectedMonth = params.selectedMonth ? parseInt(params.selectedMonth as string) : currentDate.getMonth();
  const selectedYear = params.selectedYear ? parseInt(params.selectedYear as string) : currentDate.getFullYear();
  const initialDate = params.selectedDate ? new Date(params.selectedDate as string) : new Date(selectedYear, selectedMonth, currentDate.getDate());

  // Criar horários padrão
  const createDefaultTime = (hour: number, minute: number = 0) => {
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    return time;
  };

  const [form, setForm] = useState<EventoForm>({
    nome: '',
    valor: '',
    cidade: '',
    telefoneContratante: '',
    data: initialDate,
    horarioInicio: createDefaultTime(20, 0), // 20:00
    horarioFim: createDefaultTime(23, 0), // 23:00
    status: 'confirmado',
    descricao: '',
    tag: 'evento', // Valor padrão
  });

  const [despesas, setDespesas] = useState<DespesaForm[]>([]);

  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeInicioModal, setShowTimeInicioModal] = useState(false);
  const [showTimeFimModal, setShowTimeFimModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { activeArtist } = useActiveArtist();

  const handleSave = async () => {
    // Validações básicas - apenas Nome, Valor e Data são obrigatórios
    if (!form.nome.trim()) {
      Alert.alert('Erro', 'Nome do evento é obrigatório');
      return;
    }
    if (!form.valor.trim()) {
      Alert.alert('Erro', 'Valor é obrigatório');
      return;
    }

    // Extrair valor numérico do texto formatado
    const numericValue = extractNumericValue(form.valor);
    if (!numericValue || isNaN(parseFloat(numericValue))) {
      Alert.alert('Erro', 'Valor deve ser um número válido');
      return;
    }

    setIsLoading(true);

    try {
      // Obter o usuário atual e seu artista
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        return;
      }

      const { artists, error: artistsError } = await getArtists(user.id);
      
      if (artistsError || !artists || artists.length === 0) {
        Alert.alert('Erro', 'Nenhum artista encontrado. Crie um perfil de artista primeiro.');
        return;
      }

      const artistId = activeArtist?.id || artists[0].id;

      // Preparar despesas
      const expensesData: CreateExpenseData[] = despesas
        .filter(despesa => despesa.nome.trim() && despesa.valor.trim())
        .map(despesa => ({
          name: despesa.nome.trim(),
          value: parseFloat(despesa.valor) / 100, // Converter centavos para reais
        }));

      const eventData = {
        artist_id: artistId,
        user_id: user.id,
        name: form.nome.trim(),
        description: form.descricao.trim() || undefined,
        event_date: `${form.data.getFullYear()}-${String(form.data.getMonth() + 1).padStart(2, '0')}-${String(form.data.getDate()).padStart(2, '0')}`, // YYYY-MM-DD
        start_time: form.horarioInicio.toTimeString().split(' ')[0].substring(0, 5), // HH:MM
        end_time: form.horarioFim.toTimeString().split(' ')[0].substring(0, 5), // HH:MM
        value: numericValue ? parseFloat(numericValue) : undefined,
        city: form.cidade.trim() || undefined,
        contractor_phone: form.telefoneContratante.trim() || undefined,
        confirmed: form.status === 'confirmado',
        tag: form.tag,
        expenses: expensesData
      };

      const result = await createEvent(eventData);

      if (result.success && result.event) {
        Alert.alert(
          'Sucesso',
          'Evento adicionado com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Erro', result.error || 'Erro ao salvar evento');
      }
    } catch {
      Alert.alert('Erro', 'Erro ao salvar evento');
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

  // Função para formatar valor em Real
  const formatCurrency = (value: string) => {
    // Remove tudo que não é dígito
    const numericValue = value.replace(/\D/g, '');
    
    // Se não há valor, retorna vazio
    if (!numericValue) return '';
    
    // Limita a 11 dígitos (999.999.999,99)
    const limitedValue = numericValue.slice(0, 11);
    
    // Converte para número e divide por 100 para ter centavos
    const amount = parseInt(limitedValue) / 100;
    
    // Formata como moeda brasileira
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Função para extrair valor numérico do texto formatado
  const extractNumericValue = (formattedValue: string) => {
    const numericValue = formattedValue.replace(/\D/g, '');
    return numericValue ? (parseInt(numericValue) / 100).toString() : '';
  };

  const addDespesa = () => {
    setDespesas(prev => [...prev, { nome: '', valor: '' }]);
  };

  const removeDespesa = (index: number) => {
    setDespesas(prev => prev.filter((_, i) => i !== index));
  };

  const updateDespesa = (index: number, field: keyof DespesaForm, value: any) => {
    setDespesas(prev => prev.map((despesa, i) => 
      i === index ? { ...despesa, [field]: value } : despesa
    ));
  };


  const openDatePicker = () => {
    setShowDateModal(true);
  };

  const openTimeInicioPicker = () => {
    setShowTimeInicioModal(true);
  };

  const openTimeFimPicker = () => {
    setShowTimeFimModal(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Adicionar Evento</Text>
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
            keyboardType="numeric"
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
            onChangeText={(text) => {
              // Aceitar apenas números e caracteres especiais de telefone: + - ( ) espaço
              const cleaned = text.replace(/[^0-9+\-() ]/g, '');
              updateForm('telefoneContratante', cleaned);
            }}
            placeholder="Ex: (21) 99999-9999"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
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
            onPress={openDatePicker}
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
            onPress={openTimeInicioPicker}
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
            onPress={openTimeFimPicker}
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

        {/* Seção de Despesas */}
        <View style={styles.inputGroup}>
          <View style={styles.despesasHeader}>
            <Text style={[styles.label, { color: colors.text }]}>Despesas do Evento</Text>
            <TouchableOpacity style={styles.addDespesaButton} onPress={addDespesa}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addDespesaText}>Adicionar</Text>
            </TouchableOpacity>
          </View>

          {despesas.map((despesa, index) => (
            <View key={index} style={[styles.despesaItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.despesaHeader}>
                <Text style={[styles.despesaTitle, { color: colors.text }]}>Despesa {index + 1}</Text>
                <TouchableOpacity onPress={() => removeDespesa(index)}>
                  <Ionicons name="trash" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.despesaFields}>
                <View style={styles.despesaField}>
                  <Text style={[styles.despesaLabel, { color: colors.text }]}>Nome *</Text>
                  <TextInput
                    style={[styles.despesaInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={despesa.nome}
                    onChangeText={(text) => updateDespesa(index, 'nome', text)}
                    placeholder="Ex: Transporte, Alimentação"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.despesaField}>
                  <Text style={[styles.despesaLabel, { color: colors.text }]}>Valor (R$) *</Text>
                  <TextInput
                    style={[styles.despesaInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={despesa.valor ? formatCurrency(despesa.valor) : ''}
                    onChangeText={(text) => {
                      const numericValue = text.replace(/\D/g, '').slice(0, 11);
                      updateDespesa(index, 'valor', numericValue);
                    }}
                    placeholder="R$ 0,00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

            </View>
          ))}

          {despesas.length === 0 && (
            <View style={styles.emptyDespesas}>
              <Ionicons name="receipt-outline" size={32} color={colors.border} />
              <Text style={[styles.emptyDespesasText, { color: colors.textSecondary }]}>
                Nenhuma despesa adicionada
              </Text>
              <Text style={[styles.emptyDespesasSubtext, { color: colors.textSecondary }]}>
                Toque em &quot;Adicionar&quot; para incluir despesas do evento
              </Text>
            </View>
          )}
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
                <Text style={styles.saveButtonText}>Salvar Evento</Text>
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
                initialMonth={selectedMonth}
                initialYear={selectedYear}
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
  tagButtonActive: {
    // Cor será definida dinamicamente baseada na tag
  },
  tagButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  tagButtonTextActive: {
    color: '#fff',
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
  despesasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addDespesaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addDespesaText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
    color: '#FFFFFF',
  },
  despesaItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  despesaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  despesaTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  despesaFields: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  despesaField: {
    flex: 1,
  },
  despesaLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  despesaInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  emptyDespesas: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyDespesasText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyDespesasSubtext: {
    fontSize: 14,
    textAlign: 'center',
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
    width: '14.28%', // 100% / 7 dias
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayItem: {
    width: '14.28%', // 100% / 7 dias
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
  dayItemText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  dayItemTextSelected: {
    color: '#fff',
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
    paddingBottom: 34, // Para iPhone com home indicator
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
  },
});
