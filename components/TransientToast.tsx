import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VISIBLE_MS = 2600;

type ThemeColors = {
  surface: string;
  text: string;
  border: string;
  primary: string;
};

type Props = {
  message: string | null;
  onDismiss: () => void;
  colors: ThemeColors;
};

/**
 * Toast leve na parte inferior (não bloqueia toques). Some após alguns segundos.
 */
export default function TransientToast({ message, onDismiss, colors }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return undefined;

    opacity.setValue(0);
    translateY.setValue(14);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9 }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 14, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onDismissRef.current();
      });
    }, VISIBLE_MS);

    return () => clearTimeout(t);
  }, [message, opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          bottom: Math.max(insets.bottom, 12) + 8,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.12,
                  shadowRadius: 10,
                }
              : { elevation: 8 }),
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        <Text style={[styles.text, { color: colors.text }]} numberOfLines={3}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
