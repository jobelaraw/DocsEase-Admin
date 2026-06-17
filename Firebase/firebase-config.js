import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, confirmPasswordReset, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBMUAgw21SQFZXnzxijqthz1usHxT_DYtA",
  authDomain: "docsease-efacc.firebaseapp.com",
  projectId: "docsease-efacc",
  storageBucket: "docsease-efacc.firebasestorage.app",
  messagingSenderId: "553281725931",
  appId: "1:553281725931:web:ead49444d796802c2aa5ae",
  measurementId: "G-DP5SQGZQTG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup, sendPasswordResetEmail, confirmPasswordReset, updateProfile, doc, setDoc, serverTimestamp };