import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import type { Order } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface InRideOrderNotificationProps {
  orders: Order[];
  onAccept: (orderId: string) => void;
  onDecline: (orderId: string) => void;
  maxImmediateOrders?: number; // Limite pour courses immédiates (défaut: 2)
  currentActiveOrders?: number; // Nombre de courses immédiates actives
}

// Fonction utilitaire pour formater le prix
const formatPrice = (price: number): string => {
  return price.toLocaleString('fr-FR') + ' XPF';
};

// Fonction pour extraire les adresses
const extractAddresses = (order: Order) => {
  const addresses = order.addresses || [];
  const pickup = addresses.find((a: any) => a.type === 'pickup');
  const destination = addresses.find((a: any) => a.type === 'destination');
  const stops = addresses.filter((a: any) => a.type === 'stop');
  
  // Les adresses sont dans 'value' selon le schéma AddressField
  const getAddressText = (addr: any) => {
    if (!addr) return null;
    return addr.value || addr.address || addr.label || (typeof addr === 'string' ? addr : null);
  };
  
  return {
    pickupAddress: getAddressText(pickup) || order.pickupAddress || 'Adresse non disponible',
    destinationAddress: getAddressText(destination) || order.destinationAddress || 'Destination non disponible',
    stops: stops.map((s: any) => ({
      ...s,
      address: getAddressText(s) || 'Arrêt',
    })),
  };
};

// Vérifier si c'est une course réservée à l'avance
const isScheduledOrder = (order: Order): boolean => {
  return order.isScheduled === true || !!order.scheduledTime;
};

