import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesError,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { getRevenueCatKey } from '../config/revenuecat-keys';
import { supabase } from '../lib/supabase';

let isConfigured = false;

/**
 * Inicializa o RevenueCat com o ID do usuário
 * Deve ser chamado após o login do usuário
 */
export const initializeIAP = async (userId: string): Promise<void> => {
  try {
    // Se já está configurado, não precisa configurar novamente
    if (isConfigured) {
      return;
    }

    // Configurar log level para debug
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    const apiKey = getRevenueCatKey();

    if (!apiKey || apiKey.includes('xxxxxxxx')) {
      console.warn('⚠️ RevenueCat não configurado: chaves não definidas');
      return;
    }

    if (Platform.OS === 'ios') {
      // Configurar iOS com opções para usar API diretamente
      await Purchases.configure({ 
        apiKey,
        // Usar StoreKit 1 se StoreKit 2 não estiver disponível
        useStoreKit2IfAvailable: false,
        // Não usar observer mode - usar transações normais
        observerMode: false,
      });
    } else if (Platform.OS === 'android') {
      await Purchases.configure({ apiKey });
      // Para Amazon: await Purchases.configure({ apiKey, useAmazon: true });
    }

    // Associar com o ID do usuário do Supabase
    if (userId) {
      await Purchases.logIn(userId);
    }

    isConfigured = true;
    console.log('✅ RevenueCat configurado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao configurar RevenueCat:', error);
    isConfigured = false;
    throw error;
  }
};

/**
 * Verifica se o RevenueCat está configurado e tenta configurar se necessário
 */
const ensureConfigured = async (): Promise<boolean> => {
  if (isConfigured) {
    return true;
  }

  try {
    // Tentar obter o usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('⚠️ RevenueCat: Usuário não autenticado');
      return false;
    }

    // Tentar inicializar
    await initializeIAP(user.id);
    return isConfigured;
  } catch (error) {
    console.warn('⚠️ RevenueCat: Não foi possível configurar:', error);
    return false;
  }
};

/**
 * Busca os produtos/planos disponíveis para compra
 */
export const getAvailableProducts = async (): Promise<PurchasesPackage[]> => {
  try {
    const configured = await ensureConfigured();
    if (!configured) {
      console.warn('⚠️ RevenueCat não configurado, não é possível buscar produtos');
      return [];
    }

    console.log('🔍 Buscando ofertas do RevenueCat...');
    const offerings: PurchasesOfferings = await Purchases.getOfferings();

    console.log('📦 Offerings recebidos:', {
      current: offerings.current ? 'existe' : 'não existe',
      all: Object.keys(offerings.all),
    });

    if (offerings.current) {
      console.log('📋 Oferta atual:', {
        identifier: offerings.current.identifier,
        serverDescription: offerings.current.serverDescription,
        availablePackages: offerings.current.availablePackages.length,
      });

      // Log detalhado de cada package
      offerings.current.availablePackages.forEach((pkg, index) => {
        console.log(`📦 Package ${index + 1}:`, {
          identifier: pkg.identifier,
          packageType: pkg.packageType,
          productId: pkg.product.identifier,
          productTitle: pkg.product.title,
          productPrice: pkg.product.priceString,
          productDescription: pkg.product.description,
        });
      });

      if (offerings.current.availablePackages.length > 0) {
        console.log(`✅ ${offerings.current.availablePackages.length} produto(s) encontrado(s)`);
        return offerings.current.availablePackages;
      }
    } else {
      console.warn('⚠️ Nenhuma oferta atual (current) disponível');
      console.log('📋 Ofertas disponíveis:', Object.keys(offerings.all));
      
      // Tentar buscar produtos de outras offerings
      for (const offeringKey in offerings.all) {
        const offering = offerings.all[offeringKey];
        if (offering.availablePackages.length > 0) {
          console.log(`✅ Usando offering alternativa: ${offering.identifier} com ${offering.availablePackages.length} packages`);
          return offering.availablePackages;
        }
      }
    }

    console.warn('⚠️ Nenhum produto disponível no RevenueCat');
    return [];
  } catch (error: any) {
    // Tratar erros específicos do RevenueCat
    if (error?.code === 23 || error?.readableErrorCode === 'CONFIGURATION_ERROR') {
      console.warn('⚠️ Erro de configuração do RevenueCat:', error.message);
      console.warn('💡 Dica: Verifique se os produtos estão configurados no dashboard do RevenueCat.');
      console.warn('💡 Se estiver no simulador, você pode precisar configurar o arquivo StoreKit Configuration.');
      console.warn('💡 Se estiver em dispositivo físico, use uma conta sandbox do App Store Connect.');
      
      // Tentar buscar produtos de outras offerings disponíveis
      console.log('🔄 Tentando buscar produtos de outras offerings disponíveis...');
      try {
        const allOfferings = await Purchases.getOfferings();
        console.log('📋 Todas as offerings disponíveis:', Object.keys(allOfferings.all));
        
        // Tentar buscar packages de todas as offerings
        for (const offeringKey in allOfferings.all) {
          const offering = allOfferings.all[offeringKey];
          if (offering.availablePackages.length > 0) {
            console.log(`✅ Encontrados ${offering.availablePackages.length} packages na offering: ${offering.identifier}`);
            return offering.availablePackages;
          }
        }
      } catch (directError) {
        console.warn('⚠️ Não foi possível buscar produtos de outras offerings:', directError);
      }
    } else {
      console.error('❌ Erro ao buscar produtos:', error);
    }
    return [];
  }
};

