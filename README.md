# BeSafe Backend

The BeSafe backend is a TypeScript/Express API for the BeSafe personal safety
mobile app. It handles phone-based authentication, user profiles, emergency
contacts, AI-assisted threat analysis, safety check-ins, and push notifications.

## Tech Stack

- Node.js
- Express
- TypeScript
- MongoDB with Mongoose
- JWT access and refresh tokens
- Expo push notifications
- Mailjet email delivery
- Cloudinary uploads
- node-cron scheduled safety checks

## Main Features

- Phone number authentication with OTP verification.
- Refresh-token based session management.
- User onboarding with profile details and emergency contacts.
- Emergency contact storage on the user profile.
- Text threat analysis through an external AI prediction service.
- Safety check-in sessions with confirm, extend, cancel, stop, and location update flows.
- Scheduled safety check monitoring that reminds users and triggers alerts when a check-in is overdue.
- Expo push token registration and notification dispatch.
- Admin, user, auth, safety, and notification route groups.

## Project Structure

```text
src/
  configs/          Environment, JWT, Cloudinary, Mailjet, and server config
  controllers/      Express request handlers
  exceptions/       App-specific HTTP error classes
  jobs/             Scheduled background jobs
  middlewares/      Auth, upload, and request middleware
  models/           Mongoose models
  routes/           API route definitions
  services/         Business logic
  templates/        Email templates
  types/            Shared TypeScript types
  utils/            Response, token, email, OTP, and helper utilities
```

## API Overview

All routes are mounted under `/v1`.

Public auth routes:

- `POST /v1/auth/send-otp`
- `POST /v1/auth/verify-otp`
- `POST /v1/auth/resend-otp`
- `GET /v1/auth/otp-cooldown?phone=...`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`

Authenticated safety routes:

- `POST /v1/safety/analyze`
- `POST /v1/safety/check-in/start`
- `POST /v1/safety/check-in/confirm`
- `POST /v1/safety/check-in/cancel`
- `GET /v1/safety/check-in/active`
- `POST /v1/safety/check-in/extend`
- `PATCH /v1/safety/check-in/location`
- `POST /v1/safety/check-in/stop`

Authenticated route groups also include:

- `/v1/user`
- `/v1/admin`
- `/v1/notifications`

## Environment Variables

Create a `.env` file in the backend directory. Values depend on your local or
deployment setup.

```env
PORT=8000
HOST=localhost
DB_URL=mongodb://localhost:27017/besafe
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
AI_BASE_URL=https://besafev1.onrender.com

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

MAILJET_API_KEY=your_mailjet_key
MAILJET_SECRET_KEY=your_mailjet_secret
```

The code defaults `AI_BASE_URL` to `https://besafev1.onrender.com` when it is
not provided.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build the TypeScript project:

```bash
npm run build
```

Run the built server:

```bash
npm start
```

## Safety Check Flow

1. The mobile app starts a check-in with an activity, interval, selected contacts, and optional start location.
2. The backend stores the active check and calculates the next check-in time.
3. A cron job runs every minute, sending tick updates and due reminders.
4. If the user confirms, the next check-in time is reset.
5. If the check becomes overdue beyond the grace period, the backend marks it as triggered and notifies emergency contacts.

## Threat Analysis Flow

1. The mobile app records/transcribes speech.
2. It sends text to `POST /v1/safety/analyze`.
3. The backend forwards the text to the configured AI model endpoint.
4. If the model returns `threat` with confidence at or above the threshold, the response tells the app to trigger the SOS flow.

## Notes

- This README describes the actual BeSafe backend. The previous ecommerce starter README was outdated.
- The API expects authenticated routes to receive a valid Bearer access token.
- Push notifications require valid Expo push tokens saved for users.
