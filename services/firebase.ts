
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqS05Hm2ShK5f85KJuB4hmAmQqWPWINxE",
  authDomain: "widget-e3d5c.firebaseapp.com",
  projectId: "widget-e3d5c",
  storageBucket: "widget-e3d5c.firebasestorage.app",
  messagingSenderId: "402515095062",
  appId: "1:402515095062:web:d6949ada0c8de51820cf37",
  measurementId: "G-PHBL1J9YJ3"
};

let app;
let db: any;
let analytics;
let auth: any;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  
  // Initialize Firestore
  db = getFirestore(app);

  // Initialize Auth
  auth = getAuth(app);
  
  // Initialize Analytics (only in browser environment)
  if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
  }
} catch (error) {
  console.error("Firebase failed to initialize:", error);
}

export { db, app, analytics, auth };