/**
 * Busca um produto específico pelo ID
 */
export const getProductById = async (productId: string): Promise<PurchasesPackage | null> => {
  try {
    const configured = await ensureConfigured();
    if (!configured) {
      console.warn('⚠️ RevenueCat não configurado, não é possível buscar produto');
      return null;
    }

    console.log(`🔍 Buscando produto específico: ${productId}`);
    const offerings: PurchasesOfferings = await Purchases.getOfferings();

    // Buscar em todas as ofertas
    for (const offeringKey in offerings.all) {
      const offering = offerings.all[offeringKey];
      console.log(`📋 Verificando oferta: ${offering.identifier}`);
      
      for (const pkg of offering.availablePackages) {
        console.log(`  📦 Package: ${pkg.identifier}, Product ID: ${pkg.product.identifier}`);
        
        if (pkg.product.identifier === productId) {
          console.log(`✅ Produto encontrado!`, {
            packageIdentifier: pkg.identifier,
            productId: pkg.product.identifier,
            productTitle: pkg.product.title,
            productPrice: pkg.product.priceString,
            productDescription: pkg.product.description,
          });
          return pkg;
        }
      }
    }

    // Também verificar na oferta atual
    if (offerings.current) {
      console.log(`📋 Verificando oferta atual: ${offerings.current.identifier}`);
      for (const pkg of offerings.current.availablePackages) {
        if (pkg.product.identifier === productId) {
          console.log(`✅ Produto encontrado na oferta atual!`, {
            packageIdentifier: pkg.identifier,
            productId: pkg.product.identifier,
            productTitle: pkg.product.title,
            productPrice: pkg.product.priceString,
          });
          return pkg;
        }
      }
    }

    console.warn(`⚠️ Produto "${productId}" não encontrado em nenhuma oferta`);
    return null;
  } catch (error: any) {
    console.error(`❌ Erro ao buscar produto "${productId}":`, error);
    return null;
  }
};

/**
 * Compra uma assinatura
 */
