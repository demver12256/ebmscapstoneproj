# 🚀 Quick Start: Google Login

## 1️⃣ Test Configuration
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
node test_google_auth.js
```
Expected: ✅ All checks pass

## 2️⃣ Start Backend
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
node server.js
```
Wait for: `Server is running on port 5000`

## 3️⃣ Start Frontend (New Terminal)
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\frontend
npm start
```
Wait for browser to open automatically

## 4️⃣ Test Google Login
1. Go to: http://localhost:3000/login
2. Press **F12** (open console)
3. Click **"Sign in with Google"**
4. Select your Google account
5. Watch console logs:
   - ✅ `[Google Sign-In] Library loaded`
   - ✅ `[Google Sign-In] Credential received`
   - ✅ `[Login] Google login successful`

## 5️⃣ Check Backend Logs
Should see:
```
[Google Auth] Request received
[Google Auth] Token verified successfully
[Google Auth] Login successful for: yourmail@gmail.com
```

---

## ⚠️ Quick Fixes

### Google button hindi lumalabas?
- Disable ad blocker
- Try Incognito mode (Ctrl+Shift+N)
- Hard refresh (Ctrl+Shift+R)

### Popup nag-block?
- Click address bar icon (🚫)
- Allow popups for localhost
- Refresh page

### "Invalid credential" error?
Check both `.env` files have same Client ID:
```
GOOGLE_CLIENT_ID=651314695916-jq88jrdn7vq6881n0hovugl5q3mf2djh.apps.googleusercontent.com
```

### Network error?
```cmd
netstat -ano | findstr :5000
```
If nothing, restart backend server

---

## 📊 Success = 
- ✅ Redirects to dashboard
- ✅ Your name appears in header  
- ✅ URL is `/dashboard`

---

## 🧪 Alternative Test
http://localhost:3000/test-google-signin.html

---

## 📖 Full Guide
See: `FIX_GOOGLE_LOGIN_TAGALOG.md`
