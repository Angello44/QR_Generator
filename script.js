// Mengimport fungsi-fungsi dari firebase.js untuk keperluan Analytics dan Firestore
import {
  logQREvent,
  saveQRHistory,
  getQRHistory,
  deleteQRHistory,
  saveScanHistory,
} from "./firebase.js";

// ===== DOM References =====
// Mengambil referensi elemen HTML berdasarkan ID agar bisa dimanipulasi lewat JavaScript
const qrInput = document.getElementById("qr-input");
const qrSize = document.getElementById("qr-size");
const fgColor = document.getElementById("fg-color");
const bgColor = document.getElementById("bg-color");
const generateBtn = document.getElementById("generate-btn");
const clearBtn = document.getElementById("clear-btn");
const downloadBtn = document.getElementById("download-btn");
const shareBtn = document.getElementById("share-btn");
const qrContainer = document.getElementById("qr-container");
const errorMsg = document.getElementById("error-msg");
const toast = document.getElementById("toast");

// ===== Welcome Screen =====
// Mengambil referensi elemen splash screen
const welcomeScreen = document.getElementById("welcome-screen");
const welcomeBtn = document.getElementById("welcome-btn");
const appWrapper = document.getElementById("app-wrapper");
const countdownEl = document.getElementById("welcome-countdown");

// Menyembunyikan splash screen dan menampilkan app utama
function dismissWelcome() {
  welcomeScreen.classList.add("hide");
  appWrapper.classList.remove("app-hidden");
}

// Countdown otomatis 3 detik, setelah habis splash screen ditutup
let countdownVal = 3;
const countdownTimer = setInterval(() => {
  countdownVal--;
  if (countdownEl) countdownEl.textContent = countdownVal;
  if (countdownVal <= 0) {
    clearInterval(countdownTimer);
    dismissWelcome();
  }
}, 1000);

// Jika tombol "Get Started" diklik, hentikan countdown dan tutup splash screen
welcomeBtn.addEventListener("click", () => {
  clearInterval(countdownTimer);
  dismissWelcome();
});

// ===== Bottom Nav Tab Switching =====
// Menangani perpindahan tab (Generate, Scan, History) saat tombol navigasi bawah diklik
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    // Hapus status aktif dari semua tombol dan panel
    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    // Aktifkan tombol dan panel yang sesuai
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ===== QR Scanner =====
// Variabel state untuk menyimpan stream kamera, frame animation, dan token request
let scanStream = null;
let scanAnimFrame = null;
let cameraReq = 0;

// Referensi elemen UI untuk fitur scan
const startScanBtn = document.getElementById("start-scan-btn");
const stopScanBtn = document.getElementById("stop-scan-btn");
const cameraVideo = document.getElementById("camera-video");
const cameraCanvas = document.getElementById("camera-canvas");
const cameraPlaceholder = document.getElementById("camera-placeholder");
const scanOverlay = document.querySelector(".scan-overlay");
const scanResult = document.getElementById("scan-result");
const scanResultText = document.getElementById("scan-result-text");
const scanOpenBtn = document.getElementById("scan-open-btn");
const scanCopyBtn = document.getElementById("scan-copy-btn");

// Menghentikan kamera dan mereset semua state scanner ke kondisi awal
function stopCamera() {
  cameraReq++; // Menginvalidasi request startCamera yang sedang berjalan
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop()); // Hentikan semua track kamera
    scanStream = null;
  }
  if (scanAnimFrame) {
    cancelAnimationFrame(scanAnimFrame); // Hentikan loop scan frame
    scanAnimFrame = null;
  }
  // Reset tampilan UI ke kondisi awal
  cameraVideo.classList.remove("active");
  scanOverlay.classList.remove("active");
  cameraPlaceholder.style.display = "flex";
  startScanBtn.classList.remove("hidden");
  stopScanBtn.classList.add("hidden");
}

// Meminta izin akses kamera dan memulai stream video untuk scanning
async function startCamera() {
  try {
    const my = ++cameraReq; // Token untuk mendeteksi race condition
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }, // Gunakan kamera belakang HP
    });
    // Jika user sudah pindah tab sebelum kamera selesai load, batalkan stream
    if (my !== cameraReq) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    // Hubungkan stream ke elemen video dan tampilkan UI kamera
    scanStream = stream;
    cameraVideo.srcObject = scanStream;
    cameraVideo.classList.add("active");
    cameraPlaceholder.style.display = "none";
    scanOverlay.classList.add("active");
    startScanBtn.classList.add("hidden");
    stopScanBtn.classList.remove("hidden");
    scanResult.classList.add("hidden");
    scanFrame(); // Mulai loop scan tiap frame
  } catch (err) {
    showToast("Camera access denied or not available.");
  }
}

