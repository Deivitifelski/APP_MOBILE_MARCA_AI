import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageProps, View } from 'react-native';
import { cacheService, cacheUtils } from '../services/cacheService';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  imageUrl: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackIconSize?: number;
  fallbackIconColor?: string;
  showLoadingIndicator?: boolean;
  cacheKey?: string;
  forceReload?: boolean;
  onLoadSuccess?: () => void;
  onLoadError?: (error: any) => void;
}

interface ImageCacheData {
  url: string;
  lastLoaded: number;
  loadCount: number;
}

export default function OptimizedImage({
  imageUrl,
  fallbackIcon = 'person',
  fallbackIconSize = 40,
  fallbackIconColor = '#667eea',
  showLoadingIndicator = true,
  cacheKey,
  forceReload = false,
  onLoadSuccess,
  onLoadError,
  style,
  ...props
}: OptimizedImageProps) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const loadAttempts = useRef(0);
  const maxLoadAttempts = 3;

  // Gerar chave única para o cache
  const finalCacheKey = cacheKey || cacheUtils.generateImageKey(imageUrl);

  useEffect(() => {
    loadImage();
  }, [imageUrl, forceReload]);

  const loadImage = async () => {
    if (!imageUrl || imageUrl.trim() === '') {
      setImageLoadError(true);
      setCurrentImageUrl(null);
      return;
    }

    // Verificar se já temos esta imagem em cache
    const cachedData = await cacheService.getImageData<ImageCacheData>(finalCacheKey);
    
    const cachedBaseUrl = cachedData?.url?.split('?')[0];
    const requestedBaseUrl = imageUrl.split('?')[0];

    if (cachedData && cachedBaseUrl !== requestedBaseUrl) {
      await cacheService.invalidateImageData(finalCacheKey);
    } else if (cachedData && !forceReload && !cacheUtils.shouldReloadImage(cachedData.url, cachedData.lastLoaded)) {
      setCurrentImageUrl(cachedData.url);
      setImageLoadError(false);
      setIsLoading(false);
      onLoadSuccess?.();
      return;
    }

    // Carregar nova imagem
    setIsLoading(true);
    setImageLoadError(false);
    
    try {
      // Adicionar timestamp para evitar cache
      const urlWithTimestamp = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      
      setCurrentImageUrl(urlWithTimestamp);

      // Salvar no cache
      await cacheService.setImageData(finalCacheKey, {
        url: urlWithTimestamp,
        lastLoaded: Date.now(),
        loadCount: (cachedData?.loadCount || 0) + 1,
      });

      setImageLoadError(false);
      onLoadSuccess?.();
      
    } catch (error) {
      console.error('Erro ao carregar imagem:', error);
      
      loadAttempts.current++;
      
      if (loadAttempts.current < maxLoadAttempts) {
        // Tentar novamente após um delay
        setTimeout(() => {
          loadImage();
        }, 1000 * loadAttempts.current);
        return;
      }
      
      setImageLoadError(true);
      setCurrentImageUrl(null);
      onLoadError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageError = (error: any) => {
    console.error('Erro na imagem:', error);
    setImageLoadError(true);
    onLoadError?.(error);
  };

  const handleImageLoad = () => {
    setImageLoadError(false);
    onLoadSuccess?.();
  };

  // Se está carregando e deve mostrar indicador
  if (isLoading && showLoadingIndicator) {
    return (
      <View style={[{ justifyContent: 'center', alignItems: 'center' }, style]}>
        <ActivityIndicator size="small" color="#667eea" />
      </View>
    );
  }

  // Se há erro ou não há URL
  if (imageLoadError || !currentImageUrl) {
    return (
      <View style={[{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }, style]}>
        <Ionicons 
          name={fallbackIcon} 
          size={fallbackIconSize} 
          color={fallbackIconColor} 
        />
      </View>
    );
  }

  // Renderizar imagem
  return (
    <Image
      source={{ 
        uri: currentImageUrl,
        cache: 'force-cache' // Forçar cache local
      }}
      style={style}
      onError={handleImageError}
      onLoad={handleImageLoad}
      {...props}
    />
  );
}

// Hook para usar o cache de imagens
export const useOptimizedImage = (imageUrl: string, cacheKey?: string) => {
  const [imageData, setImageData] = useState<ImageCacheData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadImageData = async () => {
      if (!imageUrl) return;

      setIsLoading(true);
      
      const key = cacheKey || cacheUtils.generateImageKey(imageUrl);
      const cached = await cacheService.getImageData<ImageCacheData>(key);
      
      setImageData(cached);
      setIsLoading(false);
    };

    loadImageData();
  }, [imageUrl, cacheKey]);

  const invalidateCache = async () => {
    const key = cacheKey || cacheUtils.generateImageKey(imageUrl);
    await cacheService.invalidateImageData(key);
  };

  return {
    imageData,
    isLoading,
    invalidateCache,
  };
};
