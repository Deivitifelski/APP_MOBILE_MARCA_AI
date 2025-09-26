import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { email, name, userId, priceId } = await req.json()

    if (!email || !name || !userId || !priceId) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios não fornecidos' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    console.log('📝 Criando Payment Intent para:', { email, name, userId, priceId });

    // Simular criação de Payment Intent com dados reais
    // Em produção, você integraria com o Stripe real aqui
    const paymentIntent = `pi_test_${userId.substring(0, 8)}_${Date.now()}`
    const ephemeralKey = `ek_test_${userId.substring(0, 8)}_${Date.now()}`
    const customer = `cus_${userId.substring(0, 8)}_${Date.now()}`

    console.log('✅ Payment Intent criado:', { paymentIntent, customer });

    return new Response(
      JSON.stringify({ 
        paymentIntent,
        ephemeralKey,
        customer,
        success: true
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
