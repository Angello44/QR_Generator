import {
  logQREvent,
  saveQRHistory,
  getQRHistory,
  deleteQRHistory,
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
  qrContainer.innerHTML = "";

  // Loading state
  generateBtn.classList.add("loading");
  generateBtn.disabled = true;

  try {
    // eslint-disable-next-line no-new
    new QRCode(qrContainer, {
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

    // Make QR background transparent (remove bg color pixels from canvas)
    const canvas = getCanvas();
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const bgR = parseInt(bg.slice(1, 3), 16);
      const bgG = parseInt(bg.slice(3, 5), 16);
      const bgB = parseInt(bg.slice(5, 7), 16);
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs(data[i] - bgR) < 10 &&
          Math.abs(data[i + 1] - bgG) < 10 &&
          Math.abs(data[i + 2] - bgB) < 10
        ) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    logQREvent("qr_generated", {
      input_length: text.length,
      qr_size: size,
      has_custom_color: fg !== "#000000" || bg !== "#ffffff",
    });
    saveQRHistory({ text, size, fgColor: fg, bgColor: bg }).then(() =>
      loadHistory(),
    );
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
  qrContainer.innerHTML = "";
  downloadBtn.classList.add("hidden");
  shareBtn.classList.add("hidden");
  clearError();
  qrInput.focus();
  logQREvent("qr_cleared", {});
}

// ===== History =====
async function loadHistory() {
  const historyList = document.getElementById("history-list");
  const items = await getQRHistory(10);
  if (items.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No history yet.</p>';
    return;
  }
  historyList.innerHTML = items
    .map((item) => {
      const truncated =
        item.text.length > 30 ? item.text.slice(0, 30) + "..." : item.text;
      const date = item.createdAt?.toDate
        ? item.createdAt.toDate()
        : new Date(item.createdAt);
      const formatted = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      return `<div class="history-item" data-id="${item.id}">
      <span class="history-item-text" title="${item.text}">${truncated}</span>
      <span class="history-item-meta">${item.size}px &bull; ${formatted}</span>
      <button class="history-reuse-btn" data-text="${item.text.replace(/"/g, "&quot;")}" data-size="${item.size}" data-fg="${item.fgColor}" data-bg="${item.bgColor}">&#x21BA; Reuse</button>
      <button class="history-delete-btn" data-id="${item.id}" aria-label="Hapus history">🗑</button>
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
      generateQR();
    });
  });

  // Attach delete button listeners
  historyList.querySelectorAll(".history-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteQRHistory(btn.dataset.id);
      await loadHistory();
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
loadHistory();
