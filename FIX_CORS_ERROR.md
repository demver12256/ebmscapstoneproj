# Fix: CORS Error sa Google Sign-In

## ❌ Ang Error:
```
Access to script at 'https://accounts.google.com/gsi/client' from origin 'http://localhost:3000' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 🔍 Ano ang Ibig Sabihin?

Ang browser mo ay **NAG-BLOCK** ng Google Sign-In script. Ito ay **HINDI NORMAL** dahil ang Google Sign-In ay public CDN na dapat accessible from any origin.

**Ang most common cause ay:**
1. **Browser extension** na nag-block (ad blocker, privacy extension)
2. **Antivirus software** na may web protection
3. **Network proxy/firewall**
4. **VPN** na may script blocking

---

## ✅ Solution 1: TRY INCOGNITO MODE (FASTEST!)

Ito ang pinakamabilis na solution:

### Chrome / Edge:
1. Press **Ctrl+Shift+N**
2. Go to http://localhost:3000/login
3. Try Google Sign-In

### Firefox:
1. Press **Ctrl+Shift+P**
2. Go to http://localhost:3000/login
3. Try Google Sign-In

**Kung gumagana sa Incognito**, ibig sabihin **browser extension** ang may problema.

---

## ✅ Solution 2: RUN DIAGNOSTIC PAGE

I-check natin kung ano exactly ang problema:

### Step 1: Start servers (kung hindi pa running)
```cmd
# Terminal 1 - Backend
cd c:\Users\Demver\OneDrive\Desktop\ebms\backend
node server.js

