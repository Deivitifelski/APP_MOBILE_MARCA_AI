# 🔍 Verificar se a Imagem Existe no Bucket

## ❌ **Erro Atual:**
```
❌ Erro ao carregar imagem do usuário na edição: https://ctulmpyaikxsnjqmrzxf.supabase.co/storage/v1/object/public/image_users/user_1758075408649_zsf56en58ki.jpg
❌ Detalhes: Failed to load https://ctulmpyaikxsnjqmrzxf.supabase.co/storage/v1/object/public/image_users/user_1758075408649_zsf56en58ki.jpg
```

## ✅ **Solução:**

### **1. Verificar se a imagem existe no bucket:**

Execute este comando SQL no Supabase Dashboard:

```sql
-- Verificar se a imagem existe no bucket
SELECT * FROM storage.objects 
WHERE bucket_id = 'image_users' 
AND name = 'user_1758075408649_zsf56en58ki.jpg';
```

### **2. Se a imagem NÃO existir, execute:**

```sql
-- Verificar todas as imagens no bucket image_users
SELECT * FROM storage.objects WHERE bucket_id = 'image_users';
```

### **3. Se o bucket estiver vazio, execute:**

```sql
-- Verificar se o bucket existe
SELECT * FROM storage.buckets WHERE id = 'image_users';
```

### **4. Corrigir permissões de leitura:**

```sql
-- Política mais permissiva para leitura
DROP POLICY IF EXISTS "Permitir visualização de imagens públicas" ON storage.objects;

CREATE POLICY "Permitir visualização de imagens públicas" 
ON storage.objects
FOR SELECT 
USING (true);
```

### **5. Verificar via Storage Dashboard:**

1. **Vá em**: Storage no Supabase Dashboard
2. **Clique** no bucket `image_users`
3. **Verifique** se a imagem `user_1758075408649_zsf56en58ki.jpg` existe
4. **Se não existir**, o upload falhou
5. **Se existir**, é problema de permissão

## 🎯 **Resultado Esperado:**
- Imagem deve existir no bucket
- URL deve carregar corretamente
- Imagem deve aparecer na tela

## 📋 **Como Executar:**

1. **Acesse**: https://supabase.com/dashboard
2. **Selecione** seu projeto
3. **Vá em**: SQL Editor
4. **Execute** os comandos acima
5. **Verifique** se a imagem existe
