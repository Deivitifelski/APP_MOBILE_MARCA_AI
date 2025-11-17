import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface FCMTokenModalProps {
  visible: boolean;
  token: string | null;
  onClose: () => void;
}

export default function FCMTokenModal({
  visible,
  token,
  onClose
}: FCMTokenModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Token FCM
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.content}>
            {token ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>
                  Token obtido com sucesso:
                </Text>
                <ScrollView
                  style={[styles.tokenContainer, { backgroundColor: colors.background }]}
                  contentContainerStyle={styles.tokenContent}
                >
                  <Text style={[styles.tokenText, { color: colors.text }]}>
                    {token}
                  </Text>
                </ScrollView>
                <View style={styles.statusContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={[styles.statusText, { color: '#4CAF50' }]}>
                    Token FCM disponível
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#F44336" />
                <Text style={[styles.errorText, { color: '#F44336' }]}>
                  Não foi possível obter o token FCM
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={onClose}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.buttonText}>Fechar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  tokenContainer: {
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
    marginBottom: 16,
  },
  tokenContent: {
    padding: 4,
  },
  tokenText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