# Terminal 2 - Frontend
cd c:\Users\Demver\OneDrive\Desktop\ebms\frontend
npm start
```

### Step 2: Open diagnostic page
```
http://localhost:3000/diagnose-google.html
```

### Step 3: Tingnan ang results

**Kung makikita mo:**
- ✅ All tests pass = GOOD! May ibang issue
- ❌ Script failed to load = Extension or network blocking
- ⚠️ Script timeout = Network issue

### Step 4: Copy the logs
1. Click **"Copy Logs"** button
2. Paste sa text file o send sa akin

---

## ✅ Solution 3: DISABLE BROWSER EXTENSIONS

### Para sa Chrome/Edge:

1. **Click** ang extension icon (puzzle piece) sa top right
2. **Click** "Manage extensions"
3. **Disable** lahat ng extensions temporarily:
   - uBlock Origin
   - AdBlock / AdBlock Plus
   - Ghostery
   - Privacy Badger
   - HTTPS Everywhere
   - Any security/privacy extensions

4. **Refresh** ang page (Ctrl+R)
5. **Try** Google Sign-In again

### Para sa Firefox:

1. **Click** hamburger menu (☰) sa top right
2. **Click** "Add-ons and themes"
3. **Click** "Extensions"
4. **Disable** lahat temporarily
5. **Refresh** ang page
6. **Try** Google Sign-In again

---

## ✅ Solution 4: CHECK ANTIVIRUS/FIREWALL

Ang iba antivirus programs ay nag-block ng external scripts:

### Common culprits:
- Kaspersky
- Avast
- AVG
- Norton
- Bitdefender
- McAfee

### Paano i-check:

1. **Temporarily disable** web protection ng antivirus
   - Right-click antivirus icon sa system tray
   - Look for "Pause protection" or "Disable web shield"
   - Select "Disable for 15 minutes"

2. **Refresh** ang browser
3. **Try** Google Sign-In

**Kung gumagana pag naka-disable ang antivirus:**
- Need mo i-whitelist ang `accounts.google.com` sa antivirus settings

---

## ✅ Solution 5: DISABLE VPN/PROXY

Kung naka-VPN o proxy ka:

1. **Disconnect** from VPN temporarily
2. **Refresh** ang browser
3. **Try** Google Sign-In

---

## ✅ Solution 6: TRY DIFFERENT BROWSER

Kung ang current browser ay may persistent issues:

1. **Install** iba browser kung wala ka pa:
   - Google Chrome: https://www.google.com/chrome/
   - Microsoft Edge: Built-in sa Windows 10/11
   - Firefox: https://www.mozilla.org/firefox/

2. **Open** ang bagong browser
3. **Go to** http://localhost:3000/login
4. **Try** Google Sign-In

---

## ✅ Solution 7: CLEAR BROWSER CACHE

Minsan ang old cached data ay may conflict:

### Para sa Chrome/Edge:
1. Press **Ctrl+Shift+Delete**
2. Select **"All time"** sa time range
3. Check ✅ **"Cached images and files"**
4. Check ✅ **"Cookies and other site data"**
5. Click **"Clear data"**
6. **Restart** browser
7. Go to http://localhost:3000/login

### Para sa Firefox:
1. Press **Ctrl+Shift+Delete**
2. Select **"Everything"** sa time range
3. Check ✅ **"Cookies"**
4. Check ✅ **"Cache"**
5. Click **"Clear Now"**
6. **Restart** browser

---

## ✅ Solution 8: CHECK NETWORK SETTINGS

Kung naka-corporate network o may special network setup:

### Check kung may proxy:
1. **Windows Settings** → **Network & Internet**
2. **Proxy**
3. Verify kung naka-ON ang manual proxy
4. Kung naka-ON, try i-disable temporarily

### Check kung may DNS filtering:
1. Some routers/networks ay nag-block ng certain domains
2. Try using **Google DNS**:
   - Primary: 8.8.8.8
   - Secondary: 8.8.4.4

---

## 🧪 QUICK TEST CHECKLIST

I-test mo one by one:

- [ ] Try **Incognito mode** (Ctrl+Shift+N)
- [ ] Open **diagnostic page**: http://localhost:3000/diagnose-google.html
- [ ] **Disable all browser extensions**
- [ ] **Disable antivirus** temporarily
- [ ] **Disconnect VPN/proxy**
- [ ] Try **different browser**
- [ ] **Clear browser cache**
- [ ] **Restart computer** (sometimes helps!)

---

## 🎯 Ano ang Expected Result?

Pag gumana na:

### Sa Diagnostic Page:
- ✅ Test 1: Script loaded successfully
- ✅ Test 2: No CORS issues detected
- ✅ Test 3: Library is available and ready to use
- ✅ Test 4: Initialization successful

### Sa Login Page:
- Google Sign-In button lumabas
- Pag nag-click, mag-open ang Google popup
- Pag nag-select ng account, mag-redirect sa dashboard

---

## 🔬 Para sa Advanced Debugging

Kung gusto mo makita ang detailed network info:

### Chrome/Edge DevTools:
1. Press **F12**
2. Go to **Network** tab
3. Refresh ang page (Ctrl+R)
4. Look for **"client"** request sa list
5. Click on it
6. Check ang **Status Code**:
   - 200 = OK ✅
   - Failed (red) = Blocked ❌
7. Check ang **Response Headers**

---

## 💡 Why is This Happening?

**Normal scenario**: Ang Google Sign-In script ay accessible from ANY domain kaya walang CORS issue.

**Your scenario**: May software/extension na nag-**intercept** ng request at nag-block nito before pa man maka-reach ng Google's servers.

**Common blockers:**
- Browser extensions with "Content Security Policy" enforcement
- Antivirus with "Script Shield" or "Web Protection"
- Corporate firewalls with "Script Filtering"
- DNS-level blocking (some ISPs or network admins)

---

## 📞 Kung Hindi Pa Rin Gumagana

After trying ALL solutions above:

1. **Take screenshot** ng diagnostic page results
2. **Copy** ang console logs
3. **Check** kung ano ang browser at version
   - Type `navigator.userAgent` sa console
4. **Note** kung may special network setup (corporate network, etc.)

Send mo sa akin ang:
- Screenshot ng diagnostic page
- Console logs
- Browser info
- Kung ano ang na-try mo na

---

## ⚡ FASTEST FIX (TL;DR)

```
1. Press Ctrl+Shift+N (Incognito)
2. Go to http://localhost:3000/login
3. Try Google Sign-In

If it works = Browser extension problem
If it fails = Network/antivirus problem
```

Try mo yan ngayon! 🚀
