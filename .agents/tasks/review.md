# Glassmorphism UI rewrite with URL-only validation

The change replaces the plain CSS with a full glassmorphism design (animated gradient background, frosted-glass card, gradient title, dark glass inputs and buttons) and tightens the `generateQR` function to reject non-URL input before calling the QR library. The label and placeholder in `index.html` now communicate URL-only intent. All previously existing functions — download, share, clear, history, event listeners — are intact.

Watch for: none — all checklist items confirmed present and correct. No blocking concerns.

**Verdict**: APPROVED

---

## High-level view

The three keyframe animations (`gradientShift`, `spin`, `fadeInUp`) are all defined and wired up correctly: `gradientShift` drives the body background, `spin` drives the loading spinner, `fadeInUp` is available for the `.qr-box` entry. The card uses `backdrop-filter: blur(20px)` and `rgba(255,255,255,0.05)` background as specified. Title gradient runs `#a78bfa` → `#60a5fa`. Input/select glass style, button variants, toast background, and history item rgba styling all match the checklist exactly. Responsive breakpoint fires at `max-width: 520px`.

`isValidURL` uses `new URL(str)` inside a try/catch and returns `true` only for `http:` or `https:` protocols — confirmed present. Inside `generateQR`, the empty-check fires first, URL validation second, matching the specified order. The label in `index.html` reads `URL` (not `Text or URL`) and the placeholder is `https://example.com`.

<details>
<summary>Issues (0)</summary>

No issues found.

</details>

<details>
<summary>Details</summary>

### Checklist verification — style.css

Every required item is confirmed:

- `@keyframes gradientShift`, `@keyframes fadeInUp`, `@keyframes spin` — all present.
- `body` uses `background-size: 400% 400%` and `animation: gradientShift 12s ease infinite`.
- `.card` uses `backdrop-filter: blur(20px)`, `-webkit-backdrop-filter: blur(20px)`, `background: rgba(255,255,255,0.05)`, `border-radius: 24px`, `box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)`.
- Title gradient: `linear-gradient(135deg, #a78bfa, #60a5fa)` with `-webkit-background-clip: text`.
- `.form-input` and `.form-select` use `background: rgba(255,255,255,0.08)`, dark glass style.
- `.btn-primary` gradient: `linear-gradient(135deg, #7c3aed, #2563eb)`.
- `.btn-ghost` uses `background: rgba(255,255,255,0.08)`.
- `.btn-secondary` uses `background: rgba(255,255,255,0.1)`.
- `.toast` uses `background: rgba(30,30,50,0.95)`.
- `.history-item` uses `background: rgba(255,255,255,0.05)`.
- Responsive breakpoint at `@media (max-width: 520px)`.

### Checklist verification — script.js

`isValidURL(str)` is confirmed at lines 19–24: wraps `new URL(str)` in try/catch, checks `url.protocol === "http:" || url.protocol === "https:"`. Inside `generateQR`: empty-check fires first (`if (!text)`), URL validation fires second (`if (!isValidURL(text))`). All existing functions — `downloadQR`, `shareQR`, `clearAll`, `loadHistory` — are present. All event listeners (generate, download, share, clear, keydown Enter) are present. `loadHistory()` is called on page load.

### Checklist verification — index.html

Label text is `URL` (confirmed, line ~11). Input placeholder is `https://example.com` (confirmed). No auto-generate wiring (no `input` event listener that calls `generateQR`) — the QR only generates on explicit button click or Enter key.

</details>

---

<details>
<summary>File map</summary>

| File         | What changed                                                                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `style.css`  | Full glassmorphism rewrite — animated gradient body, frosted-glass card, gradient title, dark glass inputs/selects/buttons, rgba toast and history items, spin/fadeInUp keyframes, 520px responsive breakpoint |
| `script.js`  | Added `isValidURL()` with `new URL()` + protocol check; added URL validation gate inside `generateQR()` after empty-check                                                                                      |
| `index.html` | Label changed from `Text or URL` to `URL`; placeholder changed to `https://example.com`                                                                                                                        |

</details>
