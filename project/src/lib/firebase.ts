import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAKgcmV-CWzzCgsYRai1p_52FVvA5C2LhM",
  authDomain: "computer-network-f5a23.firebaseapp.com",
  projectId: "computer-network-f5a23",
  storageBucket: "computer-network-f5a23.firebasestorage.app",
  messagingSenderId: "778971951016",
  appId: "1:778971951016:web:6e89abf42da9c10cf4779d",
  measurementId: "G-ECJ6JL196X"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);