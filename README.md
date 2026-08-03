# MockVerse 🚀 — AI Mock Interview Platform

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

MockVerse is a full-stack AI-powered mock interview platform that simulates realistic technical and behavioral interviews. It features adaptive question generation, real-time voice interaction with barge-in support, a split-screen coding editor, comprehensive performance reports with PDF export, credit-based payments via Razorpay, and PWA support.

---

## 🌐 Live Application
🔗 **Live Demo**: [https://mockverse.online](https://mockverse.online)  
🔗 **Alternative Frontend**: [https://ai-interview-shubh.vercel.app](https://ai-interview-shubh.vercel.app)  
🔗 **Backend API**: [https://ai-interview-6z9d.onrender.com](https://ai-interview-6z9d.onrender.com)

---

## 📋 Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Environment Variables](#-environment-variables)
- [Installation & Local Setup](#-installation--local-setup)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Security](#-security)
- [Author](#-author)

---

## ✨ Features

### 🧠 AI Interviews & Adaptive Questions
- **Just-In-Time (JIT) Question Generation**: AI dynamically evaluates candidate responses and generates adaptive follow-up questions tailored to role, experience level, and resume context.
- **Customizable Interview Setup**: Candidates select interview topics (Frontend, Backend, Fullstack, Data Science, etc.), target role, and question limits.
- **Resume Upload & Analysis**: Supports PDF resume parsing via `pdfjs-dist` to generate personalized interview questions based on candidate background.
- **Fallback Protection**: Ensures uninterrupted interview progression even if AI responses encounter quiet/empty input or network delays.

### 🎙️ Voice Interaction
- **Web Speech Integration**: Native browser Speech Recognition (STT) and Speech Synthesis (TTS).
- **Mutual Exclusion State Machine**: Prevents audio overlapping by enforcing strict lifecycle states (`IDLE`, `LISTENING`, `PROCESSING`, `SPEAKING`).
- **Active Barge-In**: Speech synthesis automatically halts when a candidate begins speaking for more than 1.5 seconds.
- **Silence Timeout Detection**: Automatically prompts or skips questions if silence is detected for extended intervals.

### 🔐 Authentication
- **Google OAuth**: Fast login and sign-up powered by Firebase Auth client.
- **JWT HTTP-Only Cookies**: Secure session token storage preventing XSS vulnerabilities.
- **Developer Login**: Quick dev-login mode for local testing and QA.

### 💻 Coding Interviews
- **Split-Screen Workspace**: Question requirements and AI hints on the left pane; code editor on the right.
- **IDE Features**: Monospace layout, dynamic line numbering, Tab-key indentation, and auto-resizing input area.
- **Code Evaluation**: Analyzes time/space complexity, syntax accuracy, and logic without directly spoiling the solution.

### 📊 Performance Reports & PDF Export
- **Multi-Metric Scoring**: Detailed rating breakdown across Technical Knowledge, Communication, Coding, Problem Solving, and Confidence.
- **Actionable Feedback**: Strengths, weaknesses, and step-by-step improvement roadmaps.
- **Client-Side PDF Compiler**: Instant report download using `jsPDF` and `jspdf-autotable`.

### 💳 Payments & Credit System
- **Razorpay Integration**: Purchase interview credits seamlessly.
- **Signature Verification**: Server-side HMAC SHA256 payment verification before crediting accounts.

### 📶 PWA & Offline Support
- **Service Worker Caching**: Offline asset caching (`public/sw.js`) for fast reload times.
- **PWA Web Manifest**: Installed app support with custom theme colors (`#10b981`) and standalone mode.

---

## 🛠️ Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Redux Toolkit, React Router DOM v7, Tailwind CSS v4, Motion, Recharts, React Circular Progressbar, Axios |
| **Backend** | Node.js, Express 5, Mongoose 9, jsonwebtoken, Multer, Helmet, Express Rate Limit, Cookie Parser |
| **Database** | MongoDB Atlas |
| **Authentication** | Firebase Auth Client (Google OAuth), JWT (HTTP-only cookies) |
| **AI Engine** | OpenRouter API (`gpt-4o-mini`) |
| **Payments** | Razorpay Node.js SDK |
| **PDF Generation** | jsPDF, jsPDF-AutoTable, pdfjs-dist |
| **Deployment** | Vercel (Frontend), Render (Backend), MongoDB Atlas (Database) |
| **Developer Tools** | Vite 7, ESLint 9, Nodemon, Git |

---

## 📁 Repository Structure

```
Ai-interview/
├── client/                     # Frontend Application (React 19 + Vite)
│   ├── public/                 # Static assets, PWA manifest & Service Worker
│   │   ├── manifest.json
│   │   ├── sw.js
│   │   └── favicon.ico
│   ├── src/                    # React Source Code
│   │   ├── assets/             # Static UI media & illustrations
│   │   ├── components/         # Reusable UI components (Navbar, Modal, etc.)
│   │   ├── context/            # React Context providers
│   │   ├── pages/              # Page views (Auth, Setup, Interview, Report, History)
│   │   ├── redux/              # Redux slices & store configuration
│   │   ├── App.jsx             # Main router & app layout
│   │   ├── index.css           # Global Tailwind & custom styles
│   │   └── main.jsx            # Entry point
│   ├── .env.example            # Frontend environment variable template
│   ├── eslint.config.js        # ESLint configuration
│   ├── package.json            # Client dependencies and scripts
│   └── vite.config.js          # Vite configuration
├── server/                     # Backend API Application (Node.js + Express 5)
│   ├── config/                 # Database connection logic
│   │   └── connectDb.js
│   ├── controllers/            # Controller handlers (Auth, Interview, Payment, User)
│   ├── middlewares/            # Authentication guard & Multer upload middleware
│   ├── models/                 # Mongoose database models (User, Interview, Payment)
│   ├── routes/                 # Express route definitions
│   ├── services/               # External service integrators (OpenRouter, Razorpay)
│   ├── .env.example            # Backend environment variable template
│   ├── index.js                # Express app entry point
│   └── package.json            # Server dependencies and scripts
├── .gitignore                  # Monorepo Git ignore configuration
└── README.md                   # Repository documentation
```

---

## 🔑 Environment Variables

> ⚠️ **Security Warning**: Never commit your `.env` files or API keys to GitHub.

### Frontend (`client/.env`)
```env
VITE_SERVER_URL=http://localhost:8000
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

### Backend (`server/.env`)
```env
PORT=8000
MONGODB_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
OPENROUTER_API_KEY=your_openrouter_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
ALLOWED_ORIGINS=http://localhost:5173,https://ai-interview-shubh.vercel.app,https://mockverse.online
NODE_ENV=development
```

---

## 🚀 Installation & Local Setup

### Prerequisites
- **Node.js**: `v18+` or `v20+` installed
- **npm**: `v9+` or `v10+` installed
- **MongoDB**: Local instance or MongoDB Atlas cluster URI

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/ShubhamKumar-47/Ai-interview.git
cd Ai-interview
```

### 2️⃣ Install Dependencies

**Server Setup**:
```bash
cd server
npm install
```

**Client Setup**:
```bash
cd ../client
npm install
```

### 3️⃣ Configure Environment Files
Copy the `.env.example` templates to `.env` in both folders and fill in your credentials:
```bash
# Server
cp server/.env.example server/.env

# Client
cp client/.env.example client/.env
```

### 4️⃣ Run Development Servers

**Start Backend API** (Runs on `http://localhost:8000`):
```bash
cd server
npm run dev
```

**Start Frontend** (Runs on `http://localhost:5173`):
```bash
cd client
npm run dev
```

### 5️⃣ Verify Build & Linting

**Lint Check**:
```bash
cd client
npm run lint
```

**Production Build**:
```bash
cd client
npm run build
```

---

## 🔌 API Documentation

### Authentication Routes (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/google` | Public | Authenticate user using Firebase Google OAuth token |
| `POST` | `/api/auth/dev-login` | Public | Quick developer login (local testing) |
| `GET` | `/api/auth/logout` | Public | Log out user and clear session cookie |

### User Routes (`/api/user`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/user/current-user` | Private | Retrieve authenticated user profile and credit balance |

### Interview Routes (`/api/interview`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/interview/resume` | Private | Upload resume PDF file for context parsing |
| `POST` | `/api/interview/generate-questions` | Private | Create new interview session and first question |
| `POST` | `/api/interview/submit-answer` | Private | Submit candidate answer and receive adaptive question/feedback |
| `POST` | `/api/interview/finish` | Private | Finalize interview session and compute aggregate score |
| `GET` | `/api/interview/get-interview` | Private | Fetch history of interviews completed by current user |
| `GET` | `/api/interview/report/:id` | Private | Retrieve detailed analytical feedback report for an interview |

### Payment Routes (`/api/payment`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/payment/create-order` | Private | Initialize Razorpay order for purchasing interview credits |
| `POST` | `/api/payment/verify` | Private | Verify Razorpay payment HMAC signature and add user credits |
| `GET` | `/api/payment/test` | Public | Health check route for payment gateway integration |

---

## 🌐 Deployment Guide

### Frontend (Vercel)
1. Push your code to GitHub.
2. Connect your repository to [Vercel](https://vercel.com).
3. Set **Root Directory** to `client`.
4. Configure Build Command: `npm run build` and Output Directory: `dist`.
5. Environment Variables: Add `VITE_SERVER_URL` and `VITE_RAZORPAY_KEY_ID`.

### Backend (Render)
1. Create a new Web Service on [Render](https://render.com).
2. Set **Root Directory** to `server`.
3. Set **Build Command**: `npm install`.
4. Set **Start Command**: `node index.js`.
5. Environment Variables: Set `PORT`, `MONGODB_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `ALLOWED_ORIGINS`, `NODE_ENV=production`.

### Database (MongoDB Atlas)
1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Whitelist Render backend IP addresses (or `0.0.0.0/0`).
3. Obtain the connection string URI and set `MONGODB_URL` in backend environment.

---

## 🛡️ Security Best Practices Implemented
- **Helmet HTTP Headers**: Secures frameguard, XSS protection, and MIME type sniffing defense.
- **Express Rate Limiter**: 100 requests per 15 minutes per IP on `/api/` endpoints to protect against brute force and Denial of Service (DoS) attacks.
- **CORS Protection**: Restricted origin list supporting custom domains with credentials allowed.
- **HMAC Signature Verification**: Razorpay payments are validated server-side using SHA256 HMAC before crediting user accounts.
- **HTTP-Only Cookies**: JWT tokens stored in HTTP-only, SameSite cookies to protect against client-side script theft (XSS).

---

## 👨‍💻 Author
**Shubham Kumar**  
Full-Stack Engineer  
GitHub: [@ShubhamKumar-47](https://github.com/ShubhamKumar-47)