export const purchaseSubscription = async (
  packageToPurchase: PurchasesPackage
): Promise<{ success: boolean; error?: string; customerInfo?: CustomerInfo }> => {
  try {
    const configured = await ensureConfigured();
    if (!configured) {
      return {
        success: false,
        error: 'Não foi possível conectar ao sistema de pagamentos. Por favor, faça login novamente.',
      };
    }

    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

    console.log('✅ [purchaseSubscription] Compra realizada com sucesso');
    console.log('📊 [purchaseSubscription] Status da assinatura:', {
      hasPremium: customerInfo.entitlements.active['premium'] !== undefined,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
    });

    // O webhook do RevenueCat atualiza automaticamente o banco de dados
    console.log('📡 [purchaseSubscription] O webhook do RevenueCat atualizará o banco automaticamente');

    return {
      success: true,
      customerInfo,
    };
  } catch (error) {
    const purchasesError = error as PurchasesError;
    
    // Verificar se foi cancelamento
    if (purchasesError.userCancelled || purchasesError.code === 'PURCHASES_ERROR_CODE_PURCHASE_CANCELLED') {
      return {
        success: false,
        error: 'cancelado', // Usado para identificar cancelamento
      };
    }

    console.error('❌ Erro ao comprar assinatura:', error);
    
    // Traduzir erros comuns do RevenueCat para português
    let errorMessage = 'Não foi possível processar sua compra. Tente novamente.';
    
    if (purchasesError.message) {
      const msg = purchasesError.message.toLowerCase();
      
      // Traduzir mensagens específicas
      if (msg.includes('network') || msg.includes('internet') || msg.includes('connection') || msg.includes('timeout')) {
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (msg.includes('payment') || msg.includes('purchase') || msg.includes('transaction')) {
        errorMessage = 'Erro no pagamento. Verifique seus dados e tente novamente.';
      } else if (msg.includes('product') || msg.includes('unavailable') || msg.includes('not found')) {
        errorMessage = 'Produto não disponível no momento. Tente novamente mais tarde.';
      } else if (msg.includes('store') || msg.includes('app store') || msg.includes('play store')) {
        errorMessage = 'Erro ao conectar com a loja. Tente novamente.';
      } else if (msg.includes('already purchased') || msg.includes('you\'re currently subscribed')) {
        errorMessage = 'Você já possui uma assinatura ativa.';
      } else if (msg.includes('receipt') || msg.includes('invalid')) {
        errorMessage = 'Erro ao validar a compra. Tente novamente.';
      } else if (msg.includes('permission') || msg.includes('unauthorized')) {
        errorMessage = 'Permissão negada. Verifique as configurações do seu dispositivo.';
      }
    }
    
    // Verificar códigos de erro do RevenueCat
    if (purchasesError.code) {
      const errorCode = purchasesError.code.toString();
      if (errorCode.includes('NETWORK') || errorCode.includes('PURCHASES_ERROR_CODE_NETWORK_ERROR')) {
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (errorCode.includes('PRODUCT_NOT_AVAILABLE') || errorCode.includes('PURCHASES_ERROR_CODE_PRODUCT_NOT_AVAILABLE_FOR_PURCHASE')) {
        errorMessage = 'Produto não disponível no momento. Tente novamente mais tarde.';
      } else if (errorCode.includes('PURCHASE_INVALID')) {
        errorMessage = 'Erro ao validar a compra. Tente novamente.';
      } else if (errorCode.includes('PAYMENT_PENDING')) {
        errorMessage = 'Pagamento pendente. Aguarde a confirmação.';
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Restaura compras anteriores
 */
export const restorePurchases = async (): Promise<{
  success: boolean;
  error?: string;
  customerInfo?: CustomerInfo;
}> => {
  try {
    const configured = await ensureConfigured();
    if (!configured) {
      return {
        success: false,
        error: 'Não foi possível conectar ao sistema de pagamentos. Por favor, faça login novamente.',
      };
    }

    const customerInfo = await Purchases.restorePurchases();
    
    // Verificar se encontrou alguma compra para restaurar
    const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
    
    if (!hasPremium) {
      return {
        success: false,
        error: 'Nenhuma compra anterior foi encontrada para restaurar.',
      };
    }

    // O webhook do RevenueCat atualiza automaticamente o banco de dados
    console.log('📡 [restorePurchases] O webhook do RevenueCat atualizará o banco automaticamente');

    return {
      success: true,
      customerInfo,
    };
  } catch (error: any) {
    console.error('❌ Erro ao restaurar compras:', error);
    
    let errorMessage = 'Não foi possível restaurar suas compras. Tente novamente mais tarde.';
    
    if (error?.message) {
      const msg = error.message.toLowerCase();
      if (msg.includes('network') || msg.includes('internet')) {
        errorMessage = 'Verifique sua conexão com a internet e tente novamente.';
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Verifica o status atual da assinatura do usuário
 */
export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    const configured = await ensureConfigured();
    if (!configured) {
      return null;
    }

    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('❌ Erro ao buscar informações do cliente:', error);
    return null;
  }
};

/**
 * Verifica se o usuário tem uma assinatura ativa
 */
export const hasActiveSubscription = async (): Promise<boolean> => {
  try {
    const configured = await ensureConfigured();
    if (!configured) {
      return false;
    }

    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['premium'] !== undefined;
  } catch (error) {
    // Não logar erro se for apenas porque não está configurado
    if (error instanceof Error && error.message.includes('singleton instance')) {
      console.warn('⚠️ RevenueCat não configurado ainda');
      return false;
    }
    console.error('❌ Erro ao verificar assinatura:', error);
    return false;
  }
};

/**
 * DEPRECATED: Esta função não atualiza mais o banco de dados.
 * O webhook do RevenueCat atualiza automaticamente a coluna plan_is_active na tabela users.
 * 
 * Esta função foi mantida apenas para compatibilidade, mas não faz mais nada.
 * Use a coluna plan_is_active da tabela users para verificar o status da assinatura.
 */
export const syncSubscriptionWithSupabase = async (customerInfo?: CustomerInfo): Promise<{
  success: boolean;
  status: 'active' | 'inactive';
  error?: string;
}> => {
  console.log('⚠️ [syncSubscription] DEPRECATED: O webhook do RevenueCat atualiza o banco automaticamente. Use a coluna plan_is_active da tabela users.');
  return {
    success: true,
    status: 'inactive',
  };
};

/**
 * DEPRECATED: Esta função não atualiza mais o banco de dados.
 * O webhook do RevenueCat atualiza automaticamente a coluna plan_is_active na tabela users.
 * 
 * Esta função foi mantida apenas para compatibilidade, mas não faz mais nada.
 * Use a coluna plan_is_active da tabela users para verificar o status da assinatura.
 */
export const checkAndSyncSubscriptionOnAppStart = async (): Promise<void> => {
  console.log('⚠️ [checkAndSyncSubscription] DEPRECATED: O webhook do RevenueCat atualiza o banco automaticamente. Use a coluna plan_is_active da tabela users.');
};

/**
 * Configura listener para mudanças de status da assinatura em tempo real
 * Este listener detecta quando o status muda (renovação, cancelamento, etc)
 * 
 * NOTA: O webhook do RevenueCat atualiza automaticamente o banco de dados.
 * Este listener apenas registra as mudanças para log/debug.
 */
export const setupSubscriptionStatusListener = (): (() => void) => {
  console.log('👂 [setupSubscriptionStatusListener] Configurando listener de mudanças de status...');
  
  const listener = Purchases.addCustomerInfoUpdateListener(async (customerInfo) => {
    console.log('📢 [SubscriptionListener] Status da assinatura mudou!');
    console.log('📊 [SubscriptionListener] Novo status:', {
      hasPremium: customerInfo.entitlements.active['premium'] !== undefined,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
    });
    
    // O webhook do RevenueCat atualiza automaticamente o banco de dados
    console.log('📡 [SubscriptionListener] O webhook do RevenueCat atualizará o banco automaticamente');
  });

  console.log('✅ [setupSubscriptionStatusListener] Listener configurado');
  
  // Retornar função para remover o listener quando necessário
  return () => {
    // O RevenueCat não tem método para remover listener, mas podemos deixar assim
    console.log('👂 [setupSubscriptionStatusListener] Listener ativo (não pode ser removido)');
  };
};

/**
 * Obtém informações sobre o entitlement premium
 */
export const getPremiumEntitlement = (customerInfo: CustomerInfo) => {
  return customerInfo.entitlements.active['premium'];
};

/**
 * Obtém informações detalhadas da assinatura atual do usuário
 */
export const getCurrentSubscriptionInfo = async (): Promise<{
  hasSubscription: boolean;
  expirationDate: Date | null;
  willRenew: boolean;
  productIdentifier: string | null;
  isSandbox: boolean;
  status: 'active' | 'cancelled' | 'expired' | 'none';
} | null> => {
  try {
    const configured = await ensureConfigured();
    if (!configured) {
      return null;
    }

    const customerInfo = await Purchases.getCustomerInfo();
    const premiumEntitlement = customerInfo.entitlements.active['premium'];

    if (!premiumEntitlement) {
      return {
        hasSubscription: false,
        expirationDate: null,
        willRenew: false,
        productIdentifier: null,
        isSandbox: false,
        status: 'none',
      };
    }

    const expirationDate = premiumEntitlement.expirationDate
      ? new Date(premiumEntitlement.expirationDate)
      : null;

    const isExpired = expirationDate ? expirationDate < new Date() : false;

    return {
      hasSubscription: true,
      expirationDate,
      willRenew: premiumEntitlement.willRenew || false,
      productIdentifier: premiumEntitlement.productIdentifier || null,
      isSandbox: premiumEntitlement.isSandbox || false,
      status: isExpired
        ? 'expired'
        : premiumEntitlement.willRenew
        ? 'active'
        : 'cancelled',
    };
  } catch (error) {
    console.error('❌ Erro ao obter informações da assinatura:', error);
    return null;
  }
};

/**
 * Verifica se o usuário está em período de teste gratuito
 */
export const isInTrialPeriod = (customerInfo: CustomerInfo): boolean => {
  const premium = getPremiumEntitlement(customerInfo);
  return premium?.isSandbox === false && premium?.willRenew === true && premium?.periodType === 'TRIAL';
};

/**
 * Obtém a data de expiração da assinatura
 */
export const getExpirationDate = (customerInfo: CustomerInfo): Date | null => {
  const premium = getPremiumEntitlement(customerInfo);
  if (premium?.expirationDate) {
    return new Date(premium.expirationDate);
  }
  return null;
};

