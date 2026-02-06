import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { randomBytes } from "crypto";
import webpush from "web-push";
import { z } from "zod";
import Stripe from "stripe";
import { storage } from "./storage";
import { verifyPassword, hashPassword, dbStorage } from "./db-storage";
import { insertOrderSchema, pushSubscriptionSchema, insertClientSchema, type Order, type OrderStatus } from "@shared/schema";
import cookieParser from "cookie-parser";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || "";

// Validation schemas for profile updates
const updateClientProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
});

const updateDriverProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  vehicleModel: z.string().max(100).optional().nullable(),
  vehicleColor: z.string().max(50).optional().nullable(),
  vehiclePlate: z.string().max(20).optional().nullable(),
});

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@tapea.pf";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("[PUSH] Web push configured with VAPID keys");
} else {
  console.warn("[PUSH] VAPID keys not configured - push notifications disabled");
}

// Function to send push notifications to all subscribed drivers
async function sendPushToAllDrivers(order: Order) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("[PUSH] Skipping push - VAPID not configured");
    return;
  }
  
  const subscriptions = await storage.getAllPushSubscriptions();
  console.log(`[PUSH] Sending push notifications to ${subscriptions.length} drivers`);
  
  const pickupAddress = order.addresses.find(a => a.type === "pickup")?.value || "Adresse inconnue";
  
  const payload = JSON.stringify({
    title: "Nouvelle course disponible",
    body: `${order.clientName} - ${pickupAddress}`,
    url: "/chauffeur",
    orderId: order.id,
  });
  
  for (const driverSub of subscriptions) {
    try {
      await webpush.sendNotification(driverSub.subscription, payload);
      console.log(`[PUSH] Notification sent to driver ${driverSub.driverId}`);
    } catch (error: any) {
      console.error(`[PUSH] Failed to send to driver ${driverSub.driverId}:`, error.message);
      // If subscription is invalid (410 Gone), remove it
      if (error.statusCode === 410) {
        await storage.removePushSubscription(driverSub.driverId);
        console.log(`[PUSH] Removed invalid subscription for driver ${driverSub.driverId}`);
      }
    }
  }
}

// Socket.IO instance export for use in other modules
let io: SocketIOServer;

// Track payment confirmations (requires both driver and client to confirm)
const paymentConfirmations = new Map<string, { 
  driver: boolean; 
  client: boolean; 
  driverSocketId: string | null;
  clientSocketId: string | null;
}>();

// Track payments currently being processed to prevent duplicate charges
const paymentsInProgress = new Map<string, boolean>();

// Track client authentication tokens for each order (token generated at order creation)
const orderClientTokens = new Map<string, { token: string; socketId: string | null }>();
// Store latest driver locations for HTTP polling backup
const driverLocations = new Map<string, { lat: number; lng: number; heading: number; speed?: number; timestamp: number }>();

// Generate a secure random token
function generateClientToken(): string {
  return randomBytes(16).toString('hex');
}

