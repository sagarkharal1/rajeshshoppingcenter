# Workspace

## Overview

Full-stack mobile e-commerce app — **Rajesh Shopping Center** (est. 1997, Musikot-5, Aapchaur, Gulmi, Nepal). Built as a pnpm monorepo with an Express.js backend and Expo/React Native mobile frontend.

## Photo & Video Upload (Object Storage)

- Object storage provisioned via Replit App Storage (GCS-backed)
- Upload utility: `artifacts/mobile/utils/upload.ts`
  - `pickAndUploadMedia()` — pick from gallery and upload to GCS
  - `pickAndUploadFromCamera()` — take photo with camera and upload
  - `getServingUrl(objectPath)` — convert stored objectPath to full serving URL
- Upload flow: request presigned URL → upload blob to GCS → store objectPath in DB
- Served via: `GET /api/storage/objects/<objectPath>`
- Admin settings: shop photo + owner photo upload (tap to pick from camera/gallery)
- Admin products: upload product image via camera/gallery or paste URL
- Home screen: shop photo shown as hero background; owner photo shown in About section
- Settings DB columns: `shopPhotoPath`, `ownerPhotoPath`
- Permissions: `expo-image-picker` plugin configured in `app.json`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (mobile/web use `zod/v4`; API server uses `zod` v3 catalog, added as direct dep), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Mobile**: Expo Router, React Query, React Native
- **Auth**: JWT (admin only), `jsonwebtoken`

## Colors & Theme

- Primary: `#1A3A6B` (Deep Navy Blue)
- Primary Dark: `#0F2347`
- Primary Light: `#2E5DAD`
- Accent: `#D4A017` (Rich Gold)
- Accent Light: `#F0C040`
- Accent Dark: `#A87800`

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080, path: /api)
│   └── mobile/             # Expo React Native mobile app
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks + custom-fetch
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## API Routes

All routes mounted at `/api`:
- `GET /api/healthz` — health check
- `GET /api/categories` — list categories
- `GET /api/products` — list products (query: categoryId, search, featured)
- `GET /api/products/:id` — product detail
- `POST /api/orders` — create order
- `POST /api/bookings` — create booking
- `GET /api/settings` — shop settings
- `POST /api/admin/login` — admin login (returns JWT)
- `GET /api/admin/products` — admin product list (auth required)
- `POST /api/admin/products` — create product (auth required)
- `PUT /api/admin/products/:id` — update product (auth required)
- `DELETE /api/admin/products/:id` — delete product (auth required)
- `GET /api/admin/orders` — admin orders (auth required)
- `PUT /api/admin/orders/:id/status` — update order status (auth required)
- `GET /api/admin/bookings` — admin bookings (auth required)
- `PUT /api/admin/settings` — update settings (auth required)

## Database Schema

Tables: `categories`, `products`, `orders`, `bookings`, `settings`

- **categories**: id, name, description, icon, sortOrder
- **products**: id, name, description, price (numeric), unit, imageUrl, categoryId (FK), inStock, featured, createdAt
- **orders**: id, customerName, customerPhone, customerAddress, items (jsonb), totalAmount (numeric), status (enum), notes, createdAt
- **bookings**: id, serviceType (jeep|tractor), customerName, customerPhone, pickupLocation, destination, bookingDate, status, notes, createdAt
- **settings**: id, shopName, phone, email, address, bankName, accountName, accountNumber, bankBranch, aboutText, deliveryPolicy, termsConditions, shopPhotoPath, ownerPhotoPath, homeBannerPath, adminPasswordHash, adminOtp, adminOtpExpiry

## Network Offline Detection

- `components/NetworkBanner.tsx` — animated slide-down banner using `@react-native-community/netinfo@11.4.1`
- Shows red bar with Nepali text ("इन्टरनेट छैन — जडान जाँच गर्नुहोस्") when offline
- Shows green bar ("जडान पुनः स्थापित भयो") for 3 seconds when connection is restored
- Rendered inside `GestureHandlerRootView` in `_layout.tsx` via absolute positioning, z-index 9999
- `pointerEvents="none"` — banner never blocks touch interactions
- Skipped on web platform (NetInfo behaves differently on web)
- React Query retry logic updated: no retry on 4xx errors, exponential backoff (max 10s) on network errors, mutations never retry

## Mobile App Screens

**Tabs:**
- `(tabs)/index.tsx` — Home: hero banner, search, categories grid, featured products, about, services
- `(tabs)/catalog.tsx` — Shop: search bar, category filter tabs, product grid with add-to-cart
- `(tabs)/cart.tsx` — Cart: quantity controls, total, checkout button
- `(tabs)/more.tsx` — More: shop info, menu items

**Screens:**
- `product/[id].tsx` — Product detail: icon, price, quantity selector, add to cart
- `checkout.tsx` — Checkout form: name, phone, address, order summary, order creation
- `booking.tsx` — Booking form: jeep/tractor toggle, pickup/destination/date fields
- `payment-info.tsx` — Bank transfer details with copy-to-clipboard
- `terms.tsx` — Terms & Conditions (from settings or default)
- `delivery-policy.tsx` — Delivery policy (from settings or default)
- `admin/index.tsx` — Admin login screen
- `admin/dashboard.tsx` — Dashboard with stats + navigation
- `admin/products.tsx` — Product CRUD (modal form)
- `admin/orders.tsx` — Order list with status updates
- `admin/bookings.tsx` — Booking list view
- `admin/settings.tsx` — Shop settings editor

## Admin

- **Login flow**: identifier + password (+ optional Google Authenticator TOTP if 2FA is set up)
  - Identifier can be: email (rajeshshoppingcenter@gmail.com), phone number, or username (default: "admin")
  - Password: defaults to `ADMIN_PASSWORD` env var or "admin123", can be changed in Settings
  - If TOTP is enabled: also requires 6-digit Google Authenticator code
- **No SMS OTP** — replaced with Google Authenticator (TOTP via otplib)
- **2FA setup**: In admin Settings → "2-Factor Authentication" section → tap "Set Up Google Authenticator" → scan QR code → verify code → enabled
- JWT secret: `ADMIN_JWT_SECRET` env var (defaults to `rajesh-shopping-secret-2024`)
- Token stored in AsyncStorage (`rajesh_admin_token`)
- `setAuthTokenGetter` used to attach Bearer token to all admin API calls
- Admin section is hidden — accessible by tapping the shop card 7 times on the "More" tab
- Password can be changed from admin Settings screen (requires current password)
- Home screen banner photo settable from admin Settings (homeBannerPath)

## Key Libraries (Mobile)

- `expo-router` — file-based routing
- `expo-linear-gradient` — gradients
- `expo-haptics` — touch feedback
- `expo-clipboard` — copy to clipboard
- `@expo/vector-icons` — MaterialIcons, MaterialCommunityIcons, Ionicons, Feather
- `@react-native-async-storage/async-storage` — token persistence
- `@tanstack/react-query` — data fetching
- `expo-blur` — blur effect for tab bar
- `react-native-safe-area-context` — safe area handling

## Running

- API Server: `pnpm --filter @workspace/api-server run dev` (port 8080)
- Mobile: `pnpm --filter @workspace/mobile run dev`
