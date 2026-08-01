# Backend - Node.js API

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env` and update as needed
   - Default PORT is 5000

3. Run the server:
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

## API Endpoints

- `GET /api` - Welcome message
- `GET /api/health` - Health check
- `GET /api/data` - Get persisted data from the configured database
- `POST /api/data` - Create new data item in the configured database

## Database

The backend supports both SQLite and MySQL.

- Default mode: `DB_CLIENT=sqlite`
- MySQL mode: `DB_CLIENT=mysql`
- If using phpMyAdmin, set:
  - `MYSQL_HOST`
  - `MYSQL_PORT`
  - `MYSQL_USER`
  - `MYSQL_PASSWORD`
  - `MYSQL_DATABASE`

The backend will automatically create the `items` table when it starts.

## Tech Stack

- Express.js
- CORS enabled for frontend/mobile access
- Body Parser for JSON requests
- dotenv for environment configuration
