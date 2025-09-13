-- Tabela de eventos
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  value NUMERIC(12,2), -- cachê do evento
  city TEXT,
  contractor_phone TEXT,
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de despesas do evento
CREATE TABLE IF NOT EXISTS event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- nome da despesa (ex: Transporte, Alimentação)
  value NUMERIC(12,2) NOT NULL, -- valor da despesa
  receipt_url TEXT, -- link para comprovante (imagem/PDF no Supabase Storage)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_events_artist_id ON events(artist_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_event_expenses_event_id ON event_expenses(event_id);
CREATE INDEX IF NOT EXISTS idx_event_expenses_created_at ON event_expenses(created_at);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_expenses_updated_at BEFORE UPDATE ON event_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas de RLS (Row Level Security)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_expenses ENABLE ROW LEVEL SECURITY;

-- Política para eventos (usuários só podem ver eventos que criaram)
CREATE POLICY "Users can view their own events" ON events
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own events" ON events
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own events" ON events
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own events" ON events
    FOR DELETE USING (user_id = auth.uid());

-- Política para despesas (usuários só podem ver despesas de seus eventos)
CREATE POLICY "Users can view event_expenses of their events" ON event_expenses
    FOR SELECT USING (
        event_id IN (
            SELECT id FROM events 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert event_expenses for their events" ON event_expenses
    FOR INSERT WITH CHECK (
        event_id IN (
            SELECT id FROM events 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update event_expenses of their events" ON event_expenses
    FOR UPDATE USING (
        event_id IN (
            SELECT id FROM events 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete event_expenses of their events" ON event_expenses
    FOR DELETE USING (
        event_id IN (
            SELECT id FROM events 
            WHERE user_id = auth.uid()
        )
    );