export function InRideOrderNotification({
  orders,
  onAccept,
  onDecline,
  maxImmediateOrders = 2,
  currentActiveOrders = 1,
}: InRideOrderNotificationProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  if (orders.length === 0) return null;

  const handleShowDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const canAcceptImmediateOrder = (order: Order): boolean => {
    // Les courses réservées peuvent toujours être acceptées
    if (isScheduledOrder(order)) return true;
    // Pour les courses immédiates, vérifier la limite
    return currentActiveOrders < maxImmediateOrders;
  };

  const renderNotificationCard = (order: Order, index: number) => {
    const isScheduled = isScheduledOrder(order);
    const canAccept = canAcceptImmediateOrder(order);

    return (
      <Animated.View
        key={order.id}
        style={[
          styles.notificationCard,
          { marginTop: index > 0 ? 8 : 0 },
        ]}
      >
        {/* Header avec icône, titre et bouton info */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconBadge, isScheduled ? styles.iconBadgeScheduled : styles.iconBadgeImmediate]}>
              <Ionicons 
                name={isScheduled ? "calendar" : "car"} 
                size={18} 
                color="#FFFFFF" 
              />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.cardTitle}>
                {isScheduled ? 'Nouvelle réservation' : 'Nouvelle course'}
              </Text>
              {isScheduled && order.scheduledTime && (
                <Text style={styles.scheduledTime}>
                  {new Date(order.scheduledTime).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Pacific/Tahiti',
                  })}
                </Text>
              )}
            </View>
          </View>
          
          {/* Bouton info pour voir les détails */}
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => handleShowDetails(order)}
          >
            <Ionicons name="information-circle" size={32} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* Prix estimé */}
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Prix estimé</Text>
          <Text style={styles.priceValue}>{formatPrice(order.totalPrice || 0)}</Text>
        </View>

        {/* Boutons d'action */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={() => onDecline(order.id)}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
            <Text style={styles.declineButtonText}>Refuser</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.acceptButton,
              !canAccept && styles.acceptButtonDisabled,
            ]}
            onPress={() => canAccept && onAccept(order.id)}
            disabled={!canAccept}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.acceptButtonText}>
              {canAccept ? 'Accepter' : 'Limite atteinte'}
            </Text>
          </TouchableOpacity>
        </View>

        {!canAccept && !isScheduled && (
          <Text style={styles.limitWarning}>
            Vous avez déjà {maxImmediateOrders} courses immédiates en cours
          </Text>
        )}
      </Animated.View>
    );
  };

  // Modal de détails complets
  const renderDetailsModal = () => {
    if (!selectedOrder) return null;

    const { pickupAddress, destinationAddress, stops } = extractAddresses(selectedOrder);
    const isScheduled = isScheduledOrder(selectedOrder);
    const canAccept = canAcceptImmediateOrder(selectedOrder);

    return (
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header du modal */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconBadge, isScheduled ? styles.iconBadgeScheduled : styles.iconBadgeImmediate]}>
                <Ionicons 
                  name={isScheduled ? "calendar" : "car"} 
                  size={24} 
                  color="#FFFFFF" 
                />
              </View>
              <Text style={styles.modalTitle}>
                {isScheduled ? 'Détails de la réservation' : 'Détails de la course'}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowDetailsModal(false)}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Informations client */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Client</Text>
                <View style={styles.clientInfo}>
                  <View style={styles.clientAvatar}>
                    <Ionicons name="person" size={24} color="#6B7280" />
                  </View>
                  <View style={styles.clientDetails}>
                    <Text style={styles.clientName}>
                      {selectedOrder.clientName || 'Client'}
                    </Text>
                    {selectedOrder.clientPhone && (
                      <Text style={styles.clientPhone}>{selectedOrder.clientPhone}</Text>
                    )}
                  </View>
                  <View style={styles.passengersInfo}>
                    <Ionicons name="people" size={18} color="#6B7280" />
                    <Text style={styles.passengersText}>
                      {selectedOrder.passengers || 1}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Date/heure pour réservation */}
              {isScheduled && selectedOrder.scheduledTime && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Date et heure</Text>
                  <View style={styles.scheduleInfo}>
                    <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
                    <Text style={styles.scheduleText}>
                      {new Date(selectedOrder.scheduledTime).toLocaleString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Pacific/Tahiti',
                      })}
                    </Text>
                  </View>
                </View>
              )}

              {/* Adresses */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Itinéraire</Text>
                <View style={styles.addressesContainer}>
                  {/* Point de départ */}
                  <View style={styles.addressItem}>
                    <View style={styles.addressDot}>
                      <View style={styles.dotGreenLarge} />
                    </View>
                    <View style={styles.addressContent}>
                      <Text style={styles.addressLabel}>Départ</Text>
                      <Text style={styles.addressFullText}>{pickupAddress}</Text>
                    </View>
                  </View>

                  {/* Ligne de connexion */}
                  <View style={styles.connectionLine} />

                  {/* Arrêts intermédiaires */}
                  {stops.map((stop: any, index: number) => (
                    <React.Fragment key={index}>
                      <View style={styles.addressItem}>
                        <View style={styles.addressDot}>
                          <View style={styles.dotOrange} />
                        </View>
                        <View style={styles.addressContent}>
                          <Text style={styles.addressLabel}>Arrêt {index + 1}</Text>
                          <Text style={styles.addressFullText}>{stop.address}</Text>
                        </View>
                      </View>
                      <View style={styles.connectionLine} />
                    </React.Fragment>
                  ))}

                  {/* Destination */}
                  <View style={styles.addressItem}>
                    <View style={styles.addressDot}>
                      <View style={styles.dotRedLarge} />
                    </View>
                    <View style={styles.addressContent}>
                      <Text style={styles.addressLabel}>Destination</Text>
                      <Text style={styles.addressFullText}>{destinationAddress}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Distance et durée */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Estimation</Text>
                <View style={styles.estimatesRow}>
                  <View style={styles.estimateItem}>
                    <Ionicons name="navigate" size={20} color="#3B82F6" />
                    <Text style={styles.estimateValue}>
                      {selectedOrder.distance ? `${(selectedOrder.distance / 1000).toFixed(1)} km` : 'N/A'}
                    </Text>
                    <Text style={styles.estimateLabel}>Distance</Text>
                  </View>
                  <View style={styles.estimateDivider} />
                  <View style={styles.estimateItem}>
                    <Ionicons name="time" size={20} color="#F59E0B" />
                    <Text style={styles.estimateValue}>
                      {selectedOrder.duration ? `${Math.ceil(selectedOrder.duration / 60)} min` : 'N/A'}
                    </Text>
                    <Text style={styles.estimateLabel}>Durée</Text>
                  </View>
                </View>
              </View>

              {/* Suppléments */}
              {selectedOrder.supplements && selectedOrder.supplements.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Suppléments</Text>
                  {selectedOrder.supplements.map((supp: any, index: number) => (
                    <View key={index} style={styles.supplementRow}>
                      <Text style={styles.supplementName}>
                        {supp.nom || supp.name}
                      </Text>
                      <Text style={styles.supplementPrice}>
                        {formatPrice(supp.prixXpf || supp.price || 0)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Prix total */}
              <View style={styles.priceSection}>
                <Text style={styles.priceSectionLabel}>Prix estimé</Text>
                <Text style={styles.priceSectionValue}>
                  {formatPrice(selectedOrder.totalPrice || 0)}
                </Text>
                <Text style={styles.earningsLabel}>
                  Vos gains: {formatPrice(selectedOrder.driverEarnings || 0)}
                </Text>
              </View>

              {/* Note du client */}
              {selectedOrder.clientNotes && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Note du client</Text>
                  <View style={styles.notesContainer}>
                    <Ionicons name="chatbubble-outline" size={16} color="#6B7280" />
                    <Text style={styles.notesText}>{selectedOrder.clientNotes}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Boutons d'action dans le modal */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalDeclineButton}
                onPress={() => {
                  setShowDetailsModal(false);
                  onDecline(selectedOrder.id);
                }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
                <Text style={styles.modalDeclineText}>Refuser</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalAcceptButton,
                  !canAccept && styles.acceptButtonDisabled,
                ]}
                onPress={() => {
                  if (canAccept) {
                    setShowDetailsModal(false);
                    onAccept(selectedOrder.id);
                  }
                }}
                disabled={!canAccept}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.modalAcceptText}>
                  {canAccept ? 'Accepter' : 'Limite'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      {/* Container des notifications en haut de l'écran */}
      <View style={styles.container}>
        {orders.map((order, index) => renderNotificationCard(order, index))}
      </View>

      {/* Modal de détails */}
      {renderDetailsModal()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 12,
    paddingTop: 50,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconBadgeImmediate: {
    backgroundColor: '#F5C400',
  },
  iconBadgeScheduled: {
    backgroundColor: '#8B5CF6',
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  scheduledTime: {
    fontSize: 13,
    color: '#8B5CF6',
    marginTop: 2,
  },
  infoButton: {
    padding: 4,
  },
  summaryContainer: {
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginRight: 10,
  },
  dotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 10,
  },
  addressText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  stopsText: {
    fontSize: 13,
    color: '#F59E0B',
    marginLeft: 20,
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  declineButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  acceptButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  limitWarning: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 8,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  clientPhone: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  passengersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  passengersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  scheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  scheduleText: {
    fontSize: 15,
    color: '#7C3AED',
    fontWeight: '500',
  },
  addressesContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressDot: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 4,
  },
  dotGreenLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
  },
  dotOrange: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F59E0B',
  },
  dotRedLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  addressFullText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  connectionLine: {
    width: 2,
    height: 20,
    backgroundColor: '#D1D5DB',
    marginLeft: 11,
    marginVertical: 4,
  },
  estimatesRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  estimateItem: {
    flex: 1,
    alignItems: 'center',
  },
  estimateValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  estimateLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  estimateDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  supplementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  supplementName: {
    fontSize: 14,
    color: '#4B5563',
  },
  supplementPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  priceSection: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  priceSectionLabel: {
    fontSize: 13,
    color: '#92400E',
    marginBottom: 4,
  },
  priceSectionValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#92400E',
  },
  earningsLabel: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '600',
    marginTop: 8,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  notesText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modalDeclineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  modalDeclineText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalAcceptButton: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  modalAcceptText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
