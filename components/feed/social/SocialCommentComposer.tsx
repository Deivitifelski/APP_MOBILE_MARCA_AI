import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  sending: boolean;
  artistName?: string;
  artistImage?: string | null;
};

export default function SocialCommentComposer({
  value,
  onChangeText,
  onSubmit,
  sending,
  artistName,
  artistImage,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const canSend = !!value.trim() && !sending;
  const avatarUrl = artistImage?.trim() || '';
  const initial = artistName?.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      style={[
        styles.wrap,
        {
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View style={[styles.avatarWrap, { backgroundColor: colors.secondary }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <Text style={[styles.avatarInitial, { color: colors.primary }]}>{initial}</Text>
        )}
      </View>

      <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Adicionar comentário..."
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text }]}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={() => {
            if (canSend) onSubmit();
          }}
        />
      </View>

      {canSend ? (
        <TouchableOpacity onPress={onSubmit} hitSlop={10} style={styles.sendBtn}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="arrow-up-circle" size={30} color={colors.primary} />
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.sendBtnPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  avatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Platform.OS === 'ios' ? 4 : 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '800',
  },
  inputWrap: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    minHeight: 40,
    maxHeight: 110,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  input: {
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 88,
    padding: 0,
  },
  sendBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 4 : 2,
  },
  sendBtnPlaceholder: {
    width: 34,
  },
});
