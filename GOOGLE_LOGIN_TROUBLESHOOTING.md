# Google Login Troubleshooting Guide

## ✅ Mga Ginawang Improvements

### 1. Enhanced Backend Logging
Nag-add ako ng detailed logging sa backend (`routes/auth.js`):
- `[Google Auth] Request received` - pag nag-request
- `[Google Auth] Token verified successfully` - pag na-verify ang Google token
- `[Google Auth] User lookup: Found user ID X` - pag may existing user
- `[Google Auth] Creating new user account...` - pag wala pang account
- `[Google Auth] Login successful` - pag successful

### 2. Enhanced Frontend Logging
Nag-add din ng detailed logging sa frontend:
- `[Google Sign-In] Library loaded` - pag na-load ang Google library
- `[Google Sign-In] Credential received` - pag na-click ang button
- `[Login] Google credential received` - pag dumating ang credential
- `[AuthContext] Google login starting...` - pag nag-start ang login process
- `[AuthContext] Google login completed successfully` - pag successful

### 3. Better Error Messages
Na-improve ang error messages para makita mo kung ano talaga ang problema.

---

## 🧪 How to Test

### Step 1: Restart Both Servers

**Backend**:
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
node server.js
```

**Frontend** (new terminal):
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\frontend
npm start
```

### Step 2: Open Browser Console
1. Open http://localhost:3000/login
2. Press **F12** → **Console** tab
3. Clear console (click 🚫 icon)

### Step 3: Try Google Login
1. Click **"Sign in with Google"** button
2. Select your Google account
3. **Watch the console logs** carefully

### Step 4: Check Backend Terminal
Tignan sa backend terminal kung may:
- ✅ `[Google Auth] Request received`
- ✅ `[Google Auth] Token verified successfully`
- ✅ `[Google Auth] Login successful`

---

## 🔍 Common Errors at Solutions

### Error 1: "Invalid Google credential"

**Console shows**:
```
[Google Auth] Token verification failed: ...
```

**Possible causes**:
1. **Wrong Client ID** sa backend `.env`
2. **Token expired** (take too long before clicking)
3. **Client ID mismatch** between frontend at backend

**Solution**:
```cmd
# Check backend .env
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
type .env
```

Verify na tama ang:
```env
GOOGLE_CLIENT_ID=651314695916-jq88jrdn7vq6881n0hovugl5q3mf2djh.apps.googleusercontent.com
```

### Error 2: "Failed to load Google Identity Services"

**Console shows**:
```
❌ Failed to load Google Identity Services
```

**Possible causes**:
1. Ad blocker nag-block ng Google script
2. Internet connection issue
3. Browser extension nag-block

**Solution**:
1. Disable ad blockers (uBlock, AdBlock, etc.)
2. Try **Incognito mode** (Ctrl+Shift+N)
3. Try ibang browser (Chrome, Firefox, Edge)
4. Whitelist localhost sa ad blocker settings

### Error 3: Button visible pero walang popup

**Console shows**:
```
[Google Sign-In] Button rendered successfully
```
Pero walang popup pag nag-click

**Possible causes**:
1. Popup blocked by browser
2. Google One Tap not initialized properly

**Solution**:
1. Allow popups for localhost
2. Click sa address bar icon (🚫) → "Always allow popups from localhost"
3. Try clicking the fallback button sa ibaba

### Error 4: Network Error / Request Failed

**Console shows**:
```
[AuthContext] Google login error: Network Error
```

**Possible causes**:
1. Backend server is not running
2. Wrong API URL
3. CORS issue

**Solution**:
```cmd
# Check if backend is running
netstat -ano | findstr :5000
```

