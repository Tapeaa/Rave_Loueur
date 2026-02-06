import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "./db";
import { 
  clients, 
  clientSessions, 
  driverSessions,
  verificationCodes,
  orders,
  drivers,
  stripeCustomers,
  paymentMethods,
  invoices
} from "@shared/schema";
import { 
  type Client,
  type InsertClient,
  type ClientSession,
  type VerificationCode,
  type Order,
  type InsertOrder,
  type AddressField,
  type Driver,
  type InsertDriver,
  type StripeCustomer,
  type PaymentMethod,
  type Invoice,
  type DriverSession
} from "@shared/schema";
import { randomUUID, scryptSync, randomBytes } from "crypto";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const testHash = scryptSync(password, salt, 64).toString("hex");
  return hash === testHash;
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export { hashPassword, verifyPassword };

export class DbStorage {
  async createClient(insertClient: InsertClient): Promise<Client> {
    const hashedPassword = hashPassword(insertClient.password);
    
    const [client] = await db.insert(clients).values({
      phone: insertClient.phone,
      hashedPassword,
      firstName: insertClient.firstName,
      lastName: insertClient.lastName,
      isVerified: false,
      walletBalance: 0,
      totalRides: 0,
    }).returning();
    
    return {
      id: client.id,
      phone: client.phone,
      hashedPassword: client.hashedPassword,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      isVerified: client.isVerified,
      walletBalance: client.walletBalance,
      averageRating: client.averageRating,
      totalRides: client.totalRides,
      createdAt: client.createdAt.toISOString(),
    };
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) return undefined;
    
