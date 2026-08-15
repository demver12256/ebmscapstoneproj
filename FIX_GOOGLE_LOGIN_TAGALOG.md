# Paano I-fix ang Google Login

## 📌 Ano ang Ginawa Ko?

Nag-add ako ng **detailed logging** sa buong Google login flow para makita natin kung saan exactly nag-fail.

### Files na Na-update:
1. ✅ `backend/routes/auth.js` - Added logging sa Google authentication
2. ✅ `frontend/src/pages/LoginPage.jsx` - Added logging sa button click
3. ✅ `frontend/src/context/AuthContext.jsx` - Added logging sa API calls
4. ✅ `frontend/public/index.html` - Improved script loading
5. ✅ Created test files for debugging

---

## 🚀 Paano I-test

### Step 1: I-run ang Test Script
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
node test_google_auth.js
```

Dapat makita mo:
```
✅ Google Client ID is configured
✅ OAuth client can be initialized
✅ Token verification is working
```

### Step 2: I-start ang Servers

**Terminal 1 (Backend)**:
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
node server.js
```

Antayin ang message:
```
Server is running on port 5000
```

**Terminal 2 (Frontend)**:
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\frontend
npm start
```

Antayin mag-open ang browser automatically.

### Step 3: I-open ang Login Page
1. Pumunta sa: http://localhost:3000/login
2. Press **F12** para i-open ang Developer Tools
3. Click ang **Console** tab
4. I-clear ang console (click 🚫 icon)

### Step 4: I-click ang Google Sign-In Button
1. Click ang **"Sign in with Google"** button
2. Piliin ang Google account mo
3. **IMPORTANT**: Bantayan ang console logs!

### Step 5: Tignan ang Logs

**Sa Browser Console** dapat makita mo:
```
[Google Sign-In] Library loaded
[Google Sign-In] Button rendered successfully
[Google Sign-In] Callback received
[Google Sign-In] Credential received, token length: 857
[Login] Google credential received, sending to backend...
[AuthContext] Google login starting...
[AuthContext] API response received
[AuthContext] Setting token and user: yourmail@gmail.com
[AuthContext] Google login completed successfully
[Login] Google login successful, redirecting to dashboard
```

**Sa Backend Terminal** dapat makita mo:
```
[Google Auth] Request received
[Google Auth] Credential received, length: 857
[Google Auth] Token verified successfully
[Google Auth] Payload extracted - email: yourmail@gmail.com
[Google Auth] Login successful for: yourmail@gmail.com
```

---

## 🔍 Kung May Error

### Scenario 1: "Google Sign-In is not available"

**Nakikita mo sa page**:
> Google Sign-In is not available. Please check your internet connection and refresh the page.

**Dahilan**:
- Hindi nag-load ang Google library
- May ad blocker na nag-block
- Network issue

**Solution**:
1. **Disable ad blockers** (uBlock Origin, AdBlock, etc.)
2. Try **Incognito mode**: Ctrl+Shift+N
3. Try **ibang browser** (Chrome, Edge, Firefox)
4. **Hard refresh**: Ctrl+Shift+R

### Scenario 2: Button lumalabas pero walang popup

**Nakikita mo**:
- Google Sign-In button is visible
- Pero pag nag-click, walang nangyayari

**Dahilan**:
- Browser nag-block ng popup
- Google One Tap hindi nag-initialize

**Solution**:
1. Click sa address bar kung may icon ng blocked popup (🚫)
2. Select **"Always allow pop-ups from localhost"**
3. I-refresh ang page (F5)
4. Try ulit

### Scenario 3: "Invalid Google credential"

**Sa backend terminal nakikita mo**:
```
[Google Auth] Token verification failed: ...
```

**Dahiran**:
- Wrong Google Client ID
- Client ID sa frontend at backend ay magkaiba
- Token expired (nagtagal bago nag-click)

**Solution**:

1. **Check frontend .env**:
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\frontend
type .env
```

