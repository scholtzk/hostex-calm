import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase web-SDK configuration for property-manager-cf570 project

const firebaseConfig = {
  apiKey: "AIzaSyDAO0MRKXCq9DHO-EZkUcpEf3m18oH4bE8",
  authDomain: "property-manager-cf570.firebaseapp.com",
  projectId: "property-manager-cf570",
  storageBucket: "property-manager-cf570.firebasestorage.app",
  messagingSenderId: "392212452825",
  appId: "1:392212452825:web:1fa2672a6a3a86f8d735c8",
  measurementId: "G-12CN857J40",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the Firestore instance for use throughout the app
export const db = getFirestore(app); 