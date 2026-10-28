import {
  logQREvent,
  saveQRHistory,
  getQRHistory,
  deleteQRHistory,
  saveScanHistory,
} from "./firebase.js";

// ===== DOM References =====
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
const welcomeScreen = document.getElementById("welcome-screen");
const welcomeBtn = document.getElementById("welcome-btn");
const appWrapper = document.getElementById("app-wrapper");
const countdownEl = document.getElementById("welcome-countdown");

function dismissWelcome() {
  welcomeScreen.classList.add("hide");
  appWrapper.classList.remove("app-hidden");
}

let countdownVal = 3;
const countdownTimer = setInterval(() => {
  countdownVal--;
  if (countdownEl) countdownEl.textContent = countdownVal;
  if (countdownVal <= 0) {
    clearInterval(countdownTimer);
    dismissWelcome();
  }
}, 1000);

welcomeBtn.addEventListener("click", () => {
  clearInterval(countdownTimer);
  dismissWelcome();
});

// ===== Bottom Nav Tab Switching =====
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ===== QR Scanner =====
let scanStream = null;
let scanAnimFrame = null;
let cameraReq = 0;

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

function stopCamera() {
  cameraReq++; // invalidate any in-flight startCamera
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  if (scanAnimFrame) {
    cancelAnimationFrame(scanAnimFrame);
    scanAnimFrame = null;
  }
  cameraVideo.classList.remove("active");
  scanOverlay.classList.remove("active");
  cameraPlaceholder.style.display = "flex";
  startScanBtn.classList.remove("hidden");
  stopScanBtn.classList.add("hidden");
}

async function startCamera() {
  try {
    const my = ++cameraReq;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    // If a stop or a newer start superseded this request, tear down the
    // just-acquired stream and leave the UI in its (stopped) state.
    if (my !== cameraReq) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    scanStream = stream;
    cameraVideo.srcObject = scanStream;
    cameraVideo.classList.add("active");
    cameraPlaceholder.style.display = "none";
    scanOverlay.classList.add("active");
    startScanBtn.classList.add("hidden");
    stopScanBtn.classList.remove("hidden");
    scanResult.classList.add("hidden");
    scanFrame();
  } catch (err) {
    showToast("Camera access denied or not available.");
  }
}

function scanFrame() {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    scanAnimFrame = requestAnimationFrame(scanFrame);
    return;
  }

  const ctx = cameraCanvas.getContext("2d");
  const w = cameraVideo.videoWidth;
  const h = cameraVideo.videoHeight;
  cameraCanvas.width = w;
  cameraCanvas.height = h;
  ctx.drawImage(cameraVideo, 0, 0, w, h);

  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch (e) {
    scanAnimFrame = requestAnimationFrame(scanFrame);
    return;
  }

  const jsQRFn = window.jsQR || (typeof jsQR !== "undefined" ? jsQR : null);
  if (!jsQRFn) {
    scanAnimFrame = requestAnimationFrame(scanFrame);
    return;
  }

  const code = jsQRFn(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });
  if (code) {
    scanResultText.textContent = code.data;
    scanResult.classList.remove("hidden");
    stopCamera();
    showToast("QR Code scanned!");
    logQREvent("qr_scanned", { result_length: code.data.length });
    // Save to scan_history collection
    saveScanHistory({ text: code.data }).catch((err) =>
      console.error("Error saving scan history:", err),
    );
    return;
  }
  scanAnimFrame = requestAnimationFrame(scanFrame);
}

startScanBtn.addEventListener("click", startCamera);
stopScanBtn.addEventListener("click", stopCamera);

scanOpenBtn.addEventListener("click", () => {
  const url = scanResultText.textContent;
  if (isValidURL(url)) {
    window.open(url, "_blank");
  } else {
    showToast("Scanned result is not a valid URL.");
  }
});

scanCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(scanResultText.textContent);
    showToast("Copied to clipboard!");
  } catch {
    showToast("Could not copy.");
  }
});

// Stop camera when switching away from scan tab
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab !== "scan") stopCamera();
  });
});

// ===== State =====
let toastTimer = null;

// ===== URL Validator =====
function isValidURL(str) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// ===== Error Helpers =====
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.classList.add("hidden");
}

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ===== Toast =====
function showToast(message) {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toast.classList.remove("show");
    // Small delay so re-show animation fires
    setTimeout(() => triggerToast(message), 50);
  } else {
    triggerToast(message);
  }
}

function triggerToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toastTimer = null;
  }, 3000);
}

