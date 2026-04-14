# 💧 Pure Home Waters — CRM

A local Angular CRM application for managing water purifier rental customers, sending WhatsApp reminders, and tracking service history.

---

## ✅ Features

- **Dashboard** — Overview of customers, revenue, due reminders, services
- **Customer Management** — Add, edit, view, search customers with plan & model info
- **WhatsApp Reminders** — One-click or bulk send pre-filled reminder messages (zero cost)
- **Service Records** — Log filter changes, repairs, installations per customer
- **Payment Tracking** — Record monthly payments, auto-advances due date
- **Rental Plans** — Manage Basic / Standard / Premium plans
- **Offline / Local** — All data stored in browser via IndexedDB (Dexie.js)

---

## 🚀 Setup Instructions

### Prerequisites
- **Node.js** v18 or higher → https://nodejs.org
- **npm** (comes with Node)

### Install & Run

```bash
# 1. Navigate to this folder
cd pure-home-waters

# 2. Install dependencies
npm install

# 3. Start the dev server
npm start
```

Then open your browser at: **http://localhost:4200**

---

## 📲 WhatsApp Reminder — How It Works

1. Go to **Reminders** page
2. See all customers due this month
3. Click **Send** next to a customer → WhatsApp opens with message pre-filled
4. Just press **Send** in WhatsApp — done!

For **bulk send**, select multiple customers and click **"Send to X Selected"**.
Each WhatsApp window opens one at a time (allow pop-ups in browser).

> ✅ 100% Free. No WhatsApp Business API needed. No monthly fees.

---

## 🗂️ Project Structure

```
src/app/
├── core/
│   ├── db/              # Dexie.js IndexedDB setup
│   ├── models/          # TypeScript interfaces
│   └── services/        # Customer, Plan, Service, Payment, WhatsApp services
├── features/
│   ├── dashboard/       # Dashboard overview
│   ├── customers/       # Customer list + detail + form dialog
│   ├── reminders/       # WhatsApp reminder center
│   ├── services/        # Service records
│   └── plans/           # Rental plans CRUD
└── app.component.ts     # App shell with sidebar
```

---

## 💾 Data Storage

All data is stored locally in your browser's **IndexedDB** via Dexie.js.

- ✅ No internet needed after first load
- ✅ Data persists across browser sessions
- ✅ Works offline
- ⚠️ Clearing browser data will erase the database

### Backup your data
Open browser DevTools → Application → IndexedDB → PureHomeWatersDB
Or export to JSON by running this in the console:
```javascript
// Future: export feature can be added
```

---

## 🔮 Future Upgrades

When ready to host online:
1. Replace **Dexie.js** with **Supabase** (free tier) as backend
2. Deploy Angular app to **Vercel** or **Netlify** (free)
3. Add **WhatsApp Business API** for fully automated sending (paid)

---

## 🛠️ Built With

- **Angular 17** (standalone components, signals)
- **Angular Material** (UI components)
- **Dexie.js** (IndexedDB wrapper)
- **WhatsApp wa.me links** (free reminder automation)
