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
        error: 'RevenueCat não configurado. Faça login novamente.',
      };
    }

    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

    console.log('✅ [purchaseSubscription] Compra realizada com sucesso');
    console.log('📊 [purchaseSubscription] Status da assinatura:', {
      hasPremium: customerInfo.entitlements.active['premium'] !== undefined,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
    });

    // Sincronizar com Supabase - isso atualiza o status no banco de dados
    const syncResult = await syncSubscriptionWithSupabase(customerInfo);
    
    if (syncResult.success) {
      console.log('✅ [purchaseSubscription] Assinatura sincronizada com banco de dados');
    } else {
      console.warn('⚠️ [purchaseSubscription] Erro ao sincronizar:', syncResult.error);
    }

    return {
      success: true,
      customerInfo,
    };
  } catch (error) {
    const purchasesError = error as PurchasesError;
    
    if (purchasesError.userCancelled) {
      return {
        success: false,
        error: 'Compra cancelada pelo usuário',
      };
    }

    console.error('❌ Erro ao comprar assinatura:', error);
    return {
      success: false,
      error: purchasesError.message || 'Erro ao processar compra',
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
        error: 'RevenueCat não configurado. Faça login novamente.',
      };
    }

    const customerInfo = await Purchases.restorePurchases();

    // Sincronizar com Supabase
    await syncSubscriptionWithSupabase(customerInfo);

    return {
      success: true,
      customerInfo,
    };
  } catch (error) {
    console.error('❌ Erro ao restaurar compras:', error);
    return {
      success: false,
      error: 'Erro ao restaurar compras',
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
 * Sincroniza o status da assinatura com o Supabase
 * Esta função busca o status mais recente da API do RevenueCat e atualiza no banco
 */
export const syncSubscriptionWithSupabase = async (customerInfo?: CustomerInfo): Promise<{
  success: boolean;
  plan: 'premium' | 'free';
  status: 'active' | 'inactive';
  error?: string;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('⚠️ Usuário não autenticado, não é possível sincronizar assinatura');
      return {
        success: false,
        plan: 'free',
        status: 'inactive',
        error: 'Usuário não autenticado',
      };
    }

    // Se não foi fornecido customerInfo, buscar da API
    let info = customerInfo;
    if (!info) {
      console.log('🔄 [syncSubscription] Buscando status atualizado da API do RevenueCat...');
      const configured = await ensureConfigured();
      if (!configured) {
        return {
          success: false,
          plan: 'free',
          status: 'inactive',
          error: 'RevenueCat não configurado',
        };
      }
      
      info = await Purchases.getCustomerInfo();
      console.log('📡 [syncSubscription] Status recebido da API do RevenueCat');
    }

    // Verificar se tem assinatura premium ativa
    const premiumEntitlement = info.entitlements.active['premium'];
    const hasPremium = premiumEntitlement !== undefined;
    
    // Determinar o status da assinatura
    let status: 'active' | 'inactive' | 'cancelled' | 'past_due' = 'inactive';
    let plan: 'premium' | 'free' = 'free';
    
    if (hasPremium && premiumEntitlement) {
      plan = 'premium';
      
      // Verificar se vai renovar (se não vai renovar, está cancelada mas ainda ativa)
      if (premiumEntitlement.willRenew) {
        status = 'active';
      } else {
        // Assinatura cancelada mas ainda ativa até expirar
        status = 'cancelled';
      }
      
      // Verificar se há problemas de pagamento (verificar entitlement expirado)
      const expiredEntitlement = info.entitlements.all['premium'];
      if (expiredEntitlement && !premiumEntitlement.willRenew && 
          expiredEntitlement.expirationDate && 
          new Date(expiredEntitlement.expirationDate) < new Date()) {
        // Assinatura expirada devido a problema de pagamento
        status = 'past_due';
        plan = 'free';
      }
    } else {
      // Verificar se tinha assinatura mas expirou
      const expiredEntitlement = info.entitlements.all['premium'];
      if (expiredEntitlement) {
        status = 'inactive';
        plan = 'free';
      }
    }

    // Sempre atualizar subscription_updated_at com a data/hora atual
    const now = new Date().toISOString();

    // Informações da assinatura para atualizar no banco
    const subscriptionInfo: any = {
      plan,
      subscription_status: status,
      subscription_updated_at: now, // Sempre atualizar a data de atualização
    };

    // Se tem assinatura ativa, adicionar informações detalhadas
    if (premiumEntitlement) {
      subscriptionInfo.subscription_expires_at = premiumEntitlement.expirationDate 
        ? new Date(premiumEntitlement.expirationDate).toISOString()
        : null;
      subscriptionInfo.subscription_will_renew = premiumEntitlement.willRenew || false;
      subscriptionInfo.subscription_product_identifier = premiumEntitlement.productIdentifier || null;
      subscriptionInfo.subscription_is_sandbox = premiumEntitlement.isSandbox || false;
    } else {
      // Limpar campos de assinatura se não há mais assinatura ativa
      subscriptionInfo.subscription_expires_at = null;
      subscriptionInfo.subscription_will_renew = false;
      subscriptionInfo.subscription_product_identifier = null;
    }

    console.log('📊 [syncSubscription] Atualizando no Supabase:', {
      userId: user.id,
      plan,
      status,
      expiresAt: subscriptionInfo.subscription_expires_at,
      willRenew: subscriptionInfo.subscription_will_renew,
    });

    // Atualizar no Supabase
    const { error } = await supabase
      .from('users')
      .update(subscriptionInfo)
      .eq('id', user.id);

    if (error) {
      console.error('❌ Erro ao atualizar assinatura no Supabase:', error);
      return {
        success: false,
        plan,
        status,
        error: error.message,
      };
    }

    console.log('✅ [syncSubscription] Assinatura sincronizada com Supabase com sucesso');
    return {
      success: true,
      plan,
      status,
    };
  } catch (error: any) {
    console.error('❌ Erro ao sincronizar assinatura:', error);
    return {
      success: false,
      plan: 'free',
      status: 'inactive',
      error: error.message,
    };
  }
};

