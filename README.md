# SwasthAI — AI-Powered OPD Triage & Smart Queue Management

> **"Intelligent OPD Triage & Smart Queue Management"** — Designed for Government Hospitals in India

## 🏥 Overview

SwasthAI is a comprehensive hospital OPD management ecosystem that uses AI-assisted preliminary triage to streamline patient flow, reduce wait times, and improve healthcare delivery in government hospitals.

## 🎯 Problem Statement

Government hospitals face: long queues, manual registration errors, incorrect department routing, poor queue visibility, emergency patients waiting in normal queues, and uneven doctor workloads.

## 💡 Solution

- **AI Symptom Assessment** — Preliminary triage with department recommendation
- **Smart Queue Management** — Priority-aware queuing (not FIFO)
- **Real-time Tracking** — Live token updates via WebSocket
- **Doctor Dashboard** — Patient summary, consultation, prescription, lab ordering
- **Admin Dashboard** — Hospital analytics, department load, staff management
- **Reception Dashboard** — Walk-in registration, token creation, queue management
- **Digital Records** — Consultations, prescriptions, lab reports

## 🏗️ Architecture

```
Patient/Doctor/Admin (Next.js) → REST API → Express + TypeScript → Prisma → Neon PostgreSQL
                                    ↕                    ↕
                              Socket.IO            AI Service
                                                (Gemini / Demo)
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 6 |
| Real-time | Socket.IO |
| AI | Google Gemini API (with Demo fallback) |
| Auth | JWT + bcrypt |
| Deployment | Render (backend), Vercel (frontend) |

## 👥 User Roles

- **Patient** — Symptom assessment, queue tracking, medical records
- **Doctor** — Queue management, consultation, prescription, lab orders
- **Receptionist** — Walk-in registration, token generation, queue management
- **Hospital Admin** — Department/doctor/staff management, analytics

## 🚀 Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (or Neon account)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL and other variables
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local if needed
npm run dev
```

## 🔐 Environment Variables

### Backend (.env)
| Variable | Description |
|----------|-------------|
| DATABASE_URL | Neon PostgreSQL connection string |
| JWT_SECRET | JWT signing secret |
| GEMINI_API_KEY | Google Gemini API key (optional) |
| AI_PROVIDER | `demo` or `gemini` |
| FRONTEND_URL | Frontend URL for CORS |
| PORT | Server port (default: 3001) |
| CLOUDINARY_* | Cloudinary credentials (optional) |

### Frontend (.env.local)
| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_API_URL | Backend API URL |
| NEXT_PUBLIC_SOCKET_URL | Backend WebSocket URL |

## 📋 Demo Accounts

**Password for all: `Demo@1234`**

| Role | Email |
|------|-------|
| Patient | patient.demo@swasthai.com |
| Patient (Rahul) | rahul.kumar@swasthai.com |
| Patient (Amit) | amit.sharma@swasthai.com |
| Doctor | doctor.demo@swasthai.com |
| Receptionist | reception.demo@swasthai.com |
| Admin | admin.demo@swasthai.com |

## 🤖 AI Configuration

The app supports two AI modes:

1. **Gemini Mode** — Set `GEMINI_API_KEY` and `AI_PROVIDER=gemini`
2. **Demo Mode** — Set `AI_PROVIDER=demo` (default, works without API key)

Demo mode uses deterministic keyword-based triage for reliable hackathon demos.

## ⚠️ Medical Safety Disclaimer

SwasthAI provides **AI-assisted preliminary triage only**. The system:
- Does NOT replace qualified medical professionals
- Does NOT provide confirmed diagnoses
- Does NOT prescribe medication autonomously
- Always displays appropriate disclaimers
- Recommends immediate professional attention for emergencies

## 📊 Features

- ✅ Patient registration & profile management
- ✅ AI symptom assessment with follow-up questions
- ✅ Structured triage output (priority, department, risk score)
- ✅ Priority-aware smart queue (Emergency > High > Moderate > Normal)
- ✅ Real-time token tracking via WebSocket
- ✅ Doctor dashboard with patient queue
- ✅ Consultation form with clinical notes
- ✅ Digital prescription creation
- ✅ Lab test ordering & report viewing
- ✅ Hospital admin dashboard with live analytics
- ✅ Department load monitoring
- ✅ Staff management (doctors, nurses, receptionists)
- ✅ In-app notifications
- ✅ Audit logging
- ✅ Emergency workflow with alerts
- ✅ Mobile-responsive patient UI
- ✅ Desktop-optimized doctor/admin dashboards

## 📁 Project Structure

```
opd-hth/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── modules/
│       │   ├── auth/
│       │   ├── hospitals/
│       │   ├── departments/
│       │   ├── doctors/
│       │   ├── patients/
│       │   ├── queue/
│       │   ├── triage/
│       │   ├── consultations/
│       │   ├── prescriptions/
│       │   ├── labs/
│       │   ├── analytics/
│       │   ├── notifications/
│       │   ├── staff/
│       │   └── realtime/
│       ├── utils/
│       ├── app.ts
│       └── server.ts
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── auth/
│       │   ├── patient/
│       │   ├── doctor/
│       │   ├── admin/
│       │   └── reception/
│       └── lib/
└── README.md
```

## 📝 License

MIT
