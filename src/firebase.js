import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCAsTQl_uOZwupLwOJjBZZJKWkGd5YVhXs",
  authDomain: "mi-menu-app-9c084.firebaseapp.com",
  projectId: "mi-menu-app-9c084",
  storageBucket: "mi-menu-app-9c084.firebasestorage.app",
  messagingSenderId: "947666434839",
  appId: "1:947666434839:web:8f6ba1701ac8128d1f9552",
  measurementId: "G-B7HV822FGJ"
};

const app = initializeApp(FIREBASE_CONFIG);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