/**
 * Verifica e sincroniza o status da assinatura ao abrir o app
 * Esta função deve ser chamada sempre que o app for aberto
 */
export const checkAndSyncSubscriptionOnAppStart = async (): Promise<void> => {
  try {
    console.log('🔄 [checkAndSyncSubscription] Verificando status da assinatura ao abrir o app...');
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('⚠️ [checkAndSyncSubscription] Usuário não autenticado, pulando verificação');
      return;
    }

    // Inicializar RevenueCat se necessário
    const configured = await ensureConfigured();
    if (!configured) {
      console.warn('⚠️ [checkAndSyncSubscription] RevenueCat não configurado');
      return;
    }

    // Buscar status atualizado da API do RevenueCat
    console.log('📡 [checkAndSyncSubscription] Buscando status da API do RevenueCat...');
    const customerInfo = await Purchases.getCustomerInfo();
    
    console.log('📊 [checkAndSyncSubscription] Status recebido:', {
      hasPremium: customerInfo.entitlements.active['premium'] !== undefined,
      allEntitlements: Object.keys(customerInfo.entitlements.active),
      firstSeen: customerInfo.firstSeen,
      requestDate: customerInfo.requestDate,
    });

    // Sincronizar com Supabase
    await syncSubscriptionWithSupabase(customerInfo);
    
    console.log('✅ [checkAndSyncSubscription] Verificação concluída');
  } catch (error: any) {
    console.error('❌ [checkAndSyncSubscription] Erro ao verificar assinatura:', error);
    
    // Não fazer throw para não quebrar o fluxo do app
    // Apenas logar o erro
    if (error?.code !== 23) {
      console.warn('⚠️ [checkAndSyncSubscription] Erro não crítico, continuando...');
    }
  }
};

/**
 * Configura listener para mudanças de status da assinatura em tempo real
 * Este listener detecta quando o status muda (renovação, cancelamento, etc)
 */
export const setupSubscriptionStatusListener = (): (() => void) => {
  console.log('👂 [setupSubscriptionStatusListener] Configurando listener de mudanças de status...');
  
  const listener = Purchases.addCustomerInfoUpdateListener(async (customerInfo) => {
    console.log('📢 [SubscriptionListener] Status da assinatura mudou!');
    console.log('📊 [SubscriptionListener] Novo status:', {
      hasPremium: customerInfo.entitlements.active['premium'] !== undefined,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
    });
    
    // Sincronizar automaticamente quando o status mudar
    await syncSubscriptionWithSupabase(customerInfo);
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

