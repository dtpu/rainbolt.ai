import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// Replace these with your actual Firebase config values
const firebaseConfig = {
  apiKey: "AIzaSyB13Z8jEykZ2UXIGIJ8H0HwP_C1camw-RM",
  authDomain: "rainboltai-5f04a.firebaseapp.com",
  projectId: "rainboltai-5f04a",
  storageBucket: "rainboltai-5f04a.firebasestorage.app",
  messagingSenderId: "392181453024",
  appId: "1:392181453024:web:e8ba677a33fdbd9b394085",
  measurementId: "G-8FFP8MPPSD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);

export default app;