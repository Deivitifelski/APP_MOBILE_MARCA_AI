-- Controle de privacidade: WhatsApp só aparece na busca de convite a evento se show_whatsapp = true.
-- Execute no SQL Editor do Supabase.

ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS show_whatsapp boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.artists.show_whatsapp IS 'Se true, o número de WhatsApp pode ser exibido na busca de convites de participação em eventos.';

-- Após criar a coluna, atualize a função buscar_artistas_para_convite (retorno com show_whatsapp boolean)
-- usando database/BUSCAR_ARTISTAS_CONVITE_FILTROS_WHATSAPP.sql ou CONVITE_PARTICIPACAO_EVENTO.sql seção 4.
