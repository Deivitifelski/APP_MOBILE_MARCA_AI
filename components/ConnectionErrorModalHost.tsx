import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { registerConnectionErrorModal, type ConnectionErrorModalOptions } from '../lib/connectionErrorModalController';
import { useTheme } from '../contexts/ThemeContext';

const DEBOUNCE_MS = 500;

export default function ConnectionErrorModalHost() {
  const { colors, isDarkMode } = useTheme();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ConnectionErrorModalOptions | undefined>();
  const lastShownAtRef = useRef(0);

  const close = useCallback(() => {
    setVisible(false);
    setOptions(undefined);
  }, []);

  const open = useCallback((opts?: ConnectionErrorModalOptions) => {
    const now = Date.now();
    if (now - lastShownAtRef.current < DEBOUNCE_MS && visible) {
      return;
    }
    lastShownAtRef.current = now;
    setOptions(opts);
    setVisible(true);
  }, [visible]);

  useEffect(() => {
    registerConnectionErrorModal(open);
    return () => registerConnectionErrorModal(null);
  }, [open]);

  const handleRetry = useCallback(() => {
    const fn = options?.onRetry;
    if (fn) fn();
    close();
  }, [close, options?.onRetry]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: isDarkMode ? '#000' : '#1e293b',
            },
          ]}
        >
          <View style={styles.body}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="cloud-offline-outline" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Erro de conexão</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              Verifique sua internet e tente novamente.
            </Text>
          </View>
          {options?.onRetry ? (
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btnSecondary, { borderColor: colors.border }]}
                onPress={close}
                activeOpacity={0.85}
              >
                <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Fechar</Text>
              </TouchableOpacity>
              <View style={styles.rowSpacer} />
              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
                onPress={handleRetry}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btnFull, { backgroundColor: colors.primary }]}
              onPress={close}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Entendi</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.12,
    shadowRadius: 24,
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
  body: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 18,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    width: '100%',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    ...Platform.select({
      android: { includeFontPadding: false, textAlignVertical: 'center' as const },
      default: {},
    }),
  },
  message: {
    width: '100%',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    ...Platform.select({
      android: { includeFontPadding: false, textAlignVertical: 'center' as const },
      default: {},
    }),
  },
  btnFull: {
    width: '100%',
    minHeight: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  rowSpacer: {
    width: 10,
  },
  btnSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  btnPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
