import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface SubscriptionModalProps {
  visible: boolean;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  onClose: () => void;
  onCancel?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  buttonText?: string;
  showCancel?: boolean;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  type,
  title,
  message,
  onClose,
  onCancel,
  icon,
  buttonText = 'Entendi',
  showCancel = false,
}) => {
  const { colors } = useTheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    if (icon) return icon;
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'warning':
        return 'warning';
      case 'info':
        return 'information-circle';
      default:
        return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return '#10B981'; // verde
      case 'error':
        return '#EF4444'; // vermelho
      case 'warning':
        return '#F59E0B'; // amarelo
      case 'info':
        return '#3B82F6'; // azul
      default:
        return colors.text;
    }
  };


  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
          },
        ]}
      >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                backgroundColor: colors.surface,
                transform: [{ scale: scaleAnim }],
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            {/* Botão de Fechar */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Ícone */}
            <View style={styles.iconContainer}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: getIconColor() + '20',
                  }
                ]}
              >
                <Ionicons
                  name={getIconName()}
                  size={40}
                  color={getIconColor()}
                />
              </View>
            </View>

            {/* Título */}
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                },
              ]}
            >
              {title}
            </Text>

            {/* Mensagem */}
            <View style={styles.messageContainer}>
              {message.split('\n').map((line, index) => {
                // Destaque para linhas com emojis ou informações importantes
                const isHighlight = line.includes('💎') || line.includes('💰') || line.includes('📅') || line.includes('🔄');
                return (
                  <Text 
                    key={index}
                    style={[
                      styles.message,
                      {
                        color: isHighlight ? colors.text : colors.textSecondary,
                        fontWeight: isHighlight ? '600' : '400',
                        marginBottom: index < message.split('\n').length - 1 ? 6 : 0,
                      }
                    ]}
                  >
                    {line}
                  </Text>
                );
              })}
            </View>

            {/* Botões */}
            <View style={styles.buttonsContainer}>
              {showCancel && onCancel && (
                <TouchableOpacity
                  onPress={onCancel}
                  activeOpacity={0.8}
                  style={[
                    styles.button,
                    styles.cancelButton,
                    {
                      borderColor: colors.border,
                      marginRight: 8,
                    }
                  ]}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.8}
                style={[
                  styles.button,
                  {
                    backgroundColor: getIconColor(),
                    width: showCancel ? undefined : '100%',
                    flex: showCancel ? 1 : undefined,
                  }
                ]}
              >
                <Text style={styles.buttonText}>{buttonText}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  messageContainer: {
    width: '100%',
    marginBottom: 24,
    alignItems: 'center',
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    width: '100%',
  },
  buttonsContainer: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 4,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

