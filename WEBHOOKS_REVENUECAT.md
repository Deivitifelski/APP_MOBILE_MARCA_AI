# Webhooks do RevenueCat - Guia Completo

## 📋 Visão Geral

O RevenueCat suporta **webhooks** que notificam seu servidor quando eventos de assinatura acontecem. Além disso, o app pode verificar o status da assinatura diretamente da API do RevenueCat sempre que é aberto.

## ✅ Implementação Atual no App

O app já está configurado para:

1. **Verificar status ao abrir o app** - A função `checkAndSyncSubscriptionOnAppStart()` é chamada automaticamente quando o usuário faz login
2. **Sincronizar após compra** - Após uma compra bem-sucedida, o status é sincronizado com o Supabase
3. **Listener em tempo real** - O app escuta mudanças de status automaticamente usando `setupSubscriptionStatusListener()`

### Como Funciona

#### 1. Verificação ao Abrir o App

```typescript
// app/index.tsx
await checkAndSyncSubscriptionOnAppStart();
```

Esta função:
- Busca o status mais recente da API do RevenueCat
- Compara com o status no Supabase
- Atualiza o banco se houver diferenças

#### 2. Listener de Mudanças em Tempo Real

```typescript
// app/_layout.tsx
setupSubscriptionStatusListener();
```

Este listener detecta automaticamente quando:
- A assinatura é renovada
- A assinatura expira
- A assinatura é cancelada
- O usuário faz upgrade/downgrade

#### 3. Sincronização após Compra

```typescript
// services/iapService.ts - purchaseSubscription()
await syncSubscriptionWithSupabase(customerInfo);
```

Após cada compra, o status é sincronizado imediatamente.

## 🔧 Configuração de Webhooks (Backend)

Para receber notificações via webhook no seu servidor, você precisa:

### 1. Criar Endpoint no Backend

O webhook precisa ser configurado no seu servidor backend (não no app mobile). Exemplo:

```javascript
// Exemplo usando Express.js
app.post('/api/revenuecat-webhook', async (req, res) => {
  const event = req.body;
  
  // Verificar autenticidade do webhook (opcional mas recomendado)
  // RevenueCat pode enviar um header de autenticação
  
  switch (event.type) {
    case 'INITIAL_PURCHASE':
      // Assinatura foi comprada pela primeira vez
      await updateUserSubscription(event.app_user_id, 'active', 'premium');
      break;
      
    case 'RENEWAL':
      // Assinatura foi renovada
      await updateUserSubscription(event.app_user_id, 'active', 'premium');
      break;
      
    case 'CANCELLATION':
      // Assinatura foi cancelada (ainda ativa até expirar)
      await updateUserSubscription(event.app_user_id, 'cancelled', 'premium');
      break;
      
    case 'EXPIRATION':
      // Assinatura expirou
      await updateUserSubscription(event.app_user_id, 'inactive', 'free');
      break;
      
    case 'BILLING_ISSUE':
      // Problema com pagamento
      await updateUserSubscription(event.app_user_id, 'past_due', 'premium');
      break;
      
    case 'PRODUCT_CHANGE':
      // Usuário mudou de plano
      await updateUserSubscription(event.app_user_id, 'active', event.product_id);
      break;
  }
  
  res.status(200).send('OK');
});
```

### 2. Configurar no Dashboard do RevenueCat

