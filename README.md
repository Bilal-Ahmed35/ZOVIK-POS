# ZovikPOS — AI-Powered Smart Canteen & Point of Sale System

A full-stack, real-time AI-powered POS system for restaurants and canteens.
Features include QR-based table ordering, multi-branch management, dynamic role-based dashboards (Admin, Cashier/Vendor, Kitchen, Customer), live order tracking, Groq AI demand forecasting, batch-by-batch inventory expiry management, recipe cost & margin analysis, and automated PDF/CSV reports.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Vanilla CSS / TailwindCSS |
| Backend | Node.js + Express + Prisma ORM + Socket.io |
| Database | PostgreSQL (hosted on Supabase Cloud) |
| AI Service | Python + FastAPI + scikit-learn + Groq LLM API |
| Email & Auth | JWT Authentication + Email OTP via Nodemailer |
| OCR | Tesseract.js / AI Invoice OCR Parsing |

---

## What Was Updated / Major Recent Enhancements 🚀

1. **AI Insights & Groq ML Demand Forecasting Page:**
   - 100% database-driven analytics — ZERO hard-coded/dummy numbers.
   - **Multi-Key Failover Rotation (`GROQ_API_KEY`, `GROQ_API_KEY_2`, `GROQ_API_KEY_3`, `GROQ_API_KEY_4`):** Ensures seamless Groq LLM API availability even under high traffic or rate limits.
   - Real demand forecasting per inventory ingredient and dish.

2. **Dynamic Multi-Branch Support:**
   - Real-time branch selector across Admin Dashboard, Inventory, Reports, and AI Insights.
   - Seamless branch context filtering for sales, stock levels, and revenue analytics.

3. **Inventory Expiry Tracking & Batch Management (View + Edit):**
   - **Interactive View/Edit Modal:** Open batch/expiry details in a centered React Portal modal.
   - **Edit Expiry Date & Batch Number:** Update existing batch records directly without creating duplicate records.
   - **Optional Expiry Field:** Option to add expiry dates when creating new ingredients (`Enter if printed on package.`), defaulting to `No Expiry Date` for items like fresh vegetables or packaging.
   - **Real-Time Recalculation:** Instant recalculation of Days Left, status badges (*Expired, Expiring Today, Within 3 Days, Within 7 Days, Within 30 Days, Fresh, No Expiry Date*), and summary cards.
   - **Batch Isolation:** Each received stock batch maintains its own batch number and expiry date.

4. **Costs & Margins Engine:**
   - Neutral money icon (`Coins`) used in top navigation header (replacing any `$` symbol).
   - Strict Pakistani Rupee (`Rs.`) currency formatting across all screens.
   - Recipe cost, Food Cost %, Gross Margin %, and profitability status calculated live from real inventory catalog data.

5. **Reports & Exports Engine:**
   - Real-time data aggregation across Sales, Products, and Inventory tabs.
   - **Export to CSV & Printable PDF:** One-click downloads for accounting and management audit.
   - **Interactive Order Details Modal:** Click on any report row to view itemized order line items in a centered portal.

---

## Prerequisites — Install These First

Before running anything, ensure these are installed on your system:

- **Node.js** v18 or higher → [https://nodejs.org](https://nodejs.org)
- **Python** 3.10 or higher → [https://python.org](https://python.org)
- **Git** → [https://git-scm.com](https://git-scm.com)

Verify your installations:
```bash
node -v
python --version
git --version
```

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/Bilal-Ahmed35/ZOVIK-POS.git
cd ZOVIK-POS
git checkout oneeb
```

---

## Step 2 — Add Environment File (`backend/.env`)

Place the `.env` file inside the **`backend/`** directory:
```
ZOVIK-POS/
└── backend/
    └── .env       ← Place backend environment file here
```

> 💡 **Database Info:** The database is hosted on **Supabase Cloud (PostgreSQL)**. Adding the `.env` file automatically connects to the shared live database with pre-populated menu items, inventory ingredients, branches, and user accounts.

### Required Environment Variables in `backend/.env`:
```env
PORT=5001
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-jwt-refresh-secret"

# Groq AI Keys (Multi-Key Rotation)
GROQ_API_KEY="gsk_..."
GROQ_API_KEY_2="gsk_..."
GROQ_API_KEY_3="gsk_..."
GROQ_API_KEY_4="gsk_..."

# Email OTP Configuration
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
```

---

## Step 3 — Backend Setup

Open a terminal and run:

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

> ✅ Backend runs on **http://localhost:5001**

---

## Step 4 — Frontend Setup

Open a **second terminal** and run:

```bash
cd frontend
npm install
npm run dev
```

> ✅ Frontend runs on **http://localhost:5173**

---

## Step 5 — AI Service Setup (Python)

Open a **third terminal** and run:

```bash
cd ai-service
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
python main.py
```

> ✅ AI service runs on **http://localhost:8000**

---

## Login Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@pos.com` | `password123` |
| Cashier / Vendor | `vendor@pos.com` | `password123` |
| Kitchen Staff | `kitchen@pos.com` | `password123` |
| Customer | Login via Email OTP (no fixed password) |

---

## Summary of Running Terminals

| Terminal | Folder | Command | URL |
|---|---|---|---|
| 1 | `backend/` | `npm run dev` | http://localhost:5001 |
| 2 | `frontend/` | `npm run dev` | http://localhost:5173 |
| 3 | `ai-service/` | `python main.py` | http://localhost:8000 |

---

## What to Share With Evaluators / Teammates

If someone else is running the project on their computer, share:
1. **Repository Link & Branch:** `https://github.com/Bilal-Ahmed35/ZOVIK-POS.git` (Branch: `oneeb`)
2. **The `backend/.env` file** (contains Supabase DB connection & Groq API keys).
3. **Login credentials table** listed above.