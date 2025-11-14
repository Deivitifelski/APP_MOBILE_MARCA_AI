# Solução para Crash RCTFormatError no TestFlight

## Problema
O app está crashando com `RCTFormatError` no TestFlight, mas funciona no dispositivo do desenvolvedor.

## Causa
O erro `RCTFormatError` geralmente ocorre quando:
1. Erros JavaScript não tratados causam crashes
2. O bundle de produção tem problemas que não aparecem em desenvolvimento
3. Erros de inicialização do app não são capturados

## Soluções Implementadas

### 1. Error Boundary React
Criado `components/ErrorBoundary.tsx` que:
- Captura erros de renderização React
- Mostra uma tela amigável ao usuário
- Permite tentar novamente
- Em desenvolvimento, mostra detalhes do erro

### 2. Handler Global de Erros JavaScript
Criado `app/error-handler.ts` que:
- Captura erros JavaScript não tratados
- Captura promessas rejeitadas não tratadas
- Loga erros de forma segura

### 3. Handler de Exceções no AppDelegate
Atualizado `ios/MarcaAI/AppDelegate.swift` para:
- Capturar exceções não tratadas em produção
- Logar informações de crash

## Como Testar

### 1. Teste Local
```bash
# Build de produção local
npx expo run:ios --configuration Release
```

### 2. Teste no TestFlight
1. Faça o Archive
2. Faça upload para App Store Connect
3. Distribua para TestFlight
4. Teste em dispositivos reais

## Próximos Passos (Opcional)

### Integrar Serviço de Crash Reporting
Para melhor rastreamento de erros, considere integrar:

1. **Sentry** (Recomendado):
```bash
npm install @sentry/react-native
```

2. **Firebase Crashlytics**:
```bash
npm install @react-native-firebase/crashlytics
```

### Monitoramento
- Configure alertas para crashes
- Analise logs de crash no App Store Connect
- Use ferramentas de crash reporting para mais detalhes

## Verificação

Após implementar:
1. ✅ Error Boundary está envolvendo o app
2. ✅ Handler global de erros está importado
3. ✅ AppDelegate captura exceções em produção
4. ✅ Teste em TestFlight para verificar se crashes diminuíram

## Notas

- O Error Boundary só captura erros de renderização React
- Erros assíncronos precisam ser tratados manualmente
- Use try/catch em operações críticas
- Valide dados antes de usar
- Trate erros de rede adequadamente

