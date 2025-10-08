# 📱 Guia Completo: Implementar Assinaturas (In-App Purchases)

## 🎯 Objetivo
Implementar sistema de assinaturas compatível com App Store (iOS) e Google Play (Android).

---

## 📋 **OPÇÃO 1: Revenue Cat (Recomendado)**

### **Vantagens:**
- ✅ Uma API para iOS e Android
- ✅ Dashboard com analytics
- ✅ Webhooks para sincronizar com Supabase
- ✅ Gratuito até $10k/mês
- ✅ Suporte a testes gratuitos, ofertas, etc.

---

## **1. Configurar Revenue Cat**

### **A. Criar Conta:**
1. Acesse: https://app.revenuecat.com/signup
2. Crie uma conta gratuita
3. Crie um novo projeto: "MarcaAi"

### **B. Configurar Plataformas:**

#### **Google Play (Android):**
1. No Revenue Cat: **Project Settings** → **Google Play**
2. Upload do **Service Account JSON**:
   - No Google Cloud Console, crie Service Account
   - Dê permissão de "Google Play Android Developer"
   - Baixe o JSON
   - Faça upload no Revenue Cat

#### **App Store (iOS):**
1. No Revenue Cat: **Project Settings** → **App Store**
2. Configure **App Store Connect API Key**
3. Upload do **.p8 file**

### **C. Criar Produtos:**
1. No Revenue Cat: **Products** → **+ New**
2. Criar produto:
   ```
   Identifier: premium_monthly
   Type: Subscription
   ```
3. Associar com IDs das lojas:
   - Google Play: `premium_monthly`
   - App Store: `premium_monthly`

### **D. Criar Offerings:**
1. **Offerings** → **Create New Offering**
2. Nome: `default`
3. Adicionar Package:
   ```
   Identifier: monthly
   Product: premium_monthly
   ```

---

## **2. Instalar no Projeto**

### **A. Instalar Dependências:**

```bash
# Instalar Revenue Cat
npx expo install react-native-purchases

# Rebuild do projeto (necessário para pacotes nativos)
npx expo prebuild
npx expo run:ios
npx expo run:android
```

### **B. Configurar API Keys:**

Crie arquivo `config/revenuecat-keys.ts`:

```typescript
// config/revenuecat-keys.ts
export const getRevenueCatKey = (): string => {
  const isIOS = Platform.OS === 'ios';
  
  if (isIOS) {
    // Chave pública do Revenue Cat para iOS
    return 'appl_xxxxxxxxxxxxxxxx';
  } else {
    // Chave pública do Revenue Cat para Android
    return 'goog_xxxxxxxxxxxxxxxx';
  }
};
```

---

## **3. Implementar no App**

### **A. Criar serviço de IAP:**

Crie `services/iapService.ts`:

