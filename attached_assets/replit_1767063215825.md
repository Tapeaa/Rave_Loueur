# Overview

TĀPE'A is a French-language ride-sharing application built with React and Express, featuring dual interfaces for clients and drivers. The application provides users with booking capabilities, wallet management, pricing information, and document handling. Drivers access a separate interface via code 111 111 with active/inactive toggle functionality. The UI is designed as a mobile-first experience optimized for Safari with safe-area handling.

The stack consists of:
- **Frontend**: React with TypeScript, Vite as build tool, Wouter for routing, TanStack Query for data fetching
- **Backend**: Express.js with TypeScript
- **UI Framework**: Tailwind CSS with shadcn/ui component library
- **Maps**: Google Maps API with geolocation
- **Database**: PostgreSQL with Drizzle ORM (configured but minimal schema implemented)
- **Deployment**: Designed for Replit environment with specific development tooling

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Problem**: Need a lightweight, mobile-optimized single-page application with good developer experience.

**Solution**: React with Vite as the build tool, using TypeScript for type safety. The application uses a component-based architecture with shadcn/ui for pre-built, accessible UI components.

**Key Decisions**:
- **Routing**: Wouter chosen over React Router for its minimal bundle size (~1KB), suitable for simple routing needs
- **State Management**: TanStack Query handles server state, eliminating need for Redux/Zustand
- **Styling**: Tailwind CSS with shadcn/ui components provides utility-first styling with pre-built accessible components
- **Build Tool**: Vite provides fast HMR and optimized production builds

**Pros**: Fast development, small bundle size, excellent DX with HMR
**Cons**: Limited to client-side rendering, no built-in SSR capabilities

## Component Structure

**Mobile-First Design Pattern**: The entire UI is constrained to a max-width of 420px to simulate a mobile device with proper Safari safe-area handling.

### Client Pages
- `Accueil` - Home page with Google Maps, category bubbles, and booking entry
- `Reservation`, `CommandeOptions`, `CommandeDetails`, `CommandeSuccess` - Booking flow
- `Commandes` - Order history
- `Wallet` - Payment management with saved cards overview
- `CartesBancaires` - Card management with Stripe Elements integration
- `Profil`, `InfoPerso`, `Notifications`, `Confidentialite` - Profile settings
- `Tarifs` - Pricing information
- `Aide`, `Support` - Help and chat support
- `Documents` - Legal documents
- `Contact` - Contact information

### Driver Pages (access via code 111 111)
- `ChauffeurLogin` - Driver login with code verification
- `ChauffeurAccueil` - Driver home with active/inactive toggle
- `ChauffeurProfil` - Driver profile
- `ChauffeurCourses` - Trip history
- `ChauffeurGains` - Earnings dashboard
- `ChauffeurAide`, `ChauffeurSupport` - Help and support
- `ChauffeurDocuments` - Driver documents (license, insurance, etc.)

### Navigation
- Hamburger menu with sliding drawer for main navigation
- Category bubbles on home pages navigate to their respective sections
- Client categories: Tarifs, Commandes, Paiement, Documents, Contact
- Driver categories: Commandes, Paiement, Documents, Contact (no Tarifs)

All components use the shadcn/ui design system with Radix UI primitives for accessibility.

## Backend Architecture

**Problem**: Need a simple REST API server that can serve both the SPA and handle API requests.

**Solution**: Express.js server with TypeScript, configured to serve Vite in development and static files in production.

**Key Decisions**:
- **Server Framework**: Express chosen for simplicity and middleware ecosystem
- **Development Mode**: Vite middleware integration for HMR during development
- **Storage Layer**: Abstracted storage interface (`IStorage`) with in-memory implementation (`MemStorage`)
- **API Design**: Routes prefixed with `/api`, all other routes serve the SPA

**Pros**: Simple, well-understood patterns; easy to extend
**Cons**: Currently minimal backend logic implemented; no authentication yet

