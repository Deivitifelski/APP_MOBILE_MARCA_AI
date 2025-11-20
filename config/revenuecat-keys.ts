import { Platform } from 'react-native';

/**
 * Retorna a chave pública do RevenueCat baseada na plataforma
 */
export const getRevenueCatKey = (): string => {
  if (Platform.OS === 'ios') {
    // Chave pública do Revenue Cat para iOS
    return 'appl_PVJKhYqNfSQdfaFxmviIAQGmaAj';
  } else {
    // Chave pública do Revenue Cat para Android
    // ⚠️ SUBSTITUA pela sua chave real quando tiver
    return 'goog_xxxxxxxxxxxxxxxx';
  }
};


