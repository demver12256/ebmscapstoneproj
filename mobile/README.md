# Mobile - React Native

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure API endpoint:
   - Update `API_URL` in `src/config/api.js`
   - Default: http://localhost:5000

3. Run the app:

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

## Tech Stack

- React Native
- Axios for API calls
- React Native CLI

## API Integration

The `src/services/api.js` file handles all API calls to the backend.

## Notes

- Make sure you have React Native development environment set up
- For iOS: Xcode and CocoaPods required
- For Android: Android Studio and SDK required
- Backend API should be accessible from your device/emulator
- For physical devices, update API_URL to your computer's IP address
