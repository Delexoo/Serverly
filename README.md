<p align="center">
  <img src="https://img.shields.io/badge/Serverly-Discord_Server_Builder-5865F2?style=for-the-badge&labelColor=4752C4&color=FFFFFF&logo=discord&logoColor=white" alt="Serverly" />
</p>

<h1 align="center">Serverly</h1>

<p align="center">
  <strong>Design your Discord server in minutes.</strong><br />
  Custom channels, roles, layouts, and monetization-ready structure — delivered after checkout.
</p>

<p align="center">
  <a href="https://serverly.store"><img src="https://img.shields.io/badge/Live_Site-serverly.store-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Live site" /></a>
  <a href="https://github.com/Delexoo/Serverly"><img src="https://img.shields.io/badge/GitHub-Source-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" /></a>
  <img src="https://img.shields.io/badge/Price-From_$9.99-2ea043?style=for-the-badge" alt="Pricing" />
</p>

---

## About

**Serverly** is a guided web wizard that helps creators, communities, and entrepreneurs launch a **professional Discord server layout** without starting from scratch. Answer a few questions, preview channel structures, pay once via Stripe, and receive a tailored template with roles, categories, naming patterns, and setup guidance.

| | |
|---|---|
| **Live site** | [serverly.store](https://serverly.store) |
| **Author** | [Delexoo](https://github.com/Delexoo) |
| **Frontend** | Static HTML/CSS/JS (GitHub Pages) |
| **Backend** | Node.js · Express · Stripe · Nodemailer |

---

## What you get

- **Custom channel layout** — categories, naming styles, and structure tuned to your goal
- **Role architecture** — staff, member, and monetization-ready roles
- **Written guidance** — welcome flows, growth notes, and paid-access setup tips
- **Email delivery** — template link and receipt sent after successful payment
- **Self-serve apply** — you implement the layout on a new or reset server (no Discord login required by default)

---

## Features

| Feature | Description |
|---------|-------------|
| **5-step wizard** | Goal, server size, channel pattern, layout preview, checkout |
| **Live layout preview** | See channel trees before you buy |
| **Stripe Checkout** | Secure payments with webhook fulfillment |
| **Template registry** | Multiple layout types mapped to delivery assets |
| **Security middleware** | Rate limiting, CORS, origin checks, header hardening |
| **GitHub Pages ready** | Static site with optional `CLIENT_SITE_PATH` for project pages |

---

## Repository structure

```
Serverly/
├── index.html              # Wizard UI
├── styles.css              # Frontend styles
├── script.js               # Wizard flow & preview
├── layout-channel-trees.js # Channel tree definitions
├── template-registry.js    # Template URL resolution
├── checkout-security.js    # Checkout hardening utilities
├── server.js               # Stripe API + webhook + email delivery
├── legal.html              # Terms & policies
├── thank-you.html          # Post-checkout page
├── package.json
└── CNAME                   # serverly.store
```

---

## Quick start (local development)

### Static site only

```bash
# Serve the frontend (any static server)
npx serve .
# Open http://localhost:3000
```

### Full stack (Stripe + email)

```bash
npm install
cp .env.example .env   # if present — otherwise create .env
npm start
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `CLIENT_URL` | Public site base URL (e.g. `https://serverly.store`) |
| `CLIENT_SITE_PATH` | Repo name for `*.github.io` project pages (e.g. `Serverly`) |
| SMTP vars | Nodemailer configuration for delivery emails |

---

## Deployment

| Component | Platform |
|-----------|----------|
| **Static site** | GitHub Pages (`serverly.store` via CNAME) |
| **API / webhooks** | Render, Railway, Fly.io, or any Node host |

Point Stripe webhook to `POST /webhook` on your API server. Set `CLIENT_URL` to your production domain so return URLs and emails are correct.

---

## FAQ

<details>
<summary><strong>Do you log into my Discord?</strong></summary>
<br />
No. By default Serverly delivers a template you apply yourself. Hands-on setup inside your server is a separate offering.
</details>

<details>
<summary><strong>Does this work on an existing server?</strong></summary>
<br />
Layouts are designed for a <strong>new server</strong> or a <strong>full reset</strong>. In-place migration for live servers is planned.
</details>

<details>
<summary><strong>What happens after I pay?</strong></summary>
<br />
Stripe confirms payment → webhook fires → you receive an email with your template and order summary.
</details>

---

## Security

Checkout endpoints use rate limiting, strict origin validation, sanitized metadata, and security headers. Never commit `.env` or Stripe secrets to the repository.

---

## License

Proprietary — © [Delexoo](https://github.com/Delexoo). Source is public for transparency; commercial use of the Serverly brand and service requires permission.

<p align="center">
  <sub>Serverly · Build your Discord server · <a href="https://serverly.store">serverly.store</a></sub>
</p>
