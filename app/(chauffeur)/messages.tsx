import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { getDriverSessionId, apiFetch, getDeletedConversationsMap, setDeletedConversationsMap } from '@/lib/api';

interface Conversation {
  orderId: string;
  otherPartyName: string;
  otherPartyType: 'client' | 'driver';
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  orderStatus: string;
  pickup: string;
  destination: string;
}

interface SupportMessage {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderType: 'admin' | 'client' | 'driver';
  senderId?: string | null;
}

export default function DriverMessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Récupérer la session
  useEffect(() => {
    const loadSession = async () => {
      const sid = await getDriverSessionId();
      setSessionId(sid);
    };
    loadSession();
  }, []);

  const loadConversations = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      setRefreshing(false);
      setConversations([]);
      return;
    }

    try {
      // Utiliser apiFetch qui gère mieux les erreurs et les headers
      const data = await apiFetch<Conversation[]>(`/api/messages/conversations/driver`, {
        headers: {
          'X-Driver-Session': sessionId,
        },
      });
      
      // Gérer le cas où l'API retourne null, undefined, ou n'est pas un tableau
      if (Array.isArray(data)) {
        const deletedMap = await getDeletedConversationsMap();
        const cleanedMap = { ...deletedMap };

        const filteredConvos = data.filter((conv) => {
          const deletedAt = cleanedMap[conv.orderId];
          if (!deletedAt) return true;
          const lastAt = new Date(conv.lastMessageAt).getTime();
          if (Number.isNaN(lastAt)) return false;
          if (lastAt > deletedAt) {
            delete cleanedMap[conv.orderId];
            return true;
          }
          return false;
        });

        if (JSON.stringify(cleanedMap) !== JSON.stringify(deletedMap)) {
          await setDeletedConversationsMap(cleanedMap);
        }

        setConversations(filteredConvos);
      } else {
        setConversations([]);
      }
    } catch (error: any) {
      // En cas d'erreur (404, 500, réponse non-JSON, ou endpoint inexistant), 
      // on affiche simplement une liste vide sans erreur visible
      // Ne pas logger l'erreur pour éviter de polluer les logs quand il n'y a simplement pas de messages
      if (__DEV__) {
        console.log('[Messages] No conversations available (this is normal if no messages exist)');
      }
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId]);

  const loadSupportMessages = useCallback(async () => {
    if (!sessionId) {
      setSupportMessages([]);
      return;
    }
    try {
      const data = await apiFetch<{ messages: SupportMessage[] }>(
        '/api/messages/direct/driver',
        {
          headers: {
            'X-Driver-Session': sessionId,
          },
        }
      );
      setSupportMessages(data?.messages || []);
    } catch (error) {
      if (__DEV__) {
        console.log('[Messages] No support messages available');
      }
      setSupportMessages([]);
    }
  }, [sessionId]);

  // Recharger quand la session est prête
  useEffect(() => {
    if (sessionId) {
      loadConversations();
      loadSupportMessages();
    }
  }, [sessionId, loadConversations, loadSupportMessages]);


  // Recharger à chaque visite de la page
  useFocusEffect(
    useCallback(() => {
      if (sessionId) {
        loadConversations();
        loadSupportMessages();
      }
    }, [sessionId, loadConversations, loadSupportMessages])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
    loadSupportMessages();
  }, [loadConversations, loadSupportMessages]);

  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Hier';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('fr-FR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }
  };

  // Obtenir le badge de statut
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
      pending: { label: 'En attente', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.2)' },
      accepted: { label: 'Acceptée', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.2)' },
      driver_enroute: { label: 'En route', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.2)' },
      driver_arrived: { label: 'Arrivé', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.2)' },
      in_progress: { label: 'En cours', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.2)' },
      completed: { label: 'Terminée', color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.2)' },
      cancelled: { label: 'Annulée', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.2)' },
    };
    return statusMap[status] || { label: status, color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.2)' };
  };

  // Ouvrir une conversation
  const openConversation = (conversation: Conversation) => {
    router.push({
      pathname: '/(chauffeur)/chat',
      params: {
        orderId: conversation.orderId,
        clientName: conversation.otherPartyName,
      },
    });
  };

  const handleDeleteConversation = (conversation: Conversation) => {
    if (!sessionId) return;
    Alert.alert(
      'Supprimer la conversation',
      'Voulez-vous supprimer toute cette conversation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/messages/conversations/driver/${conversation.orderId}`, {
                method: 'DELETE',
                headers: {
                  'X-Driver-Session': sessionId,
                },
              });
              const deletedMap = await getDeletedConversationsMap();
              deletedMap[conversation.orderId] = Date.now();
              await setDeletedConversationsMap(deletedMap);
              setConversations((prev) =>
                prev.filter((item) => item.orderId !== conversation.orderId)
              );
            } catch (error) {
              console.log('[Messages] Error deleting conversation:', error);
            }
          },
        },
      ]
    );
  };

  const unreadSupportCount = useMemo(
    () => supportMessages.filter((msg) => !msg.isRead && msg.senderType === 'admin').length,
    [supportMessages]
  );

  const latestSupportMessage = useMemo(
    () => supportMessages.find((msg) => msg.senderType === 'admin') || supportMessages[0],
    [supportMessages]
  );

  const openSupportConversation = async () => {
    if (!sessionId) return;
    try {
      await apiFetch('/api/messages/direct/driver/read', {
        method: 'POST',
        headers: {
          'X-Driver-Session': sessionId,
        },
      });
      setSupportMessages((prev) =>
        prev.map((msg) =>
          msg.senderType === 'admin' ? { ...msg, isRead: true } : msg
        )
      );
    } catch (error) {
      console.log('[Messages] Error marking support messages read:', error);
    } finally {
      router.push('/(chauffeur)/support-chat');
    }
  };

  // Rendu d'une conversation
  const renderConversation = ({ item }: { item: Conversation }) => {
    const statusBadge = getStatusBadge(item.orderStatus);

    return (
      <Swipeable
        renderRightActions={() => (
          <TouchableOpacity
            style={styles.deleteAction}
            onPress={() => handleDeleteConversation(item)}
          >
            <Ionicons name="trash" size={18} color="#FFFFFF" />
            <Text style={styles.deleteActionText}>Supprimer</Text>
          </TouchableOpacity>
        )}
      >
        <TouchableOpacity onPress={() => openConversation(item)} activeOpacity={0.7}>
          <Card style={styles.conversationCard}>
            <View style={styles.conversationRow}>
            {/* Avatar */}
            <View style={styles.avatar}>
              <Ionicons name="person" size={22} color="#1a1a1a" />
            </View>

            {/* Contenu */}
            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={styles.clientName} numberOfLines={1}>
                  {item.otherPartyName}
                </Text>
                <Text style={styles.messageDate}>{formatDate(item.lastMessageAt)}</Text>
              </View>

              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage}
              </Text>

              <View style={styles.conversationFooter}>
                <View style={styles.routeInfo}>
                  <Ionicons name="location" size={12} color="#6B7280" />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {item.pickup} → {item.destination}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
                  <Text style={[styles.statusText, { color: statusBadge.color }]}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>
            </View>

            {/* Badge non lu */}
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            )}
            </View>
          </Card>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F5C400" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.supportSection}>
        <TouchableOpacity onPress={openSupportConversation} activeOpacity={0.7}>
          <Card style={styles.supportCard}>
            <View style={styles.conversationRow}>
              <View style={styles.supportAvatar}>
                <Ionicons name="chatbubbles" size={22} color="#1a1a1a" />
              </View>
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.clientName} numberOfLines={1}>
                    Support TĀPE'A
                  </Text>
                  {latestSupportMessage ? (
                    <Text style={styles.messageDate}>
                      {formatDate(latestSupportMessage.createdAt)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.supportCaption}>
                  Service de contact en ligne
                </Text>
                <Text style={styles.lastMessage} numberOfLines={2}>
                  {latestSupportMessage
                    ? latestSupportMessage.content
                    : 'Aucun message du support pour le moment'}
                </Text>
              </View>
              {unreadSupportCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={64} color="#6B7280" />
          </View>
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptySubtitle}>
            Vos conversations avec les clients apparaîtront ici
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.orderId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#F5C400']}
              tintColor="#F5C400"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#252525',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  supportSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  supportCard: {
    marginBottom: 6,
    padding: 14,
    backgroundColor: '#2B2B2B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  supportAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5C400',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    padding: 16,
  },
  conversationCard: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#252525',
    borderRadius: 12,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5C400',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  messageDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  supportCaption: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  lastMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  routeText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  unreadBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F5C400',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  deleteAction: {
    width: 96,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginVertical: 6,
    borderRadius: 12,
  },
  deleteActionText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