```typescript
import Purchases, { 
  CustomerInfo, 
  PurchasesOfferings,
  PurchasesPackage 
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { getRevenueCatKey } from '../config/revenuecat-keys';
import { supabase } from '../lib/supabase';

// Inicializar Revenue Cat
export const initializeIAP = async (userId: string) => {
  try {
    const apiKey = getRevenueCatKey();
    
    await Purchases.configure({
      apiKey,
      appUserID: userId, // Associar com seu user ID
    });
    
    console.log('✅ Revenue Cat configurado');
  } catch (error) {
    console.error('❌ Erro ao configurar Revenue Cat:', error);
  }
};

// Buscar produtos disponíveis
export const getAvailableProducts = async (): Promise<PurchasesPackage[]> => {
  try {
    const offerings = await Purchases.getOfferings();
    
    if (offerings.current && offerings.current.availablePackages.length > 0) {
      return offerings.current.availablePackages;
    }
    
    return [];
  } catch (error) {
    console.error('❌ Erro ao buscar produtos:', error);
    return [];
  }
};

// Comprar assinatura
export const purchaseSubscription = async (
  packageToPurchase: PurchasesPackage
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    
    // Verificar se a compra foi bem-sucedida
    if (customerInfo.entitlements.active['premium']) {
      console.log('✅ Assinatura ativada!');
      
      // Atualizar no Supabase
      await updateUserPlanInSupabase('premium', 'active');
      
      return { success: true };
    }
    
    return { success: false, error: 'Assinatura não ativada' };
  } catch (error: any) {
    console.error('❌ Erro na compra:', error);
    
    if (error.userCancelled) {
      return { success: false, error: 'Cancelado pelo usuário' };
    }
    
    return { success: false, error: error.message };
  }
};

// Verificar status da assinatura
export const checkSubscriptionStatus = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    
    // Verificar se tem assinatura ativa
    const isSubscribed = customerInfo.entitlements.active['premium'] !== undefined;
    
    console.log('📊 Status da assinatura:', isSubscribed);
    
    return isSubscribed;
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    return false;
  }
};

// Restaurar compras (usuário já pagou em outro dispositivo)
export const restorePurchases = async (): Promise<{ success: boolean }> => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    
    const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
    
    if (isPremium) {
      await updateUserPlanInSupabase('premium', 'active');
      return { success: true };
    }
    
    return { success: false };
  } catch (error) {
    console.error('❌ Erro ao restaurar compras:', error);
    return { success: false };
  }
};

// Atualizar plano no Supabase
const updateUserPlanInSupabase = async (
  plan: string, 
  status: string
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await supabase
      .from('users')
      .update({ 
        plan: plan,
        subscription_status: status,
        subscription_updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    
    if (error) {
      console.error('❌ Erro ao atualizar plano no Supabase:', error);
    } else {
      console.log('✅ Plano atualizado no Supabase');
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar Supabase:', error);
  }
};

// Cancelar assinatura (redireciona para configurações da loja)
export const cancelSubscription = () => {
  if (Platform.OS === 'ios') {
    Alert.alert(
      'Cancelar Assinatura',
      'Para cancelar, vá em:\n\nAjustes → [seu nome] → Assinaturas → MarcaAi → Cancelar Assinatura',
      [{ text: 'Entendi' }]
    );
  } else {
    Alert.alert(
      'Cancelar Assinatura',
      'Para cancelar, vá em:\n\nPlay Store → Menu → Assinaturas → MarcaAi → Cancelar assinatura',
      [{ text: 'Entendi' }]
    );
  }
};
```

---

### **B. Atualizar App Layout:**

Edite `app/_layout.tsx`:

```typescript
import { useEffect } from 'react';
import { initializeIAP } from '../services/iapService';

export default function RootLayout() {
  useEffect(() => {
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await initializeIAP(user.id);
      }
    };
    setup();
  }, []);
  
  // ... resto do código
}
```

---

### **C. Atualizar Tela de Planos:**

Substitua `app/planos-pagamentos.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { PurchasesPackage } from 'react-native-purchases';
import { 
  getAvailableProducts, 
  purchaseSubscription,
  checkSubscriptionStatus,
  restorePurchases 
} from '../services/iapService';

export default function PlanosPagamentosScreen() {
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadProducts();
    checkStatus();
  }, []);
  
  const loadProducts = async () => {
    const products = await getAvailableProducts();
    setPackages(products);
    setIsLoading(false);
  };
  
  const checkStatus = async () => {
    const status = await checkSubscriptionStatus();
    setIsPremium(status);
  };
  
  const handlePurchase = async (pkg: PurchasesPackage) => {
    const result = await purchaseSubscription(pkg);
    
    if (result.success) {
      Alert.alert('Sucesso!', 'Assinatura ativada com sucesso!');
      setIsPremium(true);
    } else {
      if (result.error !== 'Cancelado pelo usuário') {
        Alert.alert('Erro', result.error);
      }
    }
  };
  
  const handleRestore = async () => {
    const result = await restorePurchases();
    
    if (result.success) {
      Alert.alert('Sucesso', 'Compras restauradas!');
      setIsPremium(true);
    } else {
      Alert.alert('Aviso', 'Nenhuma compra encontrada');
    }
  };
  
  return (
    <View>
      {packages.map(pkg => (
        <TouchableOpacity 
          key={pkg.identifier}
          onPress={() => handlePurchase(pkg)}
        >
          <Text>{pkg.product.title}</Text>
          <Text>{pkg.product.priceString}/mês</Text>
        </TouchableOpacity>
      ))}
      
      <TouchableOpacity onPress={handleRestore}>
        <Text>Restaurar Compras</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## **4. Configurar Webhooks (Sincronização com Supabase)**

### **A. Criar Edge Function no Supabase:**

Crie `supabase-functions/revenuecat-webhook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    
    // Webhook do Revenue Cat
    const event = payload.event
    const userId = event.app_user_id
    
    // Atualizar status no Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    let plan = 'free'
    let status = 'inactive'
    
    if (event.type === 'INITIAL_PURCHASE' || event.type === 'RENEWAL') {
      plan = 'premium'
      status = 'active'
    } else if (event.type === 'CANCELLATION' || event.type === 'EXPIRATION') {
      plan = 'free'
      status = 'cancelled'
    }
    
    await supabase
      .from('users')
      .update({
        plan,
        subscription_status: status,
        subscription_updated_at: new Date().toISOString()
      })
      .eq('id', userId)
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
```

### **B. Configurar Webhook no Revenue Cat:**
1. Revenue Cat → **Project Settings** → **Webhooks**
2. URL: `https://seu-projeto.supabase.co/functions/v1/revenuecat-webhook`
3. Authorization: Sua `anon key` do Supabase

