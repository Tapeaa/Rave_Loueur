import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface PaymentResultModalProps {
  visible: boolean;
  status: 'success' | 'failed';
  amount: number;
  paymentMethod?: 'card' | 'cash';
  cardBrand?: string | null;
  cardLast4?: string | null;
  errorMessage?: string;
  onRetry?: () => void;
  onSwitchToCash?: () => void;
  onClose: () => void;
}

export function PaymentResultModal({
  visible,
  status,
  amount,
  paymentMethod,
  cardBrand,
  cardLast4,
  errorMessage,
  onRetry,
  onSwitchToCash,
  onClose,
}: PaymentResultModalProps) {
  const formatPrice = (price: number) => {
    return `${price.toLocaleString('fr-FR')} XPF`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Card style={styles.modal}>
          <View style={styles.header}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: status === 'success' ? '#D1FAE5' : '#FEE2E2' },
              ]}
            >
              <Ionicons
                name={status === 'success' ? 'checkmark-circle' : 'close-circle'}
                size={48}
                color={status === 'success' ? '#22C55E' : '#EF4444'}
              />
            </View>
            <Text variant="h2" style={styles.title}>
              {status === 'success' ? 'Paiement réussi' : 'Paiement échoué'}
            </Text>
          </View>

          <View style={styles.content}>
            {status === 'success' ? (
              <>
                <Text variant="body" style={styles.amount}>
                  {formatPrice(amount)}
                </Text>
                {paymentMethod === 'card' && cardBrand && cardLast4 && (
                  <Text variant="caption" style={styles.cardInfo}>
                    Carte {cardBrand} •••• {cardLast4}
                  </Text>
                )}
                {paymentMethod === 'cash' && (
                  <Text variant="caption" style={styles.cardInfo}>
                    Paiement en espèces
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text variant="body" style={styles.errorText}>
                  {errorMessage || 'Le paiement n\'a pas pu être effectué'}
                </Text>
                {paymentMethod === 'card' && (
                  <Text variant="caption" style={styles.hint}>
                    Vous pouvez réessayer avec une autre carte ou payer en espèces
                  </Text>
                )}
              </>
            )}
          </View>

          <View style={styles.actions}>
            {status === 'failed' && (
              <>
                {onRetry && (
                  <Button
                    title="Réessayer"
                    onPress={onRetry}
                    fullWidth
                    style={styles.button}
                  />
                )}
                {onSwitchToCash && (
                  <Button
                    title="Payer en espèces"
                    variant="outline"
                    onPress={onSwitchToCash}
                    fullWidth
                    style={styles.button}
                  />
                )}
              </>
            )}
            <Button
              title={status === 'success' ? 'Continuer' : 'Fermer'}
              onPress={onClose}
              fullWidth
              variant={status === 'success' ? 'default' : 'secondary'}
            />
          </View>
        </Card>
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
  modal: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 24,
  },
  amount: {
    fontSize: 24,
    fontWeight: '600',
    color: '#F5C400',
    marginBottom: 8,
  },
  cardInfo: {
    color: '#6b7280',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    color: '#6b7280',
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
  button: {
    marginBottom: 0,
  },
});
