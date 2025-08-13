import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBc7ROAuStlZv3VISrAyXAbjQXAkiAaq10",
  authDomain: "tanviremart.firebaseapp.com",
  projectId: "tanviremart",
  storageBucket: "tanviremart.firebasestorage.app",
  messagingSenderId: "1017569424765",
  appId: "1:1017569424765:web:faed04ca3040108e488814",
  measurementId: "G-NNCVHKBRFJ"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);