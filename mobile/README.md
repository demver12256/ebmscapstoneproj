# Mobile - React Native

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure API endpoint in `src/config/api.js`:
   - For a physical Android device, use the computer's current Wi-Fi IPv4 address and keep both devices on the same Wi-Fi network.
   - For the Android emulator, use `http://10.0.2.2:5000/api`.
   - The current development computer address is `http://192.168.181.144:5000/api`; update it if the computer's address changes.

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