Dapat may result. Kung wala, i-start ang backend:
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
node server.js
```

### Error 5: "Google account has no email"

**Console shows**:
```
[Google Auth] No email in Google account
```

**Possible causes**:
1. Using a Google account without email (rare)
2. Email not shared in OAuth consent

**Solution**:
- Use a different Google account
- Check Google Cloud Console OAuth consent screen settings

---

## 📊 Expected Console Flow (Successful Login)

### Frontend Console:
```
[Google Sign-In] Library loaded
[Google Sign-In] Button rendered successfully
[Google Sign-In] Callback received
[Google Sign-In] Credential received, token length: 857
[Login] Google credential received, sending to backend...
[AuthContext] Google login starting...
[AuthContext] Sending credential to API...
[AuthContext] API response received: {success: true, token: "...", user: {...}}
[AuthContext] Setting token and user: yourmail@gmail.com
[AuthContext] Google login completed successfully
[Login] Google login successful, redirecting to dashboard
```

### Backend Terminal:
```
[Google Auth] Request received
[Google Auth] Credential received, length: 857
[Google Auth] Using Client ID: 651314695916-...
[Google Auth] Token verified successfully
[Google Auth] Payload extracted - email: yourmail@gmail.com name: Your Name
[Google Auth] User lookup: User not found, creating new
[Google Auth] Creating new user account...
[Google Auth] User created with ID: 5
[Google Auth] Creating beneficiary record...
[Google Auth] Beneficiary record created
[Google Auth] Generating JWT token for user ID: 5
[Google Auth] Login successful for: yourmail@gmail.com
```

---

## 🔧 Manual Testing Commands

### Test Google Client Library
```javascript
// Paste sa browser console (sa login page)
console.log('Google Library:', window.google?.accounts?.id ? 'Loaded ✅' : 'Not loaded ❌');
```

### Test API Endpoint
```javascript
// Paste sa browser console
fetch('http://localhost:5000/api/auth/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ credential: 'test' })
})
.then(r => r.json())
.then(d => console.log('Response:', d))
.catch(e => console.error('Error:', e));
```

Expected: `{success: false, message: "Invalid Google credential"}`

### Check Environment Variables
```javascript
// Paste sa browser console
console.log('API URL:', process.env.REACT_APP_API_URL);
console.log('Client ID:', process.env.REACT_APP_GOOGLE_CLIENT_ID);
```

### Manually Trigger Google Prompt
```javascript
// Paste sa browser console (if library is loaded)
window.google.accounts.id.initialize({
  client_id: '651314695916-jq88jrdn7vq6881n0hovugl5q3mf2djh.apps.googleusercontent.com',
  callback: (response) => {
    console.log('Manual test - Token:', response.credential);
    alert('Success! Check console for token');
  }
});
window.google.accounts.id.prompt();
```

---

## 🎯 Checklist Para sa Working Google Login

- [ ] Backend server is running (http://localhost:5000)
- [ ] Frontend server is running (http://localhost:3000)
- [ ] `.env` files are configured correctly (both frontend & backend)
- [ ] Browser console shows `[Google Sign-In] Library loaded`
- [ ] Google Sign-In button is visible
- [ ] No ad blockers blocking Google domains
- [ ] Popups are allowed for localhost
- [ ] Backend console shows `[Google Auth] Request received` when clicking button
- [ ] Successfully redirects to dashboard after login

---

## 🚨 Quick Fixes

### If Google button hindi lumalabas:
1. Hard refresh: **Ctrl+Shift+R**
2. Clear cache: **Ctrl+Shift+Delete** → Clear browsing data
3. Try incognito mode: **Ctrl+Shift+N**

### If may popup pero walang response:
1. Check backend terminal for errors
2. Check browser console Network tab (F12 → Network)
3. Look for failed request to `/api/auth/google`

### If "Invalid Google credential":
1. Verify `GOOGLE_CLIENT_ID` sa both `.env` files
2. Ensure pareho ang Client ID sa frontend at backend
3. Try to get new Client ID from Google Cloud Console

### If everything fails:
1. Clear browser cache completely
2. Restart both servers
3. Try sa ibang browser
4. Check kung may network/firewall restrictions

---

## 📝 Important Notes

1. **First time login** = Auto-creates beneficiary account
2. **Next logins** = Uses existing account
3. **Email address** is the unique identifier
4. **Role** = Always 'beneficiary' for Google logins
5. **Password** = Random (not needed, login via Google only)

---

## 🎓 Next Steps Pag Gumagana Na

1. ✅ Test with multiple Gmail accounts
2. ✅ Verify beneficiary profile is created
3. ✅ Check if can access beneficiary dashboard
4. ✅ Test logout and re-login
5. ✅ Verify data persistence after refresh

---

## 📞 Debugging Steps

Kung hindi pa rin gumagana:

1. **Take screenshot** ng browser console
2. **Copy** yung backend terminal output
3. **Check** kung ano ang last log entry
4. **Look for** kung saan nag-stop yung flow

Most common issue: **Client ID mismatch** or **Library not loading**

Try mo muna yung test page:
http://localhost:3000/test-google-signin.html