export function getIO(): SocketIOServer {
  return io;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize Socket.IO
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO connection handling
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    // Driver joins their session room
    socket.on("driver:join", async (data: { sessionId: string }, callback?: (ack: { success: boolean }) => void) => {
      console.log(`[DEBUG] driver:join received from socket ${socket.id}, sessionId: ${data.sessionId}`);
      const session = await storage.getDriverSession(data.sessionId);
      if (session) {
        await storage.addSocketToSession(data.sessionId, socket.id);
        socket.join(`driver:${session.driverId}`);
        // Note: Don't join drivers:online here - wait for driver:status with isOnline=true
        console.log(`Driver ${session.driverName} joined with socket ${socket.id} (waiting for status to go online)`);
        
        if (callback) callback({ success: true });
      } else {
        console.log(`[DEBUG] driver:join - session not found for ${data.sessionId}`);
        if (callback) callback({ success: false });
      }
    });
    
    // Client joins to track their order (requires valid client token)
    socket.on("client:join", (data: { orderId: string; clientToken?: string }) => {
      const tokenData = orderClientTokens.get(data.orderId);
      
      // Validate the client token
      if (!tokenData) {
        console.log(`Client socket ${socket.id} tried to join unknown order: ${data.orderId}`);
        socket.emit("client:join:error", { message: "Commande non trouvée" });
        return;
      }
      
      if (!data.clientToken || tokenData.token !== data.clientToken) {
        console.log(`Client socket ${socket.id} provided invalid token for order: ${data.orderId}`);
        socket.emit("client:join:error", { message: "Token client invalide" });
        return;
      }
      
      // Prevent token replay: only allow binding if not already bound to a different socket
      if (tokenData.socketId && tokenData.socketId !== socket.id) {
        // Check if the existing socket is still connected
        const existingSocket = io.sockets.sockets.get(tokenData.socketId);
        if (existingSocket && existingSocket.connected) {
          console.log(`Client socket ${socket.id} rejected: token already bound to ${tokenData.socketId}`);
          socket.emit("client:join:error", { message: "Session déjà active sur un autre appareil" });
          return;
        }
        // Existing socket is disconnected, allow rebinding
        console.log(`Client socket ${socket.id} rebinding token (old socket ${tokenData.socketId} disconnected)`);
      }
      
      // Register the authenticated socket
      tokenData.socketId = socket.id;
      orderClientTokens.set(data.orderId, tokenData);
      
      socket.join(`order:${data.orderId}`);
      console.log(`Client socket ${socket.id} authenticated and joined order room: ${data.orderId}`);
    });
    
    // Driver goes online/offline
    socket.on("driver:status", async (data: { sessionId: string; isOnline: boolean }) => {
      console.log(`[DEBUG] driver:status received from socket ${socket.id}, sessionId: ${data.sessionId}, isOnline: ${data.isOnline}`);
      const session = await storage.updateDriverOnlineStatus(data.sessionId, data.isOnline);
      if (session) {
        if (data.isOnline) {
          socket.join("drivers:online");
          // Debug: verify room membership
          const driversRoom = io.sockets.adapter.rooms.get("drivers:online");
          console.log(`[DEBUG] Driver ${session.driverName} joined drivers:online, room now has ${driversRoom?.size || 0} socket(s)`);
          
          // Send pending orders to the newly online driver
          const pendingOrders = await dbStorage.getPendingOrders();
          if (pendingOrders.length > 0) {
            socket.emit("orders:pending", pendingOrders);
            console.log(`[DEBUG] Sent ${pendingOrders.length} pending orders to driver ${session.driverName}`);
          }
        } else {
          socket.leave("drivers:online");
          console.log(`[DEBUG] Driver ${session.driverName} left drivers:online`);
        }
        console.log(`Driver ${session.driverName} is now ${data.isOnline ? 'online' : 'offline'}`);
      } else {
        console.log(`[DEBUG] driver:status - session not found for ${data.sessionId}`);
      }
    });
    
    // Driver accepts an order
    socket.on("order:accept", async (data: { orderId: string; sessionId: string }) => {
      console.log(`[DEBUG] order:accept received - orderId: ${data.orderId}, sessionId: ${data.sessionId}`);
      
      const session = await storage.getDriverSession(data.sessionId);
      const order = await dbStorage.getOrder(data.orderId);
      
      console.log(`[DEBUG] Session found: ${session ? session.driverName : 'NO'}, Order found: ${order ? 'YES' : 'NO'}, Order status: ${order?.status || 'N/A'}`);
      
      if (!session || !order) {
        console.log(`[DEBUG] order:accept:error - Session or order invalid`);
        socket.emit("order:accept:error", { message: "Session ou commande invalide" });
        return;
      }
      
      if (order.status !== "pending") {
        console.log(`[DEBUG] order:accept:error - Order status is ${order.status}, not pending`);
        socket.emit("order:accept:error", { message: "Cette commande n'est plus disponible" });
        return;
      }
      
      // Update order status
      const updatedOrder = await dbStorage.updateOrderStatus(data.orderId, "accepted", session.driverId);
      
      if (updatedOrder) {
        // Notify the accepting driver
        socket.emit("order:accept:success", updatedOrder);
        
        // Notify all other drivers to remove this order
        socket.to("drivers:online").emit("order:taken", { orderId: data.orderId });
        
        // Notify the client that their order has been accepted
        io.to(`order:${data.orderId}`).emit("order:driver:assigned", {
          orderId: data.orderId,
          driverName: session.driverName,
          driverId: session.driverId,
          sessionId: session.id
        });
        
        console.log(`Order ${data.orderId} accepted by driver ${session.driverName}`);
      }
    });
    
    // Driver declines an order
    socket.on("order:decline", async (data: { orderId: string; sessionId: string }) => {
      console.log(`Driver declined order ${data.orderId}`);
      // Just acknowledge - order stays pending for other drivers
      socket.emit("order:decline:success", { orderId: data.orderId });
    });
    
    // Driver updates ride status (enroute, arrived, inprogress, completed)
    socket.on("ride:status:update", async (data: { 
      orderId: string; 
      sessionId: string; 
      status: "enroute" | "arrived" | "inprogress" | "completed";
    }) => {
      console.log(`[DEBUG] ride:status:update - orderId: ${data.orderId}, status: ${data.status}`);
      
      const session = await storage.getDriverSession(data.sessionId);
      const order = await dbStorage.getOrder(data.orderId);
      
      if (!session || !order) {
        socket.emit("ride:status:error", { message: "Session ou commande invalide" });
        return;
      }
      
      // Verify this driver is assigned to this order
      if (order.assignedDriverId !== session.driverId) {
        socket.emit("ride:status:error", { message: "Vous n'êtes pas assigné à cette course" });
        return;
      }
      
      // Map ride status to order status
      let orderStatus: OrderStatus;
      switch (data.status) {
        case "enroute":
          orderStatus = "driver_enroute";
          break;
        case "arrived":
          orderStatus = "driver_arrived";
          break;
        case "inprogress":
          orderStatus = "in_progress";
          break;
        case "completed":
          orderStatus = "completed";
          break;
        default:
          orderStatus = "accepted";
      }
      
      const updatedOrder = await dbStorage.updateOrderStatus(data.orderId, orderStatus);
      
      if (updatedOrder) {
        // Notify both driver and client about the status change
        io.to(`order:${data.orderId}`).emit("ride:status:changed", {
          orderId: data.orderId,
          status: data.status,
          orderStatus: orderStatus,
          driverName: session.driverName
        });
        
        console.log(`Ride status updated: ${data.orderId} -> ${data.status}`);
      }
    });
    
    // Payment confirmation - SIMPLIFIED: Driver confirmation alone completes the payment
    socket.on("payment:confirm", async (data: { orderId: string; confirmed: boolean; role: 'driver' | 'client'; sessionId?: string; clientToken?: string }) => {
      console.log(`[DEBUG] payment:confirm - orderId: ${data.orderId}, confirmed: ${data.confirmed}, role: ${data.role}`);
      
      const order = await dbStorage.getOrder(data.orderId);
      if (!order) {
        socket.emit("payment:error", { message: "Commande non trouvée" });
        return;
      }

      // Only driver can confirm payment (simplified flow)
      if (data.role === 'driver') {
        if (!data.sessionId) {
          socket.emit("payment:error", { message: "Session manquante" });
          return;
        }
        const session = await storage.getDriverSession(data.sessionId);
        if (!session) {
          socket.emit("payment:error", { message: "Session invalide" });
          return;
        }
        // Don't require socket to be in session.socketIds - just verify session and driver assignment
        if (order.assignedDriverId !== session.driverId) {
          socket.emit("payment:error", { message: "Vous n'êtes pas le chauffeur de cette course" });
          return;
        }
        
        if (data.confirmed) {
          // Check if payment is already in progress to prevent duplicate charges
          if (paymentsInProgress.get(data.orderId)) {
            console.log(`[DEBUG] Payment already in progress for order ${data.orderId}, ignoring duplicate request`);
            // Emit via payment:status so frontend can handle with existing listeners
            io.to(`order:${data.orderId}`).emit("payment:status", {
              orderId: data.orderId,
              status: "payment_processing",
              confirmed: false,
              message: "Un paiement est déjà en cours de traitement"
            });
            return;
          }
          
          // Mark payment as in progress to prevent duplicate charges
          paymentsInProgress.set(data.orderId, true);
          // Driver confirms payment
          let paymentSuccess = true;
          let stripeError = null;
          
          // If payment method is card, notify that processing is starting
          if (order.paymentMethod === "card" && order.clientId) {
            io.to(`order:${data.orderId}`).emit("payment:status", {
              orderId: data.orderId,
              status: "payment_processing",
              confirmed: false,
            });
          }
          
          // Variables to store card info for success message
          let cardBrand: string | null = null;
          let cardLast4: string | null = null;
          
          // If payment method is card, process Stripe payment
          if (order.paymentMethod === "card" && order.clientId) {
            try {
              // Get client's default payment method
              const paymentMethods = await dbStorage.getPaymentMethods(order.clientId);
              const defaultMethod = paymentMethods.find(m => m.isDefault) || paymentMethods[0];
              
              if (defaultMethod?.stripePaymentMethodId) {
                // Store card info for success message
                cardBrand = defaultMethod.brand;
                cardLast4 = defaultMethod.last4;
                
                console.log(`[DEBUG] Found default payment method ${defaultMethod.stripePaymentMethodId} for client ${order.clientId}`);
                // Get Stripe customer
                const stripeCustomer = await dbStorage.getStripeCustomer(order.clientId);
                
                if (stripeCustomer) {
                  console.log(`[DEBUG] Found Stripe customer ${stripeCustomer.stripeCustomerId}`);
                  // Create and confirm PaymentIntent
                  // IMPORTANT: We use off_session: true to charge the saved card without user presence
                  // However, if the card requires SCA (3D Secure), it will fail with "requires_action"
                  const paymentIntent = await stripe.paymentIntents.create({
                    amount: Math.round(order.totalPrice),
                    currency: "xpf",
                    customer: stripeCustomer.stripeCustomerId,
                    payment_method: defaultMethod.stripePaymentMethodId,
                    confirm: true,
                    off_session: true,
                    confirmation_method: "automatic",
                    metadata: { orderId: data.orderId, clientId: order.clientId },
                  });
                  
                  console.log(`[DEBUG] PaymentIntent status: ${paymentIntent.status} for order ${data.orderId}`);
                  
                  if (paymentIntent.status === "succeeded") {
                    // Create invoice record
                    await dbStorage.createInvoice({
                      clientId: order.clientId,
                      orderId: data.orderId,
                      amount: order.totalPrice,
                      stripePaymentIntentId: paymentIntent.id,
                    });
                    console.log(`[DEBUG] Stripe payment successful for order ${data.orderId}`);
                  } else if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_confirmation") {
                    // Handle SCA (3D Secure) - The payment requires customer authentication
                    paymentSuccess = false;
                    stripeError = "Authentification 3D Secure requise. Veuillez ouvrir l'application pour confirmer.";
                    console.log(`[DEBUG] Stripe payment requires SCA for order ${data.orderId}`);
                  } else {
                    paymentSuccess = false;
                    stripeError = `Paiement échoué: ${paymentIntent.status}`;
                  }
                } else {
                  paymentSuccess = false;
                  stripeError = "Compte Stripe non configuré";
                }
              } else {
                paymentSuccess = false;
                stripeError = "Aucune carte enregistrée";
              }
            } catch (stripeErr: unknown) {
              paymentSuccess = false;
              stripeError = stripeErr instanceof Error ? stripeErr.message : "Erreur Stripe";
              console.error(`[DEBUG] Stripe payment error for order ${data.orderId}:`, stripeErr);
            }
          }
          
          if (paymentSuccess) {
            await dbStorage.updateOrderStatus(data.orderId, "payment_confirmed");
            paymentConfirmations.delete(data.orderId);
            paymentsInProgress.delete(data.orderId);
            orderClientTokens.delete(data.orderId);
            
            io.to(`order:${data.orderId}`).emit("payment:status", {
              orderId: data.orderId,
              status: "payment_confirmed",
              confirmed: true,
              driverConfirmed: true,
              clientConfirmed: true,
              amount: order.totalPrice,
              paymentMethod: order.paymentMethod,
              cardBrand: cardBrand,
              cardLast4: cardLast4
            });
            console.log(`[DEBUG] Payment confirmed by driver for order ${data.orderId}`);
          } else {
            // Stripe payment failed - keep status as payment_pending to allow retry
            // Do NOT change status to payment_failed - this allows client to retry payment
            paymentConfirmations.delete(data.orderId);
            paymentsInProgress.delete(data.orderId);
            // Keep orderClientTokens so client can retry
            
            io.to(`order:${data.orderId}`).emit("payment:status", {
              orderId: data.orderId,
              status: "payment_failed",
              confirmed: false,
              amount: order.totalPrice,
              errorMessage: stripeError || "Le paiement n'a pas pu être effectué",
              paymentMethod: order.paymentMethod,
              cardBrand: cardBrand,
              cardLast4: cardLast4
            });
            console.log(`[DEBUG] Stripe payment failed for order ${data.orderId}: ${stripeError} - keeping status as payment_pending for retry`);
          }
        } else {
          // Driver rejects payment - keep status as payment_pending to allow client to resolve
          paymentConfirmations.delete(data.orderId);
          paymentsInProgress.delete(data.orderId);
          // Keep orderClientTokens so client can retry or switch to cash
          
          io.to(`order:${data.orderId}`).emit("payment:status", {
            orderId: data.orderId,
            status: "payment_failed",
            confirmed: false,
            driverConfirmed: false,
            clientConfirmed: false,
            amount: order.totalPrice,
            paymentMethod: order.paymentMethod,
            errorMessage: "Le chauffeur a refusé le paiement"
          });
          console.log(`[DEBUG] Driver rejected payment for order ${data.orderId} - keeping status as payment_pending for retry`);
        }
      } else {
        // Client confirmation is informational only (not required)
        console.log(`[DEBUG] Client payment confirmation received but not required: ${data.orderId}`);
      }
    });
    
    // Payment retry - client requests to retry payment with their new/updated card
    socket.on("payment:retry", async (data: { orderId: string; clientToken: string }) => {
      console.log(`[DEBUG] payment:retry - orderId: ${data.orderId}`);
      
      const order = await dbStorage.getOrder(data.orderId);
      if (!order) {
        socket.emit("payment:retry:error", { message: "Commande non trouvée" });
        return;
      }
      
      // Verify client token
      const tokenData = orderClientTokens.get(data.orderId);
      if (!tokenData || tokenData.token !== data.clientToken) {
        socket.emit("payment:retry:error", { message: "Token client invalide" });
        return;
      }
      
      // Reset order to payment_pending status
      await dbStorage.updateOrderStatus(data.orderId, "payment_pending");
      
      // Reinitialize payment confirmation tracking
      paymentConfirmations.set(data.orderId, {
        driver: false,
        client: false,
        driverSocketId: null,
        clientSocketId: socket.id
      });
      
      // Notify driver that client wants to retry payment
      io.to(`order:${data.orderId}`).emit("payment:retry:ready", {
        orderId: data.orderId,
        message: "Le client a mis à jour sa carte. Prêt à réessayer le paiement."
      });
      
      console.log(`[DEBUG] Payment retry initialized for order ${data.orderId}`);
    });
    
    // Switch to cash payment - client wants to pay in cash instead
    socket.on("payment:switch-cash", async (data: { orderId: string; clientToken: string }) => {
      console.log(`[DEBUG] payment:switch-cash - orderId: ${data.orderId}`);
      
      const order = await dbStorage.getOrder(data.orderId);
      if (!order) {
        socket.emit("payment:switch-cash:error", { message: "Commande non trouvée" });
        return;
      }
      
      // Verify client token
      const tokenData = orderClientTokens.get(data.orderId);
      if (!tokenData || tokenData.token !== data.clientToken) {
        socket.emit("payment:switch-cash:error", { message: "Token client invalide" });
        return;
      }
      
      // Update order payment method to cash
      await dbStorage.updateOrderPaymentMethod(data.orderId, "cash");
      await dbStorage.updateOrderStatus(data.orderId, "payment_pending");
      
      // Reinitialize payment confirmation tracking
      paymentConfirmations.set(data.orderId, {
        driver: false,
        client: false,
        driverSocketId: null,
        clientSocketId: socket.id
      });
      
      // Notify driver that client wants to pay in cash
      io.to(`order:${data.orderId}`).emit("payment:switched-to-cash", {
        orderId: data.orderId,
        amount: order.totalPrice,
        message: "Le client souhaite payer en espèces"
      });
      
      console.log(`[DEBUG] Payment switched to cash for order ${data.orderId}`);
    });
    
    // Unilateral ride cancellation - either party can cancel at any time
    socket.on("ride:cancel", async (data: { orderId: string; role: 'driver' | 'client'; reason?: string; sessionId?: string; clientToken?: string }) => {
      console.log(`[DEBUG] ride:cancel - orderId: ${data.orderId}, role: ${data.role}, reason: ${data.reason}`);
      
      const order = await dbStorage.getOrder(data.orderId);
      if (!order) {
        socket.emit("ride:cancel:error", { message: "Commande non trouvée" });
        return;
      }
      
      // Validate the cancellation request
      if (data.role === 'driver') {
        if (!data.sessionId) {
          socket.emit("ride:cancel:error", { message: "Session manquante" });
          return;
        }
        const session = await storage.getDriverSession(data.sessionId);
        if (!session || order.assignedDriverId !== session.driverId) {
          socket.emit("ride:cancel:error", { message: "Vous n'êtes pas le chauffeur de cette course" });
          return;
        }
      } else if (data.role === 'client') {
        const tokenData = orderClientTokens.get(data.orderId);
        if (!tokenData || tokenData.token !== data.clientToken) {
          socket.emit("ride:cancel:error", { message: "Token client invalide" });
          return;
        }
      }
      
      // Cancel the order
      await dbStorage.updateOrderStatus(data.orderId, "cancelled");
      paymentConfirmations.delete(data.orderId);
      orderClientTokens.delete(data.orderId);
      
      // Notify all parties
      io.to(`order:${data.orderId}`).emit("ride:cancelled", {
        orderId: data.orderId,
        cancelledBy: data.role,
        reason: data.reason || "Annulé par " + (data.role === 'driver' ? "le chauffeur" : "le client")
      });
      
      console.log(`[DEBUG] Order ${data.orderId} cancelled by ${data.role}`);
    });
    
    // Real-time location updates - Driver sends their location
    socket.on("location:driver:update", async (data: {
      orderId: string;
      sessionId: string;
      lat: number;
      lng: number;
      heading?: number;
      speed?: number;
      timestamp: number;
    }) => {
      // Validate driver session
      const session = await storage.getDriverSession(data.sessionId);
      const order = await dbStorage.getOrder(data.orderId);
      
      if (!session || !order || order.assignedDriverId !== session.driverId) {
        console.log(`[DEBUG] location:driver:update ignored - invalid session or order`);
        return;
      }
      
      // Store latest driver location for HTTP polling backup
      driverLocations.set(data.orderId, {
        lat: data.lat,
        lng: data.lng,
        heading: data.heading || 0,
        speed: data.speed,
        timestamp: data.timestamp
      });
      
      // Use io.to() to broadcast to ALL members of the room including the sender if needed
      // This ensures the client receives the location update
      io.to(`order:${data.orderId}`).emit("location:driver", {
        orderId: data.orderId,
        lat: data.lat,
        lng: data.lng,
        heading: data.heading,
        speed: data.speed,
        timestamp: data.timestamp
      });
      console.log(`[DEBUG] Driver location broadcasted for order ${data.orderId}: ${data.lat}, ${data.lng}, heading: ${data.heading}`);
    });
    
    // Real-time location updates - Client sends their location
    socket.on("location:client:update", async (data: {
      orderId: string;
      clientToken: string;
      lat: number;
      lng: number;
      timestamp: number;
    }) => {
      // Validate client token
      const tokenData = orderClientTokens.get(data.orderId);
      if (!tokenData || tokenData.token !== data.clientToken) {
        return; // Silently ignore invalid location updates
      }
      
      // Relay to the order room (driver will receive this)
      socket.to(`order:${data.orderId}`).emit("location:client", {
        orderId: data.orderId,
        lat: data.lat,
        lng: data.lng,
        timestamp: data.timestamp
      });
    });
    
    // Driver or client joins ride room (with validation)
    socket.on("ride:join", async (data: { orderId: string; role?: 'driver' | 'client'; sessionId?: string; clientToken?: string }) => {
      const order = await dbStorage.getOrder(data.orderId);
      if (!order) {
        console.log(`Socket ${socket.id} tried to join non-existent order room: ${data.orderId}`);
        return;
      }
      
      // Validate based on role
      if (data.role === 'driver') {
        // Verify driver session and assignment
        if (!data.sessionId) {
          console.log(`Driver socket ${socket.id} missing sessionId for ride:join`);
          return;
        }
        const session = await storage.getDriverSession(data.sessionId);
        if (!session || order.assignedDriverId !== session.driverId) {
          console.log(`Driver socket ${socket.id} not assigned to order ${data.orderId}`);
          return;
        }
        socket.join(`order:${data.orderId}`);
        console.log(`Driver ${session.driverName} joined ride room: ${data.orderId}`);
      } else if (data.role === 'client') {
        // Verify client token
        const tokenData = orderClientTokens.get(data.orderId);
        if (!tokenData || tokenData.token !== data.clientToken) {
          console.log(`Client socket ${socket.id} invalid token for ride:join order ${data.orderId}`);
          return;
        }
        
        // Verify socket is the authenticated one (or allow rebinding if old socket disconnected)
        if (tokenData.socketId && tokenData.socketId !== socket.id) {
          const existingSocket = io.sockets.sockets.get(tokenData.socketId);
          if (existingSocket && existingSocket.connected) {
            console.log(`Client socket ${socket.id} rejected in ride:join: already bound to ${tokenData.socketId}`);
            return;
          }
          // Allow rebinding from disconnected socket
          console.log(`Client socket ${socket.id} rebinding in ride:join (old socket disconnected)`);
        }
        
        // Bind the socket to this token
        tokenData.socketId = socket.id;
        orderClientTokens.set(data.orderId, tokenData);
        socket.join(`order:${data.orderId}`);
        console.log(`Client socket ${socket.id} authenticated and joined ride room: ${data.orderId}`);
      } else {
        // No role specified - reject
        console.log(`Socket ${socket.id} attempted ride:join without role for order ${data.orderId}`);
      }
    });
    
    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Remove socket from all sessions and set driver offline if no sockets remain
      const sessions = await storage.getOnlineDriverSessions();
      for (const session of sessions) {
        if (session.socketIds.includes(socket.id)) {
          await storage.removeSocketFromSession(session.id, socket.id);
          // Refresh session to check remaining sockets
          const updatedSession = await storage.getDriverSession(session.id);
          if (updatedSession && updatedSession.socketIds.length === 0) {
            // No more sockets - mark driver as offline to prevent phantom orders
            console.log(`Driver ${updatedSession.driverName} has no more sockets - marking offline`);
            await storage.updateDriverOnlineStatus(session.id, false);
          }
        }
      }
    });
  });

  // API Routes
  
  // Create a new order (called when client confirms booking)
  app.post("/api/orders", async (req, res) => {
    try {
      const validatedData = insertOrderSchema.parse(req.body);
      
      // Check if client is authenticated and link order to their account
      const sessionId = req.cookies?.clientSessionId;
      let clientId: string | undefined = undefined;
      if (sessionId) {
        const session = await dbStorage.getClientSession(sessionId);
        if (session && new Date(session.expiresAt) > new Date()) {
          clientId = session.clientId;
        }
      }
      
      const order = await dbStorage.createOrder(validatedData, clientId);
      
      // Generate a secure client token for this order
      const clientToken = generateClientToken();
      orderClientTokens.set(order.id, { token: clientToken, socketId: null });
      console.log(`[DEBUG] Generated client token for order ${order.id}: ${clientToken.substring(0, 8)}...`);
      
      // Debug: Check how many sockets are in drivers:online room
      const driversRoom = io.sockets.adapter.rooms.get("drivers:online");
      const driverCount = driversRoom ? driversRoom.size : 0;
      console.log(`[DEBUG] Drivers online room has ${driverCount} socket(s)`);
      
      // Broadcast to all online drivers via WebSocket
      io.to("drivers:online").emit("order:new", order);
      
      console.log(`New order created: ${order.id}, broadcasted to ${driverCount} drivers`);
      
      // Send push notifications to all subscribed drivers (for iOS PWA)
      sendPushToAllDrivers(order);
      
      // Set timeout to expire order if not accepted
      setTimeout(async () => {
        const currentOrder = await dbStorage.getOrder(order.id);
        if (currentOrder && currentOrder.status === "pending") {
          await dbStorage.updateOrderStatus(order.id, "expired");
          orderClientTokens.delete(order.id); // Clean up expired order token
          io.to("drivers:online").emit("order:expired", { orderId: order.id });
          console.log(`Order ${order.id} expired`);
        }
      }, 60000); // 60 seconds timeout
      
      // Return order with client token (only the client creating the order receives this)
      res.json({ success: true, order, clientToken });
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(400).json({ success: false, error: "Invalid order data" });
    }
  });
  
  // Get pending orders (for driver hydration)
  app.get("/api/orders/pending", async (req, res) => {
    const orders = await dbStorage.getPendingOrders();
    res.json(orders);
  });
  
  // Get active order for authenticated client
  app.get("/api/orders/active/client", async (req, res) => {
    const sessionId = req.cookies?.clientSessionId;
    if (!sessionId) {
      return res.json({ hasActiveOrder: false });
    }
    
    const session = await dbStorage.getClientSession(sessionId);
    if (!session) {
      return res.json({ hasActiveOrder: false });
    }
    
    // Find active order for this client (accepted, driver_arrived, in_progress, completed, payment_pending, payment_failed)
    // Once an order is accepted, always show it to the client - driver socket status is irrelevant
    // 'completed' status is included because the ride is finished but payment is still pending confirmation
    const activeStatuses: OrderStatus[] = ["accepted", "driver_arrived", "in_progress", "completed", "payment_pending", "payment_failed"];
    const orders = await dbStorage.getOrdersByClient(session.clientId);
    
    // Find orders with assigned driver and active status, sorted by most recent
    const matchingOrders = orders
      .filter((o: Order) => 
        activeStatuses.includes(o.status as OrderStatus) && 
        o.assignedDriverId !== null && 
        o.assignedDriverId !== undefined
      )
      .sort((a: Order, b: Order) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    
    // Take the most recent active order
    const activeOrder = matchingOrders[0];
    
    if (!activeOrder) {
      return res.json({ hasActiveOrder: false });
    }
    
    // Get the client token if exists
    const tokenData = orderClientTokens.get(activeOrder.id);
    
    res.json({
      hasActiveOrder: true,
      order: activeOrder,
      clientToken: tokenData?.token || null
    });
  });
  
  // Get active order for authenticated driver
  app.get("/api/orders/active/driver", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      return res.json({ hasActiveOrder: false });
    }
    
    const session = await storage.getDriverSession(sessionId);
    if (!session) {
      return res.json({ hasActiveOrder: false });
    }
    
    // Find active order for this driver
    // 'completed' status is included because the ride is finished but payment is still pending confirmation
    const activeStatuses: OrderStatus[] = ["accepted", "driver_arrived", "in_progress", "completed", "payment_pending", "payment_failed"];
    const orders = await dbStorage.getOrdersByDriver(session.driverId);
    const activeOrder = orders.find((o: Order) => activeStatuses.includes(o.status as OrderStatus));
    
    if (!activeOrder) {
      return res.json({ hasActiveOrder: false });
    }
    
    res.json({
      hasActiveOrder: true,
      order: activeOrder
    });
  });
  
  // Get driver location for an order (HTTP polling backup for WebSocket)
  app.get("/api/orders/:id/driver-location", async (req, res) => {
    const orderId = req.params.id;
    const order = await dbStorage.getOrder(orderId);
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    const location = driverLocations.get(orderId);
    if (!location) {
      return res.json({ hasLocation: false });
    }
    
    res.json({
      hasLocation: true,
      lat: location.lat,
      lng: location.lng,
      heading: location.heading,
      speed: location.speed,
      timestamp: location.timestamp
    });
  });
  
  // Get order by ID
  app.get("/api/orders/:id", async (req, res) => {
    const order = await dbStorage.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    // Enrich with current driver info if assigned
    let driverInfo = null;
    if (order.assignedDriverId) {
      const driver = await dbStorage.getDriver(order.assignedDriverId);
      if (driver) {
        driverInfo = {
          id: driver.id,
          name: `${driver.firstName} ${driver.lastName}`.trim(),
          phone: driver.phone,
          vehicleModel: driver.vehicleModel,
          vehicleColor: driver.vehicleColor,
          vehiclePlate: driver.vehiclePlate,
          averageRating: driver.averageRating,
        };
      }
    }
    
    // Enrich with current client info if linked
    let clientInfo = null;
    if (order.clientId) {
      const client = await dbStorage.getClient(order.clientId);
      if (client) {
        clientInfo = {
          id: client.id,
          name: `${client.firstName} ${client.lastName}`.trim(),
          phone: client.phone,
          email: client.email,
          averageRating: client.averageRating,
        };
      }
    }
    
    res.json({
      ...order,
      driver: driverInfo,
      client: clientInfo,
    });
  });
  
  // Create driver session (on login)
  app.post("/api/driver-sessions", async (req, res) => {
    try {
      const { driverId, driverName } = req.body;
      
      if (!driverId || !driverName) {
        return res.status(400).json({ error: "Missing driverId or driverName" });
      }
      
      const session = await storage.createDriverSession(driverId, driverName);
      res.json({ success: true, session });
    } catch (error) {
      console.error("Error creating driver session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });
  
  // Update driver online status
  app.patch("/api/driver-sessions/:id/status", async (req, res) => {
    try {
      const { isOnline } = req.body;
      const session = await storage.updateDriverOnlineStatus(req.params.id, isOnline);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.json({ success: true, session });
    } catch (error) {
      console.error("Error updating driver status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });
  
  // Get driver session
  app.get("/api/driver-sessions/:id", async (req, res) => {
    const session = await storage.getDriverSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  });

  // ============ Push Notification Routes ============
  
  // Get VAPID public key (for client to subscribe)
  app.get("/api/push/vapid-public-key", (req, res) => {
    if (!VAPID_PUBLIC_KEY) {
      return res.status(503).json({ error: "Push notifications not configured" });
    }
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });
  
  // Subscribe a driver to push notifications (requires valid driver session)
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { sessionId, subscription } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Missing sessionId" });
      }
      
      // Verify the driver session exists and is valid
      const session = await storage.getDriverSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Invalid or expired session" });
      }
      
      // Validate subscription format
      const validatedSub = pushSubscriptionSchema.parse(subscription);
      
      // Use the driverId from the verified session
      const driverSub = await storage.savePushSubscription(session.driverId, validatedSub);
      console.log(`[PUSH] Driver ${session.driverName} (${session.driverId}) subscribed to push notifications`);
      
      res.json({ success: true, subscription: driverSub });
    } catch (error) {
      console.error("[PUSH] Subscription error:", error);
      res.status(400).json({ error: "Invalid subscription data" });
    }
  });
  
  // Unsubscribe a driver from push notifications (requires valid driver session)
  app.delete("/api/push/subscribe/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    
    // Verify the driver session exists and is valid
    const session = await storage.getDriverSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    
    const removed = await storage.removePushSubscription(session.driverId);
    if (removed) {
      console.log(`[PUSH] Driver ${session.driverName} (${session.driverId}) unsubscribed from push notifications`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Subscription not found" });
    }
  });
  
  // Check if driver is subscribed to push (requires valid driver session)
  app.get("/api/push/status/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    
    // Verify the driver session exists and is valid
    const session = await storage.getDriverSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    
    const subscription = await storage.getPushSubscription(session.driverId);
    res.json({ subscribed: !!subscription });
  });

  // ========================
  // CLIENT AUTHENTICATION ROUTES
  // ========================
  
  // Register a new client
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      
      // Check if phone already exists
      const existingClient = await dbStorage.getClientByPhone(validatedData.phone);
      if (existingClient) {
        return res.status(409).json({ error: "Ce numéro de téléphone est déjà utilisé" });
      }
      
      // Create client in database (persistent) - already verified
      const client = await dbStorage.createClient(validatedData);
      
      // Mark as verified immediately (no SMS verification)
      await dbStorage.updateClientVerified(client.id, true);
      
      // Create session immediately
      const session = await dbStorage.createClientSession(client.id);
      
      // Set session cookie
      res.cookie("clientSessionId", session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      
      res.json({ 
        success: true, 
        client: {
          id: client.id,
          phone: client.phone,
          firstName: client.firstName,
          lastName: client.lastName,
          walletBalance: client.walletBalance,
          averageRating: client.averageRating,
          totalRides: client.totalRides,
        }
      });
    } catch (error: any) {
      console.error("Error registering client:", error);
      if (error.errors) {
        return res.status(400).json({ error: error.errors[0]?.message || "Données invalides" });
      }
      res.status(400).json({ error: "Erreur lors de l'inscription" });
    }
  });
  
  // Verify registration code
  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { phone, code, type } = req.body;
      
      console.log(`[VERIFY] Phone: ${phone}, Code: ${code}, Type: ${type}, NODE_ENV: ${process.env.NODE_ENV}`);
      
      if (!phone || !code) {
        return res.status(400).json({ error: "Téléphone et code requis" });
      }
      
      // In development, accept 111111 as universal code
      const isDev = process.env.NODE_ENV !== "production";
      const codeStr = String(code);
      console.log(`[VERIFY] isDev: ${isDev}, codeStr: ${codeStr}, codeStr === "111111": ${codeStr === "111111"}`);
      
      if (!(isDev && codeStr === "111111")) {
        // In production or if code is not 111111, verify the actual code
        console.log(`[VERIFY] Checking actual code in database...`);
        const verificationCode = await dbStorage.getVerificationCode(phone, code, type || "registration");
        if (!verificationCode) {
          console.log(`[VERIFY] Code not found in database`);
          return res.status(400).json({ error: "Code invalide ou expiré" });
        }
        // Mark code as used
        await dbStorage.markVerificationCodeUsed(verificationCode.id);
      } else {
        console.log(`[VERIFY] Accepting dev code 111111`);
      }
      
      // Get client and mark as verified
      const client = await dbStorage.getClientByPhone(phone);
      console.log(`[VERIFY] Client found: ${client ? client.id : 'NOT FOUND'}`);
      if (!client) {
        return res.status(404).json({ error: "Client non trouvé" });
      }
      
      await dbStorage.updateClientVerified(client.id, true);
      
      // Create session
      const session = await dbStorage.createClientSession(client.id);
      
      // Set session cookie
      res.cookie("clientSessionId", session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "lax"
      });
      
      res.json({ 
        success: true,
        client: {
          id: client.id,
          phone: client.phone,
          firstName: client.firstName,
          lastName: client.lastName,
          walletBalance: client.walletBalance,
          averageRating: client.averageRating,
          totalRides: client.totalRides
        }
      });
    } catch (error) {
      console.error("Error verifying code:", error);
      res.status(500).json({ error: "Erreur de vérification" });
    }
  });
  
  // Login with phone
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { phone, password } = req.body;
      
      if (!phone || !password) {
        return res.status(400).json({ error: "Téléphone et mot de passe requis" });
      }
      
      const client = await dbStorage.getClientByPhone(phone);
      if (!client) {
        return res.status(401).json({ error: "Numéro de téléphone ou mot de passe incorrect" });
      }
      
      if (!verifyPassword(password, client.hashedPassword)) {
        return res.status(401).json({ error: "Numéro de téléphone ou mot de passe incorrect" });
      }
      
      if (!client.isVerified) {
        // Send new verification code
        const verificationCode = await dbStorage.createVerificationCode(phone, "login");
        console.log(`[SMS] Code de connexion pour ${phone}: ${verificationCode.code}`);
        const isDev = process.env.NODE_ENV !== "production";
        return res.status(403).json({ 
          error: "Compte non vérifié", 
          needsVerification: true,
          phone: client.phone,
          ...(isDev && { devCode: "111111" })
        });
      }
      
      // Create session
      const session = await dbStorage.createClientSession(client.id);
      
      // Set session cookie
      res.cookie("clientSessionId", session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax"
      });
      
      res.json({ 
        success: true,
        client: {
          id: client.id,
          phone: client.phone,
          firstName: client.firstName,
          lastName: client.lastName,
          walletBalance: client.walletBalance,
          averageRating: client.averageRating,
          totalRides: client.totalRides
        }
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Erreur de connexion" });
    }
  });
  
  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    const sessionId = req.cookies?.clientSessionId;
    if (sessionId) {
      await dbStorage.deleteClientSession(sessionId);
    }
    res.clearCookie("clientSessionId");
    res.json({ success: true });
  });
  
  // Get current client (check session)
  app.get("/api/auth/me", async (req, res) => {
    const sessionId = req.cookies?.clientSessionId;
    
    if (!sessionId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    const session = await dbStorage.getClientSession(sessionId);
    if (!session) {
      res.clearCookie("clientSessionId");
      return res.status(401).json({ error: "Session expirée" });
    }
    
    const client = await dbStorage.getClient(session.clientId);
    if (!client) {
      res.clearCookie("clientSessionId");
      return res.status(401).json({ error: "Client non trouvé" });
    }
    
    // Refresh session
    await dbStorage.refreshClientSession(sessionId);
    
    res.json({
      id: client.id,
      phone: client.phone,
      firstName: client.firstName,
      lastName: client.lastName,
      walletBalance: client.walletBalance,
      averageRating: client.averageRating,
      totalRides: client.totalRides
    });
  });
  
  // Request password reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ error: "Numéro de téléphone requis" });
      }
      
      const client = await dbStorage.getClientByPhone(phone);
      if (!client) {
        // Don't reveal if account exists
        return res.json({ success: true, message: "Si ce numéro existe, un code a été envoyé" });
      }
      
      const verificationCode = await dbStorage.createVerificationCode(phone, "password_reset");
      console.log(`[SMS] Code de réinitialisation pour ${phone}: ${verificationCode.code}`);
      
      const isDev = process.env.NODE_ENV !== "production";
      res.json({ 
        success: true, 
        message: "Code de vérification envoyé",
        ...(isDev && { devCode: "111111" })
      });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ error: "Erreur lors de la demande" });
    }
  });
  
  // Verify reset code and set new password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { phone, code, newPassword } = req.body;
      
      if (!phone || !code || !newPassword) {
        return res.status(400).json({ error: "Tous les champs sont requis" });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères" });
      }
      
      // In development, accept 111111 as universal code
      const isDev = process.env.NODE_ENV !== "production";
      const codeStr = String(code);
      
      if (!(isDev && codeStr === "111111")) {
        const verificationCode = await dbStorage.getVerificationCode(phone, code, "password_reset");
        if (!verificationCode) {
          return res.status(400).json({ error: "Code invalide ou expiré" });
        }
        // Mark code as used
        await dbStorage.markVerificationCodeUsed(verificationCode.id);
      }
      
      const client = await dbStorage.getClientByPhone(phone);
      if (!client) {
        return res.status(404).json({ error: "Client non trouvé" });
      }
      
      // Update password
      await dbStorage.updateClientPassword(client.id, hashPassword(newPassword));
      
      res.json({ success: true, message: "Mot de passe réinitialisé avec succès" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Erreur lors de la réinitialisation" });
    }
  });
  
  // Resend verification code
  app.post("/api/auth/resend-code", async (req, res) => {
    try {
      const { phone, type } = req.body;
      
      if (!phone) {
        return res.status(400).json({ error: "Numéro de téléphone requis" });
      }
      
      const verificationCode = await dbStorage.createVerificationCode(phone, type || "registration");
      console.log(`[SMS] Nouveau code pour ${phone}: ${verificationCode.code}`);
      
      const isDev = process.env.NODE_ENV !== "production";
      res.json({ 
        success: true, 
        message: "Code envoyé",
        ...(isDev && { devCode: "111111" })
      });
    } catch (error) {
      console.error("Error resending code:", error);
      res.status(500).json({ error: "Erreur lors de l'envoi" });
    }
  });
  
  // ========================
  // CLIENT DATA ROUTES
  // ========================
  
  // Get client orders
  app.get("/api/client/orders", async (req, res) => {
    const sessionId = req.cookies?.clientSessionId;
    
    if (!sessionId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    const session = await dbStorage.getClientSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: "Session expirée" });
    }
    
    const orders = await dbStorage.getOrdersByClient(session.clientId);
    res.json(orders);
  });
  
  // Update client profile
  app.patch("/api/client/profile", async (req, res) => {
    try {
      const sessionId = req.cookies?.clientSessionId;
      
      if (!sessionId) {
        return res.status(401).json({ error: "Non authentifié" });
      }
      
      const session = await dbStorage.getClientSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Session expirée" });
      }
      
      // Validate request body
      const validationResult = updateClientProfileSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Données invalides", 
          details: validationResult.error.flatten() 
        });
      }
      
      const { firstName, lastName, email } = validationResult.data;
      
      const updatedClient = await dbStorage.updateClientProfile(session.clientId, {
        firstName,
        lastName,
        email
      });
      
      if (!updatedClient) {
        return res.status(404).json({ error: "Client non trouvé" });
      }
      
      res.json({
        success: true,
        client: {
          id: updatedClient.id,
          phone: updatedClient.phone,
          firstName: updatedClient.firstName,
          lastName: updatedClient.lastName,
          email: updatedClient.email,
        }
      });
    } catch (error) {
      console.error("Error updating client profile:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour" });
    }
  });
  
  // Get wallet transactions
  app.get("/api/client/wallet", async (req, res) => {
    const sessionId = req.cookies?.clientSessionId;
    
    if (!sessionId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    const session = await dbStorage.getClientSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: "Session expirée" });
    }
    
    const client = await dbStorage.getClient(session.clientId);
    const transactions: any[] = []; // Wallet transactions not implemented in dbStorage yet
    
    res.json({
      balance: client?.walletBalance || 0,
      transactions
    });
  });
  
  // ========================
  // DRIVER DATA ROUTES
  // ========================
  
  // Get driver profile
  app.get("/api/driver/profile/:driverId", async (req, res) => {
    try {
      const { driverId } = req.params;
      
      if (!driverId) {
        return res.status(400).json({ error: "ID chauffeur requis" });
      }
      
      // Verify driver session via Authorization header (sessionId)
      const sessionId = req.headers.authorization?.replace("Bearer ", "");
      if (!sessionId) {
        return res.status(401).json({ error: "Non authentifié" });
      }
      
      const session = await storage.getDriverSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Session expirée" });
      }
      
      // Verify the driver is requesting their own profile
      if (session.driverId !== driverId) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }
      
      const driver = await dbStorage.getDriver(driverId);
      
      if (!driver) {
        return res.status(404).json({ error: "Chauffeur non trouvé" });
      }
      
      res.json({
        id: driver.id,
        phone: driver.phone,
        firstName: driver.firstName,
        lastName: driver.lastName,
        vehicleModel: driver.vehicleModel,
        vehicleColor: driver.vehicleColor,
        vehiclePlate: driver.vehiclePlate,
        averageRating: driver.averageRating,
        totalRides: driver.totalRides,
      });
    } catch (error) {
      console.error("Error getting driver profile:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du profil" });
    }
  });
  
  // Update driver profile
  app.patch("/api/driver/profile/:driverId", async (req, res) => {
    try {
      const { driverId } = req.params;
      
      if (!driverId) {
        return res.status(400).json({ error: "ID chauffeur requis" });
      }
      
      // Verify driver session via Authorization header (sessionId)
      const sessionId = req.headers.authorization?.replace("Bearer ", "");
      if (!sessionId) {
        return res.status(401).json({ error: "Non authentifié" });
      }
      
      const session = await storage.getDriverSession(sessionId);
      if (!session) {
        return res.status(401).json({ error: "Session expirée" });
      }
      
      // Verify the driver is modifying their own profile
      if (session.driverId !== driverId) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }
      
      // Validate request body
      const validationResult = updateDriverProfileSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Données invalides", 
          details: validationResult.error.flatten() 
        });
      }
      
      const { firstName, lastName, vehicleModel, vehicleColor, vehiclePlate } = validationResult.data;
      
      const updatedDriver = await dbStorage.updateDriverProfile(driverId, {
        firstName,
        lastName,
        vehicleModel,
        vehicleColor,
        vehiclePlate
      });
      
      if (!updatedDriver) {
        return res.status(404).json({ error: "Chauffeur non trouvé" });
      }
      
      res.json({
        success: true,
        driver: {
          id: updatedDriver.id,
          phone: updatedDriver.phone,
          firstName: updatedDriver.firstName,
          lastName: updatedDriver.lastName,
          vehicleModel: updatedDriver.vehicleModel,
          vehicleColor: updatedDriver.vehicleColor,
          vehiclePlate: updatedDriver.vehiclePlate,
        }
      });
    } catch (error) {
      console.error("Error updating driver profile:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour" });
    }
  });
  
  // Verify driver code and create session
  app.post("/api/driver/login", async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: "Code requis" });
      }
      
      const codeStr = String(code);
      
      // Look up driver by code in database
      const driver = await dbStorage.getDriverByCode(codeStr);
      
      if (!driver) {
        return res.status(401).json({ error: "Code incorrect" });
      }
      
      if (!driver.isActive) {
        return res.status(403).json({ error: "Compte chauffeur désactivé" });
      }
      
      // Create driver session (both in-memory for sockets and in database for persistence)
      const session = await storage.createDriverSession(driver.id, `${driver.firstName} ${driver.lastName}`.trim());
      
      // Also create/refresh database session with SAME session ID for persistence across server restarts
      await dbStorage.createDbDriverSession(driver.id, `${driver.firstName} ${driver.lastName}`.trim(), session.id);
      
      res.json({ 
        success: true, 
        session,
        driver: {
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          phone: driver.phone,
          vehicleModel: driver.vehicleModel,
          vehicleColor: driver.vehicleColor,
          vehiclePlate: driver.vehiclePlate,
        }
      });
    } catch (error) {
      console.error("Error verifying driver code:", error);
      res.status(500).json({ error: "Erreur lors de la connexion" });
    }
  });
  
  // Get driver orders (completed and cancelled rides) - by session ID
  // First checks memory storage, then falls back to database for persistence
  app.get("/api/driver/orders/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(401).json({ error: "Session requise" });
    }
    
    // First try in-memory session
    let session = await storage.getDriverSession(sessionId);
    let driverId: string | undefined;
    
    if (session) {
      driverId = session.driverId;
    } else {
      // Fallback to database session (survives server restart)
      const dbSession = await dbStorage.getDbDriverSession(sessionId);
      if (dbSession) {
        driverId = dbSession.driverId;
      }
    }
    
    if (!driverId) {
      return res.status(401).json({ error: "Session expirée" });
    }
    
    const orders = await dbStorage.getOrdersByDriver(driverId);
    res.json(orders);
  });
  

  // ============ STRIPE PAYMENT ENDPOINTS ============
  
  // Helper to get authenticated client from session cookie
  async function getAuthenticatedClient(req: any): Promise<string | null> {
    const sessionId = req.cookies?.clientSessionId;
    if (!sessionId) return null;
    
    const session = await dbStorage.getClientSession(sessionId);
    if (!session || new Date(session.expiresAt) < new Date()) return null;
    
    return session.clientId;
  }

  // Zod validation schemas for Stripe endpoints
  const setupIntentBodySchema = z.object({
    clientId: z.string().min(1),
  });
  
  const savePaymentMethodSchema = z.object({
    clientId: z.string().min(1),
    paymentMethodId: z.string().min(1),
    isDefault: z.boolean().optional(),
  });
  
  const paymentIntentSchema = z.object({
    clientId: z.string().min(1),
    orderId: z.string().min(1),
    amount: z.number().positive(),
    paymentMethodId: z.string().optional(),
  });
  
  const confirmPaymentSchema = z.object({
    paymentIntentId: z.string().min(1),
    invoiceId: z.string().min(1),
  });

  // Get or create Stripe customer for authenticated client
  app.post("/api/stripe/customer", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    try {
      // Check if customer already exists
      let stripeCustomer = await dbStorage.getStripeCustomer(authClientId);
      
      if (!stripeCustomer) {
        // Get client info
        const client = await dbStorage.getClient(authClientId);
        if (!client) {
          return res.status(404).json({ error: "Client non trouvé" });
        }
        
        // Create Stripe customer
        const customer = await stripe.customers.create({
          phone: client.phone,
          name: `${client.firstName} ${client.lastName}`.trim(),
          metadata: { clientId: authClientId },
        });
        
        stripeCustomer = await dbStorage.createStripeCustomer(authClientId, customer.id);
      }
      
      res.json(stripeCustomer);
    } catch (error) {
      console.error("Error creating Stripe customer:", error);
      res.status(500).json({ error: "Erreur Stripe" });
    }
  });

  // Get Stripe publishable key (for frontend initialization)
  app.get("/api/stripe/publishable-key", (req, res) => {
    if (!STRIPE_PUBLISHABLE_KEY) {
      return res.status(500).json({ error: "Stripe publishable key not configured" });
    }
    res.json({ publishableKey: STRIPE_PUBLISHABLE_KEY });
  });

  // Create SetupIntent for adding a card
  app.post("/api/stripe/setup-intent", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    // Validate request body
    const validation = setupIntentBodySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Données invalides" });
    }
    
    // Verify the request is for the authenticated user
    if (validation.data.clientId !== authClientId) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    try {
      // Get or create Stripe customer
      let stripeCustomer = await dbStorage.getStripeCustomer(authClientId);
      
      if (!stripeCustomer) {
        const client = await dbStorage.getClient(authClientId);
        if (!client) {
          return res.status(404).json({ error: "Client non trouvé" });
        }
        
        const customer = await stripe.customers.create({
          phone: client.phone,
          name: `${client.firstName} ${client.lastName}`.trim(),
          metadata: { clientId: authClientId },
        });
        
        stripeCustomer = await dbStorage.createStripeCustomer(authClientId, customer.id);
      }
      
      // Create SetupIntent
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomer.stripeCustomerId,
        payment_method_types: ["card"],
      });
      
      res.json({ clientSecret: setupIntent.client_secret });
    } catch (error) {
      console.error("Error creating SetupIntent:", error);
      res.status(500).json({ error: "Erreur Stripe" });
    }
  });

  // Save payment method after successful setup
  app.post("/api/stripe/payment-method", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    // Validate request body
    const validation = savePaymentMethodSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Données invalides" });
    }
    
    const { clientId, paymentMethodId, isDefault } = validation.data;
    
    // Verify the request is for the authenticated user
    if (clientId !== authClientId) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    try {
      // Get payment method details from Stripe
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      if (!paymentMethod.card) {
        return res.status(400).json({ error: "Méthode de paiement invalide" });
      }
      
      // Get or create Stripe customer
      let stripeCustomer = await dbStorage.getStripeCustomer(authClientId);
      
      if (stripeCustomer) {
        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomer.stripeCustomerId,
        });
      }
      
      // Check if this is the first card
      const existingMethods = await dbStorage.getPaymentMethods(authClientId);
      const shouldBeDefault = isDefault || existingMethods.length === 0;
      
      // Save to database
      const savedMethod = await dbStorage.addPaymentMethod({
        clientId: authClientId,
        stripePaymentMethodId: paymentMethodId,
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand,
        expiryMonth: paymentMethod.card.exp_month,
        expiryYear: paymentMethod.card.exp_year,
        isDefault: shouldBeDefault,
      });
      
      res.json(savedMethod);
    } catch (error) {
      console.error("Error saving payment method:", error);
      res.status(500).json({ error: "Erreur lors de l'enregistrement de la carte" });
    }
  });

  // Get all payment methods for authenticated client
  app.get("/api/stripe/payment-methods/:clientId", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    const { clientId } = req.params;
    
    // Verify the request is for the authenticated user
    if (clientId !== authClientId) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    try {
      const methods = await dbStorage.getPaymentMethods(authClientId);
      res.json(methods);
    } catch (error) {
      console.error("Error getting payment methods:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des cartes" });
    }
  });

  // Delete a payment method
  app.delete("/api/stripe/payment-method/:id", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    const { id } = req.params;
    
    try {
      // Get the payment method to verify ownership and find Stripe ID
      const methods = await dbStorage.getPaymentMethods(authClientId);
      const method = methods.find(m => m.id === id);
      
      if (!method) {
        return res.status(404).json({ error: "Carte non trouvée" });
      }
      
      // Detach from Stripe
      try {
        await stripe.paymentMethods.detach(method.stripePaymentMethodId);
      } catch (stripeError) {
        console.warn("Could not detach from Stripe:", stripeError);
      }
      
      await dbStorage.deletePaymentMethod(id, authClientId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting payment method:", error);
      res.status(500).json({ error: "Erreur lors de la suppression" });
    }
  });

  // Set default payment method
  app.post("/api/stripe/payment-method/:id/default", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    const { id } = req.params;
    
    try {
      // Verify the card belongs to the authenticated user
      const methods = await dbStorage.getPaymentMethods(authClientId);
      const method = methods.find(m => m.id === id);
      
      if (!method) {
        return res.status(404).json({ error: "Carte non trouvée" });
      }
      
      await dbStorage.setDefaultPaymentMethod(id, authClientId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting default payment method:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour" });
    }
  });

  // Create PaymentIntent for a ride
  app.post("/api/stripe/payment-intent", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    // Validate request body
    const validation = paymentIntentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Données invalides" });
    }
    
    const { clientId, orderId, amount, paymentMethodId } = validation.data;
    
    // Verify the request is for the authenticated user
    if (clientId !== authClientId) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    try {
      // Verify the order belongs to this client
      const order = await dbStorage.getOrder(orderId);
      if (!order || order.clientId !== authClientId) {
        return res.status(403).json({ error: "Commande non autorisée" });
      }
      
      // Get Stripe customer
      const stripeCustomer = await dbStorage.getStripeCustomer(authClientId);
      if (!stripeCustomer) {
        return res.status(400).json({ error: "Compte Stripe non configuré" });
      }
      
      // Convert XPF to the smallest unit (XPF has no cents, so amount is already in the smallest unit)
      const amountInSmallestUnit = Math.round(amount);
      
      // Create PaymentIntent
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: amountInSmallestUnit,
        currency: "xpf",
        customer: stripeCustomer.stripeCustomerId,
        metadata: { orderId, clientId: authClientId },
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      };
      
      // If a specific payment method is provided, verify it belongs to this client
      if (paymentMethodId) {
        const methods = await dbStorage.getPaymentMethods(authClientId);
        const method = methods.find(m => m.stripePaymentMethodId === paymentMethodId);
        if (!method) {
          return res.status(403).json({ error: "Méthode de paiement non autorisée" });
        }
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirm = true;
        paymentIntentData.off_session = false;
      }
      
      const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
      
      // Create invoice record
      const invoice = await dbStorage.createInvoice({
        clientId: authClientId,
        orderId,
        amount,
        stripePaymentIntentId: paymentIntent.id,
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        invoiceId: invoice.id,
        status: paymentIntent.status,
      });
    } catch (error) {
      console.error("Error creating PaymentIntent:", error);
      res.status(500).json({ error: "Erreur lors de la création du paiement" });
    }
  });

  // Confirm payment and update invoice
  app.post("/api/stripe/confirm-payment", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    // Validate request body
    const validation = confirmPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Données invalides" });
    }
    
    const { paymentIntentId, invoiceId } = validation.data;
    
    try {
      // Check payment intent status
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      // Verify this payment belongs to the authenticated client
      if (paymentIntent.metadata?.clientId !== authClientId) {
        return res.status(403).json({ error: "Paiement non autorisé" });
      }
      
      if (paymentIntent.status === "succeeded") {
        // Get order and client info to create proper Stripe Invoice
        const dbInvoice = await dbStorage.getInvoiceByOrder(paymentIntent.metadata?.orderId || "");
        const order = dbInvoice ? await dbStorage.getOrder(dbInvoice.orderId) : null;
        const client = await dbStorage.getClient(authClientId);
        
        let invoicePdfUrl: string | undefined;
        let stripeInvoiceId: string | undefined;
        
        // Get or create Stripe customer
        let stripeCustomer = await dbStorage.getStripeCustomer(authClientId);
        if (!stripeCustomer && client) {
          const customer = await stripe.customers.create({
            name: `${client.firstName} ${client.lastName}`,
            phone: client.phone,
            email: client.email || undefined,
            metadata: { clientId: authClientId }
          });
          stripeCustomer = await dbStorage.createStripeCustomer(authClientId, customer.id);
        }
        
        if (stripeCustomer && order) {
          try {
            // Create the invoice first as a draft
            const stripeInvoice = await stripe.invoices.create({
              customer: stripeCustomer.stripeCustomerId,
              auto_advance: false,
              collection_method: 'charge_automatically',
              metadata: {
                orderId: order.id,
                clientId: authClientId,
                paymentIntentId: paymentIntentId
              }
            });
            
            // Create invoice item and attach it to the invoice
            await stripe.invoiceItems.create({
              customer: stripeCustomer.stripeCustomerId,
              invoice: stripeInvoice.id,
              amount: Math.round(order.totalPrice), // Amount in smallest currency unit
              currency: 'xpf',
              description: `Course TAPE'A - ${order.rideOption?.title || 'Transport'}`,
            });
            
            // Finalize the invoice
            await stripe.invoices.finalizeInvoice(stripeInvoice.id);
            
            // Pay the invoice immediately (since payment already succeeded)
            const paidInvoice = await stripe.invoices.pay(stripeInvoice.id, {
              paid_out_of_band: true // Mark as paid externally since PaymentIntent already succeeded
            });
            
            stripeInvoiceId = paidInvoice.id;
            invoicePdfUrl = paidInvoice.invoice_pdf || undefined;
            
            console.log(`[STRIPE] Created invoice ${stripeInvoiceId} for order ${order.id}, PDF: ${invoicePdfUrl}`);
          } catch (invoiceError) {
            console.error("Error creating Stripe invoice:", invoiceError);
            // Continue without invoice - payment was still successful
          }
        }
        
        // Update invoice status with Stripe invoice info
        const invoice = await dbStorage.updateInvoiceStatus(invoiceId, "paid", invoicePdfUrl, stripeInvoiceId);
        
        res.json({ 
          success: true, 
          invoice,
          status: "paid",
        });
      } else {
        res.json({ 
          success: false, 
          status: paymentIntent.status,
          message: "Paiement non confirmé",
        });
      }
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ error: "Erreur lors de la confirmation" });
    }
  });

  // Get invoices for authenticated client
  app.get("/api/stripe/invoices/:clientId", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    const { clientId } = req.params;
    
    // Verify the request is for the authenticated user
    if (clientId !== authClientId) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    
    try {
      const invoices = await dbStorage.getInvoicesByClient(authClientId);
      res.json(invoices);
    } catch (error) {
      console.error("Error getting invoices:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des factures" });
    }
  });

  // Generate Stripe invoice for an existing paid order that doesn't have one yet
  app.post("/api/stripe/generate-invoice/:orderId", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    const { orderId } = req.params;
    
    try {
      // Verify the order belongs to this client
      const order = await dbStorage.getOrder(orderId);
      if (!order || order.clientId !== authClientId) {
        return res.status(403).json({ error: "Commande non autorisée" });
      }
      
      // Check if order was paid by card and is completed
      if (order.paymentMethod !== "card") {
        return res.status(400).json({ error: "Cette commande n'a pas été payée par carte" });
      }
      
      if (!["completed", "payment_confirmed"].includes(order.status)) {
        return res.status(400).json({ error: "Cette commande n'est pas terminée" });
      }
      
      // Get existing invoice record
      let dbInvoice = await dbStorage.getInvoiceByOrder(orderId);
      
      // If invoice already has a PDF URL and amount > 0, return it
      // Allow regeneration if amount is 0 (previous bug)
      if (dbInvoice?.pdfUrl && dbInvoice.amount > 0) {
        return res.json({ success: true, invoice: dbInvoice, message: "Facture déjà générée" });
      }
      
      // Get client info
      const client = await dbStorage.getClient(authClientId);
      if (!client) {
        return res.status(400).json({ error: "Client non trouvé" });
      }
      
      // Get or create Stripe customer
      let stripeCustomer = await dbStorage.getStripeCustomer(authClientId);
      if (!stripeCustomer) {
        const customer = await stripe.customers.create({
          name: `${client.firstName} ${client.lastName}`,
          phone: client.phone,
          email: client.email || undefined,
          metadata: { clientId: authClientId }
        });
        stripeCustomer = await dbStorage.createStripeCustomer(authClientId, customer.id);
      }
      
      // Create the invoice first as a draft
      const stripeInvoice = await stripe.invoices.create({
        customer: stripeCustomer.stripeCustomerId,
        auto_advance: false,
        collection_method: 'charge_automatically',
        metadata: {
          orderId: order.id,
          clientId: authClientId
        }
      });
      
      // Create invoice item and attach it to the invoice
      await stripe.invoiceItems.create({
        customer: stripeCustomer.stripeCustomerId,
        invoice: stripeInvoice.id,
        amount: Math.round(order.totalPrice),
        currency: 'xpf',
        description: `Course TAPE'A - ${order.rideOption?.title || 'Transport'} - ${new Date(order.createdAt).toLocaleDateString('fr-FR')}`,
      });
      
      // Finalize the invoice
      await stripe.invoices.finalizeInvoice(stripeInvoice.id);
      
      // Pay the invoice (mark as paid externally)
      const paidInvoice = await stripe.invoices.pay(stripeInvoice.id, {
        paid_out_of_band: true
      });
      
      // Update or create invoice record in DB
      if (dbInvoice) {
        // Update with new Stripe invoice info
        dbInvoice = await dbStorage.updateInvoiceStatus(
          dbInvoice.id, 
          "paid", 
          paidInvoice.invoice_pdf || undefined,
          paidInvoice.id
        );
      } else {
        dbInvoice = await dbStorage.createInvoice({
          clientId: authClientId,
          orderId: order.id,
          amount: order.totalPrice,
          stripeInvoiceId: paidInvoice.id
        });
        if (dbInvoice) {
          dbInvoice = await dbStorage.updateInvoiceStatus(
            dbInvoice.id, 
            "paid", 
            paidInvoice.invoice_pdf || undefined,
            paidInvoice.id
          );
        }
      }
      
      console.log(`[STRIPE] Generated invoice ${paidInvoice.id} for order ${orderId}, amount: ${order.totalPrice} XPF, PDF: ${paidInvoice.invoice_pdf}`);
      
      res.json({ 
        success: true, 
        invoice: dbInvoice,
        pdfUrl: paidInvoice.invoice_pdf
      });
    } catch (error) {
      console.error("Error generating invoice:", error);
      res.status(500).json({ error: "Erreur lors de la génération de la facture" });
    }
  });

  // Get invoice for specific order (client must own the order)
  app.get("/api/stripe/invoice/order/:orderId", async (req, res) => {
    const authClientId = await getAuthenticatedClient(req);
    if (!authClientId) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    
    const { orderId } = req.params;
    
    try {
      // Verify the order belongs to this client
      const order = await dbStorage.getOrder(orderId);
      if (!order || order.clientId !== authClientId) {
        return res.status(403).json({ error: "Commande non autorisée" });
      }
      
      const invoice = await dbStorage.getInvoiceByOrder(orderId);
      res.json(invoice || null);
    } catch (error) {
      console.error("Error getting invoice:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de la facture" });
    }
  });

  return httpServer;
}
