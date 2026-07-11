# MockVerse 🚀 — Production-Grade AI Interview Platform (SaaS)

> A premium, full-stack AI mock interview platform featuring stabilized voice engines with barge-in, just-in-time (JIT) adaptive questioning, split-screen IDE workspaces, credit payment systems, and custom PDF analytics report downloads.

---

## 🌐 Live URL
🔗 [https://mockverse.online](https://mockverse.online)

---

## ✨ Features & Architecture Highlights

### 🧠 Just-In-Time (JIT) Adaptive AI Engine
*   **Adaptive Question Loops**: Rather than static pre-generation, MockVerse creates the initial question and dynamically evaluates each candidate answer.
*   **Contextual Branching**: High-scoring answers (score $\ge 7$) adaptively increase the difficulty, while lower-scoring answers trigger targeted follow-up prompts to probe strengths and weaknesses.

### 🎙️ Synchronized Voice Engine with Barge-In
*   **Voice State Machine**: Anchored by an explicit lifecycle state machine (`IDLE`, `LISTENING`, `PROCESSING`, `SPEAKING`, `STOPPING`, `ERROR`, `RECONNECTING`) keeping speech synthesis (TTS) and speech recognition (STT) mutually exclusive.
*   **Timing Guard Locks**: Utilizes synchronous refs (`isRecognitionActiveRef`, `isAISpeakingRef`) to prevent asynchronous SpeechSynthesis queuing race conditions (`InvalidStateError` resolved).
*   **Active Barge-In**: Candidates can interrupt the AI's reading of the question/feedback. Speaking for $>1.5\text{s}$ cancels ongoing speech synthesis immediately.
*   **3-Tier Silence Detection**: Reconnects on silent timeouts (5s warning, 10s repeat question, 15s skip answer).

### 💻 Monospace Coding Sandbox
*   **Side-by-Side Workspace**: Problem statement and AI hints on the left pane; code editor on the right pane.
*   **IDE Features**: Monospace font layout, dynamic line numbering, Tab-key override (inserts double spaces), and auto-resizing textareas.
*   **AI Code Evaluator**: Evaluate time/space complexity, syntax correctness, and suggestions without revealing the final code solution.

### 📊 Comprehensive Performance Reports & PDF Export
*   **Multi-Metric Scoring**: Breakdowns of Technical, Communication, Coding, Problem Solving, and Confidence scores.
*   **Actionable Roadmaps**: Custom step-by-step roadmap, strengths/weaknesses list, and hiring recommendation.
*   **PDF Compiler**: Compiles the report client-side using `jspdf` and `jspdf-autotable`.

### 💳 SaaS Credit & Payment Systems
*   **Razorpay Checkout Gateway**: Secure backend order creation, webhook mapping, signature validation, and credit allocations.
*   **Developer Sandbox Bypass**: Secure Local Sandbox Login for automated testing and local developer runs.

---

## ⚙️ Tech Stack

### 🖥️ Frontend
*   React.js (Vite, SPA router)
*   Redux Toolkit (User session slices)
*   Vanilla CSS & Tailwind CSS (Curated dark themes)
*   Axios (With-credentials cookie sessions)
*   Motion (Micro-animations)
*   jsPDF & jsPDF-AutoTable (PDF compilation)

### 🧩 Backend & Services
*   Node.js & Express.js
*   MongoDB (Mongoose schemas for Users, Interviews, Payments)
*   Firebase Admin API (Firebase client OAuth)
*   Razorpay SDK (Payment gateway)
*   OpenRouter (AI chat model completion calls: `gpt-4o-mini`)

---

## 🔑 Environment Setup

### Frontend configuration (`client/.env`)
```env
VITE_FIREBASE_APIKEY=AIzaSyB8T6NvX8-KRk3Ql-tuTnUOoqgzwnDWIu0
VITE_SERVER_URL=http://localhost:8000
```

### Backend configuration (`server/.env`)
```env
PORT=8000
MONGODB_URL=mongodb+srv://workforshubh47_db_user:<password>@cluster0.ou6poqh.mongodb.net/ai-interview
JWT_SECRET=DSY29QURD12R23TFNO1FFFTY13
OPENROUTER_API_KEY=sk-or-v1-...
RAZORPAY_KEY_ID=rzp_live_ScYJUJhVoyaXXx
RAZORPAY_KEY_SECRET=jvsvwCZGsi2hI411Lb64KaSx
```

---

## 🚀 Getting Started

### 1️⃣ Clone the Repo
```bash
git clone https://github.com/ShubhamKumar-47/Ai-interview.git
```

### 2️⃣ Install Dependencies
```bash
# Frontend setup
cd client
npm install

# Backend setup
cd ../server
npm install
```

### 3️⃣ Start Development Servers
```bash
# Backend dev server (auto-reloading nodemon)
cd server
npm run dev

# Frontend dev server (Vite on http://localhost:5173)
cd ../client
npm run dev
```

### 4️⃣ Production Build & Lint Checks
```bash
# Lint compliance check
cd client
npm run lint

# Production assets compilation
npm run build
```

---

## 👨‍💻 Author
**Shubham Kumar**  
*Full-Stack Engineer & Lead Architect*
