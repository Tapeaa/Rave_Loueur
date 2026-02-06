import { 
  type User, 
  type InsertUser, 
  type Order, 
  type InsertOrder,
  type DriverSession,
  type PushSubscription,
  type DriverPushSubscription,
  type Client,
  type InsertClient,
  type ClientSession,
  type VerificationCode,
  type WalletTransaction,
  type ClientRating
} from "@shared/schema";
import { randomUUID, scryptSync, randomBytes } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Orders
  createOrder(order: InsertOrder, clientId?: string): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getPendingOrders(): Promise<Order[]>;
  updateOrderStatus(id: string, status: Order["status"], driverId?: string): Promise<Order | undefined>;
  getOrdersByDriver(driverId: string): Promise<Order[]>;
  getOrdersByClient(clientId: string): Promise<Order[]>;
  
  // Driver Sessions
  createDriverSession(driverId: string, driverName: string): Promise<DriverSession>;
  getDriverSession(id: string): Promise<DriverSession | undefined>;
  getDriverSessionByDriverId(driverId: string): Promise<DriverSession | undefined>;
  updateDriverOnlineStatus(sessionId: string, isOnline: boolean): Promise<DriverSession | undefined>;
  addSocketToSession(sessionId: string, socketId: string): Promise<void>;
  removeSocketFromSession(sessionId: string, socketId: string): Promise<void>;
  getOnlineDriverSessions(): Promise<DriverSession[]>;
  deleteExpiredSessions(): Promise<number>;
  refreshSessionExpiry(sessionId: string): Promise<DriverSession | undefined>;
  
  // Push Subscriptions
  savePushSubscription(driverId: string, subscription: PushSubscription): Promise<DriverPushSubscription>;
  removePushSubscription(driverId: string): Promise<boolean>;
  getPushSubscription(driverId: string): Promise<DriverPushSubscription | undefined>;
  getAllPushSubscriptions(): Promise<DriverPushSubscription[]>;
  
  // Clients
  createClient(client: InsertClient): Promise<Client>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByPhone(phone: string): Promise<Client | undefined>;
  updateClientVerified(clientId: string, isVerified: boolean): Promise<Client | undefined>;
  updateClientPassword(clientId: string, hashedPassword: string): Promise<Client | undefined>;
  updateClientWallet(clientId: string, amount: number): Promise<Client | undefined>;
  updateClientRating(clientId: string, rating: number): Promise<Client | undefined>;
  
  // Client Sessions
  createClientSession(clientId: string): Promise<ClientSession>;
  getClientSession(id: string): Promise<ClientSession | undefined>;
  deleteClientSession(id: string): Promise<boolean>;
  refreshClientSession(id: string): Promise<ClientSession | undefined>;
  
  // Verification Codes
  createVerificationCode(phone: string, type: VerificationCode["type"]): Promise<VerificationCode>;
  getVerificationCode(phone: string, code: string, type: VerificationCode["type"]): Promise<VerificationCode | undefined>;
  markVerificationCodeUsed(id: string): Promise<void>;
  deleteExpiredVerificationCodes(): Promise<number>;
  
  // Wallet Transactions
  createWalletTransaction(clientId: string, type: "credit" | "debit", amount: number, description: string, orderId?: string): Promise<WalletTransaction>;
  getWalletTransactions(clientId: string): Promise<WalletTransaction[]>;
  
  // Ratings
  createClientRating(clientId: string, orderId: string, score: number, comment?: string): Promise<ClientRating>;
  getClientRatings(clientId: string): Promise<ClientRating[]>;
}

