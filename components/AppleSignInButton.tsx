import type { User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { supabase } from '../lib/supabase';
import { createOrUpdateUserFromApple } from '../services/supabase/userService';

const APPLE_CANCEL_CODES = [
  'ERR_CANCELED',
  'ERR_REQUEST_CANCELED',
  'ERR_REQUEST_UNKNOWN',
];

export interface AppleSignInResult {
  user: User;
  credentialEmail: string | null;
  credentialFullName: AppleAuthentication.AppleAuthenticationFullName | null;
  isNewUser?: boolean;
}

interface AppleSignInButtonProps {
  disabled?: boolean;
  style?: ViewStyle;
  onSuccess?: (result: AppleSignInResult) => void;
  onError?: (error: Error) => void;
  iconOnly?: boolean;
  icon?: React.ReactNode;
}

export default function AppleSignInButton({
  disabled,
  style,
  onSuccess,
  onError,
  iconOnly = false,
  icon,
}: AppleSignInButtonProps) {
  const [working, setWorking] = useState(false);

  if (Platform.OS !== 'ios') {
    return null;
  }

  const handlePress = async () => {
    if (disabled || working) {
      return;
    }
    try {
      setWorking(true);
      console.log('AppleSignInButton: iniciando fluxo de login');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      console.log('AppleSignInButton: credential', JSON.stringify(credential, null, 2));

      if (!credential.identityToken) {
        Alert.alert('Erro', 'Não foi possível obter seus dados junto a apple.');
        throw new Error('Não foi possível obter o token de identidade da Apple.');
      }

      const { error, data } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      console.log('AppleSignInButton: supabase signInWithIdToken', {
        user: data?.user,
        error,
      });

      if (error) {
        throw error;
      }

      const user = data?.user;
      if (!user) {
        throw new Error('Usuário não foi retornado após o login com Apple.');
      }

      const credentialEmail = credential.email || user.email || null;

      const nameParts = [
        credential.fullName?.givenName,
        credential.fullName?.middleName,
        credential.fullName?.familyName,
      ].filter(Boolean);

      const fullName = nameParts.join(' ').trim() || null;

      const emailToPersist = credentialEmail || '';

      if (!emailToPersist) {
        throw new Error('O Apple ID precisa compartilhar um email para prosseguir.');
      }

      const upsertResult = await createOrUpdateUserFromApple(user.id, {
        name: fullName || undefined,
        email: emailToPersist,
        photo:
          (user.user_metadata?.avatar_url as string | undefined) ||
          (user.user_metadata?.picture as string | undefined) ||
          undefined,
      });

      console.log('AppleSignInButton: createOrUpdateUserFromApple retornou', upsertResult);

      onSuccess?.({
        user,
        credentialEmail,
        credentialFullName: credential.fullName || null,
        isNewUser: upsertResult.isNewUser,
      });
    } catch (error: any) {
      const isCanceled = APPLE_CANCEL_CODES.includes(error?.code);

      if (isCanceled) {
        console.log('AppleSignInButton: login com Apple cancelado pelo usuário', error?.code);
        setWorking(false);
        return;
      }

      console.error('AppleSignInButton: erro no login com Apple', error);
      onError?.(error);
    } finally {
      setWorking(false);
    }
  };

  if (iconOnly) {
    return (
      <TouchableOpacity
        style={[styles.iconButton, style]}
        onPress={handlePress}
        disabled={disabled || working}
      >
        {icon}
      </TouchableOpacity>
    );
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={8}
      style={[styles.button, style]}
      onPress={handlePress}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 54,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

