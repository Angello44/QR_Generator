import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAnalytics,
  logEvent,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB4CngaoqUhJ5th_pReSm9zQVJdUlN-lJQ",
  authDomain: "qrgenerator-f8fd0.firebaseapp.com",
  projectId: "qrgenerator-f8fd0",
  storageBucket: "qrgenerator-f8fd0.firebasestorage.app",
  messagingSenderId: "670120907620",
  appId: "1:670120907620:web:85e0a2d25dbc4f3e542071",
  measurementId: "G-VSR9T7ZECW",
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export function logQREvent(eventName, params = {}) {
  try {
    logEvent(analytics, eventName, params);
  } catch (err) {
    console.warn("Analytics log failed:", err);
  }
}

export async function saveQRHistory(data) {
  const docRef = await addDoc(collection(db, "qr_history"), {
    text: data.text,
    size: data.size,
    fgColor: data.fgColor,
    bgColor: data.bgColor,
    createdAt: serverTimestamp(),
  });
  return docRef;
}

export async function getQRHistory(limitCount = 10) {
  const q = query(
    collection(db, "qr_history"),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function deleteQRHistory(id) {
  if (!id) {
    throw new Error("Missing history item id.");
  }
  await deleteDoc(doc(db, "qr_history", id));
}

export async function saveScanHistory(data) {
  const docRef = await addDoc(collection(db, "scan_history"), {
    text: data.text,
    scannedAt: serverTimestamp(),
  });
  return docRef;
}
