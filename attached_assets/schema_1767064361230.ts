import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Drivers table (for driver accounts)
export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone").notNull().unique(),
  code: text("code").notNull(), // 6-digit access code
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  vehicleModel: text("vehicle_model"),
  vehicleColor: text("vehicle_color"),
  vehiclePlate: text("vehicle_plate"),
  isActive: boolean("is_active").default(true).notNull(),
  averageRating: real("average_rating"),
  totalRides: integer("total_rides").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Driver schema
export const driverSchema = z.object({
  id: z.string(),
  phone: z.string(),
  code: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  vehicleModel: z.string().nullable(),
  vehicleColor: z.string().nullable(),
  vehiclePlate: z.string().nullable(),
  isActive: z.boolean(),
  averageRating: z.number().nullable(),
  totalRides: z.number(),
  createdAt: z.string(),
});

export type Driver = z.infer<typeof driverSchema>;

export const insertDriverSchema = z.object({
  phone: z.string(),
  code: z.string().length(6, "Le code doit contenir 6 chiffres"),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  vehicleModel: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehiclePlate: z.string().optional(),
});

export type InsertDriver = z.infer<typeof insertDriverSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Client table (for authenticated customers)
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  isVerified: boolean("is_verified").default(false).notNull(),
  walletBalance: real("wallet_balance").default(0).notNull(),
  averageRating: real("average_rating"),
  totalRides: integer("total_rides").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Client sessions table
export const clientSessions = pgTable("client_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

// Driver sessions table (persistent across server restarts)
export const driverSessions = pgTable("driver_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  driverName: text("driver_name").notNull(),
  isOnline: boolean("is_online").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

// Stripe customer and payment methods for clients
export const stripeCustomers = pgTable("stripe_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id).unique(),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Saved payment methods (cards)
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),
  last4: text("last4").notNull(),
  brand: text("brand").notNull(), // visa, mastercard, etc.
  expiryMonth: integer("expiry_month").notNull(),
  expiryYear: integer("expiry_year").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Invoices for completed rides
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  amount: real("amount").notNull(),
  currency: text("currency").default("XPF").notNull(),
  status: text("status").default("pending").notNull(), // pending, paid, failed
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
});

// Verification codes table (for SMS verification)
export const verificationCodes = pgTable("verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  type: text("type").notNull(), // "registration", "login", "password_reset"
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  addresses: jsonb("addresses").notNull(),
  rideOption: jsonb("ride_option").notNull(),
  routeInfo: jsonb("route_info"),
  passengers: integer("passengers").notNull(),
  supplements: jsonb("supplements").notNull(),
  totalPrice: real("total_price").notNull(),
  driverEarnings: real("driver_earnings").notNull(),
  paymentMethod: text("payment_method").default("cash").notNull(), // "cash" or "card"
  scheduledTime: timestamp("scheduled_time"),
  isAdvanceBooking: boolean("is_advance_booking").default(false).notNull(),
  status: text("status").default("pending").notNull(),
  assignedDriverId: varchar("assigned_driver_id"),
  clientRatingId: varchar("client_rating_id"),
  driverRatingId: varchar("driver_rating_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Client schema (for authenticated customers)
export const clientSchema = z.object({
  id: z.string(),
  phone: z.string(), // E.164 format with +689 prefix
  hashedPassword: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  isVerified: z.boolean(),
  walletBalance: z.number(),
  averageRating: z.number().nullable(),
  totalRides: z.number(),
  createdAt: z.string(),
});

export type Client = z.infer<typeof clientSchema>;

// Update client profile schema
export const updateClientProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
});

export type UpdateClientProfile = z.infer<typeof updateClientProfileSchema>;

// Update driver profile schema
export const updateDriverProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  vehicleModel: z.string().nullable().optional(),
  vehicleColor: z.string().nullable().optional(),
  vehiclePlate: z.string().nullable().optional(),
});

export type UpdateDriverProfile = z.infer<typeof updateDriverProfileSchema>;

// Insert client schema (for registration)
export const insertClientSchema = z.object({
  phone: z.string().regex(/^\+689\d{6,8}$/, "Numéro de téléphone invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
});

export type InsertClient = z.infer<typeof insertClientSchema>;

// Client session schema
export const clientSessionSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
});

export type ClientSession = z.infer<typeof clientSessionSchema>;

