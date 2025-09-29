import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

export default function CancelarPlanoScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirmCancel = async () => {
    Alert.alert(
      'Confirmar Cancelamento',
      'Tem certeza absoluta que deseja cancelar seu plano premium? Esta ação não pode ser desfeita.',
      [
        {
          text: 'Voltar',
          style: 'cancel'
        },
        {
          text: 'Sim, Cancelar Plano',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Aqui você implementaria a lógica real de cancelamento
              // Por enquanto, vamos simular o processo
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              Alert.alert(
                'Cancelamento Processado',
                'Seu plano premium foi cancelado com sucesso. Você ainda terá acesso aos recursos premium até o final do período de cobrança atual.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.back();
                    }
                  }
                ]
              );
            } catch (error) {
              Alert.alert('Erro', 'Erro ao cancelar plano: ' + error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contatar Suporte',
      'Para cancelar seu plano ou esclarecer dúvidas, entre em contato conosco:',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Enviar Email',
          onPress: () => {
            // Aqui você pode implementar envio de email
            Alert.alert('Email', 'contato@marcaai.com');
          }
        }
      ]
    );
  };

  const dynamicStyles = createDynamicStyles(colors);

  return (
    <View style={dynamicStyles.container}>
      <SafeAreaView style={dynamicStyles.safeArea}>
        {/* Header */}
        <View style={[dynamicStyles.header, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={dynamicStyles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>Cancelar Plano Premium</Text>
          <View style={dynamicStyles.headerPlaceholder} />
        </View>

        <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
          {/* Aviso Importante */}
          <View style={[dynamicStyles.warningCard, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <View style={dynamicStyles.warningHeader}>
              <Ionicons name="warning" size={24} color="#F59E0B" />
              <Text style={[dynamicStyles.warningTitle, { color: '#92400E' }]}>
                Aviso Importante
              </Text>
            </View>
            <Text style={[dynamicStyles.warningText, { color: '#92400E' }]}>
              Ao cancelar seu plano premium, você perderá acesso a recursos exclusivos e voltará ao plano gratuito com limitações.
            </Text>
          </View>

          {/* O que você perderá */}
          <View style={[dynamicStyles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>
              ❌ O que você perderá:
            </Text>
            
            <View style={dynamicStyles.featureList}>
              <View style={dynamicStyles.featureItem}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={[dynamicStyles.featureText, { color: colors.text }]}>
                  Usuários ilimitados por artista
                </Text>
              </View>
              
              <View style={dynamicStyles.featureItem}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={[dynamicStyles.featureText, { color: colors.text }]}>
                  Relatórios financeiros detalhados
                </Text>
              </View>
              
              <View style={dynamicStyles.featureItem}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={[dynamicStyles.featureText, { color: colors.text }]}>
                  Exportação de dados em PDF
                </Text>
              </View>
              
              <View style={dynamicStyles.featureItem}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={[dynamicStyles.featureText, { color: colors.text }]}>
                  Suporte prioritário
                </Text>
              </View>
              
              <View style={dynamicStyles.featureItem}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={[dynamicStyles.featureText, { color: colors.text }]}>
                  Recursos avançados de gestão
                </Text>
              </View>
              
              <View style={dynamicStyles.featureItem}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={[dynamicStyles.featureText, { color: colors.text }]}>
                  Análises e insights exclusivos
                </Text>
              </View>
            </View>
          </View>

          {/* Limitações do plano gratuito */}
          <View style={[dynamicStyles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>
              📊 Limitações do Plano Gratuito:
            </Text>
            
            <View style={dynamicStyles.limitationList}>
              <View style={dynamicStyles.limitationItem}>
                <Ionicons name="people" size={20} color="#6B7280" />
                <Text style={[dynamicStyles.limitationText, { color: colors.text }]}>
                  Máximo 3 usuários por artista
                </Text>
              </View>
              
              <View style={dynamicStyles.limitationItem}>
                <Ionicons name="document-text" size={20} color="#6B7280" />
                <Text style={[dynamicStyles.limitationText, { color: colors.text }]}>
                  Relatórios básicos apenas
                </Text>
              </View>
              
              <View style={dynamicStyles.limitationItem}>
                <Ionicons name="time" size={20} color="#6B7280" />
                <Text style={[dynamicStyles.limitationText, { color: colors.text }]}>
                  Suporte por email (até 48h)
                </Text>
              </View>
            </View>
          </View>

          {/* Alternativas */}
          <View style={[dynamicStyles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[dynamicStyles.sectionTitle, { color: colors.text }]}>
              💡 Alternativas:
            </Text>
            
            <View style={dynamicStyles.alternativeList}>
              <View style={dynamicStyles.alternativeItem}>
                <Ionicons name="pause-circle" size={20} color="#3B82F6" />
                <Text style={[dynamicStyles.alternativeText, { color: colors.text }]}>
                  Pausar assinatura temporariamente
                </Text>
              </View>
              
              <View style={dynamicStyles.alternativeItem}>
                <Ionicons name="card" size={20} color="#3B82F6" />
                <Text style={[dynamicStyles.alternativeText, { color: colors.text }]}>
                  Alterar método de pagamento
                </Text>
              </View>
              
              <View style={dynamicStyles.alternativeItem}>
                <Ionicons name="chatbubble" size={20} color="#3B82F6" />
                <Text style={[dynamicStyles.alternativeText, { color: colors.text }]}>
                  Falar com nosso suporte
                </Text>
              </View>
            </View>
          </View>

          {/* Informações sobre reembolso */}
          <View style={[dynamicStyles.infoCard, { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' }]}>
            <View style={dynamicStyles.infoHeader}>
              <Ionicons name="information-circle" size={20} color="#6B7280" />
              <Text style={[dynamicStyles.infoTitle, { color: '#374151' }]}>
                Informações Importantes
              </Text>
            </View>
            <Text style={[dynamicStyles.infoText, { color: '#374151' }]}>
              • Você manterá acesso aos recursos premium até o final do período de cobrança atual{'\n'}
              • Não há reembolso para períodos já pagos{'\n'}
              • Você pode reativar seu plano a qualquer momento{'\n'}
              • Seus dados serão preservados por 30 dias após o cancelamento
            </Text>
          </View>
        </ScrollView>

        {/* Botões de Ação */}
        <View style={[dynamicStyles.actionButtons, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[dynamicStyles.contactButton, { backgroundColor: colors.primary }]}
            onPress={handleContactSupport}
          >
            <Ionicons name="chatbubble" size={20} color="#fff" />
            <Text style={dynamicStyles.contactButtonText}>Falar com Suporte</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[dynamicStyles.cancelButton, { backgroundColor: '#EF4444' }]}
            onPress={handleConfirmCancel}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={dynamicStyles.cancelButtonText}>Cancelar Plano</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createDynamicStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  warningCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  featureList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    flex: 1,
  },
  limitationList: {
    gap: 8,
  },
  limitationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  limitationText: {
    fontSize: 14,
    flex: 1,
  },
  alternativeList: {
    gap: 8,
  },
  alternativeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alternativeText: {
    fontSize: 14,
    flex: 1,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
