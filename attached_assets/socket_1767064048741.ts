import { io, Socket } from "socket.io-client";
import type { Order } from "@shared/schema";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export async function connectSocketAsync(): Promise<Socket> {
  const s = getSocket();
  
  if (s.connected) {
    return s;
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Socket connection timeout"));
    }, 10000);
    
    s.once("connect", () => {
      clearTimeout(timeout);
      console.log("Socket connected successfully");
      resolve(s);
    });
    
    s.once("connect_error", (error) => {
      clearTimeout(timeout);
      console.error("Socket connection error:", error);
      reject(error);
    });
    
    s.connect();
  });
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export async function joinDriverSessionAsync(sessionId: string): Promise<boolean> {
  try {
    const s = await connectSocketAsync();
    
    return new Promise((resolve) => {
      s.emit("driver:join", { sessionId }, (ack: { success: boolean }) => {
        if (ack?.success) {
          console.log("Joined driver session successfully:", sessionId);
          resolve(true);
        } else {
          console.warn("Join driver session failed:", sessionId);
          resolve(false);
        }
      });
      
      setTimeout(() => {
        console.log("Join session no ack, assuming success");
        resolve(true);
      }, 3000);
    });
  } catch (error) {
    console.error("Failed to join driver session:", error);
    return false;
  }
}

export function joinDriverSession(sessionId: string): void {
  const s = connectSocket();
  s.emit("driver:join", { sessionId });
}

export function updateDriverStatus(sessionId: string, isOnline: boolean): void {
  const s = getSocket();
  console.log(`[DEBUG] updateDriverStatus called: sessionId=${sessionId}, isOnline=${isOnline}, socket.connected=${s.connected}`);
  if (s.connected) {
    s.emit("driver:status", { sessionId, isOnline });
    console.log(`[DEBUG] driver:status event emitted`);
  } else {
    console.warn("Socket not connected, cannot update driver status");
  }
}

export function acceptOrder(orderId: string, sessionId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("order:accept", { orderId, sessionId });
  }
}

export function declineOrder(orderId: string, sessionId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("order:decline", { orderId, sessionId });
  }
}

// Event listeners
export function onNewOrder(callback: (order: Order) => void): () => void {
  const s = getSocket();
  console.log(`[DEBUG] Registering onNewOrder listener on socket ${s.id}, connected: ${s.connected}`);
  s.on("order:new", (order) => {
    console.log(`[DEBUG] order:new event received:`, order);
    callback(order);
  });
  return () => s.off("order:new", callback);
}

export function onPendingOrders(callback: (orders: Order[]) => void): () => void {
  const s = getSocket();
  s.on("orders:pending", callback);
  return () => s.off("orders:pending", callback);
}

export function onOrderTaken(callback: (data: { orderId: string }) => void): () => void {
  const s = getSocket();
  s.on("order:taken", callback);
  return () => s.off("order:taken", callback);
}

export function onOrderExpired(callback: (data: { orderId: string }) => void): () => void {
  const s = getSocket();
  s.on("order:expired", callback);
  return () => s.off("order:expired", callback);
}

export function onOrderAcceptSuccess(callback: (order: Order) => void): () => void {
  const s = getSocket();
  s.on("order:accept:success", callback);
  return () => s.off("order:accept:success", callback);
}

export function onOrderAcceptError(callback: (data: { message: string }) => void): () => void {
  const s = getSocket();
  s.on("order:accept:error", callback);
  return () => s.off("order:accept:error", callback);
}

export function onOrderDeclineSuccess(callback: (data: { orderId: string }) => void): () => void {
  const s = getSocket();
  s.on("order:decline:success", callback);
  return () => s.off("order:decline:success", callback);
}

// Client-side events for order status
export function joinClientSession(orderId: string, clientToken?: string): void {
  const s = connectSocket();
  s.emit("client:join", { orderId, clientToken });
  console.log(`[DEBUG] client:join emitted: ${orderId} with token: ${clientToken ? 'yes' : 'no'}`);
}

export function onDriverAssigned(callback: (data: { 
  orderId: string;
  driverName: string;
  driverId: string;
  sessionId: string;
}) => void): () => void {
  const s = getSocket();
  s.on("order:driver:assigned", callback);
  return () => s.off("order:driver:assigned", callback);
}

export function onOrderCancelled(callback: (data: { orderId: string; reason: string }) => void): () => void {
  const s = getSocket();
  s.on("order:cancelled", callback);
  return () => s.off("order:cancelled", callback);
}

// Ride status events
export function updateRideStatus(orderId: string, sessionId: string, status: "enroute" | "arrived" | "inprogress" | "completed"): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("ride:status:update", { orderId, sessionId, status });
    console.log(`[DEBUG] ride:status:update emitted: ${orderId} -> ${status}`);
  }
}

