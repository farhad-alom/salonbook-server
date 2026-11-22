# SalonBook – Server

REST API for the SalonBook salon appointment booking platform. It handles services, appointments, users, profiles, Stripe payments, and transactions.

This repository is the **server (backend)**. The client is in a separate repository.

## Links

- Live API: `https://salonbook-server-rust.vercel.app`
- Live Site: `https://salonbook-client-puce.vercel.app`
- Client Repository: `https://github.com/farhad-alom/salonbook-client`
- Server Repository: `https://github.com/farhad-alom/salonbook-server`

## Features

- JWT-based protection for private routes
- Role-based access (admin and customer)
- Blocked users cannot use protected routes
- Services: public list with search, category filter and sort; admin add, update, delete, active/inactive
- Appointments: booking with duplicate time-slot check, cancel own pending appointment, admin confirm or cancel
- Users: admin can list, view, block, and unblock customers
- Profile: users can update only their own name, image, and phone
- Payments: Stripe Checkout session for confirmed appointments
- Stripe webhook (signature verified) marks the appointment as paid and saves the transaction
- Transactions: admin sees all, customer sees own

## Technologies

- Node.js and Express
- MongoDB (official driver)
- JSON Web Token (jsonwebtoken)
- Stripe
- CORS and dotenv

## How to Run Locally

1. Clone the repository and open the folder.
2. Install packages:
   ```bash
   npm install
   ```
3. Create a `.env` file (see the names below) and fill in your own values.
4. Start the server:
   ```bash
   npm start
   ```
5. The server runs on `http://localhost:5000`.

## Environment Variables (names only)

```
MONGODB_URI
JWT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
CLIENT_URL
PORT
```

`PORT` is optional (default is 5000).

## Testing the Stripe Webhook Locally

1. Install the Stripe CLI and log in with `stripe login`.
2. Run:
   ```bash
   stripe listen --events checkout.session.completed --forward-to localhost:5000/webhook
   ```
3. Copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET` and restart the server.
4. Pay with the Stripe test card `4242 4242 4242 4242`.

## Main API Routes

| Method | Route | Access |
|---|---|---|
| GET | `/api/services`, `/api/services/featured`, `/api/services/:id` | Public |
| GET/POST | `/api/admin/services` | Admin |
| PUT/DELETE | `/api/admin/services/:id` | Admin |
| PATCH | `/api/admin/services/:id/status` | Admin |
| POST/GET | `/api/appointments` | Customer |
| GET | `/api/appointments/stats`, `/api/appointments/:id` | Customer |
| PATCH | `/api/appointments/:id/cancel` | Customer |
| GET | `/api/admin/appointments`, `/api/admin/stats` | Admin |
| PATCH | `/api/admin/appointments/:id/confirm`, `/cancel` | Admin |
| GET | `/api/admin/users`, `/api/admin/users/:id` | Admin |
| PATCH | `/api/admin/users/:id/block-status` | Admin |
| GET/PATCH | `/api/profile` | Logged-in user |
| POST | `/api/payments/checkout` | Customer |
| POST | `/webhook` | Stripe only |
| GET | `/api/admin/transactions` | Admin |
| GET | `/api/transactions` | Customer |
