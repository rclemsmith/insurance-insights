# Emerson Insurance - Analytics Dashboard

A modern, standalone analytics dashboard for Emerson Insurance that connects to Microsoft Clarity's Data Export API.

---

## Deploy to Cloudflare Pages (Production)

This dashboard is already pre-configured with **Cloudflare Pages Functions** in `/functions/api/`, meaning you can deploy it directly to Cloudflare Pages without needing any Python server in production!

### Step 1: Connect to Cloudflare Pages
1. In your Cloudflare Dashboard, go to **Workers & Pages**.
2. Click **Create Application** $\rightarrow$ select the **Pages** tab.
3. Choose either:
   - **Connect to Git** (push this folder to a new GitHub repo `insurance-dashboard` and select it), OR
   - **Direct Upload** (drag and drop the files from `insurance-dashboard`).
4. Set the project name (e.g. `emerson-dashboard`).
   - Your dashboard will be live at: `https://emerson-dashboard.pages.dev`
5. Build settings:
   - Framework preset: **None**
   - Build output directory: `/` (root)

### Step 2: Add Your Secret Clarity Token in Cloudflare
1. In Cloudflare Dashboard, open your new **`emerson-dashboard`** project.
2. Go to **Settings** $\rightarrow$ **Environment variables**.
3. Click **Add variable**:
   - Variable name: `CLARITY_API_TOKEN`
   - Value: *(Paste your Clarity API token)*
   - Type: **Secret / Encrypted**
4. Click **Save**.

Your dashboard will now run 100% serverless, fast, and secure on Cloudflare's global edge network!

---

## Local Development (Testing on PC)

1. Put your token in `.env`:
   ```env
   CLARITY_API_TOKEN=your_token_here
   ```
2. Start the local server:
   ```bash
   python server.py
   ```
3. Open `http://localhost:8000`.
