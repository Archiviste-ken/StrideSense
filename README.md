<div align="center">

# StrideSense

### Smart Assistive System for Visually Impaired Users

Accessible, mobile‑first prototype focused on safe navigation, clear feedback, and a calm dark UI.

[Live Demo](https://your-deployment-url.com) · [Report Issue](https://github.com/your-org/stride-sense/issues)

</div>

---

## ✨ Overview

StrideSense is a **UI‑only prototype** of a smart assistive system designed for visually impaired users. It focuses on:

- Large, high‑contrast controls that are easy to tap
- Simple, predictable navigation
- Screen‑reader friendly copy and landmarks
- Optional **voice** and **haptic** feedback for key actions

This project is built with the **Next.js App Router** and is intended as a clean starting point for future backend and AI integrations.

---

## 🧱 Features

- **Multi‑page mobile experience**
  - Home (Crossing Assistant)
  - Camera Assist
  - Get Help
  - Profile & Settings
- **Fixed bottom navigation bar** with clear text labels (no icon‑only actions)
- **Dark theme**, high contrast typography, and large rounded buttons (≥ 60–72px)
- **Assistive feedback hook** using:
  - Web Speech API (`window.speechSynthesis`)
  - Vibration API (`navigator.vibrate`)
- **Prototype interactions only**
  - “Coming Soon” and “Loading” states instead of real backend logic
  - Geolocation and camera access are used in a minimal, safe way

---

## 🧠 Tech Stack

### Frontend

- [Next.js 16](https://nextjs.org/) – App Router, React Server + Client Components
- [React 19](https://react.dev/) – Hooks‑first component architecture
- [Tailwind CSS v4](https://tailwindcss.com/) – utility‑first styling, mobile‑optimized
- HTML5, modern CSS, and accessible ARIA patterns

### Tooling

- ESLint 9 + `eslint-config-next` – linting and best practices
- `next/font` – optimized Geist font loading

> Note: The backend and database are **not** implemented in this prototype, but the design anticipates a future stack with **Node.js + Express** and **MongoDB**.

---

## 🧭 Application Structure

Key paths inside `src/app`:

- `/` → `page.js` – **Home / Crossing Assistant**
- `/camera` → `camera/page.js` – **Camera Assist** placeholder
- `/help` → `help/page.js` – **Get Help** actions
- `/profile` → `profile/page.js` – **Profile & Settings**

Shared UI & hooks:

- `components/AppShell.jsx` – Root shell with fixed bottom navigation
- `hooks/useAssistiveFeedback.js` – Speech + vibration helper used across pages

---

## ♿ Accessibility Design

StrideSense is intentionally designed for assistive use:

- **Semantic layout** – `main`, `section`, `nav`, and proper headings
- **Descriptive aria‑labels** on **every** interactive control
- **Large touch targets** (60–72px high buttons) with generous spacing
- **High contrast** dark theme: near‑black backgrounds, white / slate text
- **Live regions** (`aria-live="polite"`) for status messages like
  - `Idle`
  - `Tracking location…`
  - `Coming Soon: Smart Detection`
- **No icon‑only buttons** – every nav item and action includes clear text

This makes the app friendlier to screen readers such as TalkBack, VoiceOver, and NVDA.

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- Node.js **18+** (LTS recommended)
- npm, pnpm, yarn, or bun (examples below use npm)

### Clone & install

```bash
git clone https://github.com/your-org/stride-sense.git
cd stride-sense
npm install
```

### Run the dev server

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser.

The app is built mobile‑first; for the best experience, open DevTools → Device Toolbar and choose a phone (e.g. iPhone 14 / Pixel) or a tablet breakpoint.

---

## 🌍 Deployment

StrideSense is a standard Next.js App Router project and can be deployed to platforms like **Vercel**, **Netlify**, or any Node‑capable host.

### Deploy to Vercel (recommended)

1. Push your repository to GitHub / GitLab / Bitbucket
2. Go to [https://vercel.com/new](https://vercel.com/new)
3. Import the `stride-sense` repo
4. Use the default **Next.js** presets
5. Click **Deploy**

Once deployed, update the link at the top of this README:

```md
[Live Demo](https://your-deployment-url.com)
```

---

## 🕹 How to Use

> This is a **UI prototype** – actions provide feedback (speech, vibration, text), but do not contact real services.

### 1. Home – Crossing Assistant

- Tap **“Start Assistance”** to begin a mock crossing session
  - Status changes to **“Tracking location…”**
  - After 3 seconds, it updates to **“Coming Soon: Smart Detection”**
  - Optional speech: “Assistance started”
- Tap **“Stop Assistance”** to end the session
  - Status returns to **“Idle”**

### 2. Camera Assist

- Shows a large placeholder “Camera Assist – Coming Soon” panel
- Buttons:
  - **Open Camera** – lightly probes `getUserMedia` and then stops the stream
  - **Take Picture** – placeholder action
  - **View History** – placeholder action
- All buttons announce “Camera feature coming soon” via voice + vibration (where supported).

### 3. Get Help

- **Call a Volunteer**
  - Speaks “Requesting assistance – feature coming soon”
  - Triggers a short vibration
  - Shows a blocking alert: `Feature coming soon`
- **Emergency Contact**
  - Updates helper text and announces that the feature is coming soon

### 4. Profile & Settings

- Displays a **Demo User** profile
- Buttons for **Manage Contacts** and **Preferences**
- Both trigger “Backend integration coming soon” messaging with assistive feedback

---

## 🔒 Privacy & Permissions

This prototype may prompt for **location** or **camera** access when you interact with certain buttons. These are used purely for experimentation and are not stored or transmitted.

- Geolocation is requested once when assistance starts; the result is ignored.
- Camera access is requested (for “Open Camera”) and immediately released.

You can safely deny permissions; the UI will still show “Coming Soon” behavior.

---

## 🧩 Roadmap Ideas

- Real‑time crossing assistance with computer vision
- Secure backend with user accounts and emergency contact management
- Cloud‑synced history of routes and alerts
- Richer haptic patterns and configurable audio feedback

---

## 🤝 Contributing

Contributions are welcome, especially around accessibility and UX improvements.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/improve-accessibility`
3. Make your changes and add tests where appropriate
4. Run `npm run lint`
5. Open a Pull Request with a clear description and screenshots

---

## 📄 License

Specify your license here (e.g. MIT). Until then, this project is provided as‑is for experimentation and prototyping.