// Loop scanning yang berjalan setiap frame menggunakan requestAnimationFrame
// Setiap frame video di-capture ke canvas, lalu dianalisis oleh jsQR
function scanFrame() {
  // Tunggu sampai video sudah siap menampilkan gambar
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    scanAnimFrame = requestAnimationFrame(scanFrame);
    return;
  }

  // Gambar frame video ke canvas untuk dianalisis
  const ctx = cameraCanvas.getContext("2d");
  const w = cameraVideo.videoWidth;
  const h = cameraVideo.videoHeight;
  cameraCanvas.width = w;
  cameraCanvas.height = h;
  ctx.drawImage(cameraVideo, 0, 0, w, h);

  // Ambil data pixel dari canvas
  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch (e) {
    scanAnimFrame = requestAnimationFrame(scanFrame);
    return;
  }

  // Pastikan library jsQR tersedia (support module dan non-module scope)
  const jsQRFn = window.jsQR || (typeof jsQR !== "undefined" ? jsQR : null);
  if (!jsQRFn) {
    scanAnimFrame = requestAnimationFrame(scanFrame);
    return;
  }

  // Jalankan jsQR untuk mendeteksi QR code dari pixel data
  const code = jsQRFn(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth", // Coba deteksi QR normal dan inverted
  });

  if (code) {
    // QR berhasil terdeteksi — tampilkan hasil dan simpan ke Firestore
    scanResultText.textContent = code.data;
    scanResult.classList.remove("hidden");
    stopCamera();
    showToast("QR Code scanned!");
    logQREvent("qr_scanned", { result_length: code.data.length });
    saveScanHistory({ text: code.data }).catch((err) =>
      console.error("Error saving scan history:", err),
    );
    return;
  }
  // QR belum ditemukan, lanjut scan frame berikutnya
  scanAnimFrame = requestAnimationFrame(scanFrame);
}

// Listener tombol Start dan Stop kamera
startScanBtn.addEventListener("click", startCamera);
stopScanBtn.addEventListener("click", stopCamera);

// Membuka URL hasil scan di tab baru (hanya jika URL valid http/https)
scanOpenBtn.addEventListener("click", () => {
  const url = scanResultText.textContent;
  if (isValidURL(url)) {
    window.open(url, "_blank");
  } else {
    showToast("Scanned result is not a valid URL.");
  }
});

// Menyalin hasil scan ke clipboard
scanCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(scanResultText.textContent);
    showToast("Copied to clipboard!");
  } catch {
    showToast("Could not copy.");
  }
});

// Otomatis hentikan kamera saat user berpindah dari tab Scan ke tab lain
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab !== "scan") stopCamera();
  });
});

// ===== State =====
let toastTimer = null;

// ===== URL Validator =====
// Memvalidasi apakah string yang diinput adalah URL yang valid (harus http atau https)
function isValidURL(str) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// ===== Error Helpers =====
// Menampilkan pesan error di bawah input
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
}

// Menyembunyikan pesan error
function clearError() {
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");
}

// Menerjemahkan kode error Firebase menjadi pesan yang mudah dipahami
function describeError(err) {
  const code = String(err?.code || "");
  if (code.includes("permission-denied")) {
    return "Permission denied. Check your Firestore rules.";
  }
  if (code.includes("unavailable")) {
    return "Network unavailable. Check your connection.";
  }
  if (code.includes("not-found")) {
    return "This item no longer exists.";
  }
  return err?.message || "Unknown error";
}

// Mengamankan string dari karakter HTML berbahaya untuk mencegah XSS
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ===== Toast =====
// Menampilkan notifikasi toast di bagian bawah layar
function showToast(message) {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toast.classList.remove("show");
    setTimeout(() => triggerToast(message), 50);
  } else {
    triggerToast(message);
  }
}

// Memunculkan toast dan menyembunyikannya setelah 3 detik
function triggerToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toastTimer = null;
  }, 3000);
}

