# Configuração do Supabase Storage

## Buckets Necessários

Para o funcionamento completo da aplicação, você precisa criar os seguintes buckets no Supabase Storage:

### 1. Bucket `image_users`
- **Propósito**: Armazenar fotos de perfil dos usuários
- **Configurações**:
  - Public: `true` (para permitir acesso público às imagens)
  - File size limit: `5MB`
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

### 2. Bucket `image_artists`
- **Propósito**: Armazenar fotos de perfil dos artistas
- **Configurações**:
  - Public: `true` (para permitir acesso público às imagens)
  - File size limit: `5MB`
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

## Como Configurar no Supabase Dashboard

1. **Acesse o Supabase Dashboard**
   - Vá para https://supabase.com/dashboard
   - Selecione seu projeto

2. **Navegue para Storage**
   - No menu lateral, clique em "Storage"

3. **Criar Bucket `image_users`**
   - Clique em "New bucket"
   - Nome: `image_users`
   - Marque "Public bucket"
   - Clique em "Create bucket"

4. **Criar Bucket `image_artists`**
   - Clique em "New bucket"
   - Nome: `image_artists`
   - Marque "Public bucket"
   - Clique em "Create bucket"

5. **Configurar Políticas RLS (Row Level Security)**

   Para o bucket `image_users`:
   ```sql
   -- Permitir upload para usuários autenticados
   CREATE POLICY "Users can upload their own images" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'image_users' AND 
     auth.uid()::text = (storage.foldername(name))[1]
   );

   -- Permitir leitura pública
   CREATE POLICY "Public can view user images" ON storage.objects
   FOR SELECT USING (bucket_id = 'image_users');
   ```

   Para o bucket `image_artists`:
   ```sql
   -- Permitir upload para usuários autenticados
   CREATE POLICY "Users can upload artist images" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'image_artists' AND 
     auth.uid()::text = (storage.foldername(name))[1]
   );

   -- Permitir leitura pública
   CREATE POLICY "Public can view artist images" ON storage.objects
   FOR SELECT USING (bucket_id = 'image_artists');
   ```

## Estrutura de Arquivos

Os arquivos serão salvos com a seguinte estrutura:

### Bucket `image_users`
```
image_users/
├── {user_id}_1234567890.jpg
├── {user_id}_1234567891.png
└── ...
```

### Bucket `image_artists`
```
image_artists/
├── {user_id}_1234567890.jpg
├── {user_id}_1234567891.png
└── ...
```

## Funcionalidades Implementadas

✅ **Seleção de imagem da galeria**
✅ **Upload automático para o Supabase Storage**
✅ **Salvamento da URL no banco de dados**
✅ **Exibição da imagem nas telas**
✅ **Tratamento de erros**
✅ **Permissões de galeria**

## Como Usar

1. **Na tela de cadastro de usuário**: Toque na área da foto para selecionar uma imagem
2. **Na tela de cadastro de artista**: Toque na área da foto para selecionar uma imagem
3. A imagem será automaticamente:
   - Selecionada da galeria
   - Redimensionada para 1:1
   - Comprimida para 80% de qualidade
   - Enviada para o Supabase Storage
   - URL salva no banco de dados

## Dependências

- `expo-image-picker`: Para seleção de imagens da galeria
- `@supabase/supabase-js`: Para upload e gerenciamento de arquivos

## Notas Importantes

- As imagens são redimensionadas para formato quadrado (1:1)
- Qualidade reduzida para 80% para otimizar o tamanho
- Nomes únicos gerados com timestamp para evitar conflitos
- Suporte a JPEG, PNG e WebP
- Limite de 5MB por arquivo
