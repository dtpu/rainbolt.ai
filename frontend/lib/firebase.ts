import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// Replace these with your actual Firebase config values
const firebaseConfig = {
  apiKey: "AIzaSyBx2Iq-rnSOjcFNFeAtYcC6a-d0a5o1ZdY",
  authDomain: "rainboltai.firebaseapp.com",
  projectId: "rainboltai",
  storageBucket: "rainboltai.firebasestorage.app",
  messagingSenderId: "1022058146045",
  appId: "1:1022058146045:web:328a77bf657b7bedf13694",
  measurementId: "G-X947YYS1Z6",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
