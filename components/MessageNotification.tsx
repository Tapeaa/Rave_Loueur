import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getSocket } from '@/lib/socket';
import { getDriverSessionId } from '@/lib/api';

interface NotificationMessage {
  id: string;
  orderId: string;
  content: string;
  clientName: string;
  timestamp: number;
}

const { width } = Dimensions.get('window');

export default function DriverMessageNotification() {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const router = useRouter();
  const slideAnims = useRef<Map<string, Animated.Value>>(new Map());

  // Get session ID on mount
  useEffect(() => {
    const loadSession = async () => {
      const sid = await getDriverSessionId();
      setSessionId(sid);
    };
    loadSession();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for chat notifications from clients
    const handleNotification = (data: { 
      orderId: string; 
      message: { id: string; content: string; createdAt: string; senderType?: string }; 
      clientName?: string;
      fromClient?: boolean;
    }) => {
      // Only show notifications from clients
      if (data.message?.senderType === 'driver') return;
      
      const newNotif: NotificationMessage = {
        id: data.message.id,
        orderId: data.orderId,
        content: data.message.content,
        clientName: data.clientName || 'Client',
        timestamp: Date.now(),
      };

      // Create animation for this notification
      const anim = new Animated.Value(-100);
      slideAnims.current.set(newNotif.id, anim);

      setNotifications(prev => {
        // Don't add duplicate notifications
        if (prev.some(n => n.id === newNotif.id)) return prev;
        return [...prev, newNotif];
      });

      // Animate in
      Animated.spring(anim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        dismissNotification(newNotif.id);
      }, 10000);
    };

    // Use specific named handlers to avoid conflicts with chat.tsx listeners
    const handleChatNotification = (data: any) => {
      console.log('[DriverNotif] Received chat:notification:', data);
      if (data.fromClient || data.message?.senderType === 'client') {
        handleNotification(data);
      }
    };
    
    const handleChatMessage = (data: any) => {
      console.log('[DriverNotif] Received chat:message:', data.message?.senderType);
      if (data.message?.senderType === 'client') {
        handleNotification({
          orderId: data.orderId,
          message: data.message,
          clientName: 'Client',
          fromClient: true,
        });
      }
    };

    // Listen for notifications specifically for drivers
    socket.on('chat:notification', handleChatNotification);

    // Also listen for regular chat messages (but don't remove other listeners on cleanup)
    socket.on('chat:message', handleChatMessage);

    return () => {
      // Only remove our specific handlers
      socket.off('chat:notification', handleChatNotification);
      socket.off('chat:message', handleChatMessage);
    };
  }, []);

  const dismissNotification = (id: string) => {
    const anim = slideAnims.current.get(id);
    if (anim) {
      Animated.timing(anim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        slideAnims.current.delete(id);
      });
    } else {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const openChat = async (notification: NotificationMessage) => {
    dismissNotification(notification.id);
    
    router.push({
      pathname: '/(chauffeur)/chat',
      params: {
        orderId: notification.orderId,
        clientName: notification.clientName,
        sessionId: sessionId || '',
      },
    });
  };

  if (notifications.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {notifications.map((notif) => {
        const anim = slideAnims.current.get(notif.id) || new Animated.Value(0);
        
        return (
          <Animated.View 
            key={notif.id} 
            style={[
              styles.notification,
              { transform: [{ translateY: anim }] }
            ]}
          >
            <TouchableOpacity 
              style={styles.notificationContent}
              onPress={() => openChat(notif)}
              activeOpacity={0.9}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="chatbubble-ellipses" size={24} color="#1a1a1a" />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.clientName} numberOfLines={1}>
                  {notif.clientName}
                </Text>
                <Text style={styles.messageText} numberOfLines={2}>
                  {notif.content}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => dismissNotification(notif.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  notification: {
    width: width - 24,
    marginBottom: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  textContainer: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#22C55E',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  messageText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
