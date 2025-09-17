# Configuração de Políticas RLS para Supabase Storage - Bucket image_users

Este documento contém os comandos SQL necessários para configurar as políticas de Row Level Security (RLS) no bucket `image_users` do Supabase Storage.

## 🔧 Políticas RLS para Supabase Storage

Execute estes comandos SQL no **Supabase SQL Editor**:

### 1. **Criar o bucket (se não existir)**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('image_users', 'image_users', true)
ON CONFLICT (id) DO NOTHING;
```

### 2. **Política para UPLOAD (INSERT)**
```sql
CREATE POLICY "Permitir upload de imagens de usuários para usuários autenticados" 
ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'image_users' 
  AND auth.role() = 'authenticated'
);
```

### 3. **Política para VISUALIZAÇÃO (SELECT)**
```sql
CREATE POLICY "Permitir visualização de imagens de usuários públicas" 
ON storage.objects
FOR SELECT 
USING (bucket_id = 'image_users');
```

### 4. **Política para ATUALIZAÇÃO (UPDATE)**
```sql
CREATE POLICY "Permitir atualização de imagens de usuários para usuários autenticados" 
ON storage.objects
FOR UPDATE 
USING (
  bucket_id = 'image_users' 
  AND auth.role() = 'authenticated'
);
```

### 5. **Política para REMOÇÃO (DELETE)**
```sql
CREATE POLICY "Permitir remoção de imagens de usuários para usuários autenticados" 
ON storage.objects
FOR DELETE 
USING (
  bucket_id = 'image_users' 
  AND auth.role() = 'authenticated'
);
```

## 🚀 Solução Rápida (Temporária)
Se as políticas acima não funcionarem, você pode temporariamente desabilitar RLS para permitir uploads:

```sql
-- Desabilitar RLS temporariamente para permitir uploads
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

**⚠️ ATENÇÃO**: Desabilitar RLS remove todas as proteções de segurança. Use apenas para desenvolvimento/teste.

## Reabilitar RLS (Após Configurar Políticas)
Quando as políticas estiverem funcionando, reabilite o RLS:

```sql
-- Reabilitar RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## Verificação Rápida
Para verificar se RLS está habilitado:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'objects' AND schemaname = 'storage';
```

## 📋 Resumo dos Buckets
- `image_artists`: Para imagens dos artistas
- `image_users`: Para imagens dos usuários
