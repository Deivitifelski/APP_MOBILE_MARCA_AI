# Solução para Erro "Node server is running and available"

## 🔍 Problema

Erro no app iOS:
```
Ensure the following:
- Node server is running and available on the same network - run 'npm start' from react-native root
- Node server URL is correctly set in AppDelegate
- WiFi is enabled and connected to the same network as the Node Server

URL: http://192.168.1.2:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true
```

## 🎯 Causa

O **Metro Bundler** (servidor de desenvolvimento do React Native/Expo) não está rodando na porta 8081.

## ✅ Solução

### 1. Iniciar o Metro Bundler

Execute o script de inicialização:
```bash
./start-metro.sh
```

Ou manualmente:
```bash
# Na raiz do projeto
npm start
# ou
npx expo start --clear --lan --port 8081
```

### 2. Verificar se o Metro está Rodando

```bash
# Verificar se a porta 8081 está em uso
lsof -ti:8081

# Testar se o servidor responde
curl http://localhost:8081/status
```

### 3. Verificar o IP da Máquina

O app precisa se conectar ao IP correto da sua máquina:

```bash
# Verificar IP atual
ifconfig | grep -A 1 "en0\|en1" | grep "inet " | awk '{print $2}'
```

O AppDelegate já está configurado para detectar automaticamente o IP da máquina.

### 4. No Xcode

1. **Certifique-se de que o Metro está rodando** (terminal separado)
2. **Compile o app**: ⌘R
3. O app deve se conectar automaticamente ao Metro

## 🔧 Configuração do AppDelegate

O `AppDelegate.swift` já está configurado para:

1. **Detectar automaticamente o IP da máquina** usando `getLocalIPAddress()`
2. **Substituir localhost pelo IP** quando necessário
3. **Tentar múltiplos caminhos** para encontrar o bundle
4. **Funcionar no simulador** (usa localhost) e **dispositivo físico** (usa IP da máquina)

## 💡 Dicas

### Para Desenvolvimento (Debug)

- **Sempre inicie o Metro antes de compilar**:
  ```bash
  ./start-metro.sh
  ```

- **Mantenha o Metro rodando** em um terminal separado enquanto desenvolve

- **No simulador**: O app pode usar `localhost:8081`
- **No dispositivo físico**: O app precisa do IP da máquina (detectado automaticamente)

### Para Produção (Release)

- **Não precisa do Metro** - o bundle é embutido no app
- O app usa o bundle local (`main.jsbundle`)

## 🔍 Troubleshooting

### Metro não inicia

```bash
# Matar processos na porta 8081
lsof -ti:8081 | xargs kill -9

# Limpar cache
rm -rf /tmp/metro-*
rm -rf /tmp/haste-map-*

# Tentar novamente
npm start
```

### App não conecta ao Metro

1. **Verificar se estão na mesma rede WiFi**
   - Mac e iPhone precisam estar na mesma rede

2. **Verificar firewall**
   - O firewall do Mac pode estar bloqueando a porta 8081
   - Desabilitar temporariamente ou permitir Node.js

3. **Verificar IP**
   - O IP pode ter mudado
   - O AppDelegate detecta automaticamente, mas pode levar alguns segundos

4. **Usar simulador**
   - No simulador, `localhost` funciona automaticamente
   - Não precisa do IP da máquina

### Erro de conexão no dispositivo físico

Se o app no dispositivo físico não conseguir conectar:

1. **Verificar se o Metro está acessível na rede**:
   ```bash
   # No Mac, testar se o IP está acessível
   curl http://192.168.1.5:8081/status
   ```

2. **Verificar se o Metro está configurado para LAN**:
   ```bash
   npx expo start --lan
   ```

3. **Verificar logs do Metro** para ver se há erros

## ✅ Checklist

- [ ] Metro bundler está rodando (`./start-metro.sh`)
- [ ] Porta 8081 está em uso (`lsof -ti:8081`)
- [ ] Metro responde (`curl http://localhost:8081/status`)
- [ ] Mac e iPhone estão na mesma rede WiFi (se usando dispositivo físico)
- [ ] Firewall não está bloqueando a porta 8081
- [ ] App compilado e rodando no Xcode

## 📋 Comandos Úteis

```bash
# Iniciar Metro
./start-metro.sh

# Verificar se está rodando
lsof -ti:8081

# Parar Metro
killall node
# ou
lsof -ti:8081 | xargs kill -9

# Verificar IP da máquina
ifconfig | grep -A 1 "en0\|en1" | grep "inet " | awk '{print $2}'

# Testar conexão
curl http://localhost:8081/status
```

