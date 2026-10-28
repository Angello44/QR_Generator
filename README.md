# Qraft : QR Code Generator & Scanner

**Create. Scan. Connect.**  
Aplikasi web untuk generate dan scan QR Code berbasis URL, terintegrasi dengan Firebase Analytics dan Firestore.

Live Demo: [https://angello44.github.io/QR_Generator/](https://angello44.github.io/QR_Generator/)

:

## Screenshot

<img src="mobile_demo/page 2.jpeg" width="130" alt="App Preview" />

:

## Fitur Utama

**Generate QR Code**

- Input URL (validasi http/https)
- Pilih ukuran: Small (128px), Medium (200px), Large (300px)
- Pilih warna QR dan warna background
- Download QR sebagai PNG
- Share QR via Web Share API, fallback copy clipboard

**Scan QR Code**

- Akses kamera HP langsung dari browser
- Deteksi QR Code otomatis frame per frame
- Hasil scan bisa dibuka sebagai URL atau di-copy
- Tersimpan otomatis ke Firebase

**History**

- Semua QR yang di-generate tersimpan di `qr_history`
- Semua QR yang di-scan tersimpan di `scan_history`
- Tombol Reuse: isi ulang form dan generate otomatis
- Tombol Delete: hapus dari database

:

## Tech Stack & Library

| Library / Tool        | Fungsi                                            | File & Line               |
| --------------------- | ------------------------------------------------- | ------------------------- |
| QRCode.js             | Generate QR Code dari URL ke canvas HTML          | `script.js` line 298      |
| jsQR                  | Decode/scan QR Code dari frame kamera             | `script.js` line 142–151  |
| Firebase Analytics    | Track event: generate, download, share, scan      | `firebase.js` line 35     |
| Firebase Firestore    | Simpan `qr_history` & `scan_history` ke cloud     | `firebase.js` line 42, 70 |
| Canvas API            | Render QR, convert ke PNG, baca frame kamera      | `script.js` line 356, 376 |
| Web Share API         | Share QR native ke WhatsApp, dll                  | `script.js` line 373–404  |
| WebRTC / getUserMedia | Akses kamera HP untuk fitur scan                  | `script.js` line 98       |
| URL API               | Validasi input harus http/https                   | `script.js` line 199–203  |
| Clipboard API         | Copy hasil scan/URL ke clipboard sebagai fallback | `script.js` line 180, 401 |
| requestAnimationFrame | Loop scan kamera tiap frame secara efisien        | `script.js` line 123, 163 |

:

## Struktur File

```
Qr_Generator/
├── index.html          # Struktur UI (splash, generate, scan, history tab)
├── style.css           # Desain dark theme + mint green accent
├── script.js           # Logic utama (generate, scan, history, firebase)
├── firebase.js         # Firebase init, Analytics, Firestore
├── favicon.svg         # Icon tab browser
├── assets/
│   ├── logo.png        # Logo Qraft
│   └── jsQR.js         # jsQR library (local copy)
└── mobile_demo/        # Screenshot tampilan di HP
```

:

## Firebase Collections

**qr_history** : tersimpan setiap kali user generate QR Code.

```json
{
  "text": "https://example.com",
  "size": 200,
  "fgColor": "#000000",
  "bgColor": "#ffffff",
  "createdAt": "timestamp"
}
```

**scan_history** : tersimpan setiap kali user scan QR Code berhasil.

```json
{
  "text": "https://example.com",
  "scannedAt": "timestamp"
}
```

:

## Firebase Analytics Events

| Event           | Trigger                     |
| --------------- | --------------------------- |
| `qr_generated`  | Setiap berhasil generate QR |
| `qr_downloaded` | Setiap klik Download        |
| `qr_shared`     | Setiap klik Share           |
| `qr_scanned`    | Setiap berhasil scan QR     |
| `qr_cleared`    | Setiap klik Clear           |

:

## Cara Menjalankan

1. Clone repo ini
2. Buka `index.html` langsung di browser, atau
3. Akses via live demo: [https://angello44.github.io/QR_Generator/](https://angello44.github.io/QR_Generator/)

Tidak memerlukan build tools, npm, atau server — pure HTML/CSS/JS.
