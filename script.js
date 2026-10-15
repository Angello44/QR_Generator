// ===== DOM References =====
const qrInput      = document.getElementById('qr-input');
const qrSize       = document.getElementById('qr-size');
const fgColor      = document.getElementById('fg-color');
const bgColor      = document.getElementById('bg-color');
const generateBtn  = document.getElementById('generate-btn');
const clearBtn     = document.getElementById('clear-btn');
const downloadBtn  = document.getElementById('download-btn');
const shareBtn     = document.getElementById('share-btn');
const qrContainer  = document.getElementById('qr-container');
const errorMsg     = document.getElementById('error-msg');
const toast        = document.getElementById('toast');

// ===== State =====
let toastTimer = null;

// ===== Error Helpers =====
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
}

function clearError() {
  errorMsg.textContent = '';
  errorMsg.classList.add('hidden');
}

// ===== Toast =====
function showToast(message) {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toast.classList.remove('show');
    // Small delay so re-show animation fires
    setTimeout(() => triggerToast(message), 50);
  } else {
    triggerToast(message);
  }
}

function triggerToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = null;
  }, 3000);
}

// ===== Generate QR =====
function generateQR() {
  const text = qrInput.value.trim();

  if (!text) {
    showError('Please enter some text or a URL.');
    return;
  }

  clearError();

  const size = parseInt(qrSize.value, 10) || 256;
  const fg   = fgColor.value || '#000000';
  const bg   = bgColor.value || '#ffffff';

  // Clear previous QR
  qrContainer.innerHTML = '';

  // Loading state
  generateBtn.classList.add('loading');
  generateBtn.disabled = true;

  try {
    // eslint-disable-next-line no-new
    new QRCode(qrContainer, {
      text:        text,
      width:       size,
      height:      size,
      colorDark:   fg,
      colorLight:  bg,
      correctLevel: QRCode.CorrectLevel.H,
    });
  } catch (err) {
    generateBtn.classList.remove('loading');
    generateBtn.disabled = false;
    showError('Failed to generate QR code. Please try again.');
    return;
  }

  // Give QRCode.js a tick to render, then finalize
  setTimeout(() => {
    generateBtn.classList.remove('loading');
    generateBtn.disabled = false;
    downloadBtn.classList.remove('hidden');
    shareBtn.classList.remove('hidden');
  }, 100);
}

// ===== Get Canvas from Container =====
function getCanvas() {
  return qrContainer.querySelector('canvas');
}

// ===== Download QR =====
function downloadQR() {
  const canvas = getCanvas();
  if (!canvas) return;

  const dataURL = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = 'qrcode.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('QR Code downloaded!');
}

// ===== Share QR =====
async function shareQR() {
  const canvas = getCanvas();
  if (!canvas) return;

  if (navigator.share && navigator.canShare) {
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'qrcode.png', { type: 'image/png' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files:  [file],
          title:  'QR Code',
          text:   'Scan this QR code',
        });
        showToast('QR Code shared!');
        return;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Fall through to clipboard fallback
      } else {
        return; // User cancelled share sheet
      }
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(qrInput.value.trim());
    showToast('Text copied to clipboard!');
  } catch (err) {
    showToast('Share not supported on this browser.');
  }
}

// ===== Clear / Reset =====
function clearAll() {
  qrInput.value = '';
  qrContainer.innerHTML = '';
  downloadBtn.classList.add('hidden');
  shareBtn.classList.add('hidden');
  clearError();
  qrInput.focus();
}

// ===== Debounce Helper =====
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ===== Event Listeners =====

// Generate button
generateBtn.addEventListener('click', generateQR);

// Download button
downloadBtn.addEventListener('click', downloadQR);

// Share button
shareBtn.addEventListener('click', shareQR);

// Clear button
clearBtn.addEventListener('click', clearAll);

// Enter key in input
qrInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    generateQR();
  }
});

// Debounced auto-generate on typing
const debouncedGenerate = debounce(() => {
  if (qrInput.value.trim()) {
    generateQR();
  }
}, 500);

qrInput.addEventListener('input', debouncedGenerate);

// Immediate regenerate when options change (only if input already has a value)
function regenerateIfHasValue() {
  if (qrInput.value.trim()) {
    generateQR();
  }
}

qrSize.addEventListener('change',  regenerateIfHasValue);
fgColor.addEventListener('change', regenerateIfHasValue);
bgColor.addEventListener('change', regenerateIfHasValue);
