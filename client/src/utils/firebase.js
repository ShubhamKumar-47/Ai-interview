import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB8T6NvX8-KRk3Ql-tuTnUOoqgzwnDWIu0",
  authDomain: "ai-interview-app-d2baf.firebaseapp.com", // ✅ KEEP THIS
  projectId: "ai-interview-app-d2baf",
  storageBucket: "ai-interview-app-d2baf.firebasestorage.app",
  messagingSenderId: "466532609784",
  appId: "1:466532609784:web:9faa0a4a00d52f1a2f950d",
  measurementId: "G-X30XP3TK8G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth
const auth = getAuth(app);

// ❌ REMOVED (causes issues in production)
// auth.useDeviceLanguage();

// Google Provider
const provider = new GoogleAuthProvider();

// Optional (clean config)
provider.setCustomParameters({
  prompt: "select_account"
});

export { auth, provider };