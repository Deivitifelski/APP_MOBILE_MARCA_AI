import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { createEvent, CreateExpenseData } from '../services/supabase/eventService';
import { getCurrentUser } from '../services/supabase/authService';
import { getArtists } from '../services/supabase/artistService';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

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
}

interface DespesaForm {
  nome: string;
  valor: string;
  arquivo_url?: string;
  arquivo_tipo?: 'image' | 'document';
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
      <Text style={styles.monthYearLabel}>
        {monthNames[month]} / {year}
      </Text>
      
      {/* Cabeçalho dos dias da semana */}
      <View style={styles.weekdayHeader}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((weekday) => (
          <Text key={weekday} style={styles.weekdayHeaderText}>
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

export default function AdicionarEventoScreen() {
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
    status: 'a_confirmar',
    descricao: '',
  });

  const [despesas, setDespesas] = useState<DespesaForm[]>([]);

  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeInicioModal, setShowTimeInicioModal] = useState(false);
  const [showTimeFimModal, setShowTimeFimModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);


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

      const artistId = artists[0].id;

      // Preparar despesas
      const expensesData: CreateExpenseData[] = despesas
        .filter(despesa => despesa.nome.trim() && despesa.valor.trim())
        .map(despesa => ({
          name: despesa.nome.trim(),
          value: parseFloat(despesa.valor),
          receipt_url: despesa.arquivo_url
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
    } catch (error) {
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
    
    // Converte para número e divide por 100 para ter centavos
    const amount = parseInt(numericValue) / 100;
    
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

  const pickImageForDespesa = async (index: number) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        updateDespesa(index, 'arquivo_url', asset.uri);
        updateDespesa(index, 'arquivo_tipo', 'image');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao selecionar imagem');
    }
  };

  const pickDocumentForDespesa = async (index: number) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        updateDespesa(index, 'arquivo_url', asset.uri);
        updateDespesa(index, 'arquivo_tipo', 'document');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao selecionar documento');
    }
  };

  const removeFileFromDespesa = (index: number) => {
    updateDespesa(index, 'arquivo_url', undefined);
    updateDespesa(index, 'arquivo_tipo', undefined);
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Adicionar Evento</Text>
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
            onPress={openDatePicker}
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
            onPress={openTimeInicioPicker}
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
            onPress={openTimeFimPicker}
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

        {/* Seção de Despesas */}
        <View style={styles.inputGroup}>
          <View style={styles.despesasHeader}>
            <Text style={styles.label}>Despesas do Evento</Text>
            <TouchableOpacity style={styles.addDespesaButton} onPress={addDespesa}>
              <Ionicons name="add" size={20} color="#667eea" />
              <Text style={styles.addDespesaText}>Adicionar</Text>
            </TouchableOpacity>
          </View>

          {despesas.map((despesa, index) => (
            <View key={index} style={styles.despesaItem}>
              <View style={styles.despesaHeader}>
                <Text style={styles.despesaTitle}>Despesa {index + 1}</Text>
                <TouchableOpacity onPress={() => removeDespesa(index)}>
                  <Ionicons name="trash" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.despesaFields}>
                <View style={styles.despesaField}>
                  <Text style={styles.despesaLabel}>Nome *</Text>
                  <TextInput
                    style={styles.despesaInput}
                    value={despesa.nome}
                    onChangeText={(text) => updateDespesa(index, 'nome', text)}
                    placeholder="Ex: Transporte, Alimentação"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.despesaField}>
                  <Text style={styles.despesaLabel}>Valor (R$) *</Text>
                  <TextInput
                    style={styles.despesaInput}
                    value={despesa.valor}
                    onChangeText={(text) => updateDespesa(index, 'valor', text)}
                    placeholder="0,00"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Upload de arquivo */}
              <View style={styles.despesaFileSection}>
                <Text style={styles.despesaLabel}>Comprovante (Opcional)</Text>
                
                {despesa.arquivo_url ? (
                  <View style={styles.filePreview}>
                    <View style={styles.fileInfo}>
                      <Ionicons 
                        name={despesa.arquivo_tipo === 'image' ? 'image' : 'document'} 
                        size={20} 
                        color="#667eea" 
                      />
                      <Text style={styles.fileName}>
                        {despesa.arquivo_tipo === 'image' ? 'Foto anexada' : 'Documento anexado'}
                      </Text>
                      <TouchableOpacity onPress={() => removeFileFromDespesa(index)}>
                        <Ionicons name="close-circle" size={20} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.uploadButtons}>
                    <TouchableOpacity 
                      style={styles.uploadButton} 
                      onPress={() => pickImageForDespesa(index)}
                    >
                      <Ionicons name="camera" size={18} color="#667eea" />
                      <Text style={styles.uploadButtonText}>Foto</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.uploadButton} 
                      onPress={() => pickDocumentForDespesa(index)}
                    >
                      <Ionicons name="document" size={18} color="#667eea" />
                      <Text style={styles.uploadButtonText}>Documento</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))}

          {despesas.length === 0 && (
            <View style={styles.emptyDespesas}>
              <Ionicons name="receipt-outline" size={32} color="#ccc" />
              <Text style={styles.emptyDespesasText}>
                Nenhuma despesa adicionada
              </Text>
              <Text style={styles.emptyDespesasSubtext}>
                Toque em "Adicionar" para incluir despesas do evento
              </Text>
            </View>
          )}
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
                initialMonth={selectedMonth}
                initialYear={selectedYear}
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  despesaItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
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
    color: '#333',
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
    color: '#333',
    marginBottom: 6,
  },
  despesaInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
    color: '#333',
  },
  despesaFileSection: {
    marginTop: 8,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#667eea',
    marginLeft: 4,
  },
  filePreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileName: {
    fontSize: 14,
    color: '#667eea',
    marginLeft: 8,
    flex: 1,
  },
  emptyDespesas: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  emptyDespesasText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyDespesasSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
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
});
