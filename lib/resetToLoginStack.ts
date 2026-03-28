import { CommonActions, type NavigationProp, type NavigationState, type ParamListBase } from '@react-navigation/native';
import { Platform } from 'react-native';

/** Zera a pilha do Stack raiz e deixa apenas a tela de login (evita tabs “por baixo”). */
export function dispatchResetToLogin(
  navigation: Pick<NavigationProp<ParamListBase>, 'dispatch'>
) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'login' as never }],
    })
  );
}

/** Só há uma rota `login` na pilha do navegador que contém esta tela (sem index/tabs por baixo). */
function isLoginAloneInParentStack(state: NavigationState | undefined): boolean {
  if (!state?.routes?.length) return false;
  return state.routes.length === 1 && state.routes[0].name === 'login';
}

/**
 * Primeira instalação / cold start: o Expo pode deixar `(tabs)` na pilha com `login` por cima.
 * Ao focar o login no Android, força pilha única para o Voltar sempre sair do app.
 */
export function sanitizeLoginParentStackIfNeeded(navigation: NavigationProp<ParamListBase>) {
  if (Platform.OS !== 'android') return;
  const state = navigation.getState() as NavigationState | undefined;
  // `canGoBack` pega casos em que ainda há rota por baixo (ex.: agenda) mesmo se `getState` variar.
  if (isLoginAloneInParentStack(state) && !navigation.canGoBack()) {
    return;
  }
  dispatchResetToLogin(navigation);
}
