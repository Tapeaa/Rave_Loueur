import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Text } from '@/components/ui/Text';
import { getDriverSessionId, apiFetch, apiPost } from '@/lib/api';
import { getSocket, isSocketConnected, joinRideRoom } from '@/lib/socket';

// API URL pour le fallback HTTP
const API_URL = Constants.expoConfig?.extra?.apiUrl || '';

interface Message {
  id: string;
  orderId: string;
  senderId: string;
  senderType: 'client' | 'driver';
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function DriverChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId: string;
    clientName?: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const orderId = params.orderId;
  const clientName = params.clientName || 'Client';

  // Récupérer la session du chauffeur
  useEffect(() => {
    const loadSession = async () => {
      const sid = await getDriverSessionId();
      setSessionId(sid);
    };
    loadSession();
  }, []);

  // Charger les messages
  const loadMessages = useCallback(async () => {
    if (!orderId || !sessionId) return;

    try {
      const data = await apiFetch<Message[]>(`/api/messages/order/${orderId}/driver`, {
        headers: {
          'X-Driver-Session': sessionId,
        },
      });
      // Gérer le cas où l'API retourne null
      setMessages(data || []);
    } catch (error) {
      console.error('[Chat Driver] Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [orderId, sessionId]);

  // Rejoindre la room de la commande pour recevoir les messages
  useEffect(() => {
    if (!orderId || !sessionId) return;
    
    console.log('[Chat Driver] Joining ride room for order:', orderId);
    joinRideRoom(orderId, 'driver', { sessionId });
  }, [orderId, sessionId]);

  // Écouter les nouveaux messages via Socket.IO
  useEffect(() => {
    if (!orderId) return;

    const socket = getSocket();
    if (!socket) {
      console.log('[Chat Driver] No socket available for listening to messages');
      return;
    }

    console.log('[Chat Driver] Setting up chat:message listener');

    const handleNewMessage = (data: { orderId: string; message: Message }) => {
      console.log('[Chat Driver] Received chat:message event:', { orderId: data.orderId, messageId: data.message?.id });
      if (data.orderId === orderId) {
        setMessages(prev => {
          // Éviter les doublons
          if (prev.some(m => m.id === data.message.id)) return prev;
          console.log('[Chat Driver] Adding new message to state');
          return [...prev, data.message];
        });

        // Scroll vers le bas
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    socket.on('chat:message', handleNewMessage);

    // Marquer les messages comme lus
    if (sessionId && isSocketConnected()) {
      socket.emit('chat:read', { orderId, role: 'driver', sessionId });
    }

    return () => {
      socket.off('chat:message', handleNewMessage);
    };
  }, [orderId, sessionId]);

  // Charger les messages quand la session est prête
  useEffect(() => {
    if (sessionId) {
      loadMessages();
    }
  }, [sessionId, loadMessages]);

  // Scroll vers le bas quand les messages changent
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length]);

  // Envoyer un message
  const sendMessage = async () => {
    console.log('[Chat Driver] sendMessage called', { newMessage: newMessage.trim(), sending, orderId, sessionId: sessionId ? 'present' : 'missing' });
    
    if (!newMessage.trim() || sending || !orderId || !sessionId) {
      console.log('[Chat Driver] sendMessage aborted - missing data');
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const socket = getSocket();
      const socketConnected = isSocketConnected();
      console.log('[Chat Driver] Socket status:', { hasSocket: !!socket, socketConnected });
      
      // Envoyer via Socket.IO pour temps réel si connecté
      if (socket && socketConnected) {
        console.log('[Chat Driver] Sending via Socket.IO...');
        socket.emit('chat:send:driver', {
          orderId,
          sessionId,
          content: messageContent,
        });
        console.log('[Chat Driver] Message emitted via Socket.IO');
        // Attendre un peu et recharger les messages au cas où l'event ne revient pas
        setTimeout(() => loadMessages(), 500);
      } else {
        // Fallback API HTTP
        console.log('[Chat Driver] Sending via HTTP fallback...');
        const response = await fetch(`${API_URL}/api/messages/send/driver`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Driver-Session': sessionId,
          },
          body: JSON.stringify({
            orderId,
            content: messageContent,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        // Recharger les messages
        await loadMessages();
      }
    } catch (error) {
      console.error('[Chat] Error sending message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
      setNewMessage(messageContent); // Restaurer le message
    } finally {
      setSending(false);
    }
  };

  // Formater l'heure
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Rendu d'un message
  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderType === 'driver';

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime
          ]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{clientName}</Text>
            <Text style={styles.headerSubtitle}>Chargement...</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F5C400" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{clientName}</Text>
          <Text style={styles.headerSubtitle}>
            {messages.length > 0 ? `${messages.length} message${messages.length > 1 ? 's' : ''}` : 'Commencer la discussion'}
          </Text>
        </View>
        <View style={styles.headerAvatar}>
          <Ionicons name="person" size={20} color="#1a1a1a" />
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={48} color="#6B7280" />
            </View>
            <Text style={styles.emptyTitle}>Aucun message</Text>
            <Text style={styles.emptySubtitle}>
              Envoyez un message au client pour commencer la discussion
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Écrire un message..."
              placeholderTextColor="#6B7280"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={1000}
              editable={!sending}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#1a1a1a" />
            ) : (
              <Ionicons name="send" size={20} color="#1a1a1a" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#252525',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5C400',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoid: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageContainer: {
    marginBottom: 8,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#F5C400',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#333',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#1a1a1a',
  },
  otherMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(0, 0, 0, 0.5)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#6B7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#252525',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    maxHeight: 100,
  },
  input: {
    fontSize: 15,
    color: '#FFFFFF',
    maxHeight: 80,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5C400',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#444',
  },
});
