import { useEffect, useRef } from 'react';
import { AppState, InteractionManager } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { reconcileSubscriptionWithStore } from '../services/subscriptionSyncService';

const DEBOUNCE_MS = 1600;
const FOREGROUND_MIN_INTERVAL_MS = 2.5 * 60 * 1000;

/**
 * Em background: alinha IAP ↔ Supabase após login e ao voltar ao app (com throttle).
 * Não bloqueia navegação nem splash — usa InteractionManager + debounce.
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

    const queueReconcile = () => {
      clearDebounce();
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        InteractionManager.runAfterInteractions(() => {
          void reconcileSubscriptionWithStore().catch(() => {});
        });
      }, DEBOUNCE_MS);
    };

    const onAuth = (event: string, session: Session | null) => {
      if (!session?.user?.id) return;
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        queueReconcile();
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
        queueReconcile();
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