---

## **5. Adicionar Campos no Supabase**

Execute este SQL:

```sql
-- Adicionar campos de assinatura na tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMP;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
```

---

## **6. Verificar Plano no App**

Crie `services/subscriptionService.ts`:

```typescript
import { supabase } from '../lib/supabase';

export const getUserPlan = async (): Promise<{
  plan: string;
  isPremium: boolean;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { plan: 'free', isPremium: false };
    
    const { data, error } = await supabase
      .from('users')
      .select('plan, subscription_status')
      .eq('id', user.id)
      .single();
    
    if (error || !data) {
      return { plan: 'free', isPremium: false };
    }
    
    const isPremium = data.plan === 'premium' && data.subscription_status === 'active';
    
    return { plan: data.plan, isPremium };
  } catch (error) {
    return { plan: 'free', isPremium: false };
  }
};

// Usar em qualquer lugar do app
export const checkPremiumAccess = async (): Promise<boolean> => {
  const { isPremium } = await getUserPlan();
  return isPremium;
};
```

---

## **7. Bloquear Recursos Premium**

Use em qualquer tela:

```typescript
import { checkPremiumAccess } from '../services/subscriptionService';

// Exemplo: Bloquear exportação de relatórios
const handleExport = async () => {
  const isPremium = await checkPremiumAccess();
  
  if (!isPremium) {
    Alert.alert(
      'Recurso Premium',
      'Esta funcionalidade está disponível apenas para assinantes premium.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Assinar', onPress: () => router.push('/planos-pagamentos') }
      ]
    );
    return;
  }
  
  // Continuar com exportação
};
```

---

## **8. Testes**

### **Teste no Android:**
1. Crie **tester tracks** no Google Play Console
2. Adicione seu email como testador
3. Upload do APK/AAB
4. Teste assinatura (não será cobrado)

### **Teste no iOS:**
1. Use **Sandbox Testers** no App Store Connect
2. Crie conta de teste
3. Teste assinatura no simulador/device

---

## **9. Checklist de Implementação**

### **Configuração:**
- [ ] Conta no Revenue Cat criada
- [ ] Produtos criados no Google Play Console
- [ ] Produtos criados no App Store Connect
- [ ] Produtos configurados no Revenue Cat
- [ ] Webhooks configurados

### **Código:**
- [ ] `react-native-purchases` instalado
- [ ] `initializeIAP()` no app layout
- [ ] Tela de planos atualizada
- [ ] Serviço de IAP criado
- [ ] Verificação de plano implementada
- [ ] Campos no Supabase adicionados
- [ ] Edge Function de webhook criada

### **Testes:**
- [ ] Testar compra no Android
- [ ] Testar compra no iOS
- [ ] Testar restauração de compras
- [ ] Testar cancelamento
- [ ] Testar sincronização com Supabase

---

## **10. Recursos Premium que Você Pode Bloquear**

No seu app, bloqueie para não-premium:

- ✅ Mais de 3 colaboradores por artista
- ✅ Exportação de relatórios PDF
- ✅ Acesso a finanças completas
- ✅ Recursos avançados de análise

---

## 📚 **Documentação Oficial:**

- Revenue Cat: https://docs.revenuecat.com/docs/getting-started
- Google Play Billing: https://developer.android.com/google/play/billing
- App Store IAP: https://developer.apple.com/in-app-purchase/

---

## 💡 **Quer que eu implemente?**

Posso criar todos os arquivos necessários para você:
1. Serviço de IAP completo
2. Tela de planos atualizada
3. Verificação de premium
4. Edge Function de webhook
5. SQL para atualizar Supabase

**Deseja que eu implemente agora?** 🚀