// Verification code schema (for SMS verification)
export const verificationCodeSchema = z.object({
  id: z.string(),
  phone: z.string(),
  code: z.string(),
  type: z.enum(["registration", "login", "password_reset"]),
  expiresAt: z.string(),
  usedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type VerificationCode = z.infer<typeof verificationCodeSchema>;

// Wallet transaction schema
export const walletTransactionSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  type: z.enum(["credit", "debit"]),
  amount: z.number(),
  balanceAfter: z.number(),
  description: z.string(),
  orderId: z.string().nullable(),
  createdAt: z.string(),
});

export type WalletTransaction = z.infer<typeof walletTransactionSchema>;

// Client rating schema
export const clientRatingSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  orderId: z.string(),
  score: z.number().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.string(),
});

export type ClientRating = z.infer<typeof clientRatingSchema>;

// Order supplement schema
export const supplementSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.enum(["bagages", "encombrants"]),
  price: z.number(),
  quantity: z.number(),
});

export type Supplement = z.infer<typeof supplementSchema>;

// Route info schema
export const routeInfoSchema = z.object({
  distance: z.number(),
  duration: z.string(),
});

export type RouteInfo = z.infer<typeof routeInfoSchema>;

// Address field schema
export const addressFieldSchema = z.object({
  id: z.string(),
  value: z.string(),
  placeId: z.string().nullable(),
  type: z.enum(["pickup", "stop", "destination"]),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type AddressField = z.infer<typeof addressFieldSchema>;

// Order status
export const orderStatusSchema = z.enum([
  "pending", 
  "accepted", 
  "declined", 
  "expired", 
  "cancelled",
  "driver_enroute",
  "driver_arrived",
  "in_progress",
  "completed",
  "payment_pending",
  "payment_confirmed",
  "payment_failed"
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

// Order schema
export const orderSchema = z.object({
  id: z.string(),
  clientId: z.string().nullable(), // Linked to authenticated client
  clientName: z.string(),
  clientPhone: z.string(),
  addresses: z.array(addressFieldSchema),
  rideOption: z.object({
    id: z.string(),
    title: z.string(),
    price: z.number(),
    pricePerKm: z.number(),
  }),
  routeInfo: routeInfoSchema.optional(),
  passengers: z.number().min(1).max(8),
  supplements: z.array(supplementSchema),
  paymentMethod: z.enum(["cash", "card"]),
  totalPrice: z.number(),
  driverEarnings: z.number(),
  scheduledTime: z.string().nullable(),
  isAdvanceBooking: z.boolean(),
  status: orderStatusSchema,
  assignedDriverId: z.string().nullable(),
  clientRatingId: z.string().nullable(), // Rating given by client
  driverRatingId: z.string().nullable(), // Rating given by driver
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type Order = z.infer<typeof orderSchema>;

// Insert order schema (for creating new orders)
export const insertOrderSchema = orderSchema.omit({
  id: true,
  clientId: true,
  status: true,
  assignedDriverId: true,
  clientRatingId: true,
  driverRatingId: true,
  createdAt: true,
  expiresAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;

// Driver session schema
export const driverSessionSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  driverName: z.string(),
  isOnline: z.boolean(),
  socketIds: z.array(z.string()),
  createdAt: z.string(),
  expiresAt: z.string(),
  lastSeenAt: z.string(),
});

export type DriverSession = z.infer<typeof driverSessionSchema>;

// Push subscription schema for iOS PWA notifications
export const pushSubscriptionSchema = z.object({
  endpoint: z.string(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export type PushSubscription = z.infer<typeof pushSubscriptionSchema>;

// Driver push subscription (links subscription to driver)
export const driverPushSubscriptionSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  subscription: pushSubscriptionSchema,
  createdAt: z.string(),
});

export type DriverPushSubscription = z.infer<typeof driverPushSubscriptionSchema>;

// Stripe customer schema
export const stripeCustomerSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  stripeCustomerId: z.string(),
  createdAt: z.string(),
});

export type StripeCustomer = z.infer<typeof stripeCustomerSchema>;

// Payment method schema
export const paymentMethodSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  stripePaymentMethodId: z.string(),
  last4: z.string(),
  brand: z.string(),
  expiryMonth: z.number(),
  expiryYear: z.number(),
  isDefault: z.boolean(),
  createdAt: z.string(),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// Invoice schema
export const invoiceSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  orderId: z.string(),
  stripePaymentIntentId: z.string().nullable(),
  stripeInvoiceId: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["pending", "paid", "failed"]),
  pdfUrl: z.string().nullable(),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
});

export type Invoice = z.infer<typeof invoiceSchema>;
