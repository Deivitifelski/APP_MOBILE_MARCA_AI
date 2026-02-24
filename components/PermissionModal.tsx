import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface PermissionModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function PermissionModal({
  visible,
  onClose,
  title = "Sem Permissão",
  message = "Você não tem permissão para acessar esta funcionalidade.",
  icon = "lock-closed"
}: PermissionModalProps) {
  const { colors } = useTheme();

  const createDynamicStyles = () => StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 24,
      margin: 20,
      maxWidth: Dimensions.get('window').width - 40,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: Platform.OS === 'android' ? 0 : 0.25,
      shadowRadius: Platform.OS === 'android' ? 0 : 3.84,
      elevation: Platform.OS === 'android' ? 0 : 5,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    icon: {
      backgroundColor: colors.error + '20',
      borderRadius: 50,
      padding: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    message: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    button: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      minWidth: 120,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  const styles = createDynamicStyles();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.icon}>
              <Ionicons 
                name={icon} 
                size={32} 
                color={colors.error} 
              />
            </View>
          </View>
          
          <Text style={styles.title}>{title}</Text>
          
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