    return {
      id: client.id,
      phone: client.phone,
      hashedPassword: client.hashedPassword,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      isVerified: client.isVerified,
      walletBalance: client.walletBalance,
      averageRating: client.averageRating,
      totalRides: client.totalRides,
      createdAt: client.createdAt.toISOString(),
    };
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.phone, phone));
    if (!client) return undefined;
    
    return {
      id: client.id,
      phone: client.phone,
      hashedPassword: client.hashedPassword,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      isVerified: client.isVerified,
      walletBalance: client.walletBalance,
      averageRating: client.averageRating,
      totalRides: client.totalRides,
      createdAt: client.createdAt.toISOString(),
    };
  }

  async updateClientVerified(clientId: string, isVerified: boolean): Promise<Client | undefined> {
    const [client] = await db.update(clients)
      .set({ isVerified })
      .where(eq(clients.id, clientId))
      .returning();
    
    if (!client) return undefined;
    
    return {
      id: client.id,
      phone: client.phone,
      hashedPassword: client.hashedPassword,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      isVerified: client.isVerified,
      walletBalance: client.walletBalance,
      averageRating: client.averageRating,
      totalRides: client.totalRides,
      createdAt: client.createdAt.toISOString(),
    };
  }

  async updateClientPassword(clientId: string, hashedPassword: string): Promise<Client | undefined> {
    const [client] = await db.update(clients)
      .set({ hashedPassword })
      .where(eq(clients.id, clientId))
      .returning();
    
    if (!client) return undefined;
    
    return {
      id: client.id,
      phone: client.phone,
      hashedPassword: client.hashedPassword,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      isVerified: client.isVerified,
      walletBalance: client.walletBalance,
      averageRating: client.averageRating,
      totalRides: client.totalRides,
      createdAt: client.createdAt.toISOString(),
    };
  }

  async updateClientWallet(clientId: string, amount: number): Promise<Client | undefined> {
    const current = await this.getClient(clientId);
    if (!current) return undefined;
    
    const newBalance = current.walletBalance + amount;
    
    const [client] = await db.update(clients)
      .set({ walletBalance: newBalance })
      .where(eq(clients.id, clientId))
      .returning();
    
    if (!client) return undefined;
    
    return {
      id: client.id,
      phone: client.phone,
      hashedPassword: client.hashedPassword,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      isVerified: client.isVerified,
      walletBalance: client.walletBalance,
      averageRating: client.averageRating,
      totalRides: client.totalRides,
      createdAt: client.createdAt.toISOString(),
    };
  }

  async updateClientProfile(clientId: string, data: { firstName?: string; lastName?: string; email?: string | null }): Promise<Client | undefined> {
    const updateData: Record<string, unknown> = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;
    
    if (Object.keys(updateData).length === 0) {
      return this.getClient(clientId);
    }
    
    const [client] = await db.update(clients)
      .set(updateData)
      .where(eq(clients.id, clientId))
      .returning();
    
    if (!client) return undefined;
    
    return {
      id: client.id,
      phone: client.phone,
      hashedPassword: client.hashedPassword,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      isVerified: client.isVerified,
      walletBalance: client.walletBalance,
      averageRating: client.averageRating,
      totalRides: client.totalRides,
      createdAt: client.createdAt.toISOString(),
    };
  }

  async updateDriverProfile(driverId: string, data: { firstName?: string; lastName?: string; vehicleModel?: string | null; vehicleColor?: string | null; vehiclePlate?: string | null }): Promise<Driver | undefined> {
    const updateData: Record<string, unknown> = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.vehicleModel !== undefined) updateData.vehicleModel = data.vehicleModel;
    if (data.vehicleColor !== undefined) updateData.vehicleColor = data.vehicleColor;
    if (data.vehiclePlate !== undefined) updateData.vehiclePlate = data.vehiclePlate;
    
    if (Object.keys(updateData).length === 0) {
      return this.getDriver(driverId);
    }
    
    const [driver] = await db.update(drivers)
      .set(updateData)
      .where(eq(drivers.id, driverId))
      .returning();
    
    if (!driver) return undefined;
    
    return {
      id: driver.id,
      phone: driver.phone,
      code: driver.code,
      firstName: driver.firstName,
      lastName: driver.lastName,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      vehiclePlate: driver.vehiclePlate,
      isActive: driver.isActive,
      averageRating: driver.averageRating,
      totalRides: driver.totalRides,
      createdAt: driver.createdAt.toISOString(),
    };
  }

  async createClientSession(clientId: string): Promise<ClientSession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const [session] = await db.insert(clientSessions).values({
      clientId,
      expiresAt,
    }).returning();
    
    return {
      id: session.id,
      clientId: session.clientId,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
    };
  }

  async getClientSession(id: string): Promise<ClientSession | undefined> {
    const now = new Date();
    const [session] = await db.select()
      .from(clientSessions)
      .where(and(
        eq(clientSessions.id, id),
        gt(clientSessions.expiresAt, now)
      ));
    
    if (!session) return undefined;
    
    return {
      id: session.id,
      clientId: session.clientId,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
    };
  }

  async deleteClientSession(id: string): Promise<boolean> {
    const result = await db.delete(clientSessions)
      .where(eq(clientSessions.id, id));
    return true;
  }

  async refreshClientSession(id: string): Promise<ClientSession | undefined> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const [session] = await db.update(clientSessions)
      .set({ expiresAt, lastSeenAt: now })
      .where(eq(clientSessions.id, id))
      .returning();
    
    if (!session) return undefined;
    
    return {
      id: session.id,
      clientId: session.clientId,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
    };
  }

  // Driver session methods (persistent in database)
  // sessionId parameter allows syncing with in-memory session ID
  async createDbDriverSession(driverId: string, driverName: string, sessionId?: string): Promise<{ id: string; driverId: string; driverName: string; expiresAt: string }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // If sessionId provided, check if it already exists in database
    if (sessionId) {
      const existingById = await this.getDbDriverSession(sessionId);
      if (existingById) {
        // Session already exists, just refresh it
        return this.refreshDbDriverSession(sessionId) as Promise<{ id: string; driverId: string; driverName: string; expiresAt: string }>;
      }
    }
    
    // Check if a different session already exists for this driver
    const existingSession = await this.getDbDriverSessionByDriverId(driverId);
    if (existingSession) {
      // Delete old session and create new one with the in-memory session ID
      await db.delete(driverSessions).where(eq(driverSessions.id, existingSession.id));
    }
    
    // Create new session with the provided sessionId (or let DB generate one)
    const insertValues: any = {
      driverId,
      driverName,
      expiresAt,
      isOnline: false,
    };
    
    if (sessionId) {
      insertValues.id = sessionId;
    }
    
    const [session] = await db.insert(driverSessions).values(insertValues).returning();
    
    return {
      id: session.id,
      driverId: session.driverId,
      driverName: session.driverName,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async getDbDriverSession(id: string): Promise<{ id: string; driverId: string; driverName: string; expiresAt: string } | undefined> {
    const now = new Date();
    const [session] = await db.select()
      .from(driverSessions)
      .where(and(
        eq(driverSessions.id, id),
        gt(driverSessions.expiresAt, now)
      ));
    
    if (!session) return undefined;
    
    return {
      id: session.id,
      driverId: session.driverId,
      driverName: session.driverName,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async getDbDriverSessionByDriverId(driverId: string): Promise<{ id: string; driverId: string; driverName: string; expiresAt: string } | undefined> {
    const now = new Date();
    const [session] = await db.select()
      .from(driverSessions)
      .where(and(
        eq(driverSessions.driverId, driverId),
        gt(driverSessions.expiresAt, now)
      ));
    
    if (!session) return undefined;
    
    return {
      id: session.id,
      driverId: session.driverId,
      driverName: session.driverName,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async refreshDbDriverSession(id: string): Promise<{ id: string; driverId: string; driverName: string; expiresAt: string } | undefined> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const [session] = await db.update(driverSessions)
      .set({ expiresAt, lastSeenAt: now })
      .where(eq(driverSessions.id, id))
      .returning();
    
    if (!session) return undefined;
    
    return {
      id: session.id,
      driverId: session.driverId,
      driverName: session.driverName,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async createVerificationCode(phone: string, type: "registration" | "login" | "password_reset"): Promise<VerificationCode> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const code = generateVerificationCode();
    
    const [vc] = await db.insert(verificationCodes).values({
      phone,
      code,
      type,
      expiresAt,
    }).returning();
    
    console.log(`[SMS] Code de vérification pour ${phone}: ${code}`);
    
    return {
      id: vc.id,
      phone: vc.phone,
      code: vc.code,
      type: vc.type as "registration" | "login" | "password_reset",
      expiresAt: vc.expiresAt.toISOString(),
      usedAt: vc.usedAt?.toISOString() ?? null,
      createdAt: vc.createdAt.toISOString(),
    };
  }

  async getVerificationCode(phone: string, code: string, type: "registration" | "login" | "password_reset"): Promise<VerificationCode | undefined> {
    const now = new Date();
    const [vc] = await db.select()
      .from(verificationCodes)
      .where(and(
        eq(verificationCodes.phone, phone),
        eq(verificationCodes.code, code),
        eq(verificationCodes.type, type),
        isNull(verificationCodes.usedAt),
        gt(verificationCodes.expiresAt, now)
      ));
    
    if (!vc) return undefined;
    
    return {
      id: vc.id,
      phone: vc.phone,
      code: vc.code,
      type: vc.type as "registration" | "login" | "password_reset",
      expiresAt: vc.expiresAt.toISOString(),
      usedAt: vc.usedAt?.toISOString() ?? null,
      createdAt: vc.createdAt.toISOString(),
    };
  }

  async markVerificationCodeUsed(id: string): Promise<void> {
    await db.update(verificationCodes)
      .set({ usedAt: new Date() })
      .where(eq(verificationCodes.id, id));
  }

  async createOrder(insertOrder: InsertOrder, clientId?: string): Promise<Order> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000);
    
    const [order] = await db.insert(orders).values({
      clientId: clientId ?? null,
      clientName: insertOrder.clientName,
      clientPhone: insertOrder.clientPhone,
      addresses: insertOrder.addresses as any,
      rideOption: insertOrder.rideOption as any,
      routeInfo: insertOrder.routeInfo as any,
      passengers: insertOrder.passengers,
      supplements: insertOrder.supplements as any,
      totalPrice: insertOrder.totalPrice,
      driverEarnings: insertOrder.driverEarnings,
      paymentMethod: insertOrder.paymentMethod || "cash",
      scheduledTime: insertOrder.scheduledTime ? new Date(insertOrder.scheduledTime) : null,
      isAdvanceBooking: insertOrder.isAdvanceBooking,
      status: "pending",
      expiresAt,
    }).returning();
    
    return {
      id: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      addresses: order.addresses as AddressField[],
      rideOption: order.rideOption as Order["rideOption"],
      routeInfo: order.routeInfo as Order["routeInfo"],
      passengers: order.passengers,
      supplements: order.supplements as Order["supplements"],
      totalPrice: order.totalPrice,
      driverEarnings: order.driverEarnings,
      paymentMethod: (order.paymentMethod || "cash") as Order["paymentMethod"],
      scheduledTime: order.scheduledTime?.toISOString() ?? null,
      isAdvanceBooking: order.isAdvanceBooking,
      status: order.status as Order["status"],
      assignedDriverId: order.assignedDriverId,
      clientRatingId: order.clientRatingId,
      driverRatingId: order.driverRatingId,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString(),
    };
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;
    
    return {
      id: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      addresses: order.addresses as AddressField[],
      rideOption: order.rideOption as Order["rideOption"],
      routeInfo: order.routeInfo as Order["routeInfo"],
      passengers: order.passengers,
      supplements: order.supplements as Order["supplements"],
      totalPrice: order.totalPrice,
      driverEarnings: order.driverEarnings,
      paymentMethod: (order.paymentMethod || "cash") as Order["paymentMethod"],
      scheduledTime: order.scheduledTime?.toISOString() ?? null,
      isAdvanceBooking: order.isAdvanceBooking,
      status: order.status as Order["status"],
      assignedDriverId: order.assignedDriverId,
      clientRatingId: order.clientRatingId,
      driverRatingId: order.driverRatingId,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString(),
    };
  }

  async getPendingOrders(): Promise<Order[]> {
    const now = new Date();
    const result = await db.select()
      .from(orders)
      .where(and(
        eq(orders.status, "pending"),
        gt(orders.expiresAt, now)
      ));
    
    return result.map((order: typeof orders.$inferSelect) => ({
      id: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      addresses: order.addresses as AddressField[],
      rideOption: order.rideOption as Order["rideOption"],
      routeInfo: order.routeInfo as Order["routeInfo"],
      passengers: order.passengers,
      supplements: order.supplements as Order["supplements"],
      totalPrice: order.totalPrice,
      driverEarnings: order.driverEarnings,
      paymentMethod: (order.paymentMethod || "cash") as Order["paymentMethod"],
      scheduledTime: order.scheduledTime?.toISOString() ?? null,
      isAdvanceBooking: order.isAdvanceBooking,
      status: order.status as Order["status"],
      assignedDriverId: order.assignedDriverId,
      clientRatingId: order.clientRatingId,
      driverRatingId: order.driverRatingId,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString(),
    }));
  }

  async updateOrderStatus(id: string, status: Order["status"], driverId?: string): Promise<Order | undefined> {
    const updateData: any = { status };
    if (driverId) updateData.assignedDriverId = driverId;
    
    const [order] = await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    
    if (!order) return undefined;
    
    return {
      id: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      addresses: order.addresses as AddressField[],
      rideOption: order.rideOption as Order["rideOption"],
      routeInfo: order.routeInfo as Order["routeInfo"],
      passengers: order.passengers,
      supplements: order.supplements as Order["supplements"],
      totalPrice: order.totalPrice,
      driverEarnings: order.driverEarnings,
      paymentMethod: (order.paymentMethod || "cash") as Order["paymentMethod"],
      scheduledTime: order.scheduledTime?.toISOString() ?? null,
      isAdvanceBooking: order.isAdvanceBooking,
      status: order.status as Order["status"],
      assignedDriverId: order.assignedDriverId,
      clientRatingId: order.clientRatingId,
      driverRatingId: order.driverRatingId,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString(),
    };
  }

  async updateOrderPaymentMethod(id: string, paymentMethod: Order["paymentMethod"]): Promise<Order | undefined> {
    const [order] = await db.update(orders)
      .set({ paymentMethod })
      .where(eq(orders.id, id))
      .returning();
    
    if (!order) return undefined;
    
    return {
      id: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      addresses: order.addresses as AddressField[],
      rideOption: order.rideOption as Order["rideOption"],
      routeInfo: order.routeInfo as Order["routeInfo"],
      passengers: order.passengers,
      supplements: order.supplements as Order["supplements"],
      totalPrice: order.totalPrice,
      driverEarnings: order.driverEarnings,
      paymentMethod: (order.paymentMethod || "cash") as Order["paymentMethod"],
      scheduledTime: order.scheduledTime?.toISOString() ?? null,
      isAdvanceBooking: order.isAdvanceBooking,
      status: order.status as Order["status"],
      assignedDriverId: order.assignedDriverId,
      clientRatingId: order.clientRatingId,
      driverRatingId: order.driverRatingId,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString(),
    };
  }

  async getOrdersByClient(clientId: string): Promise<Order[]> {
    const result = await db.select()
      .from(orders)
      .where(eq(orders.clientId, clientId));
    
    return result.map((order: typeof orders.$inferSelect) => ({
      id: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      addresses: order.addresses as AddressField[],
      rideOption: order.rideOption as Order["rideOption"],
      routeInfo: order.routeInfo as Order["routeInfo"],
      passengers: order.passengers,
      supplements: order.supplements as Order["supplements"],
      totalPrice: order.totalPrice,
      driverEarnings: order.driverEarnings,
      paymentMethod: (order.paymentMethod || "cash") as Order["paymentMethod"],
      scheduledTime: order.scheduledTime?.toISOString() ?? null,
      isAdvanceBooking: order.isAdvanceBooking,
      status: order.status as Order["status"],
      assignedDriverId: order.assignedDriverId,
      clientRatingId: order.clientRatingId,
      driverRatingId: order.driverRatingId,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString(),
    })).sort((a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getOrdersByDriver(driverId: string): Promise<Order[]> {
    const result = await db.select()
      .from(orders)
      .where(eq(orders.assignedDriverId, driverId));
    
    return result.map((order: typeof orders.$inferSelect) => ({
      id: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      addresses: order.addresses as AddressField[],
      rideOption: order.rideOption as Order["rideOption"],
      routeInfo: order.routeInfo as Order["routeInfo"],
      passengers: order.passengers,
      supplements: order.supplements as Order["supplements"],
      totalPrice: order.totalPrice,
      driverEarnings: order.driverEarnings,
      paymentMethod: (order.paymentMethod || "cash") as Order["paymentMethod"],
      scheduledTime: order.scheduledTime?.toISOString() ?? null,
      isAdvanceBooking: order.isAdvanceBooking,
      status: order.status as Order["status"],
      assignedDriverId: order.assignedDriverId,
      clientRatingId: order.clientRatingId,
      driverRatingId: order.driverRatingId,
      createdAt: order.createdAt.toISOString(),
      expiresAt: order.expiresAt.toISOString(),
    }));
  }

  // Driver methods
  async createDriver(insertDriver: InsertDriver): Promise<Driver> {
    const [driver] = await db.insert(drivers).values({
      phone: insertDriver.phone,
      code: insertDriver.code,
      firstName: insertDriver.firstName,
      lastName: insertDriver.lastName,
      vehicleModel: insertDriver.vehicleModel ?? null,
      vehicleColor: insertDriver.vehicleColor ?? null,
      vehiclePlate: insertDriver.vehiclePlate ?? null,
      isActive: true,
      totalRides: 0,
    }).returning();

    return {
      id: driver.id,
      phone: driver.phone,
      code: driver.code,
      firstName: driver.firstName,
      lastName: driver.lastName,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      vehiclePlate: driver.vehiclePlate,
      isActive: driver.isActive,
      averageRating: driver.averageRating,
      totalRides: driver.totalRides,
      createdAt: driver.createdAt.toISOString(),
    };
  }

  async getDriver(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    if (!driver) return undefined;

    return {
      id: driver.id,
      phone: driver.phone,
      code: driver.code,
      firstName: driver.firstName,
      lastName: driver.lastName,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      vehiclePlate: driver.vehiclePlate,
      isActive: driver.isActive,
      averageRating: driver.averageRating,
      totalRides: driver.totalRides,
      createdAt: driver.createdAt.toISOString(),
    };
  }

  async getDriverById(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    if (!driver) return undefined;

    return {
      id: driver.id,
      phone: driver.phone,
      code: driver.code,
      firstName: driver.firstName,
      lastName: driver.lastName,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      vehiclePlate: driver.vehiclePlate,
      isActive: driver.isActive,
      averageRating: driver.averageRating,
      totalRides: driver.totalRides,
      createdAt: driver.createdAt.toISOString(),
    };
  }

  async getDriverByPhone(phone: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.phone, phone));
    if (!driver) return undefined;

    return {
      id: driver.id,
      phone: driver.phone,
      code: driver.code,
      firstName: driver.firstName,
      lastName: driver.lastName,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      vehiclePlate: driver.vehiclePlate,
      isActive: driver.isActive,
      averageRating: driver.averageRating,
      totalRides: driver.totalRides,
      createdAt: driver.createdAt.toISOString(),
    };
  }

  async getDriverByCode(code: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.code, code));
    if (!driver) return undefined;

    return {
      id: driver.id,
      phone: driver.phone,
      code: driver.code,
      firstName: driver.firstName,
      lastName: driver.lastName,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      vehiclePlate: driver.vehiclePlate,
      isActive: driver.isActive,
      averageRating: driver.averageRating,
      totalRides: driver.totalRides,
      createdAt: driver.createdAt.toISOString(),
    };
  }

  async getAllDrivers(): Promise<Driver[]> {
    const result = await db.select().from(drivers);
    return result.map(driver => ({
      id: driver.id,
      phone: driver.phone,
      code: driver.code,
      firstName: driver.firstName,
      lastName: driver.lastName,
      vehicleModel: driver.vehicleModel,
      vehicleColor: driver.vehicleColor,
      vehiclePlate: driver.vehiclePlate,
      isActive: driver.isActive,
      averageRating: driver.averageRating,
      totalRides: driver.totalRides,
      createdAt: driver.createdAt.toISOString(),
    }));
  }

  // Stripe Customer Methods
  async getStripeCustomer(clientId: string): Promise<StripeCustomer | undefined> {
    const [customer] = await db.select().from(stripeCustomers).where(eq(stripeCustomers.clientId, clientId));
    if (!customer) return undefined;
    return {
      id: customer.id,
      clientId: customer.clientId,
      stripeCustomerId: customer.stripeCustomerId,
      createdAt: customer.createdAt.toISOString(),
    };
  }

  async createStripeCustomer(clientId: string, stripeCustomerId: string): Promise<StripeCustomer> {
    const [customer] = await db.insert(stripeCustomers).values({
      clientId,
      stripeCustomerId,
    }).returning();
    return {
      id: customer.id,
      clientId: customer.clientId,
      stripeCustomerId: customer.stripeCustomerId,
      createdAt: customer.createdAt.toISOString(),
    };
  }

  // Payment Methods
  async getPaymentMethods(clientId: string): Promise<PaymentMethod[]> {
    const result = await db.select().from(paymentMethods).where(eq(paymentMethods.clientId, clientId));
    return result.map(pm => ({
      id: pm.id,
      clientId: pm.clientId,
      stripePaymentMethodId: pm.stripePaymentMethodId,
      last4: pm.last4,
      brand: pm.brand,
      expiryMonth: pm.expiryMonth,
      expiryYear: pm.expiryYear,
      isDefault: pm.isDefault,
      createdAt: pm.createdAt.toISOString(),
    }));
  }

  async addPaymentMethod(data: {
    clientId: string;
    stripePaymentMethodId: string;
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
  }): Promise<PaymentMethod> {
    // If this is marked as default, unset other defaults first
    if (data.isDefault) {
      await db.update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.clientId, data.clientId));
    }
    
    const [pm] = await db.insert(paymentMethods).values(data).returning();
    return {
      id: pm.id,
      clientId: pm.clientId,
      stripePaymentMethodId: pm.stripePaymentMethodId,
      last4: pm.last4,
      brand: pm.brand,
      expiryMonth: pm.expiryMonth,
      expiryYear: pm.expiryYear,
      isDefault: pm.isDefault,
      createdAt: pm.createdAt.toISOString(),
    };
  }

  async deletePaymentMethod(id: string, clientId: string): Promise<boolean> {
    const result = await db.delete(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.clientId, clientId)));
    return true;
  }

  async setDefaultPaymentMethod(id: string, clientId: string): Promise<boolean> {
    await db.update(paymentMethods)
      .set({ isDefault: false })
      .where(eq(paymentMethods.clientId, clientId));
    await db.update(paymentMethods)
      .set({ isDefault: true })
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.clientId, clientId)));
    return true;
  }

  // Invoice Methods
  async createInvoice(data: {
    clientId: string;
    orderId: string;
    amount: number;
    stripePaymentIntentId?: string;
    stripeInvoiceId?: string;
  }): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values({
      clientId: data.clientId,
      orderId: data.orderId,
      amount: data.amount,
      stripePaymentIntentId: data.stripePaymentIntentId || null,
      stripeInvoiceId: data.stripeInvoiceId || null,
      status: "pending",
    }).returning();
    return {
      id: invoice.id,
      clientId: invoice.clientId,
      orderId: invoice.orderId,
      stripePaymentIntentId: invoice.stripePaymentIntentId,
      stripeInvoiceId: invoice.stripeInvoiceId,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status as Invoice["status"],
      pdfUrl: invoice.pdfUrl,
      createdAt: invoice.createdAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() || null,
    };
  }

  async updateInvoiceStatus(id: string, status: Invoice["status"], pdfUrl?: string, stripeInvoiceId?: string): Promise<Invoice | undefined> {
    const updateData: any = { status };
    if (status === "paid") {
      updateData.paidAt = new Date();
    }
    if (pdfUrl) {
      updateData.pdfUrl = pdfUrl;
    }
    if (stripeInvoiceId) {
      updateData.stripeInvoiceId = stripeInvoiceId;
    }
    
    const [invoice] = await db.update(invoices)
      .set(updateData)
      .where(eq(invoices.id, id))
      .returning();
    
    if (!invoice) return undefined;
    return {
      id: invoice.id,
      clientId: invoice.clientId,
      orderId: invoice.orderId,
      stripePaymentIntentId: invoice.stripePaymentIntentId,
      stripeInvoiceId: invoice.stripeInvoiceId,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status as Invoice["status"],
      pdfUrl: invoice.pdfUrl,
      createdAt: invoice.createdAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() || null,
    };
  }

  async getInvoicesByClient(clientId: string): Promise<Invoice[]> {
    const result = await db.select().from(invoices).where(eq(invoices.clientId, clientId));
    return result.map(invoice => ({
      id: invoice.id,
      clientId: invoice.clientId,
      orderId: invoice.orderId,
      stripePaymentIntentId: invoice.stripePaymentIntentId,
      stripeInvoiceId: invoice.stripeInvoiceId,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status as Invoice["status"],
      pdfUrl: invoice.pdfUrl,
      createdAt: invoice.createdAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() || null,
    }));
  }

  async getInvoiceByOrder(orderId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.orderId, orderId));
    if (!invoice) return undefined;
    return {
      id: invoice.id,
      clientId: invoice.clientId,
      orderId: invoice.orderId,
      stripePaymentIntentId: invoice.stripePaymentIntentId,
      stripeInvoiceId: invoice.stripeInvoiceId,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status as Invoice["status"],
      pdfUrl: invoice.pdfUrl,
      createdAt: invoice.createdAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() || null,
    };
  }
}

export const dbStorage = new DbStorage();
