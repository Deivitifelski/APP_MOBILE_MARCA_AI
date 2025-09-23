import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      },
    )
  }

  try {
    const { customerId, priceId } = await req.json()

    // Validar parâmetros obrigatórios
    if (!customerId || !priceId) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: customerId, priceId' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Inicializar Stripe com a chave secreta
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY não configurada')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Criar subscription no Stripe
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: 'default_incomplete', // Permite pagamento incompleto inicial
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // Extrair client_secret do PaymentIntent
    const paymentIntent = subscription.latest_invoice?.payment_intent;
    let clientSecret = null;

    if (paymentIntent && typeof paymentIntent === 'object' && 'client_secret' in paymentIntent) {
      clientSecret = paymentIntent.client_secret;
    }

    console.log('✅ Subscription criada no Stripe:', subscription.id)
    console.log('📊 Status:', subscription.status)
    console.log('🔑 Client Secret:', clientSecret ? 'Gerado' : 'Não gerado')

    return new Response(
      JSON.stringify({ 
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        setupIntentClientSecret: clientSecret, // Para compatibilidade com o código existente
        paymentIntentClientSecret: clientSecret, // Nome mais correto
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    console.error('❌ Erro ao criar subscription:', error)
    
    // Tratamento específico para erros do Stripe
    if (error.type === 'StripeError') {
      return new Response(
        JSON.stringify({ 
          error: 'Erro do Stripe: ' + error.message,
          type: error.type,
          code: error.code
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        message: error?.message || 'Erro desconhecido'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
