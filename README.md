# HireTrail 🎯

> A smart job application management platform combining placement tracking with ATS resume analysis.

## Features

- 📋 **Application Tracker** — Kanban-style pipeline (Applied → Interview → Offer → Rejected)
- 🤖 **ATS Resume Analyzer** — TF-IDF, cosine similarity, keyword gap detection
- 🔔 **Smart Reminders** — Automated follow-up email alerts
- 📊 **Reports** — Export application history as PDF or CSV
- 🔐 **Secure Auth** — JWT + bcrypt + refresh token rotation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js + Vite |
| Backend | Node.js + Express.js |
| Database | MongoDB (Mongoose) |
| Cache / Queue | Redis + BullMQ |
| Auth | JWT + bcrypt |
| NLP | TF-IDF + cosine similarity |
| Email | Nodemailer |
| Containers | Docker + Docker Compose |

## Project Structure

```
hiretrail-placement-tracker/
├── client/               # React SPA (Vite)
├── server/
│   ├── config/           # DB and Redis connection
│   ├── routes/           # Express route handlers
│   ├── controllers/      # Business logic
│   ├── models/           # Mongoose schemas
│   ├── middleware/        # JWT auth, error handler, rate-limit
│   ├── services/          # ATS analyzer, reports, notifications
│   ├── workers/           # BullMQ background workers
│   └── queues/            # Queue definitions
├── docker-compose.yml
├── .env.example
└── README.md
```

## Getting Started

### Prerequisites
- Node.js >= 18
- Docker + Docker Compose

### 1. Clone and install
```bash
git clone <repo-url>
cd hiretrail-placement-tracker

# Server dependencies
cd server && npm install && cd ..
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start MongoDB & Redis
```bash
docker-compose up -d
```

### 4. Start the server
```bash
cd server
npm run dev
```

### 5. Start the client (Phase 1+)
```bash
cd client
npm run dev
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new account |
| POST | `/api/auth/login` | Login + get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/me` | Get current user (protected) |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |

## Development Phases

- [x] **Phase 1** — Project Scaffold + Auth System
- [ ] **Phase 2** — Google OAuth + Enhanced Auth UI
- [ ] **Phase 3** — Job Application Tracker (CRUD + Kanban)
- [ ] **Phase 4** — File Upload + Resume Parsing
- [ ] **Phase 5** — ATS Analyzer (NLP Engine)
- [ ] **Phase 6** — Email Notifications + Reminders
- [ ] **Phase 7** — Reports + Export
- [ ] **Phase 8** — Polish + Testing + Production Build

## License

MIT
