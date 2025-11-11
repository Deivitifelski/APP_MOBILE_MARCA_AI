import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActiveArtistContext } from '../contexts/ActiveArtistContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStandaloneExpense } from '../services/supabase/expenseService';

const CATEGORIAS = [
  { value: 'show', label: 'Show/Apresentação', icon: 'musical-notes' },
  { value: 'cache_extra', label: 'Cachê Extra', icon: 'cash' },
  { value: 'streaming', label: 'Streaming', icon: 'logo-youtube' },
  { value: 'direitos', label: 'Direitos Autorais', icon: 'document-text' },
  { value: 'patrocinio', label: 'Patrocínio', icon: 'ribbon' },
  { value: 'outros', label: 'Outros', icon: 'ellipsis-horizontal-circle' },
];

export default function AdicionarReceitaScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeArtist } = useActiveArtistContext();
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [data, setData] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const formatarValor = (text: string) => {
    // Remove tudo exceto números
    const apenasNumeros = text.replace(/[^0-9]/g, '');
    
    if (apenasNumeros === '') {
      setValor('');
      return;
    }

    // Converte para número com centavos
    const numero = parseInt(apenasNumeros) / 100;
    
    // Formata como moeda brasileira
    const valorFormatado = numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    setValor(valorFormatado);
  };

  const handleSalvar = async () => {
    if (!activeArtist) {
      Alert.alert('Erro', 'Nenhum artista selecionado');
      return;
    }

    if (!descricao.trim()) {
      Alert.alert('Atenção', 'Preencha a descrição da receita');
      return;
    }

    if (!valor || parseFloat(valor.replace(',', '.')) <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido');
      return;
    }

    if (!categoria) {
      Alert.alert('Atenção', 'Selecione uma categoria');
      return;
    }

    try {
      setIsLoading(true);

      // Converter valor de string formatada para número
      const valorNumerico = parseFloat(valor.replace('.', '').replace(',', '.'));

      // Salvar como despesa, mas com valor NEGATIVO para indicar receita
      const { success, error } = await createStandaloneExpense({
        artist_id: activeArtist.id,
        description: descricao.trim(),
        value: -valorNumerico, // Negativo = receita
        category: categoria,
        notes: observacoes.trim() || undefined,
        date: data.toISOString().split('T')[0],
      });

      if (success) {
        Alert.alert('Sucesso', 'Receita adicionada com sucesso!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert('Erro', error || 'Não foi possível adicionar a receita');
      }
    } catch (err) {
      Alert.alert('Erro', 'Erro ao adicionar receita');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: colors.surface, 
        borderBottomColor: colors.border,
        paddingTop: insets.top > 0 ? 16 : 20
      }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Nova Receita</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView>
          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="cash" size={20} color={colors.success} />
            <Text style={[styles.infoText, { color: colors.success }]}>
              Receitas avulsas são ganhos extras não vinculados a eventos. Use para cachês extras, direitos autorais, etc.
            </Text>
          </View>

          {/* Formulário */}
          <View style={[styles.formContainer, { backgroundColor: colors.surface }]}>
            {/* Descrição */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Descrição * <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                placeholder="Ex: Cachê extra do show"
                placeholderTextColor={colors.textSecondary}
                value={descricao}
                onChangeText={setDescricao}
                maxLength={100}
              />
            </View>

            {/* Valor */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Valor * <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.valorContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.cifrao, { color: colors.success }]}>R$</Text>
                <TextInput
                  style={[styles.valorInput, { color: colors.success }]}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSecondary}
                  value={valor}
                  onChangeText={formatarValor}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Categoria */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Categoria * <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.categoriasContainer}>
                {CATEGORIAS.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoriaButton,
                      {
                        backgroundColor: categoria === cat.value ? colors.success : colors.background,
                        borderColor: categoria === cat.value ? colors.success : colors.border,
                      },
                    ]}
                    onPress={() => setCategoria(cat.value)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={20}
                      color={categoria === cat.value ? '#fff' : colors.text}
                    />
                    <Text
                      style={[
                        styles.categoriaText,
                        { color: categoria === cat.value ? '#fff' : colors.text },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Data */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Data</Text>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color={colors.success} />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {data.toLocaleDateString('pt-BR')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Observações */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Observações (opcional)</Text>
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                placeholder="Adicione detalhes extras sobre esta receita..."
                placeholderTextColor={colors.textSecondary}
                value={observacoes}
                onChangeText={setObservacoes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>
          </View>

          {/* Botão Salvar */}
          <View style={[styles.buttonContainer, { paddingBottom: Math.max(insets.bottom, 20) + 40 }]}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.success }]}
              onPress={handleSalvar}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Adicionar Receita</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de Calendário */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View style={[styles.calendarModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.calendarTitle, { color: colors.text }]}>
              {data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </Text>

            {/* Grid de Dias */}
            <View style={styles.calendarGrid}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <Text key={day} style={[styles.calendarWeekday, { color: colors.textSecondary }]}>
                  {day}
                </Text>
              ))}
              
              {(() => {
                const year = data.getFullYear();
                const month = data.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const days = [];
                
                // Dias vazios antes do primeiro dia
                for (let i = 0; i < firstDay; i++) {
                  days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
                }
                
                // Dias do mês
                for (let day = 1; day <= daysInMonth; day++) {
                  const isSelected = data.getDate() === day;
                  days.push(
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.calendarDay,
                        isSelected && { backgroundColor: colors.success, borderRadius: 20 }
                      ]}
                      onPress={() => {
                        const newDate = new Date(year, month, day);
                        setData(newDate);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        { color: isSelected ? '#fff' : colors.text }
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                }
                
                return days;
              })()}
            </View>

            <TouchableOpacity
              style={[styles.calendarCloseButton, { backgroundColor: colors.background }]}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={[styles.calendarCloseText, { color: colors.text }]}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  formContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  valorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cifrao: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  valorInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
  },
  categoriasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoriaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoriaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  buttonContainer: {
    paddingHorizontal: 20,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  calendarWeekday: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  calendarDayText: {
    fontSize: 14,
  },
  calendarCloseButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  calendarCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

