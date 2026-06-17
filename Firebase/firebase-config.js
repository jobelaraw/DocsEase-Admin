import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMUAgw21SQFZXnzxijqthz1usHxT_DYtA",
  authDomain: "docsease-efacc.firebaseapp.com",
  projectId: "docsease-efacc",
  storageBucket: "docsease-efacc.firebasestorage.app",
  messagingSenderId: "553281725931",
  appId: "1:553281725931:web:ead49444d796802c2aa5ae",
  measurementId: "G-DP5SQGZQTG"
};

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 4. Initialize Auth and Firestore
const auth = getAuth(app);
const db = getFirestore(app);

// 5. Export them so your HTML files can use them
export { auth, db };