import { useEffect } from 'react';
import { fetchProducts, initConnection } from 'react-native-iap';

export default function PlanosPagamentosScreen() {
  useEffect(() => {
    const buscarProdutos = async () => {
      try {
        // Inicializar conexão com StoreKit
        await initConnection();
        console.log('✅ StoreKit inicializado');

        // Buscar produtos
        const produtos = await fetchProducts({
          skus: ['Premium marca_ai_9_90_m'],
          type: 'subs',
        });

        console.log('📦 Produtos encontrados:', produtos);
      } catch (error) {
        console.error('❌ Erro ao buscar produtos:', error);
      }
    };

    buscarProdutos();
  }, []);

  return null;
}