Dapat:
```env
REACT_APP_GOOGLE_CLIENT_ID=651314695916-jq88jrdn7vq6881n0hovugl5q3mf2djh.apps.googleusercontent.com
```

2. **Check backend .env**:
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
type .env
```

Dapat:
```env
GOOGLE_CLIENT_ID=651314695916-jq88jrdn7vq6881n0hovugl5q3mf2djh.apps.googleusercontent.com
```

3. **Verify na SAME** ang Client ID sa both files!

### Scenario 4: Network Error

**Sa console nakikita mo**:
```
[AuthContext] Google login error: Network Error
```

**Dahilan**:
- Backend server is not running
- Wrong API URL

**Solution**:

1. **Check kung running ang backend**:
```cmd
netstat -ano | findstr :5000
```

Kung walang result, i-start ang backend:
```cmd
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
node server.js
```

2. **Check ang API URL sa frontend .env**:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 🎯 Ano ang Expected Result?

Pag successful ang login:

1. ✅ Mag-open ang Google popup
2. ✅ Pipiliin mo ang Google account
3. ✅ Automatic redirect sa dashboard
4. ✅ Makikita mo ang name mo sa top right
5. ✅ Naka-login ka na as **beneficiary**

**First time login**:
- Automatic gagawa ng beneficiary account
- Email address mo ang gagamitin
- Name mo from Google ang ilalagay

**Next login**:
- Gagamitin ang existing account
- Straight to dashboard agad

---

## 🧪 Test Page

Para mas madali i-test, may ginawa ako test page:

### Open ang Test Page:
```
http://localhost:3000/test-google-signin.html
```

Dito makikita mo kaagad kung:
- ✅ Google library is loaded
- ✅ Button is working
- ❌ May problema sa setup

---

## 📋 Checklist Before Testing

Siguraduhin na:
- [ ] Backend server is running (port 5000)
- [ ] Frontend server is running (port 3000)
- [ ] Both `.env` files have the same `GOOGLE_CLIENT_ID`
- [ ] No ad blockers enabled (o naka-whitelist ang localhost)
- [ ] Popups are allowed for localhost
- [ ] Browser console is open (F12)
- [ ] Backend terminal is visible

---

## 💡 Tips

1. **Always watch both terminals** (backend at frontend console)
2. **Read the log messages carefully** - nandun lahat ng info
3. **If may error**, check kung ano ang last log message
4. **Try incognito mode first** para walang interference from extensions
5. **Use Chrome or Edge** - mas tested ang Google Sign-In dito

---

## 🎓 Kung Gumagana Na

Pag naka-login ka na successfully:

1. ✅ Check ang profile - dapat nandun ang Gmail mo
2. ✅ Try mag-logout at mag-login ulit
3. ✅ Verify na persistent ang login (refresh the page)
4. ✅ Check kung may access ka sa beneficiary features

---

## 🚨 Emergency Solutions

### Kung hindi talaga gumagana ang Google Sign-In:

**Option 1: Use Email/Password Login**
- May regular login form pa rin sa taas
- Email: `admin@ebms.local`
- Password: `Admin@123`

**Option 2: Disable Google Sign-In Temporarily**
Contact me to remove Google Sign-In completely and use email/password only.

---

## 📞 Need Help?

Kung hindi pa rin gumagana after following these steps:

1. **Screenshot** ng browser console
2. **Copy** ng backend terminal logs
3. **Tell me** kung ano ang last successful log message
4. **Check** kung ano ang exact error message

Most common issues:
- ❌ Ad blocker blocking Google
- ❌ Popup blocked by browser
- ❌ Wrong Client ID configuration
- ❌ Backend not running
- ❌ Network/firewall restrictions

---

## ✅ Success Indicators

Alam mo successful pag:
- Browser console shows `[Google Auth] Login successful`
- Backend shows `[Google Auth] Login successful for: youremail@gmail.com`
- Nag-redirect sa `/dashboard`
- Nakikita mo ang name mo sa header
- URL is `http://localhost:3000/dashboard`

**Good luck!** 🚀
