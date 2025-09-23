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
    const { productId, productName, amount, currency } = await req.json()

    if (!productId || !productName || !amount || !currency) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios não fornecidos' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Aqui você integraria com o Stripe real
    // Por enquanto, vamos simular uma URL de checkout
    const checkoutUrl = `https://checkout.stripe.com/pay/cs_test_${productId}_${Date.now()}`

    return new Response(
      JSON.stringify({ 
        url: checkoutUrl,
        sessionId: `cs_test_${productId}_${Date.now()}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error)
    
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
