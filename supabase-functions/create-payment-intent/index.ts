import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Chave secreta do Stripe para PRODUÇÃO (usar variável de ambiente)
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, name, userId, priceId, forceProduction } = await req.json()

    if (!email || !name || !userId || !priceId) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios não fornecidos' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    console.log('📝 Criando Setup Intent para:', { email, name, userId, priceId, forceProduction });

    // Criar Customer no Stripe
    const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: email,
        name: name,
        metadata: JSON.stringify({ userId: userId })
      })
    });

    if (!customerResponse.ok) {
      const error = await customerResponse.text();
      console.error('❌ Erro ao criar customer:', error);
      throw new Error('Erro ao criar customer no Stripe');
    }

    const customer = await customerResponse.json();
    console.log('✅ Customer criado:', customer.id);

    // Criar Ephemeral Key
    const ephemeralKeyResponse = await fetch('https://api.stripe.com/v1/ephemeral_keys', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2023-10-16'
      },
      body: new URLSearchParams({
        customer: customer.id
      })
    });

    if (!ephemeralKeyResponse.ok) {
      const error = await ephemeralKeyResponse.text();
      console.error('❌ Erro ao criar ephemeral key:', error);
      throw new Error('Erro ao criar ephemeral key no Stripe');
    }

    const ephemeralKey = await ephemeralKeyResponse.json();
    console.log('✅ Ephemeral Key criado:', ephemeralKey.id);

    // Criar Setup Intent
    const setupIntentResponse = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customer.id,
        payment_method_types: 'card',
        usage: 'off_session'
      })
    });

    if (!setupIntentResponse.ok) {
      const error = await setupIntentResponse.text();
      console.error('❌ Erro ao criar setup intent:', error);
      throw new Error('Erro ao criar setup intent no Stripe');
    }

    const setupIntent = await setupIntentResponse.json();
    console.log('✅ Setup Intent criado:', setupIntent.id);

    return new Response(
      JSON.stringify({ 
        setupIntent: setupIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id,
        publishableKey: 'pk_live_51SC1KOCeuRyMxVXe7MIvQqIYKurtgxle8hQF7pwYlPbw01lcApUU3LWD9bt9XIpBDiFjjRtuoUllXWQ64ZCvv5q50031w6hLqm',
        chaveStripe: STRIPE_SECRET_KEY
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('❌ Erro ao criar payment intent:', error)
    
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})