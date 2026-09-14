# ZovikPOS — AI-Powered Smart Canteen & Point of Sale System

A full-stack, real-time AI-powered POS system for restaurants and canteens.
Features include QR-based table ordering, role-based dashboards (Admin, Cashier/Vendor, Kitchen, Customer), live order tracking, payment management, email OTP authentication, and AI-driven ETA forecasting.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS |
| Backend | Node.js + Express + Prisma ORM + Socket.io |
| Database | PostgreSQL (hosted on Supabase) |
| AI Service | Python + FastAPI + scikit-learn |
| Email | Gmail SMTP via Nodemailer |
| Auth | JWT (Access + Refresh Tokens) + OTP via Email |

---

## Prerequisites — Install These First

Before running anything, make sure these are installed on your machine:

- **Node.js** v18 or higher → https://nodejs.org
- **Python** 3.10 or higher → https://python.org
- **Git** → https://git-scm.com

Verify your installations:
```bash
node -v
python --version
git --version
```

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/OneebDev/zovikpos.git
cd zovikpos
```

---

## Step 2 — Add the Environment Files

> ⚠️ You need to get the `.env` file from the project owner before continuing.

Place the `.env` file inside the **`backend/`** folder:
```
zovikpos/
└── backend/
    └── .env       ← put the file here
```

> 💡 **Important:** The database is hosted on **Supabase (Cloud)**. This means as soon as you add the `.env` file, you are connected to the **same live database** as the project owner — with all menus, staff, tables, and data already in place. You do NOT need to set up or create any database yourself.

---

## Step 3 — Backend Setup

Open a terminal and run these commands **one by one**:

```bash
cd backend
```

```bash
npm install
```

```bash
npx prisma generate
```

```bash
npm run dev
```

> ✅ Backend is now running on **http://localhost:5001**

> ℹ️ **Note:** You do NOT need to run `prisma migrate` or `prisma db seed`.
> The database is already live on Supabase cloud with all data ready.

---

## Step 4 — Frontend Setup

Open a **new terminal** (keep backend running) and run:

```bash
cd frontend
```

```bash
npm install
```

```bash
npm run dev
```

> ✅ Frontend is now running on **http://localhost:5173**

---

## Step 5 — AI Service Setup

Open a **third terminal** and run:

```bash
cd ai-service
```

```bash
python -m venv venv
```

**Windows:**
```bash
venv\Scripts\activate
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

```bash
pip install -r requirements.txt
```

```bash
python main.py
```

> ✅ AI service is now running on **http://localhost:8000**

---

## Login Credentials (after seed)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@pos.com` | `password123` |
| Cashier / Vendor | `vendor@pos.com` | `password123` |
| Kitchen Staff | `kitchen@pos.com` | `password123` |
| Customer | Login via email OTP (no fixed password) |

---

## Folder Structure

```
zovikpos/
├── backend/          → Node.js + Express API server
│   ├── src/          → Controllers, routes, services, sockets
│   ├── prisma/       → Database schema + seed data
│   └── uploads/      → Uploaded menu images
├── frontend/         → React (Vite) web application
│   └── src/
│       ├── components/   → All UI components
│       ├── pages/        → Admin, Customer, Kitchen, Cashier pages
│       └── services/     → API client + socket client
├── ai-service/       → Python FastAPI ML forecasting service
│   ├── main.py       → FastAPI server entry point
│   └── model.py      → ETA prediction model
└── README.md
```

---

## Running All 3 Services

You need **3 separate terminal windows** running at the same time:

| Terminal | Folder | Command | URL |
|---|---|---|---|
| 1 | `backend/` | `npm run dev` | http://localhost:5001 |
| 2 | `frontend/` | `npm run dev` | http://localhost:5173 |
| 3 | `ai-service/` | `python main.py` | http://localhost:8000 |

---

## Common Issues

**`npx prisma migrate deploy` fails?**
→ Make sure the `.env` file is inside the `backend/` folder and the `DATABASE_URL` is correct.

**`npm install` fails?**
→ Make sure Node.js v18+ is installed. Run `node -v` to check.

**`python main.py` fails?**
→ Make sure you activated the virtual environment first (`venv\Scripts\activate` on Windows).

**Frontend shows blank page?**
→ Make sure the backend is running on port 5001 before opening the frontend.

---

## Key Features

- **🍔 Independent Portion / Variant Selection**: Food cards support multi-portion options (e.g. 250 gm, 500 gm). Each portion maintains independent quantities, distinct cart lines, in-cart badges, and subtotal previews.
- **⚡ Persistent Session Cart**: Instant local state updates backed by database session synchronization (`PUT`/`DELETE`). Items deleted from cart remain deleted across navigation and reloads.
- **⏱️ Real-Time AI Kitchen ETA & Ticking Countdown**: Authoritative preparation time calculation from Python AI service based on order items and kitchen workload. Features client-side zero-overhead ticking timer (`0 API calls/sec`), status-aware freezing on `READY`/`COMPLETED`, and multi-customer order isolation.
- **🌙 Complete Premium Dark Theme System**: Full HSL dark-mode system support across Customer, Admin, Cashier, Vendor, and Kitchen views with zero unstyled white elements.
- **📱 Touch & Mobile Responsive UX**: Mobile-optimized layouts tested across 320px–414px viewports with scaled thumbnails, sticky headers, non-overlapping action buttons, and touch-friendly controls.
- **🔄 Table Transfer & Rerouting**: Real-time table switching modal and post-order delivery table rerouting with instant kitchen notification.

---

## What to Share With Someone Setting This Up

Give them these **two things**:

1. **The project ZIP or Git repo link**
2. **The `backend/.env` file** (share it privately — it contains secrets)

They do NOT need any other files. Everything else is generated automatically.