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

  try {
    const { productId, productName, amount, currency, customerName } = await req.json()

    if (!productId || !productName || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios não fornecidos' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Inicializar Stripe com a chave secreta
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: productName,
              description: `Assinatura do ${productName}`,
            },
            unit_amount: amount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: 'https://your-app.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://your-app.com/cancel',
      customer_email: '', // Opcional: pode pedir o email do usuário
      metadata: {
        productId: productId,
        customerName: customerName || '',
      },
    });

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Erro ao criar checkout do Stripe:', error)
    
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