1. Acesse o [Dashboard do RevenueCat](https://app.revenuecat.com)
2. Vá em **Project Settings** > **Webhooks**
3. Adicione a URL do seu endpoint: `https://seu-dominio.com/api/revenuecat-webhook`
4. Selecione os eventos que deseja receber:
   - `INITIAL_PURCHASE` - Primeira compra
   - `RENEWAL` - Renovação
   - `CANCELLATION` - Cancelamento
   - `EXPIRATION` - Expiração
   - `BILLING_ISSUE` - Problema com pagamento
   - `PRODUCT_CHANGE` - Mudança de produto

### 3. Verificar Autenticidade (Recomendado)

Para garantir que o webhook vem do RevenueCat, você pode verificar o header:

```javascript
const revenueCatSignature = req.headers['authorization'];
// Verificar com a chave secreta do RevenueCat
```

## 📊 Eventos de Webhook do RevenueCat

### Tipos de Eventos Disponíveis

| Evento | Descrição | Quando Acontece |
|--------|-----------|-----------------|
| `INITIAL_PURCHASE` | Primeira compra | Usuário compra assinatura pela primeira vez |
| `RENEWAL` | Renovação | Assinatura é renovada automaticamente |
| `CANCELLATION` | Cancelamento | Usuário cancela a assinatura |
| `EXPIRATION` | Expiração | Assinatura expira (após cancelamento ou falha no pagamento) |
| `BILLING_ISSUE` | Problema de pagamento | Falha na cobrança (cartão expirado, etc) |
| `PRODUCT_CHANGE` | Mudança de produto | Usuário faz upgrade ou downgrade |
| `UNCANCELLATION` | Reativação | Usuário reativa assinatura cancelada |
| `NON_RENEWING_PURCHASE` | Compra não recorrente | Compra única (não assinatura) |

### Estrutura do Payload do Webhook

```json
{
  "event": {
    "id": "event_id_123",
    "app_id": "app_123",
    "product_id": "premium_monthly",
    "period_type": "NORMAL",
    "type": "RENEWAL",
    "app_user_id": "user_id_supabase",
    "original_app_user_id": "user_id_supabase",
    "aliases": [],
    "event_timestamp_ms": 1234567890,
    "entitlement_ids": ["premium"],
    "entitlement_id": "premium",
    "environment": "PRODUCTION",
    "price": "9.99",
    "currency": "USD",
    "subscriber_attributes": {},
    "store": "APP_STORE",
    "transaction_id": "transaction_123",
    "original_transaction_id": "original_transaction_123",
    "is_family_share": false,
    "country_code": "BR",
    "currency_code": "BRL",
    "presented_offering_id": "default"
  }
}
```

## 🔄 Fluxo Completo de Sincronização

### Cenário 1: Usuário Abre o App

```
1. App abre → app/index.tsx
2. Verifica autenticação → checkAuthStatus()
3. Se logado → initializeIAP(userId)
4. checkAndSyncSubscriptionOnAppStart()
   ├─ Busca status da API do RevenueCat
   ├─ Compara com Supabase
   └─ Atualiza banco se necessário
```

### Cenário 2: Usuário Compra Assinatura

```
1. Usuário compra → purchaseSubscription()
2. RevenueCat processa pagamento
3. purchaseSubscription() retorna customerInfo
4. syncSubscriptionWithSupabase(customerInfo)
   └─ Atualiza Supabase imediatamente
5. Listener detecta mudança automaticamente
6. Webhook também é enviado ao servidor (se configurado)
```

### Cenário 3: Assinatura Expira/Renova

```
1. RevenueCat detecta expiração/renovação
2. Listener no app detecta automaticamente
   └─ setupSubscriptionStatusListener() chama syncSubscriptionWithSupabase()
3. Webhook também é enviado ao servidor (se configurado)
4. Próxima vez que usuário abrir app → verificação dupla
```

## 🎯 Vantagens da Abordagem Atual

### ✅ Verificação no App (Implementado)
- **Instantâneo** - Status é verificado logo ao abrir o app
- **Sem servidor necessário** - Funciona diretamente do app
- **Atualizado** - Busca sempre da API do RevenueCat
- **Listener em tempo real** - Detecta mudanças automaticamente

### ✅ Webhooks (Opcional - Requer Backend)
- **Notificações imediatas** - Recebe eventos em tempo real
- **Backup** - Garante que o servidor sempre saiba o status
- **Auditoria** - Histórico completo de eventos
- **Automações** - Pode acionar outras ações no servidor

## 📝 Campos Atualizados no Supabase

Quando a sincronização acontece, os seguintes campos são atualizados na tabela `users`:

```sql
plan                        -- 'premium' ou 'free'
subscription_status         -- 'active', 'inactive', 'cancelled', 'past_due'
subscription_updated_at     -- Timestamp da última atualização
subscription_expires_at     -- Data de expiração (se aplicável)
subscription_will_renew     -- true/false se vai renovar
subscription_product_identifier -- ID do produto (ex: 'premium_monthly')
subscription_is_sandbox     -- true se for ambiente de teste
```

## 🔍 Como Verificar se Está Funcionando

### 1. Verificar Logs do App

Procure por estas mensagens no console:

```
🔄 [checkAndSyncSubscription] Verificando status da assinatura ao abrir o app...
📡 [checkAndSyncSubscription] Buscando status da API do RevenueCat...
📊 [checkAndSyncSubscription] Status recebido: { hasPremium: true, ... }
✅ [syncSubscription] Assinatura sincronizada com Supabase com sucesso
```

### 2. Verificar no Supabase

```sql
-- Ver status atual dos usuários
SELECT 
  id,
  email,
  plan,
  subscription_status,
  subscription_updated_at,
  subscription_expires_at
FROM users
WHERE subscription_status IS NOT NULL;
```

### 3. Testar Manualmente

1. Abra o app e faça login
2. Verifique os logs no console
3. Verifique a tabela `users` no Supabase
4. Faça uma compra de teste
5. Verifique se o status foi atualizado

## 🚀 Próximos Passos

1. **Implementar Webhook (Opcional)** - Se precisar de notificações no servidor
2. **Configurar Alertas** - Avisar quando assinatura expira
3. **Histórico de Assinaturas** - Criar tabela para histórico completo
4. **Testes Automatizados** - Testar todos os cenários

## 📚 Referências

- [Documentação de Webhooks do RevenueCat](https://docs.revenuecat.com/docs/webhooks)
- [Eventos de Webhook](https://docs.revenuecat.com/docs/webhooks#event-types)
- [API do RevenueCat](https://docs.revenuecat.com/reference#overview)

