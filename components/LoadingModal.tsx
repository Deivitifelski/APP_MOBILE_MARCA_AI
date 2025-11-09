import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface LoadingModalProps {
  visible: boolean;
  message?: string;
}

export default function LoadingModal({
  visible,
  message = 'Gerando documento...'
}: LoadingModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.message, { color: colors.text }]}>
            {message}
          </Text>
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
  },
  container: {
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

