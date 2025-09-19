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
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly IMAGE_CACHE_TTL = 30 * 60 * 1000; // 30 minutos para imagens
  private readonly USER_DATA_TTL = 10 * 60 * 1000; // 10 minutos para dados do usuário
  private readonly ARTIST_DATA_TTL = 15 * 60 * 1000; // 15 minutos para dados do artista

  /**
   * Armazena dados no cache
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.DEFAULT_TTL;
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + ttl,
      };

      await AsyncStorage.setItem(
        `${this.CACHE_PREFIX}${key}`,
        JSON.stringify(cacheItem)
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
   * Cache para imagens (URLs e metadados)
   */
  async setImageData<T>(imageKey: string, data: T): Promise<void> {
    await this.set(`image_${imageKey}`, data, { ttl: this.IMAGE_CACHE_TTL });
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
