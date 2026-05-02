# TheBookkeepers — Full-Stack Website

A professional one-page website for a bookkeeping services company, built with plain HTML/CSS on the frontend and Node.js + Express on the backend, with Firebase Firestore for data storage and Nodemailer for email notifications.

---

## Project Structure

```
thebookkeepers/
├── public/               ← Static frontend (served by Express)
│   ├── index.html        ← One-page website
│   ├── style.css         ← All styles
│   └── main.js           ← Form submission + UI interactions
│
├── server/
│   └── index.js          ← Express server, Firestore, Nodemailer
│
├── .env.example          ← Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## Prerequisites

- **Node.js** v18 or higher → https://nodejs.org
- A **Firebase** project with Firestore enabled
- A **Gmail** account (or any SMTP provider) for email notifications

---

## Step 1 — Install Dependencies

```bash
cd thebookkeepers
npm install
```

---

## Step 2 — Firebase Setup

### 2a. Create a Firebase Project
1. Go to https://console.firebase.google.com
2. Click **"Add project"**, give it a name (e.g. `thebookkeepers`), and click through the setup wizard.

### 2b. Enable Firestore
1. In the Firebase console sidebar, click **Firestore Database**.
2. Click **"Create database"**.
3. Choose **"Start in production mode"** (you can adjust rules later).
4. Select your preferred region and click **Done**.

### 2c. Download a Service Account Key
1. In the Firebase console, click the ⚙️ gear icon → **Project Settings**.
2. Go to the **Service accounts** tab.
3. Click **"Generate new private key"** → **"Generate key"**.
4. Save the downloaded JSON file.

**You have two options for providing the key to the server:**

**Option A — File path (simplest for local dev):**
1. Rename the downloaded file to `firebase-service-account.json`.
2. Place it in the project root (`thebookkeepers/`).
3. In your `.env` file, set:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   ```
   And comment out all the individual `FIREBASE_*` variables.

**Option B — Individual environment variables (best for cloud hosting):**
Open the downloaded JSON file and copy each value into the matching variable in `.env`:
```
FIREBASE_PROJECT_ID=        ← "project_id" field
FIREBASE_PRIVATE_KEY_ID=    ← "private_key_id" field
FIREBASE_PRIVATE_KEY=       ← "private_key" field (keep the quotes + \n sequences)
FIREBASE_CLIENT_EMAIL=      ← "client_email" field
FIREBASE_CLIENT_ID=         ← "client_id" field
FIREBASE_CLIENT_CERT_URL=   ← "client_x509_cert_url" field
```

### 2d. Firestore Security Rules (recommended)
In the Firebase console → Firestore → **Rules**, replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only the server (Admin SDK) can write leads — deny all client access
    match /leads/{document=**} {
      allow read, write: if false;
    }
  }
}
```

The Admin SDK bypasses these rules, so the server can still write. This just prevents any direct browser access.

---

## Step 3 — Email Setup (Gmail)

The server uses Nodemailer to send a notification email to the manager when a new lead is submitted.

### 3a. Enable 2-Step Verification on your Google Account
Go to https://myaccount.google.com/security and enable **2-Step Verification** (required for App Passwords).

### 3b. Generate a Gmail App Password
1. Go to https://myaccount.google.com/apppasswords
2. Select app: **"Mail"** → Select device: **"Other"** → type `TheBookkeepers`
3. Click **Generate**. Copy the 16-character password shown.

### 3c. Set email variables in `.env`
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop    ← the 16-char App Password (spaces are fine)
MANAGER_EMAIL=manager@thebookkeepers.com
```

### Using a different SMTP provider
| Provider     | SMTP_HOST              | SMTP_PORT | SMTP_SECURE |
|-------------|------------------------|-----------|-------------|
| Gmail       | smtp.gmail.com         | 587       | false       |
| Outlook/Hotmail | smtp.office365.com | 587       | false       |
| SendGrid    | smtp.sendgrid.net      | 587       | false       |
| Mailgun     | smtp.mailgun.org       | 587       | false       |

For port 465 (SSL), set `SMTP_SECURE=true`.

---

## Step 4 — Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in all the values from Steps 2 and 3. At minimum you need:

```
PORT=3000
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
SMTP_USER=...
SMTP_PASS=...
MANAGER_EMAIL=...
```

---

## Step 5 — Run the Project

### Development (auto-restarts on file changes)
```bash
npm run dev
```

### Production
```bash
npm start
```

Open your browser at: **http://localhost:3000**

---

## How It Works

1. User fills in the contact form on the website.
2. JavaScript validates the inputs client-side (required fields, email format).
3. On submit, `fetch()` sends a `POST` request to `/submit-form` — **no page reload**.
4. The Express server validates inputs again server-side.
5. The lead is saved to **Firestore** in a `leads` collection with a server timestamp.
6. **Nodemailer** sends a formatted HTML email to `MANAGER_EMAIL`.
7. The server responds with `{ success: true }` and the form shows a success banner.

---

## Viewing Leads in Firestore

1. Open the Firebase console → **Firestore Database**.
2. Click the `leads` collection.
3. Each document contains: `fullName`, `email`, `service`, `message`, `createdAt`.

---

## Deploying to a Cloud Host

### Railway / Render / Fly.io
1. Push the project to a GitHub repo.
2. Connect the repo to your hosting platform.
3. Set all `.env` variables in the platform's **Environment Variables** settings.
4. The `npm start` command will be picked up automatically from `package.json`.

### Important for cloud hosts
Use **Option B** (individual environment variables) for Firebase credentials instead of a JSON file, as file-based credentials are harder to manage on most platforms.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Error: Failed to load Firebase service account` | Check your `.env` values match the JSON file exactly. For `FIREBASE_PRIVATE_KEY`, ensure the `\n` sequences are preserved inside double quotes. |
| Email not sending | Verify the Gmail App Password is correct. Check that 2-Step Verification is on. Try `SMTP_PORT=465` with `SMTP_SECURE=true`. |
| `ECONNREFUSED` on form submit | Make sure the server is running on the correct port. |
| Firestore permission denied | The Admin SDK should bypass rules. If you see this, ensure `admin.initializeApp()` ran without errors (check the terminal). |
