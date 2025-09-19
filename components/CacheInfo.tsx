import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { cacheService } from '../services/cacheService';

interface CacheInfoProps {
  show?: boolean;
}

export default function CacheInfo({ show = false }: CacheInfoProps) {
  const [cacheInfo, setCacheInfo] = useState<{ size: number; keys: string[] }>({ size: 0, keys: [] });

  useEffect(() => {
    if (show) {
      loadCacheInfo();
    }
  }, [show]);

  const loadCacheInfo = async () => {
    const info = await cacheService.getCacheInfo();
    setCacheInfo(info);
  };

  const clearCache = async () => {
    await cacheService.clear();
    await loadCacheInfo();
  };

  if (!show) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Cache Info</Text>
      <Text style={styles.info}>Itens: {cacheInfo.size}</Text>
      <Text style={styles.info}>Chaves: {cacheInfo.keys.length}</Text>
      
      <TouchableOpacity style={styles.button} onPress={clearCache}>
        <Text style={styles.buttonText}>Limpar Cache</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={loadCacheInfo}>
        <Text style={styles.buttonText}>Atualizar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 8,
    minWidth: 150,
  },
  title: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  info: {
    color: 'white',
    fontSize: 12,
    marginBottom: 2,
  },
  button: {
    backgroundColor: '#667eea',
    padding: 5,
    borderRadius: 4,
    marginTop: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
  },
});
