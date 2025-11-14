// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Garantir que o Metro resolva corretamente os módulos do node_modules
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Se o módulo começa com ./expo-router/, remover o ./ e resolver do node_modules
    if (moduleName.startsWith('./expo-router/')) {
      const cleanModuleName = moduleName.replace('./', '');
      try {
        const resolved = require.resolve(cleanModuleName, { 
          paths: [path.resolve(__dirname, 'node_modules')] 
        });
        return {
          filePath: resolved,
          type: 'sourceFile',
        };
      } catch (e) {
        // Fallback para resolução padrão
      }
    }
    // Usar resolução padrão para outros módulos
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;

