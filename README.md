# Circlk

Circlk is an event hosting and booking platform:
- Users can sign up, log in, browse events by city, and book tickets.
- Hosts can publish paid events (for example, cooking classes).
- Booking returns a payment-portal redirect URL and a QR code for entry/check-in.
- Platform fee is automatically included in final ticket price.

## Tech Stack

- Frontend: React + Vite
- Backend: Flask + SQLAlchemy + JWT
- Database: PostgreSQL (recommended for production)

## Project Structure

- `frontend/` React app
- `backend/` Flask API

## Backend Features

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/events?city=...`
- `GET /api/events/:id`
- `POST /api/events` (host event, auth required)
- `POST /api/events/:id/book` (book and get payment URL + QR, auth required)
- `GET /api/my/bookings`

## Local Run

### 1) Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
flask --app manage.py init-db
python run.py
```

Backend runs on `http://localhost:5000`.

### 2) Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Docker Run (Backend + PostgreSQL)

```bash
docker compose up --build
```

Then initialize DB once:

```bash
docker compose exec backend flask --app manage.py init-db
```

## Scaling Notes (Target: ~1000 concurrent users)

- Use Gunicorn multi-worker config (`backend/gunicorn.conf.py`) behind Nginx/ALB.
- Keep frontend statically hosted on CDN (Vercel/CloudFront/Netlify) and API behind load balancer.
- Use PostgreSQL with connection pooling (PgBouncer) for stable DB concurrency.
- Add Redis for:
  - rate limiting
  - session/token deny-list (if needed)
  - caching city/event queries
- Move payment integration to Stripe/Razorpay webhooks for reliable payment confirmation.
- Add background jobs (Celery/RQ) for emails, ticket confirmations, reminders.
- Enable observability: structured logs, metrics, tracing, health checks.

## Important Note

Payment URL in this version is a placeholder redirect (`payments.example.com`) to demonstrate flow.  
Replace with a real provider checkout session API in production.
