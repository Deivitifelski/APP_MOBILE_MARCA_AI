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
      await Purchases.configure({ apiKey });
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
    }

    console.warn('⚠️ Nenhum produto disponível no RevenueCat');
    return [];
  } catch (error: any) {
    // Tratar erros específicos do RevenueCat
    if (error?.code === 23 || error?.readableErrorCode === 'CONFIGURATION_ERROR') {
      console.warn('⚠️ Erro de configuração do RevenueCat:', error.message);
      console.warn('💡 Dica: Verifique se os produtos estão configurados no dashboard do RevenueCat.');
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

    // Sincronizar com Supabase
    await syncSubscriptionWithSupabase(customerInfo);

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
 */
const syncSubscriptionWithSupabase = async (customerInfo: CustomerInfo): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('⚠️ Usuário não autenticado, não é possível sincronizar assinatura');
      return;
    }

    // Verificar se tem assinatura premium ativa
    const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
    const plan = hasPremium ? 'premium' : 'free';
    const status = hasPremium ? 'active' : 'inactive';

    // Atualizar no Supabase
    const { error } = await supabase
      .from('users')
      .update({
        plan,
        subscription_status: status,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('❌ Erro ao atualizar assinatura no Supabase:', error);
    } else {
      console.log('✅ Assinatura sincronizada com Supabase');
    }
  } catch (error) {
    console.error('❌ Erro ao sincronizar assinatura:', error);
  }
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