export function joinRideRoom(
  orderId: string, 
  role: 'driver' | 'client' = 'driver',
  credentials?: { sessionId?: string; clientToken?: string }
): void {
  const s = getSocket();
  const payload = { orderId, role, ...credentials };
  
  if (s.connected) {
    s.emit("ride:join", payload);
    console.log(`[DEBUG] Joined ride room: ${orderId} as ${role}`);
  } else {
    // Queue the join for when socket connects
    s.once("connect", () => {
      s.emit("ride:join", payload);
      console.log(`[DEBUG] Joined ride room after connect: ${orderId} as ${role}`);
    });
    s.connect();
  }
}

export function onRideStatusChanged(callback: (data: {
  orderId: string;
  status: "enroute" | "arrived" | "inprogress" | "completed";
  orderStatus: string;
  driverName: string;
}) => void): () => void {
  const s = getSocket();
  s.on("ride:status:changed", callback);
  return () => s.off("ride:status:changed", callback);
}

export function onRideStatusError(callback: (data: { message: string }) => void): () => void {
  const s = getSocket();
  s.on("ride:status:error", callback);
  return () => s.off("ride:status:error", callback);
}

// Payment events
export function confirmPayment(
  orderId: string, 
  confirmed: boolean, 
  role: 'driver' | 'client', 
  credentials?: { sessionId?: string; clientToken?: string }
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("payment:confirm", { orderId, confirmed, role, ...credentials });
    console.log(`[DEBUG] payment:confirm emitted: ${orderId} -> ${confirmed} (${role})`);
  }
}

export function onPaymentStatus(callback: (data: {
  orderId: string;
  status: string;
  confirmed: boolean;
  driverConfirmed?: boolean;
  clientConfirmed?: boolean;
  amount?: number;
  paymentMethod?: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  errorMessage?: string;
}) => void): () => void {
  const s = getSocket();
  s.on("payment:status", callback);
  return () => s.off("payment:status", callback);
}

// Payment retry - client requests to retry payment after updating card
export function retryPayment(orderId: string, clientToken: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("payment:retry", { orderId, clientToken });
    console.log(`[DEBUG] payment:retry emitted: ${orderId}`);
  }
}

export function onPaymentRetryReady(callback: (data: {
  orderId: string;
  message: string;
}) => void): () => void {
  const s = getSocket();
  s.on("payment:retry:ready", callback);
  return () => s.off("payment:retry:ready", callback);
}

// Switch to cash payment
export function switchToCashPayment(orderId: string, clientToken: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("payment:switch-cash", { orderId, clientToken });
    console.log(`[DEBUG] payment:switch-cash emitted: ${orderId}`);
  }
}

export function onPaymentSwitchedToCash(callback: (data: {
  orderId: string;
  amount: number;
  message: string;
}) => void): () => void {
  const s = getSocket();
  s.on("payment:switched-to-cash", callback);
  return () => s.off("payment:switched-to-cash", callback);
}

// Ride cancellation - unilateral, either party can cancel
export function cancelRide(
  orderId: string, 
  role: 'driver' | 'client', 
  reason?: string,
  credentials?: { sessionId?: string; clientToken?: string }
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("ride:cancel", { orderId, role, reason, ...credentials });
    console.log(`[DEBUG] ride:cancel emitted: ${orderId} by ${role}`);
  }
}

export function onRideCancelled(callback: (data: {
  orderId: string;
  cancelledBy: 'driver' | 'client';
  reason: string;
}) => void): () => void {
  const s = getSocket();
  s.on("ride:cancelled", callback);
  return () => s.off("ride:cancelled", callback);
}

// Real-time location tracking
export interface LocationUpdate {
  orderId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

// Calculate heading (bearing) between two GPS coordinates
export function calculateHeading(
  prevLat: number, prevLng: number,
  currLat: number, currLng: number
): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;
  
  const dLng = toRad(currLng - prevLng);
  const lat1 = toRad(prevLat);
  const lat2 = toRad(currLat);
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360; // Normalize to 0-360
}

// Driver emits their location
export function emitDriverLocation(
  orderId: string,
  sessionId: string,
  lat: number,
  lng: number,
  heading?: number,
  speed?: number
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("location:driver:update", {
      orderId,
      sessionId,
      lat,
      lng,
      heading,
      speed,
      timestamp: Date.now()
    });
  }
}

// Client emits their location
export function emitClientLocation(
  orderId: string,
  clientToken: string,
  lat: number,
  lng: number
): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("location:client:update", {
      orderId,
      clientToken,
      lat,
      lng,
      timestamp: Date.now()
    });
  }
}

// Listen for driver location updates (client side)
export function onDriverLocationUpdate(callback: (data: LocationUpdate) => void): () => void {
  const s = getSocket();
  s.on("location:driver", callback);
  return () => s.off("location:driver", callback);
}

// Listen for client location updates (driver side)
export function onClientLocationUpdate(callback: (data: LocationUpdate) => void): () => void {
  const s = getSocket();
  s.on("location:client", callback);
  return () => s.off("location:client", callback);
}
