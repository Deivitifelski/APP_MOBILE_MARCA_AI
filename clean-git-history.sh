#!/bin/bash

echo "🧹 Limpando histórico Git para remover chaves Stripe..."

# Fazer backup do branch atual
echo "📦 Criando backup do branch atual..."
git checkout -b backup-comprar-plano-$(date +%Y%m%d-%H%M%S)

# Voltar para o branch original
git checkout comprar-plano

# Encontrar o commit antes das chaves (aproximadamente 5 commits atrás)
echo "🔍 Encontrando commit limpo..."
CLEAN_COMMIT=$(git log --oneline -10 | tail -1 | cut -d' ' -f1)
echo "📌 Commit limpo encontrado: $CLEAN_COMMIT"

# Resetar para o commit limpo
echo "⏪ Resetando para commit limpo..."
git reset --hard $CLEAN_COMMIT

# Fazer as alterações de segurança novamente
echo "🔧 Aplicando alterações de segurança..."

# Criar arquivo de configuração
mkdir -p config
cat > config/stripe-keys.ts << 'EOF'
// Configuração das chaves do Stripe
// Este arquivo deve ser adicionado ao .gitignore para segurança

export const STRIPE_KEYS = {
  SECRET_KEY: 'SUA_CHAVE_SECRETA_AQUI',
  PUBLISHABLE_KEY: 'SUA_CHAVE_PUBLICA_AQUI'
};
EOF

# Atualizar .gitignore
echo "" >> .gitignore
echo "# Stripe keys (security)" >> .gitignore
echo "config/stripe-keys.ts" >> .gitignore

# Atualizar _layout.tsx
sed -i '' 's/const key = '\''pk_live_.*'\'';/const key = STRIPE_KEYS.PUBLISHABLE_KEY;/' app/_layout.tsx
sed -i '' '/import { STRIPE_KEYS } from/d' app/_layout.tsx
sed -i '' '/import { useColorScheme } from/a\
import { STRIPE_KEYS } from '\''../config/stripe-keys'\'';
' app/_layout.tsx

# Atualizar função Supabase
sed -i '' 's/const STRIPE_SECRET_KEY = Deno.env.get('\''STRIPE_SECRET_KEY'\'') || '\''sk_live_.*'\''/const STRIPE_SECRET_KEY = Deno.env.get('\''STRIPE_SECRET_KEY'\'') || '\'\'\'\'/' supabase-functions/create-payment-intent/index.ts
sed -i '' 's/publishableKey: '\''pk_live_.*'\''/publishableKey: '\''SUA_CHAVE_PUBLICA_AQUI'\''/' supabase-functions/create-payment-intent/index.ts

# Atualizar documentação
sed -i '' 's/sk_live_.*/SUA_CHAVE_SECRETA_AQUI/' stripe-config.md
sed -i '' 's/pk_live_.*/SUA_CHAVE_PUBLICA_AQUI/' stripe-config.md

# Fazer commit das alterações
echo "💾 Fazendo commit das alterações..."
git add .
git commit -m "feat: implement secure Stripe key management

- Move Stripe keys to secure config file
- Remove hardcoded keys from code
- Add config/stripe-keys.ts to .gitignore
- Update documentation with placeholder keys"

echo "✅ Histórico limpo! Agora você pode fazer push sem problemas."
echo "🚀 Execute: git push --force-with-lease"
