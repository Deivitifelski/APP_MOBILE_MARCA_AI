import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { getCurrentUser } from '../services/supabase/authService';
import { getPlanos, Plano, setUsuarioPlano } from '../services/supabase/planService';

export default function SelecionarPlanoScreen() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlano, setSelectedPlano] = useState<Plano | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPlanos();
  }, []);

  const loadPlanos = async () => {
    try {
      const { success, planos: planosData, error } = await getPlanos();
      
      if (success && planosData) {
        setPlanos(planosData);
        // Selecionar o plano Free por padrão
        const freePlano = planosData.find(p => p.nome === 'free');
        if (freePlano) {
          setSelectedPlano(freePlano);
        }
      } else {
        Alert.alert('Erro', 'Erro ao carregar planos: ' + error);
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const handleSelecionarPlano = (plano: Plano) => {
    setSelectedPlano(plano);
  };

  const handleContinuar = async () => {
    if (!selectedPlano) {
      Alert.alert('Erro', 'Por favor, selecione um plano');
      return;
    }

    setProcessing(true);
    try {
      // Obter o usuário atual
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        return;
      }

      // Se for plano Free, criar diretamente
      if (selectedPlano.nome === 'free') {
        const { success, error } = await setUsuarioPlano(user.id, selectedPlano.id);
        
        if (success) {
          Alert.alert(
            'Sucesso!',
            'Plano Free ativado com sucesso! Você pode começar a usar o app.',
            [
              {
                text: 'Continuar',
                onPress: () => router.replace('/(tabs)/agenda')
              }
            ]
          );
        } else {
          Alert.alert('Erro', 'Erro ao ativar plano: ' + error);
        }
      } else {
        // Para planos pagos, mostrar informações sobre pagamento
        Alert.alert(
          'Plano Pago',
          `Você selecionou o plano ${selectedPlano.nome.toUpperCase()} por R$ ${selectedPlano.preco.toFixed(2)}/mês.\n\nFuncionalidades incluídas:\n${getRecursosText(selectedPlano)}\n\nO sistema de pagamento será implementado em breve. Por enquanto, você pode usar o plano Free.`,
          [
            {
              text: 'Usar Plano Free',
              onPress: async () => {
                const freePlano = planos.find(p => p.nome === 'free');
                if (freePlano) {
                  const { success, error } = await setUsuarioPlano(user.id, freePlano.id);
                  
                  if (success) {
                    Alert.alert(
                      'Sucesso!',
                      'Plano Free ativado com sucesso!',
                      [
                        {
                          text: 'Continuar',
                          onPress: () => router.replace('/(tabs)/agenda')
                        }
                      ]
                    );
                  } else {
                    Alert.alert('Erro', 'Erro ao ativar plano: ' + error);
                  }
                }
              }
            },
            {
              text: 'Cancelar',
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao processar o plano');
    } finally {
      setProcessing(false);
    }
  };

  const getRecursosText = (plano: Plano) => {
    const recursos = [];
    
    if (plano.recursos.export_financas) {
      recursos.push('• Exportação de relatórios financeiros');
    }
    
    if (plano.recursos.colaboradores) {
      recursos.push(`• Até ${plano.max_usuarios || 'ilimitados'} colaboradores`);
    }
    
    if (plano.recursos.suporte_prioritario) {
      recursos.push('• Suporte prioritário');
    }
    
    return recursos.join('\n');
  };

  const getPlanoColor = (plano: Plano) => {
    switch (plano.nome) {
      case 'free':
        return '#28a745';
      case 'basic':
        return '#007bff';
      case 'pro':
        return '#6f42c1';
      default:
        return '#667eea';
    }
  };

  const getPlanoIcon = (plano: Plano) => {
    switch (plano.nome) {
      case 'free':
        return 'gift-outline';
      case 'basic':
        return 'star-outline';
      case 'pro':
        return 'diamond-outline';
      default:
        return 'card-outline';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Carregando planos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="card-outline" size={50} color="#667eea" />
            </View>
            <Text style={styles.title}>Escolha seu Plano</Text>
            <Text style={styles.subtitle}>
              Selecione o plano que melhor atende às suas necessidades
            </Text>
          </View>

          {/* Planos */}
          <View style={styles.planosContainer}>
            {planos.map((plano) => (
              <TouchableOpacity
                key={plano.id}
                style={[
                  styles.planoCard,
                  selectedPlano?.id === plano.id && styles.planoCardSelected,
                  { borderColor: getPlanoColor(plano) }
                ]}
                onPress={() => handleSelecionarPlano(plano)}
                disabled={processing}
              >
                <View style={styles.planoHeader}>
                  <View style={[styles.planoIcon, { backgroundColor: getPlanoColor(plano) }]}>
                    <Ionicons name={getPlanoIcon(plano)} size={24} color="#fff" />
                  </View>
                  <View style={styles.planoInfo}>
                    <Text style={styles.planoNome}>{plano.nome.toUpperCase()}</Text>
                    <Text style={styles.planoPreco}>
                      {plano.preco === 0 ? 'Grátis' : `R$ ${plano.preco.toFixed(2)}/mês`}
                    </Text>
                  </View>
                  {selectedPlano?.id === plano.id && (
                    <View style={styles.selectedIndicator}>
                      <Ionicons name="checkmark-circle" size={24} color={getPlanoColor(plano)} />
                    </View>
                  )}
                </View>

                <View style={styles.planoRecursos}>
                  <Text style={styles.recursosTitle}>Recursos incluídos:</Text>
                  <Text style={styles.recursosText}>{getRecursosText(plano)}</Text>
                  
                  {plano.max_usuarios !== null && (
                    <Text style={styles.limiteText}>
                      Limite: {plano.max_usuarios} usuário{plano.max_usuarios > 1 ? 's' : ''}
                    </Text>
                  )}
                  
                  {plano.max_usuarios === null && (
                    <Text style={styles.limiteText}>Usuários: Ilimitados</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Botão Continuar */}
          <TouchableOpacity
            style={[
              styles.continuarButton,
              (!selectedPlano || processing) && styles.continuarButtonDisabled
            ]}
            onPress={handleContinuar}
            disabled={!selectedPlano || processing}
          >
            <Text style={styles.continuarButtonText}>
              {processing ? 'Processando...' : 'Continuar'}
            </Text>
          </TouchableOpacity>

          {/* Informações adicionais */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              💡 Você pode alterar seu plano a qualquer momento nas configurações
            </Text>
            <Text style={styles.infoText}>
              🔒 Seus dados estão seguros e protegidos
            </Text>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  planosContainer: {
    marginBottom: 30,
  },
  planoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  planoCardSelected: {
    borderWidth: 3,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  planoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  planoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  planoInfo: {
    flex: 1,
  },
  planoNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  planoPreco: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  selectedIndicator: {
    marginLeft: 8,
  },
  planoRecursos: {
    marginTop: 8,
  },
  recursosTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  recursosText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  limiteText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  continuarButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  continuarButtonDisabled: {
    backgroundColor: '#ccc',
  },
  continuarButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});