## Data Storage

**Problem**: Need persistent data storage with type-safe queries.

**Solution**: Drizzle ORM with PostgreSQL, specifically configured for Neon serverless database.

**Schema Design**:
- Single `users` table with `id`, `username`, and `password` fields
- UUID primary keys using PostgreSQL's `gen_random_uuid()`
- Schema validation using Drizzle-Zod for runtime type safety

**Current Implementation**:
- Storage interface defined with CRUD operations for users
- In-memory implementation (`MemStorage`) used as fallback/development storage
- Database migrations configured in `/migrations` directory

**Pros**: Type-safe queries, automatic migration generation, serverless-compatible
**Cons**: Schema is minimal; no actual database integration in routes yet

## Authentication & Authorization

**Status**: Fully implemented

**Implementation**:
- Session-based authentication using cookies (`clientSessionId`)
- Password hashing with scrypt (built-in Node.js crypto)
- Client authentication via phone number (+689 prefix) and password
- Driver authentication via 6-digit access codes
- Protected API endpoints verify session before processing

## Payment Integration (Stripe)

**Status**: Fully implemented

**Implementation**:
- Stripe SDK integration for card payment processing
- Database tables: `stripeCustomers`, `paymentMethods`, `invoices`
- Frontend card management via Stripe Elements (`@stripe/react-stripe-js`)
- Secure API endpoints with session-based authentication:
  - POST `/api/stripe/customer` - Create/get Stripe customer
  - POST `/api/stripe/setup-intent` - Create SetupIntent for card setup
  - POST `/api/stripe/payment-method` - Save card after setup
  - GET `/api/stripe/payment-methods/:clientId` - List saved cards
  - DELETE `/api/stripe/payment-method/:id` - Delete a card
  - POST `/api/stripe/payment-method/:id/default` - Set default card
  - POST `/api/stripe/payment-intent` - Create PaymentIntent for rides
  - POST `/api/stripe/confirm-payment` - Confirm payment and update invoice
  - GET `/api/stripe/invoices/:clientId` - Get client invoices

**Security**:
- All Stripe endpoints require authenticated session
- Ownership verification for all card/invoice operations
- Zod validation on all request bodies
- Client can only access their own payment data

**Environment Variables**:
- `STRIPE_SECRET_KEY` - Backend Stripe API key
- `VITE_STRIPE_PUBLISHABLE_KEY` - Frontend publishable key

## External Dependencies

### Third-Party UI Libraries
- **shadcn/ui**: Complete UI component library built on Radix UI primitives
- **Radix UI**: Headless, accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- **Lucide React**: Icon library for consistent iconography
- **class-variance-authority**: Utility for managing component variants
- **Tailwind CSS**: Utility-first CSS framework

### Data Fetching & State
- **TanStack Query v5**: Server state management and caching
- **React Hook Form**: Form state management
- **Zod**: Runtime schema validation

### Database & Backend
- **Drizzle ORM**: Type-safe SQL query builder
- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### Routing & Navigation
- **Wouter**: Lightweight routing library (~1KB)

### Development Tools
- **Vite**: Build tool and dev server
- **TypeScript**: Static type checking
- **@replit/vite-plugin-***: Replit-specific development plugins for error handling and debugging

### Build & Deployment
- **esbuild**: Used to bundle server code for production
- **tsx**: TypeScript execution for development server

### Styling & Utilities
- **date-fns**: Date manipulation and formatting
- **clsx + tailwind-merge**: Utility for conditional className composition
- **embla-carousel-react**: Carousel/slider component
- **cmdk**: Command palette component

## Configuration Notes

- **Module System**: ESM throughout (type: "module" in package.json)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` to `shared/`
- **Build Output**: Client builds to `dist/public`, server bundles to `dist/index.js`
- **Database URL**: Required via `DATABASE_URL` environment variable
- **Replit Integration**: Conditional loading of Replit-specific plugins in development