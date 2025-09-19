import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface LimitReachedModalProps {
  visible: boolean;
  currentCount: number;
  maxCount: number;
  planName: string;
  onClose: () => void;
  onUpgrade: () => void;
  onCancel: () => void;
}

export default function LimitReachedModal({
  visible,
  currentCount,
  maxCount,
  planName,
  onClose,
  onUpgrade,
  onCancel,
}: LimitReachedModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={60} color="#ff6b35" />
          </View>
          
          <Text style={styles.title}>Limite Atingido</Text>
          
          <Text style={styles.message}>
            Seu plano <Text style={styles.planName}>{planName.toUpperCase()}</Text> permite apenas{' '}
            <Text style={styles.highlight}>{maxCount} artista{maxCount > 1 ? 's' : ''}</Text>.
          </Text>
          
          <Text style={styles.subMessage}>
            Você já tem {currentCount} artista{currentCount > 1 ? 's' : ''} criado{currentCount > 1 ? 's' : ''}.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={onUpgrade}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.upgradeButtonText}>Fazer Upgrade</Text>
            </TouchableOpacity>
          </View>
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
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 320,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  planName: {
    fontWeight: 'bold',
    color: '#667eea',
  },
  highlight: {
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  subMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  upgradeButton: {
    flex: 2,
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});
