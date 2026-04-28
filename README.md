# MsikaPOS - Premium Enterprise POS & Inventory System

MsikaPOS is a modern, offline-first, professional Point of Sale (POS) and Marketplace system designed for speed, scalability, and aesthetic excellence. It provides a seamless transition between local operations and cloud synchronization.

## 🚀 Key Features

### 🛒 Point of Sale (Staff)

- **High-Performance Checkout:** Optimized for rapid scanning and transaction processing.
- **Totals Priority:** Large, high-contrast, and bold italic typography for clear visibility during busy shifts.
- **Unified Sales Log:** Transactions and Daily Sales consolidated into a single audit trail with advanced filtering.

### 📦 Inventory & Products

- **Smart Image Processing:** Automatic 1:1 aspect ratio forcing and client-side compression to ensure fast loading and minimal storage impact.
- **Stock Management:** Real-time tracking of product quantities and services.
- **Category Defaults:** Intelligent fallback system for items without custom images.

### 🏢 Customer Marketplace (Public)

- **Edge-to-Edge Design:** A minimalist, premium browsing experience for public customers.
- **Seamless Auth:** Role-aware authentication using simple Username/Password credentials for inquiries.
- **Advanced Inquiry Workflow:** Request → Response → Quote system with integrated WhatsApp communication shortcuts.

### 🛡️ System Core

- **Offline-First:** Powered by IndexedDB (`Dexie.js`) for uninterrupted operation during internet outages.
- **Cloud Sync:** Background synchronization with Supabase/Backend services via TLS-encrypted tunnels.
- **Theme Engine:** OS-aware theme switching (Light, Dark, System) with edge-to-edge consistency.

---

## 🛠️ Technical Stack

- **Frontend:** React 19 (TypeScript), Vite 8
- **Styling:** Tailwind CSS 4 (Custom Variables, Mesh Gradients)
- **Database:** IndexedDB (Dexie) + Supabase
- **PWA:** Service Workers for offline access and native app feel
- **Icons:** Lucide React

---

## 🏁 Getting Started

### Prerequisites

- Node.js (v18+)
- NPM or Yarn

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   ```

2. **Setup Frontend:**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Setup Backend:**

   ```bash
   cd backend
   npm install
   npm start
   ```

### Building for Production

```bash
npm run build
```

The output will be in the `dist/` folder, ready for deployment to platforms like Netlify, Vercel, or Render.

---

## ⚖️ Security & Data Integrity

- **E2EE:** End-to-end encryption for sensitive data in transit via TLS.
- **RBAC:** Strict Role-Based Access Control (Cashier, Admin, Super Admin, Customer).
- **Session Safety:** Automatic session clearance and secure role-gated routing.

---

## 🎨 Global Design Tokens

- **Typography:** System font stack (`-apple-system`, `BlinkMacSystemFont`).
- **Colors:** Fully standardized CSS variables (`--bg-main`, `--bg-card`, `--primary-500`).
- **Layout:** Dense line heights (1.4 - 1.5) and tracking-tight headers for a premium editorial feel.

---

© 2026 MsikaPOS. All rights reserved.
