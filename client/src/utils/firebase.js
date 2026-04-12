
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
const firebaseConfig = {
  apiKey: "AIzaSyB8T6NvX8-KRk3Ql-tuTnUOoqgzwnDWIu0",
  authDomain: "ai-interview-app-d2baf.firebaseapp.com",
  projectId: "ai-interview-app-d2baf",
  storageBucket: "ai-interview-app-d2baf.firebasestorage.app",
  messagingSenderId: "466532609784",
  appId: "1:466532609784:web:9faa0a4a00d52f1a2f950d",
  measurementId: "G-X30XP3TK8G"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
auth.useDeviceLanguage();

// For development, add all possible localhost ports as authorized redirect URIs
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  try {
    // This tells Firebase this is a localhost dev environment
    auth.settings.appVerificationDisabledForTesting = true;
  } catch {
    // Silently ignore if not available
  }
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ 
  prompt: "select_account",
  access_type: "offline"
});

export { auth, provider }