// Password hashing utilities
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const testHash = scryptSync(password, salt, 64).toString("hex");
  return hash === testHash;
}

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export { hashPassword, verifyPassword };

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private orders: Map<string, Order>;
  private driverSessions: Map<string, DriverSession>;
  private pushSubscriptions: Map<string, DriverPushSubscription>;
  private clients: Map<string, Client>;
  private clientSessions: Map<string, ClientSession>;
  private verificationCodes: Map<string, VerificationCode>;
  private walletTransactions: Map<string, WalletTransaction>;
  private clientRatings: Map<string, ClientRating>;

  constructor() {
    this.users = new Map();
    this.orders = new Map();
    this.driverSessions = new Map();
    this.pushSubscriptions = new Map();
    this.clients = new Map();
    this.clientSessions = new Map();
    this.verificationCodes = new Map();
    this.walletTransactions = new Map();
    this.clientRatings = new Map();
    
    // Clean up expired sessions every hour
    setInterval(() => {
      this.deleteExpiredSessions();
      this.deleteExpiredVerificationCodes();
    }, 60 * 60 * 1000);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Order methods
  async createOrder(insertOrder: InsertOrder, clientId?: string): Promise<Order> {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000); // Expires in 60 seconds
    
    const order: Order = {
      ...insertOrder,
      id,
      clientId: clientId ?? null,
      status: "pending",
      assignedDriverId: null,
      clientRatingId: null,
      driverRatingId: null,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    
    this.orders.set(id, order);
    return order;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getPendingOrders(): Promise<Order[]> {
    const now = new Date();
    return Array.from(this.orders.values()).filter(
      (order) => order.status === "pending" && new Date(order.expiresAt) > now
    );
  }

  async updateOrderStatus(id: string, status: Order["status"], driverId?: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const updatedOrder: Order = {
      ...order,
      status,
      assignedDriverId: driverId ?? order.assignedDriverId,
    };
    
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async getOrdersByDriver(driverId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.assignedDriverId === driverId
    );
  }

  async getOrdersByClient(clientId: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter((order) => order.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Driver Session methods
  async createDriverSession(driverId: string, driverName: string): Promise<DriverSession> {
    // Check if session already exists
    const existing = await this.getDriverSessionByDriverId(driverId);
    if (existing) {
      // Refresh existing session
      return this.refreshSessionExpiry(existing.id) as Promise<DriverSession>;
    }
    
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    
    const session: DriverSession = {
      id,
      driverId,
      driverName,
      isOnline: true,
      socketIds: [],
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastSeenAt: now.toISOString(),
    };
    
    this.driverSessions.set(id, session);
    return session;
  }

  async getDriverSession(id: string): Promise<DriverSession | undefined> {
    return this.driverSessions.get(id);
  }

  async getDriverSessionByDriverId(driverId: string): Promise<DriverSession | undefined> {
    return Array.from(this.driverSessions.values()).find(
      (session) => session.driverId === driverId
    );
  }

  async updateDriverOnlineStatus(sessionId: string, isOnline: boolean): Promise<DriverSession | undefined> {
    const session = this.driverSessions.get(sessionId);
    if (!session) return undefined;
    
    const updatedSession: DriverSession = {
      ...session,
      isOnline,
      lastSeenAt: new Date().toISOString(),
    };
    
    this.driverSessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async addSocketToSession(sessionId: string, socketId: string): Promise<void> {
    const session = this.driverSessions.get(sessionId);
    if (!session) return;
    
    if (!session.socketIds.includes(socketId)) {
      session.socketIds.push(socketId);
      session.lastSeenAt = new Date().toISOString();
      this.driverSessions.set(sessionId, session);
    }
  }

  async removeSocketFromSession(sessionId: string, socketId: string): Promise<void> {
    const session = this.driverSessions.get(sessionId);
    if (!session) return;
    
    session.socketIds = session.socketIds.filter(id => id !== socketId);
    this.driverSessions.set(sessionId, session);
  }

  async getOnlineDriverSessions(): Promise<DriverSession[]> {
    const now = new Date();
    return Array.from(this.driverSessions.values()).filter(
      (session) => session.isOnline && new Date(session.expiresAt) > now
    );
  }

  async deleteExpiredSessions(): Promise<number> {
    const now = new Date();
    let deleted = 0;
    
    const entries = Array.from(this.driverSessions.entries());
    for (const [id, session] of entries) {
      if (new Date(session.expiresAt) <= now) {
        this.driverSessions.delete(id);
        deleted++;
      }
    }
    
    return deleted;
  }

  async refreshSessionExpiry(sessionId: string): Promise<DriverSession | undefined> {
    const session = this.driverSessions.get(sessionId);
    if (!session) return undefined;
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const updatedSession: DriverSession = {
      ...session,
      expiresAt: expiresAt.toISOString(),
      lastSeenAt: now.toISOString(),
    };
    
    this.driverSessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  // Push Subscription methods
  async savePushSubscription(driverId: string, subscription: PushSubscription): Promise<DriverPushSubscription> {
    // Check if subscription already exists for this driver
    const existing = await this.getPushSubscription(driverId);
    if (existing) {
      // Update existing subscription
      const updated: DriverPushSubscription = {
        ...existing,
        subscription,
      };
      this.pushSubscriptions.set(driverId, updated);
      return updated;
    }
    
    // Create new subscription
    const id = randomUUID();
    const driverSub: DriverPushSubscription = {
      id,
      driverId,
      subscription,
      createdAt: new Date().toISOString(),
    };
    
    this.pushSubscriptions.set(driverId, driverSub);
    return driverSub;
  }

  async removePushSubscription(driverId: string): Promise<boolean> {
    return this.pushSubscriptions.delete(driverId);
  }

  async getPushSubscription(driverId: string): Promise<DriverPushSubscription | undefined> {
    return this.pushSubscriptions.get(driverId);
  }

  async getAllPushSubscriptions(): Promise<DriverPushSubscription[]> {
    return Array.from(this.pushSubscriptions.values());
  }

  // Client methods
  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const now = new Date();
    
    const client: Client = {
      id,
      phone: insertClient.phone,
      hashedPassword: hashPassword(insertClient.password),
      firstName: insertClient.firstName,
      lastName: insertClient.lastName,
      isVerified: false,
      walletBalance: 0,
      averageRating: null,
      totalRides: 0,
      createdAt: now.toISOString(),
    };
    
    this.clients.set(id, client);
    return client;
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(
      (client) => client.phone === phone
    );
  }

  async updateClientVerified(clientId: string, isVerified: boolean): Promise<Client | undefined> {
    const client = this.clients.get(clientId);
    if (!client) return undefined;
    
    const updated: Client = { ...client, isVerified };
    this.clients.set(clientId, updated);
    return updated;
  }

  async updateClientPassword(clientId: string, hashedPassword: string): Promise<Client | undefined> {
    const client = this.clients.get(clientId);
    if (!client) return undefined;
    
    const updated: Client = { ...client, hashedPassword };
    this.clients.set(clientId, updated);
    return updated;
  }

  async updateClientWallet(clientId: string, amount: number): Promise<Client | undefined> {
    const client = this.clients.get(clientId);
    if (!client) return undefined;
    
    const updated: Client = { 
      ...client, 
      walletBalance: client.walletBalance + amount 
    };
    this.clients.set(clientId, updated);
    return updated;
  }

  async updateClientRating(clientId: string, rating: number): Promise<Client | undefined> {
    const client = this.clients.get(clientId);
    if (!client) return undefined;
    
    // Calculate new average
    const ratings = await this.getClientRatings(clientId);
    const totalScore = ratings.reduce((sum, r) => sum + r.score, 0) + rating;
    const newAverage = totalScore / (ratings.length + 1);
    
    const updated: Client = { 
      ...client, 
      averageRating: Math.round(newAverage * 10) / 10,
      totalRides: client.totalRides + 1
    };
    this.clients.set(clientId, updated);
    return updated;
  }

  // Client Session methods
  async createClientSession(clientId: string): Promise<ClientSession> {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const session: ClientSession = {
      id,
      clientId,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
    };
    
    this.clientSessions.set(id, session);
    return session;
  }

  async getClientSession(id: string): Promise<ClientSession | undefined> {
    const session = this.clientSessions.get(id);
    if (!session) return undefined;
    
    // Check if expired
    if (new Date(session.expiresAt) <= new Date()) {
      this.clientSessions.delete(id);
      return undefined;
    }
    
    return session;
  }

  async deleteClientSession(id: string): Promise<boolean> {
    return this.clientSessions.delete(id);
  }

  async refreshClientSession(id: string): Promise<ClientSession | undefined> {
    const session = this.clientSessions.get(id);
    if (!session) return undefined;
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const updated: ClientSession = {
      ...session,
      expiresAt: expiresAt.toISOString(),
      lastSeenAt: now.toISOString(),
    };
    
    this.clientSessions.set(id, updated);
    return updated;
  }

  // Verification Code methods
  async createVerificationCode(phone: string, type: VerificationCode["type"]): Promise<VerificationCode> {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    
    // Delete any existing codes for this phone and type
    const entries = Array.from(this.verificationCodes.entries());
    for (const [key, code] of entries) {
      if (code.phone === phone && code.type === type && !code.usedAt) {
        this.verificationCodes.delete(key);
      }
    }
    
    const verificationCode: VerificationCode = {
      id,
      phone,
      code: generateVerificationCode(),
      type,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: now.toISOString(),
    };
    
    this.verificationCodes.set(id, verificationCode);
    console.log(`[SMS] Code de vérification pour ${phone}: ${verificationCode.code}`);
    return verificationCode;
  }

  async getVerificationCode(phone: string, code: string, type: VerificationCode["type"]): Promise<VerificationCode | undefined> {
    const now = new Date();
    return Array.from(this.verificationCodes.values()).find(
      (vc) => vc.phone === phone && 
              vc.code === code && 
              vc.type === type && 
              !vc.usedAt && 
              new Date(vc.expiresAt) > now
    );
  }

  async markVerificationCodeUsed(id: string): Promise<void> {
    const code = this.verificationCodes.get(id);
    if (code) {
      code.usedAt = new Date().toISOString();
      this.verificationCodes.set(id, code);
    }
  }

  async deleteExpiredVerificationCodes(): Promise<number> {
    const now = new Date();
    let deleted = 0;
    
    const codeEntries = Array.from(this.verificationCodes.entries());
    for (const [id, code] of codeEntries) {
      if (new Date(code.expiresAt) <= now || code.usedAt) {
        this.verificationCodes.delete(id);
        deleted++;
      }
    }
    
    return deleted;
  }

  // Wallet Transaction methods
  async createWalletTransaction(
    clientId: string, 
    type: "credit" | "debit", 
    amount: number, 
    description: string, 
    orderId?: string
  ): Promise<WalletTransaction> {
    const client = await this.getClient(clientId);
    if (!client) throw new Error("Client not found");
    
    const id = randomUUID();
    const now = new Date();
    
    // Update wallet balance
    const newBalance = type === "credit" 
      ? client.walletBalance + amount 
      : client.walletBalance - amount;
    
    await this.updateClientWallet(clientId, type === "credit" ? amount : -amount);
    
    const transaction: WalletTransaction = {
      id,
      clientId,
      type,
      amount,
      balanceAfter: newBalance,
      description,
      orderId: orderId ?? null,
      createdAt: now.toISOString(),
    };
    
    this.walletTransactions.set(id, transaction);
    return transaction;
  }

  async getWalletTransactions(clientId: string): Promise<WalletTransaction[]> {
    return Array.from(this.walletTransactions.values())
      .filter((t) => t.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Rating methods
  async createClientRating(clientId: string, orderId: string, score: number, comment?: string): Promise<ClientRating> {
    const id = randomUUID();
    const now = new Date();
    
    const rating: ClientRating = {
      id,
      clientId,
      orderId,
      score,
      comment: comment ?? null,
      createdAt: now.toISOString(),
    };
    
    this.clientRatings.set(id, rating);
    
    // Update client's average rating
    await this.updateClientRating(clientId, score);
    
    return rating;
  }

  async getClientRatings(clientId: string): Promise<ClientRating[]> {
    return Array.from(this.clientRatings.values())
      .filter((r) => r.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const storage = new MemStorage();
