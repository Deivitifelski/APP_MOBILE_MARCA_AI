import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { createExpense } from '../services/supabase/expenseService';

interface DespesaForm {
  nome: string;
  valor: string;
}

export default function AdicionarDespesaScreen() {
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;

  const [form, setForm] = useState<DespesaForm>({
    nome: '',
    valor: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const updateForm = (field: keyof DespesaForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };


  const handleSave = async () => {
    // Validações básicas
    if (!form.nome.trim()) {
      Alert.alert('Erro', 'Nome da despesa é obrigatório');
      return;
    }
    if (!form.valor.trim()) {
      Alert.alert('Erro', 'Valor é obrigatório');
      return;
    }
    if (isNaN(parseFloat(form.valor))) {
      Alert.alert('Erro', 'Valor deve ser um número válido');
      return;
    }

    setIsLoading(true);

    try {
      const expenseData = {
        name: form.nome.trim(),
        value: parseFloat(form.valor) / 100, // Converter centavos para reais
      };

      const result = await createExpense(eventId, expenseData);

      if (result.success) {
        Alert.alert(
          'Sucesso',
          'Despesa adicionada com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Erro', result.error || 'Erro ao salvar despesa');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao salvar despesa');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    // Remove caracteres não numéricos
    const numericValue = value.replace(/\D/g, '');
    
    if (!numericValue) return '';
    
    // Converte para número e formata como moeda
    const number = parseFloat(numericValue) / 100;
    return number.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const handleValueChange = (text: string) => {
    const numericValue = text.replace(/\D/g, '');
    updateForm('valor', numericValue);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Adicionar Despesa</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Nome da Despesa */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome da Despesa *</Text>
          <TextInput
            style={styles.input}
            value={form.nome}
            onChangeText={(text) => updateForm('nome', text)}
            placeholder="Ex: Combustível, Alimentação, Hospedagem"
            placeholderTextColor="#999"
          />
        </View>

        {/* Valor */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Valor (R$) *</Text>
          <TextInput
            style={styles.input}
            value={form.valor ? formatCurrency(form.valor) : ''}
            onChangeText={handleValueChange}
            placeholder="R$ 0,00"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
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
                <Text style={styles.saveButtonText}>Salvar Despesa</Text>
              </>
            )}
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
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
