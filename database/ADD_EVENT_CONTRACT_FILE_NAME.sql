-- Salvar nome original do arquivo de contrato no evento
-- (para exibir sempre o nome real para o usuário)

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS contract_file_name text NULL;

