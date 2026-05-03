import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAewNRpYxsT7D-c2yE6PvR52YaBkZGOfN4",
  authDomain: "daysuntil-c8909.firebaseapp.com",
  projectId: "daysuntil-c8909",
  messagingSenderId: "850249417315",
  appId: "1:850249417315:web:de7fb067dbf7df28c3ae56",
  measurementId: "G-7Q7EBH5C0J"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
