# SHELTER Auth Server

Simple Express + MySQL service that powers signup/login for the SHELTER project.

## Prerequisites

- Node.js 18+
- MySQL instance (XAMPP / MariaDB works)
- Database created with the SQL shared earlier (`shelter_auth` by default)

## Configuration

1. Duplicate `.env.example` into `.env`.
2. Update the values so they match your MySQL credentials and deployment URLs.
3. Configure SMTP (required for signup OTP and password reset email).

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DB=shelter_auth
APP_PORT=5000
APP_HOST=0.0.0.0

# Google OAuth (required for Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173

# Required SMTP for OTP and password reset emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-user@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=SHELTER <no-reply@shelter.local>
PASSWORD_RESET_FRONTEND_URL=http://localhost:5173
```

## Install & Run

```bash
cd server
npm install
npm run dev   # or `npm start` for production mode
```

The API will be available at `http://localhost:5000` (unless you change the port).

## Endpoints

- `POST /api/auth/signup/request-otp` — expects `{ fullName, age, address, email, password }`
- `POST /api/auth/signup/verify-otp` — expects `{ email, otp }`
- `POST /api/auth/signup` — phone signup path, expects `{ fullName, age, address, phoneNumber, password }`
- `POST /api/auth/login` — expects `{ credential, password }` where credential can be email or phone number
- `GET /api/auth/google/start` — starts Google OAuth login flow in browser popup
- `GET /api/auth/google/callback` — OAuth callback used by the popup flow
- `POST /api/auth/password/change` — expects `{ userId, currentPassword, newPassword }`
- `POST /api/auth/password/reset/request` — expects `{ email }` and sends reset verification email
- `POST /api/auth/password/reset/verify` — expects `{ email, token, newPassword }`
- `GET /health` — simple status check

All successful logins return a basic user profile that the frontend can store in context/storage.

