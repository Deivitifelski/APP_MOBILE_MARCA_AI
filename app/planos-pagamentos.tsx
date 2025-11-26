import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchProducts, initConnection, requestPurchase } from 'react-native-iap';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

// IDs das assinaturas
const subscriptionSkus = ['Premium marca_ai_9_90_m'];

export default function PlanosPagamentosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    const inicializarEBuscar = async () => {
      try {
        // Inicializar StoreKit primeiro
        console.log('🔄 [useEffect] Iniciando conexão com StoreKit...');
        const initResult = await initConnection();
        console.log('✅ [initConnection] SUCESSO - StoreKit inicializado:');
        console.log('📊 [initConnection] Resultado:', JSON.stringify(initResult, null, 2));
        
        // Aguardar um pouco para garantir que a conexão está totalmente estabelecida
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Agora buscar assinaturas
        console.log('🔄 [useEffect] Conexão estabelecida, buscando assinaturas...');
        await inAppGetSubscriptions();
      } catch (error: any) {
        console.error('❌ [initConnection] ERRO ao inicializar StoreKit:');
        console.error('❌ [initConnection] Tipo do erro:', typeof error);
        console.error('❌ [initConnection] Mensagem:', error?.message || 'Sem mensagem');
        console.error('❌ [initConnection] Stack:', error?.stack || 'Sem stack');
        console.error('❌ [initConnection] Erro completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      }
    };

    inicializarEBuscar();
  }, []);

  // Função para buscar assinaturas disponíveis
  const inAppGetSubscriptions = async () => {
    try {
      console.log('🔄 [inAppGetSubscriptions] Iniciando busca de assinaturas...');
      console.log('📋 [inAppGetSubscriptions] SKUs buscados:', JSON.stringify(subscriptionSkus, null, 2));
      
      // Garantir que a conexão está inicializada
      console.log('🔍 [inAppGetSubscriptions] Verificando conexão...');
      try {
        await initConnection();
        console.log('✅ [inAppGetSubscriptions] Conexão verificada/estabelecida');
      } catch (initError) {
        console.warn('⚠️ [inAppGetSubscriptions] Erro ao verificar conexão (pode já estar inicializada):', initError);
      }
      
      // Pequeno delay para garantir que a conexão está pronta
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('🔍 [inAppGetSubscriptions] Buscando produtos...');
      const test = await fetchProducts({
        skus: subscriptionSkus,
        type: 'subs',
      });
      
      console.log('✅ [inAppGetSubscriptions] SUCESSO - Dados recebidos:');
      console.log('📊 [inAppGetSubscriptions] Tipo:', typeof test);
      console.log('📊 [inAppGetSubscriptions] É array?', Array.isArray(test));
      console.log('📊 [inAppGetSubscriptions] Quantidade:', test?.length || 0);
      console.log('📊 [inAppGetSubscriptions] Dados completos:', JSON.stringify(test, null, 2));
      
      if (test && test.length > 0) {
        console.log('✅ [inAppGetSubscriptions] Produtos encontrados:', test.length);
        test.forEach((produto, index) => {
          console.log(`\n📦 [inAppGetSubscriptions] Produto ${index + 1}:`);
          console.log('   ID:', produto.id);
          console.log('   Título:', produto.title);
          console.log('   Preço:', produto.displayPrice);
          console.log('   Descrição:', produto.description);
          console.log('   Tipo:', produto.type);
          console.log('   Dados completos do produto:', JSON.stringify(produto, null, 2));
        });
      } else {
        console.warn('⚠️ [inAppGetSubscriptions] Nenhuma assinatura encontrada');
        console.warn('⚠️ [inAppGetSubscriptions] Resposta recebida:', test);
      }
    } catch (error: any) {
      console.error('❌ [inAppGetSubscriptions] ERRO ao buscar assinaturas:');
      console.error('❌ [inAppGetSubscriptions] Tipo do erro:', typeof error);
      console.error('❌ [inAppGetSubscriptions] É instância de Error?', error instanceof Error);
      console.error('❌ [inAppGetSubscriptions] Mensagem:', error?.message || 'Sem mensagem');
      console.error('❌ [inAppGetSubscriptions] Código:', error?.code || 'Sem código');
      console.error('❌ [inAppGetSubscriptions] Stack:', error?.stack || 'Sem stack');
      console.error('❌ [inAppGetSubscriptions] Erro completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
  };

  // Função para comprar uma assinatura
  const inAppBuySubscription = async (data: { productid?: string }) => {
    console.log('🔄 [inAppBuySubscription] Iniciando compra de assinatura...');
    console.log('📋 [inAppBuySubscription] Dados recebidos:', JSON.stringify(data, null, 2));
    console.log('📋 [inAppBuySubscription] Product ID:', data?.productid || 'Não fornecido');
    
    try {
      // Garantir que a conexão está inicializada
      console.log('🔍 [inAppBuySubscription] Verificando conexão...');
      try {
        await initConnection();
        console.log('✅ [inAppBuySubscription] Conexão verificada/estabelecida');
      } catch (initError) {
        console.warn('⚠️ [inAppBuySubscription] Erro ao verificar conexão (pode já estar inicializada):', initError);
      }
      
      // Pequeno delay para garantir que a conexão está pronta
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const productId = data?.productid || subscriptionSkus[0];
      console.log('🛒 [inAppBuySubscription] Product ID a ser usado:', productId);
      
      const requestParams = {
        request: {
          ios: { sku: productId },
        },
        type: 'subs' as const,
      };
      
      console.log('📤 [inAppBuySubscription] Parâmetros da requisição:', JSON.stringify(requestParams, null, 2));
      
      const result = await requestPurchase(requestParams);
      
      console.log('✅ [inAppBuySubscription] SUCESSO - Compra iniciada:');
      console.log('📊 [inAppBuySubscription] Tipo do resultado:', typeof result);
      console.log('📊 [inAppBuySubscription] Resultado completo:', JSON.stringify(result, null, 2));
      
      if (result) {
        console.log('✅ [inAppBuySubscription] Compra processada com sucesso');
        if (Array.isArray(result)) {
          console.log('📦 [inAppBuySubscription] Múltiplas compras:', result.length);
          result.forEach((purchase, index) => {
            console.log(`\n📦 [inAppBuySubscription] Compra ${index + 1}:`, JSON.stringify(purchase, null, 2));
          });
        } else {
          console.log('📦 [inAppBuySubscription] Compra única:', JSON.stringify(result, null, 2));
        }
      } else {
        console.warn('⚠️ [inAppBuySubscription] Resultado é null (compra pode estar pendente)');
      }
    } catch (error: any) {
      console.error('❌ [inAppBuySubscription] ERRO ao comprar assinatura:');
      console.error('❌ [inAppBuySubscription] Tipo do erro:', typeof error);
      console.error('❌ [inAppBuySubscription] É instância de Error?', error instanceof Error);
      
      // PurchaseError é uma interface, não uma classe
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        console.error('❌ [inAppBuySubscription] Código do erro:', error.code);
        console.error('❌ [inAppBuySubscription] Mensagem do erro:', error.message);
        console.error('❌ [inAppBuySubscription] Product ID (se disponível):', error.productId || 'Não disponível');
        console.error('❌ [inAppBuySubscription] Erro completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } else {
        console.error('❌ [inAppBuySubscription] Mensagem:', error?.message || 'Sem mensagem');
        console.error('❌ [inAppBuySubscription] Stack:', error?.stack || 'Sem stack');
        console.error('❌ [inAppBuySubscription] Erro completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: colors.surface, 
        borderBottomColor: colors.border,
        paddingTop: insets.top > 0 ? 16 : 20
      }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Planos e Pagamentos</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Conteúdo da tela será adicionado aqui */}
      </View>
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