// ===== Generate QR =====
function generateQR() {
  const text = qrInput.value.trim();

  if (!text) {
    showError("Please enter some text or a URL.");
    return;
  }

  if (!isValidURL(text)) {
    showError("Please enter a valid URL (must start with http:// or https://)");
    return;
  }

  clearError();

  const size = parseInt(qrSize.value, 10) || 256;
  const fg = fgColor.value || "#000000";
  const bg = bgColor.value || "#ffffff";

  // Clear previous QR
  qrContainer.innerHTML =
    '<div id="qr-placeholder" class="qr-placeholder hidden"><img src="assets/logo.png" alt="Qraft" class="qr-placeholder-logo" /></div>';
  document.getElementById("qr-placeholder")?.classList.add("hidden");

  // Buat wrapper qr-box dulu
  const qrWrapper = document.createElement("div");
  qrWrapper.className = "qr-box";
  qrContainer.appendChild(qrWrapper);

  // Loading state
  generateBtn.classList.add("loading");
  generateBtn.disabled = true;

  try {
    // eslint-disable-next-line no-new
    new QRCode(qrWrapper, {
      text: text,
      width: size,
      height: size,
      colorDark: fg,
      colorLight: bg,
      correctLevel: QRCode.CorrectLevel.H,
    });
  } catch (err) {
    generateBtn.classList.remove("loading");
    generateBtn.disabled = false;
    showError("Failed to generate QR code. Please try again.");
    return;
  }

  // Give QRCode.js a tick to render, then finalize
  setTimeout(() => {
    generateBtn.classList.remove("loading");
    generateBtn.disabled = false;
    downloadBtn.classList.remove("hidden");
    shareBtn.classList.remove("hidden");

    // Apply fg color as border + glow on the QR box
    const qrBox =
      qrContainer.querySelector(".qr-box") || qrContainer.firstElementChild;
    if (qrBox) {
      // Convert hex to rgba for glow (50% opacity)
      const r = parseInt(fg.slice(1, 3), 16);
      const g = parseInt(fg.slice(3, 5), 16);
      const b = parseInt(fg.slice(5, 7), 16);
      qrBox.style.setProperty("--qr-fg-color", `rgba(${r},${g},${b},0.7)`);
      qrBox.style.setProperty("--qr-glow-color", `rgba(${r},${g},${b},0.35)`);
    }

    logQREvent("qr_generated", {
      input_length: text.length,
      qr_size: size,
      has_custom_color: fg !== "#000000" || bg !== "#ffffff",
    });
    saveQRHistory({ text, size, fgColor: fg, bgColor: bg })
      .then(() => loadHistory())
      .catch((err) => {
        console.error("Error saving QR history:", err);
        showToast("QR generated, but history could not be saved.");
      });
  }, 100);
}

// ===== Get Canvas from Container =====
function getCanvas() {
  return qrContainer.querySelector("canvas");
}

// ===== Download QR =====
function downloadQR() {
  const canvas = getCanvas();
  if (!canvas) return;

  const dataURL = canvas.toDataURL("image/png");
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
async function shareQR() {
  const canvas = getCanvas();
  if (!canvas) return;

  if (navigator.share && navigator.canShare) {
    try {
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
        // Fall through to clipboard fallback
      } else {
        return; // User cancelled share sheet
      }
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(qrInput.value.trim());
    showToast("Text copied to clipboard!");
    logQREvent("qr_shared", { method: "clipboard" });
  } catch (err) {
    showToast("Share not supported on this browser.");
  }
}

// ===== Clear / Reset =====
function clearAll() {
  qrInput.value = "";
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
async function loadHistory() {
  const historyList = document.getElementById("history-list");

  let items;
  try {
    items = await getQRHistory(10);
  } catch (err) {
    console.error("Error fetching QR history:", err);
    historyList.innerHTML =
      '<p class="history-empty">Could not load history.</p>';
    showToast("Could not load history: " + describeError(err));
    return;
  }

  if (items.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No history yet.</p>';
    return;
  }

  historyList.innerHTML = items
    .map((item) => {
      const text = escapeHtml(item.text);
      const truncated =
        item.text.length > 30
          ? escapeHtml(item.text.slice(0, 30)) + "..."
          : text;
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

  // Attach reuse button listeners
  historyList.querySelectorAll(".history-reuse-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      qrInput.value = btn.dataset.text;
      qrSize.value = btn.dataset.size;
      fgColor.value = btn.dataset.fg;
      bgColor.value = btn.dataset.bg;
      // Switch to Generate tab
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

  // Attach delete button listeners
  historyList.querySelectorAll(".history-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!id) {
        showToast("Could not delete this item.");
        return;
      }

      btn.disabled = true;
      try {
        await deleteQRHistory(id);
        await loadHistory();
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

// Generate button
generateBtn.addEventListener("click", generateQR);

// Download button
downloadBtn.addEventListener("click", downloadQR);

// Share button
shareBtn.addEventListener("click", shareQR);

// Clear button
clearBtn.addEventListener("click", clearAll);

// Enter key in input
qrInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    generateQR();
  }
});

// Load history on page start
loadHistory().catch((err) => console.error("Error loading QR history:", err));
