// Import fungsi inisialisasi Firebase dari SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";

// Import fungsi Analytics untuk mencatat event pengguna
import {
  getAnalytics,
  logEvent,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-analytics.js";

// Import fungsi Firestore untuk operasi database (baca, tulis, hapus)
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

// Konfigurasi Firebase — berisi kredensial untuk menghubungkan app ke project Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB4CngaoqUhJ5th_pReSm9zQVJdUlN-lJQ",
  authDomain: "qrgenerator-f8fd0.firebaseapp.com",
  projectId: "qrgenerator-f8fd0",
  storageBucket: "qrgenerator-f8fd0.firebasestorage.app",
  messagingSenderId: "670120907620",
  appId: "1:670120907620:web:85e0a2d25dbc4f3e542071",
  measurementId: "G-VSR9T7ZECW",
};

// Inisialisasi Firebase App, Analytics, dan Firestore
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Mencatat event ke Firebase Analytics
// eventName: nama event (contoh: "qr_generated"), params: data tambahan
export function logQREvent(eventName, params = {}) {
  try {
    logEvent(analytics, eventName, params);
  } catch (err) {
    console.warn("Analytics log failed:", err);
  }
}

// Menyimpan data QR yang di-generate ke collection "qr_history" di Firestore
// Menyimpan: URL, ukuran, warna QR, warna background, dan waktu generate
export async function saveQRHistory(data) {
  const docRef = await addDoc(collection(db, "qr_history"), {
    text: data.text,
    size: data.size,
    fgColor: data.fgColor,
    bgColor: data.bgColor,
    createdAt: serverTimestamp(), // Timestamp dari server Firebase agar akurat
  });
  return docRef;
}

// Mengambil data history QR dari Firestore, diurutkan dari yang terbaru
// limitCount: jumlah maksimal data yang diambil (default 10)
export async function getQRHistory(limitCount = 10) {
  const q = query(
    collection(db, "qr_history"),
    orderBy("createdAt", "desc"), // Urutkan dari terbaru ke terlama
    limit(limitCount),
  );
  const snapshot = await getDocs(q);
  // Kembalikan array berisi id dokumen beserta semua field datanya
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Menghapus satu dokumen dari collection "qr_history" berdasarkan ID dokumen
export async function deleteQRHistory(id) {
  if (!id) {
    throw new Error("Missing history item id.");
  }
  await deleteDoc(doc(db, "qr_history", id));
}

// Menyimpan hasil scan QR ke collection "scan_history" di Firestore
// Menyimpan: URL hasil scan dan waktu scan
export async function saveScanHistory(data) {
  const docRef = await addDoc(collection(db, "scan_history"), {
    text: data.text,
    scannedAt: serverTimestamp(), // Timestamp dari server Firebase
  });
  return docRef;
}
