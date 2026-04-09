import { useEffect, useRef } from 'react';
import { Alert, AppState, InteractionManager } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { refreshSubscriptionStateFromDatabase } from '../services/subscriptionSyncService';

const DEBOUNCE_MS = 1600;
const FOREGROUND_MIN_INTERVAL_MS = 2.5 * 60 * 1000;

/**
 * Após login e ao voltar ao app (com throttle): só revalida via tabela `user_subscriptions` + invalida cache.
 * Não chama a loja (IAP); compra/restaurar/tela Premium cuidam do sync com a loja quando necessário.
 */
export default function SubscriptionReconcileBootstrap() {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastForegroundRunRef = useRef(0);

  useEffect(() => {
    const clearDebounce = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };

    const queueRefreshFromDb = () => {
      clearDebounce();
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        InteractionManager.runAfterInteractions(() => {
          void refreshSubscriptionStateFromDatabase()
            .then((r) => {
              if (r.paymentConfirmationFailed) {
                Alert.alert(
                  'Pagamento não confirmado',
                  'Não recebemos a confirmação da loja no prazo esperado. Sua conta voltou ao plano gratuito. Verifique o pagamento ou, se já foi cobrado, use Restaurar compras em Assine Premium.',
                  [{ text: 'OK' }],
                );
              }
            })
            .catch(() => {});
        });
      }, DEBOUNCE_MS);
    };

    const onAuth = (event: string, session: Session | null) => {
      if (!session?.user?.id) return;
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        queueRefreshFromDb();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(onAuth);

    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const now = Date.now();
      if (now - lastForegroundRunRef.current < FOREGROUND_MIN_INTERVAL_MS) return;

      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user?.id) return;
        lastForegroundRunRef.current = Date.now();
        queueRefreshFromDb();
      });
    });

    return () => {
      clearDebounce();
      subscription.unsubscribe();
      appSub.remove();
    };
  }, []);

  return null;
}
