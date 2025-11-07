import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxAge?: number; // Maximum age in milliseconds
}

class CacheService {
  private readonly CACHE_PREFIX = '@marca_ai_cache_';
  private readonly DEFAULT_TTL = 2 * 60 * 1000; // 2 minutos (reduzido)
  private readonly IMAGE_CACHE_TTL = 10 * 60 * 1000; // 10 minutos para imagens (reduzido)
  private readonly USER_DATA_TTL = 5 * 60 * 1000; // 5 minutos para dados do usuário (reduzido)
  private readonly ARTIST_DATA_TTL = 5 * 60 * 1000; // 5 minutos para dados do artista (reduzido)
  private readonly MAX_CACHE_SIZE = 50; // Máximo de 50 itens em cache
  private readonly MAX_CACHE_SIZE_MB = 10; // Máximo de 10MB em cache

  /**
   * Armazena dados no cache com limpeza automática
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      // Verificar tamanho do cache antes de adicionar
      await this.cleanupCacheIfNeeded();

      const ttl = options.ttl || this.DEFAULT_TTL;
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + ttl,
      };

      const serializedData = JSON.stringify(cacheItem);
      
      // Verificar se o item é muito grande (mais de 1MB)
      const dataSizeMB = new Blob([serializedData]).size / (1024 * 1024);
      if (dataSizeMB > 1) {
        console.warn('⚠️ Item muito grande para cache:', key, `${dataSizeMB.toFixed(2)}MB`);
        return; // Não salvar itens muito grandes
      }

      await AsyncStorage.setItem(
        `${this.CACHE_PREFIX}${key}`,
        serializedData
      );
    } catch (error) {
      console.error('Erro ao salvar no cache:', error);
    }
  }

  /**
   * Recupera dados do cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      
      if (!cached) {
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      
      // Verificar se o cache expirou
      if (Date.now() > cacheItem.expiry) {
        await this.remove(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.error('Erro ao recuperar do cache:', error);
      return null;
    }
  }

  /**
   * Remove item do cache
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error('Erro ao remover do cache:', error);
    }
  }

  /**
   * Limpa todo o cache
   */
  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  }

  /**
   * Verifica se um item existe no cache e não expirou
   */
  async exists(key: string): Promise<boolean> {
    try {
      const cached = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      
      if (!cached) {
        return false;
      }

      const cacheItem: CacheItem<any> = JSON.parse(cached);
      return Date.now() <= cacheItem.expiry;
    } catch (error) {
      console.error('Erro ao verificar cache:', error);
      return false;
    }
  }

  // Métodos específicos para diferentes tipos de dados

  /**
   * Cache para dados do usuário
   */
  async setUserData<T>(userId: string, data: T): Promise<void> {
    await this.set(`user_${userId}`, data, { ttl: this.USER_DATA_TTL });
  }

  async getUserData<T>(userId: string): Promise<T | null> {
    return await this.get<T>(`user_${userId}`);
  }

  /**
   * Cache para dados do artista
   */
  async setArtistData<T>(artistId: string, data: T): Promise<void> {
    await this.set(`artist_${artistId}`, data, { ttl: this.ARTIST_DATA_TTL });
  }

  async getArtistData<T>(artistId: string): Promise<T | null> {
    return await this.get<T>(`artist_${artistId}`);
  }

  /**
   * Cache para imagens (URLs e metadados) - Leve
   */
  async setImageData<T>(imageKey: string, data: T): Promise<void> {
    // Para imagens, só cacheamos metadados, não a imagem em si
    const lightweightData = {
      url: (data as any)?.url || '',
      lastLoaded: (data as any)?.lastLoaded || Date.now(),
      loadCount: (data as any)?.loadCount || 0,
    };
    await this.set(`image_${imageKey}`, lightweightData, { ttl: this.IMAGE_CACHE_TTL });
  }

  async getImageData<T>(imageKey: string): Promise<T | null> {
    return await this.get<T>(`image_${imageKey}`);
  }

  /**
   * Cache para eventos
   */
  async setEventsData<T>(artistId: string, year: number, month: number, data: T): Promise<void> {
    const key = `events_${artistId}_${year}_${month}`;
    await this.set(key, data, { ttl: 2 * 60 * 1000 }); // 2 minutos para eventos
  }

  async getEventsData<T>(artistId: string, year: number, month: number): Promise<T | null> {
    const key = `events_${artistId}_${year}_${month}`;
    return await this.get<T>(key);
  }

  /**
   * Cache para permissões
   */
  async setPermissionsData<T>(userId: string, artistId: string, data: T): Promise<void> {
    const key = `permissions_${userId}_${artistId}`;
    await this.set(key, data, { ttl: 5 * 60 * 1000 }); // 5 minutos para permissões
  }

  async getPermissionsData<T>(userId: string, artistId: string): Promise<T | null> {
    const key = `permissions_${userId}_${artistId}`;
    return await this.get<T>(key);
  }

  /**
   * Limpeza automática do cache quando necessário
   */
  private async cleanupCacheIfNeeded(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      // Se temos muitos itens, limpar os mais antigos
      if (cacheKeys.length > this.MAX_CACHE_SIZE) {
        const itemsToRemove = cacheKeys.length - this.MAX_CACHE_SIZE;
        console.log(`🧹 Limpando ${itemsToRemove} itens antigos do cache`);
        
        // Remover os itens mais antigos
        const itemsWithTimestamps = await Promise.all(
          cacheKeys.map(async (key) => {
            try {
              const cached = await AsyncStorage.getItem(key);
              if (cached) {
                const cacheItem = JSON.parse(cached);
                return { key, timestamp: cacheItem.timestamp };
              }
            } catch (error) {
              // Item corrompido, remover
              return { key, timestamp: 0 };
            }
            return null;
          })
        );
        
        const validItems = itemsWithTimestamps.filter(item => item !== null);
        validItems.sort((a, b) => a!.timestamp - b!.timestamp);
        
        const keysToRemove = validItems.slice(0, itemsToRemove).map(item => item!.key);
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error('Erro na limpeza do cache:', error);
    }
  }

  /**
   * Invalida cache específico quando dados são atualizados
   */
  async invalidateUserData(userId: string): Promise<void> {
    await this.remove(`user_${userId}`);
  }

  async invalidateArtistData(artistId: string): Promise<void> {
    await this.remove(`artist_${artistId}`);
    // Também invalidar eventos relacionados
    const keys = await AsyncStorage.getAllKeys();
    const eventKeys = keys.filter(key => 
      key.includes(`events_${artistId}`) || key.includes(`image_artist_${artistId}`)
    );
    if (eventKeys.length > 0) {
      await AsyncStorage.multiRemove(eventKeys);
    }
  }

  async invalidateImageData(imageKey: string): Promise<void> {
    await this.remove(`image_${imageKey}`);
  }

  async invalidateEventsCache(artistId: string, year: number, month: number): Promise<void> {
    const key = `events_${artistId}_${year}_${month}`;
    await this.remove(key);
  }

  /**
   * Obtém informações sobre o cache atual
   */
  async getCacheInfo(): Promise<{ size: number; keys: string[] }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      return { size: cacheKeys.length, keys: cacheKeys };
    } catch (error) {
      console.error('Erro ao obter informações do cache:', error);
      return { size: 0, keys: [] };
    }
  }
}

// Instância singleton
export const cacheService = new CacheService();

// Funções utilitárias para uso comum
export const cacheUtils = {
  /**
   * Gera chave única para imagem baseada na URL
   */
  generateImageKey: (url: string): string => {
    return url.split('/').pop()?.split('?')[0] || url;
  },

  /**
   * Verifica se uma URL de imagem precisa ser recarregada
   */
  shouldReloadImage: (url: string, lastLoad?: number): boolean => {
    if (!lastLoad) return true;
    
    // Recarregar se passou mais de 30 minutos
    const thirtyMinutes = 30 * 60 * 1000;
    return Date.now() - lastLoad > thirtyMinutes;
  },

  /**
   * Gera chave para cache de eventos
   */
  generateEventsKey: (artistId: string, year: number, month: number): string => {
    return `events_${artistId}_${year}_${month}`;
  }
};
