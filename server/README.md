# SHELTER Auth Server

Simple Express + MySQL service that powers signup/login for the SHELTER project.

## Prerequisites

- Node.js 18+
- MySQL instance (XAMPP / MariaDB works)
- Database created with the SQL shared earlier (`shelter_auth` by default)

## Configuration

1. Duplicate `.env.example` into `.env`.
2. Update the values so they match your local MySQL credentials and desired port.

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DB=shelter_auth
APP_PORT=5000
APP_HOST=0.0.0.0
```

## Install & Run

```bash
cd server
npm install
npm run dev   # or `npm start` for production mode
```

The API will be available at `http://localhost:5000` (unless you change the port).

## Endpoints

- `POST /api/auth/signup` — expects `{ fullName, age, address, email, phoneNumber, password }`
- `POST /api/auth/login` — expects `{ credential, password }` where credential can be email or phone number
- `GET /health` — simple status check

All successful logins return a basic user profile that the frontend can store in context/storage.