// ===== Generate QR =====
// Fungsi utama untuk membuat QR Code dari URL yang diinput user
function generateQR() {
  const text = qrInput.value.trim();

  // Validasi: input tidak boleh kosong
  if (!text) {
    showError("Please enter some text or a URL.");
    return;
  }

  // Validasi: input harus berupa URL yang valid (http/https)
  if (!isValidURL(text)) {
    showError("Please enter a valid URL (must start with http:// or https://)");
    return;
  }

  clearError();

  // Ambil nilai ukuran dan warna yang dipilih user
  const size = parseInt(qrSize.value, 10) || 256;
  const fg = fgColor.value || "#000000";
  const bg = bgColor.value || "#ffffff";

  // Bersihkan QR sebelumnya dari container
  qrContainer.innerHTML =
    '<div id="qr-placeholder" class="qr-placeholder hidden"><img src="assets/logo.png" alt="Qraft" class="qr-placeholder-logo" /></div>';
  document.getElementById("qr-placeholder")?.classList.add("hidden");

  // Buat wrapper div dengan class qr-box sebagai container QR
  const qrWrapper = document.createElement("div");
  qrWrapper.className = "qr-box";
  qrContainer.appendChild(qrWrapper);

  // Tampilkan loading state pada tombol Generate
  generateBtn.classList.add("loading");
  generateBtn.disabled = true;

  try {
    // Gunakan library QRCode.js untuk membuat QR Code di dalam qrWrapper
    new QRCode(qrWrapper, {
      text: text,
      width: size,
      height: size,
      colorDark: fg,
      colorLight: bg,
      correctLevel: QRCode.CorrectLevel.H, // Level koreksi error tertinggi
    });
  } catch (err) {
    generateBtn.classList.remove("loading");
    generateBtn.disabled = false;
    showError("Failed to generate QR code. Please try again.");
    return;
  }

  // Tunggu sebentar agar QRCode.js selesai render, baru finalisasi UI
  setTimeout(() => {
    generateBtn.classList.remove("loading");
    generateBtn.disabled = false;
    downloadBtn.classList.remove("hidden");
    shareBtn.classList.remove("hidden");

    // Terapkan warna border dan glow sesuai warna foreground yang dipilih
    const qrBox =
      qrContainer.querySelector(".qr-box") || qrContainer.firstElementChild;
    if (qrBox) {
      const r = parseInt(fg.slice(1, 3), 16);
      const g = parseInt(fg.slice(3, 5), 16);
      const b = parseInt(fg.slice(5, 7), 16);
      qrBox.style.setProperty("--qr-fg-color", `rgba(${r},${g},${b},0.7)`);
      qrBox.style.setProperty("--qr-glow-color", `rgba(${r},${g},${b},0.35)`);
    }

    // Kirim event Analytics ke Firebase
    logQREvent("qr_generated", {
      input_length: text.length,
      qr_size: size,
      has_custom_color: fg !== "#000000" || bg !== "#ffffff",
    });

    // Simpan ke Firestore dan reload history
    saveQRHistory({ text, size, fgColor: fg, bgColor: bg })
      .then(() => loadHistory())
      .catch((err) => {
        console.error("Error saving QR history:", err);
        showToast("QR generated, but history could not be saved.");
      });
  }, 100);
}

// ===== Get Canvas from Container =====
// Mengambil elemen canvas dari dalam qr-container (hasil render QRCode.js)
function getCanvas() {
  return qrContainer.querySelector("canvas");
}

// ===== Download QR =====
// Mengkonversi canvas QR ke format PNG dan men-trigger download otomatis
function downloadQR() {
  const canvas = getCanvas();
  if (!canvas) return;

  // Konversi canvas ke data URL format PNG
  const dataURL = canvas.toDataURL("image/png");

  // Buat link sementara dan klik otomatis untuk download
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = "qrcode.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("QR Code downloaded!");
  logQREvent("qr_downloaded", { qr_size: parseInt(qrSize.value, 10) || 256 });
}

// ===== Share QR =====
// Membagikan QR Code menggunakan Web Share API native browser
// Jika tidak didukung, fallback ke copy URL ke clipboard
async function shareQR() {
  const canvas = getCanvas();
  if (!canvas) return;

  if (navigator.share && navigator.canShare) {
    try {
      // Konversi canvas ke Blob, lalu bungkus sebagai File untuk di-share
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      const file = new File([blob], "qrcode.png", { type: "image/png" });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "QR Code",
          text: "Scan this QR code",
        });
        showToast("QR Code shared!");
        logQREvent("qr_shared", { method: "share_api" });
        return;
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        // Jika error bukan karena user cancel, lanjut ke fallback clipboard
      } else {
        return; // User membatalkan share sheet
      }
    }
  }

  // Fallback: copy URL ke clipboard jika Web Share API tidak tersedia
  try {
    await navigator.clipboard.writeText(qrInput.value.trim());
    showToast("Text copied to clipboard!");
    logQREvent("qr_shared", { method: "clipboard" });
  } catch (err) {
    showToast("Share not supported on this browser.");
  }
}

