# Full Stack Project

A complete full-stack application with Node.js backend, React.js frontend, and React Native mobile app.

## Project Structure

```
├── backend/          # Node.js + Express API Server
├── frontend/         # React.js Web Application
├── mobile/           # React Native Mobile App
└── README.md         # This file
```

## Quick Start

### 1. Backend Setup (Node.js)

```bash
cd backend
npm install
npm start
```

The backend API will run on [http://localhost:5000](http://localhost:5000)

### 2. Frontend Setup (React.js)

```bash
cd frontend
npm install
npm start
```

The frontend will run on [http://localhost:3000](http://localhost:3000)

### 3. Mobile Setup (React Native)

```bash
cd mobile
npm install

# For Android
npm run android

# For iOS
npm run ios
```

## Architecture

### Backend (Node.js)
- **Port**: 5000
- **Tech Stack**: Express.js, CORS, Body Parser
- **API Endpoints**:
  - `GET /api` - Welcome message
  - `GET /api/health` - Health check
  - `GET /api/data` - Retrieve data
  - `POST /api/data` - Create data

### Frontend (React.js)
- **Port**: 3000
- **Tech Stack**: React 18, Axios, Create React App
- **Features**:
  - Connected to backend API via Axios
  - Form for creating data
  - Display data from API
  - Error handling
  - Responsive design

### Mobile (React Native)
- **Tech Stack**: React Native, Axios
- **Features**:
  - Native iOS and Android apps
  - Connected to backend API
  - Pull-to-refresh functionality
  - Form for creating data
  - Native UI components

## API Connection Configuration

### Frontend
Update `.env` file in the `frontend` folder:
```
REACT_APP_API_URL=http://localhost:5000/api
```

### Mobile
Update `src/config/api.js` in the `mobile` folder:
```javascript
export const API_URL = 'http://localhost:5000/api';
// For physical devices, use your computer's IP:
// export const API_URL = 'http://192.168.1.100:5000/api';
```

## Development Workflow

1. Start the backend server first
2. Start the frontend development server
3. For mobile development, ensure backend is accessible from device/emulator
4. All three applications communicate through the REST API

## Important Notes

- **CORS**: Backend has CORS enabled for frontend/mobile access
- **API URL**: For mobile testing on physical devices, replace `localhost` with your computer's IP address
- **Environment Variables**: Check `.env` files for configuration
- **Hot Reload**: All three applications support hot reloading during development

## Next Steps

- Add authentication (JWT, OAuth, etc.)
- Implement database (MongoDB, PostgreSQL, etc.)
- Add more API endpoints
- Implement state management (Redux, Context API)
- Add navigation (React Router for web, React Navigation for mobile)
- Implement error boundaries
- Add unit and integration tests
- Setup CI/CD pipelines

## Troubleshooting

### Backend not accessible from mobile
- Use your computer's IP address instead of `localhost` in mobile config
- Ensure firewall allows connections on port 5000
- Check that backend is running and accessible

### CORS errors
- Verify backend CORS configuration
- Check API URL in frontend/mobile config

### Module not found errors
- Run `npm install` in the respective folder
- Clear npm cache: `npm cache clean --force`

## License

MIT
