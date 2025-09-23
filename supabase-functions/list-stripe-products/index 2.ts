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
    // Lista de planos mockados (você pode substituir por uma chamada real ao Stripe)
    const plans = [
      {
        id: "prod_T5EeVi7oUpo3dD",
        name: "Plano Premium",
        description: "O Plano Pro é ideal para quem precisa de mais recursos e flexibilidade.",
        value: 999,
        currency: "brl"
      },
      {
        id: "prod_basico123",
        name: "Plano Básico",
        description: "Perfeito para bandas em crescimento com funcionalidades essenciais.",
        value: 490,
        currency: "brl"
      },
      {
        id: "prod_pro456",
        name: "Plano Pro",
        description: "Para bandas profissionais que precisam de recursos avançados.",
        value: 990,
        currency: "brl"
      }
    ]

    return new Response(
      JSON.stringify(plans),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Erro ao listar produtos:', error)
    
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