// ===== Clear / Reset =====
// Mereset semua input dan tampilan QR ke kondisi awal
function clearAll() {
  qrInput.value = "";
  // Kembalikan placeholder logo ke container
  qrContainer.innerHTML =
    '<div id="qr-placeholder" class="qr-placeholder"><img src="assets/logo.png" alt="Qraft" class="qr-placeholder-logo" /></div>';
  document.getElementById("qr-placeholder")?.classList.remove("hidden");
  downloadBtn.classList.add("hidden");
  shareBtn.classList.add("hidden");
  clearError();
  qrInput.focus();
  logQREvent("qr_cleared", {});
}

// ===== History =====
// Mengambil data history dari Firestore dan menampilkannya di tab History
async function loadHistory() {
  const historyList = document.getElementById("history-list");

  let items;
  try {
    items = await getQRHistory(10); // Ambil 10 history terbaru
  } catch (err) {
    console.error("Error fetching QR history:", err);
    historyList.innerHTML =
      '<p class="history-empty">Could not load history.</p>';
    showToast("Could not load history: " + describeError(err));
    return;
  }

  // Tampilkan pesan kosong jika belum ada history
  if (items.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No history yet.</p>';
    return;
  }

  // Render setiap item history sebagai HTML
  historyList.innerHTML = items
    .map((item) => {
      const text = escapeHtml(item.text);
      // Potong teks jika lebih dari 30 karakter
      const truncated =
        item.text.length > 30
          ? escapeHtml(item.text.slice(0, 30)) + "..."
          : text;
      // Format tanggal dari Firestore timestamp
      const date = item.createdAt?.toDate
        ? item.createdAt.toDate()
        : new Date(item.createdAt);
      const formatted = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      return `<div class="history-item" data-id="${escapeHtml(item.id)}">
      <span class="history-item-text" title="${text}">${truncated}</span>
      <span class="history-item-meta">${escapeHtml(item.size)}px &bull; ${formatted}</span>
      <button type="button" class="history-reuse-btn" data-text="${text}" data-size="${escapeHtml(item.size)}" data-fg="${escapeHtml(item.fgColor || "#000000")}" data-bg="${escapeHtml(item.bgColor || "#ffffff")}">⟳</button>
      <button type="button" class="history-delete-btn" data-id="${escapeHtml(item.id)}" aria-label="Delete history">&#128465;</button>
    </div>`;
    })
    .join("");

  // Pasang event listener untuk tombol Reuse di setiap item history
  historyList.querySelectorAll(".history-reuse-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      // Isi ulang form dengan data dari history
      qrInput.value = btn.dataset.text;
      qrSize.value = btn.dataset.size;
      fgColor.value = btn.dataset.fg;
      bgColor.value = btn.dataset.bg;
      // Pindah ke tab Generate dan langsung generate QR
      document
        .querySelectorAll(".nav-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => p.classList.remove("active"));
      document
        .querySelector(".nav-btn[data-tab='generate']")
        .classList.add("active");
      document.getElementById("tab-generate").classList.add("active");
      generateQR();
    });
  });

  // Pasang event listener untuk tombol Delete di setiap item history
  historyList.querySelectorAll(".history-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!id) {
        showToast("Could not delete this item.");
        return;
      }
      btn.disabled = true;
      try {
        await deleteQRHistory(id); // Hapus dari Firestore
        await loadHistory(); // Reload tampilan history
        showToast("History deleted.");
      } catch (err) {
        console.error("Error deleting QR history:", err);
        btn.disabled = false;
        showToast("Delete failed: " + describeError(err));
      }
    });
  });
}

// ===== Event Listeners =====
// Menghubungkan tombol-tombol UI dengan fungsi yang sesuai

generateBtn.addEventListener("click", generateQR); // Tombol Generate
downloadBtn.addEventListener("click", downloadQR); // Tombol Download
shareBtn.addEventListener("click", shareQR); // Tombol Share
clearBtn.addEventListener("click", clearAll); // Tombol Clear

// Generate QR saat user menekan Enter di input field
qrInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    generateQR();
  }
});

// Load history saat halaman pertama kali dibuka
loadHistory().catch((err) => console.error("Error loading QR history:", err));
