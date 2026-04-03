# Stripe checkout + order email

Your marketing site is **static HTML**. Stripe **secret keys** and **webhooks** must run on a small server (this folder)—never put `sk_live_…` in the browser.

## What this does

1. **`POST /create-checkout-session`** — Creates a [Stripe Checkout](https://stripe.com/docs/payments/checkout) session for **$10 / $20 / $50** (Basic / Advanced / Professional) and stores the wizard answers in **session metadata**.
2. **`POST /webhook`** — On `checkout.session.completed`, builds a **plain-text email** (questionnaire + tier bullets, same idea as the on-site summary) and sends it to the customer’s email.

The **full polished blueprint** is still something you deliver manually (Google Doc, etc.); this email is the **order receipt + spec snapshot**.

## Setup

1. **Install**

   ```bash
   cd stripe-server
   npm install
   ```

2. **Copy env**

   ```bash
   copy env.example .env
   ```

   On Mac/Linux: `cp env.example .env`

3. **Stripe Dashboard**

   - Get **Secret key** → `STRIPE_SECRET_KEY`
   - **Developers → Webhooks → Add endpoint**  
     URL: `https://YOUR-API-HOST/webhook`  
     Event: `checkout.session.completed`  
     Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

4. **Local webhook testing**

   ```bash
   stripe listen --forward-to localhost:3000/webhook
   ```

   Use the `whsec_…` from that command as `STRIPE_WEBHOOK_SECRET` in `.env` while testing.

5. **Email**

   Set `SMTP_*` and `EMAIL_FROM`. For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833), not your normal password.

6. **Run API**

   ```bash
   npm start
   ```

7. **Connect the website**

   In `index.html`, set your deployed API URL (no trailing slash):

   ```html
   <script>
     window.STRIPE_CHECKOUT_API = "https://your-api.onrender.com";
   </script>
   ```

   `CLIENT_URL` in `.env` must match where you open the wizard (e.g. `https://your-site.netlify.app`), because Stripe redirects back there with `?checkout=success` or `?checkout=cancel`.

## Deploy options

- **Render / Railway / Fly.io** — Run `node server.js`, set env vars, public URL for the API.
- **CORS** — Defaults to `CLIENT_URL`. Override with `CORS_ORIGIN` if needed.

## Security notes

- Use **HTTPS** in production for both the site and the API.
- Rotate keys if exposed.
- Consider verifying `session.payment_status` in the webhook if you add more logic.
