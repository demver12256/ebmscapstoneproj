# 🔧 Instructions to Test Announcement Fix

## ⚠️ IMPORTANT: RESTART BACKEND SERVER

The code has been updated with debug logging. You **MUST restart** the backend server for changes to take effect.

### Step 1: Restart Backend Server

```bash
# Stop the current server (Ctrl+C in the terminal)
# Then restart:
cd backend
node server.js
```

You should see the server start message:
```
Server is running on port 5000
```

---

## 🧪 Testing Method 1: Manual Frontend Testing

### Test as Sergio (Aplaya Staff)

1. **Login to frontend**:
   - Email: `sergiofolloso@example.com`
   - Password: `password123`

2. **Go to Announcements page**

3. **Check backend server console** - You should see:
   ```
   [ANNOUNCEMENT FILTER] User: Sergio Folloso (ID: 108)
   [ANNOUNCEMENT FILTER] Role: staff, Barangay ID: 38
   [ANNOUNCEMENT FILTER] Before filter: X announcements
   [ANNOUNCEMENT FILTER]   ✅ Included: "..." (Target barangays: [38])
   [ANNOUNCEMENT FILTER]   ❌ Filtered out: "..." (Target barangays: [37])
   [ANNOUNCEMENT FILTER] After filter: Y announcements
   ```

4. **Check frontend UI**:
   - ✅ Should ONLY see Aplaya (barangay_id: 38) announcements
   - ❌ Should NOT see Anilao (barangay_id: 37) announcements

### Test as Demver (Anilao Staff)

1. **Logout and login again**:
   - Email: `demverminion@example.com`
   - Password: `password123`

2. **Go to Announcements page**

3. **Check backend server console**

4. **Check frontend UI**:
   - ✅ Should ONLY see Anilao (barangay_id: 37) announcements
   - ❌ Should NOT see Aplaya (barangay_id: 38) announcements

---

## 🧪 Testing Method 2: Automated Script

If backend server is running, you can run the automated test:

```bash
cd backend
node test_real_api_call.js
```

This will:
1. Login as Sergio (Aplaya staff)
2. Fetch announcements and check if he sees Anilao announcements (he shouldn't)
3. Login as Demver (Anilao staff)
4. Fetch announcements and check if he sees Aplaya announcements (he shouldn't)

Expected output:
```
✅ PASS: Sergio is NOT seeing Anilao announcements
✅ PASS: Demver is NOT seeing Aplaya announcements
```

---

## 🔍 What to Look For

### Backend Console Logs

When a staff user accesses the announcements page, you should see:

```
[ANNOUNCEMENT FILTER] User: <name> (ID: <id>)
[ANNOUNCEMENT FILTER] Role: <role>, Barangay ID: <barangay_id>
[ANNOUNCEMENT FILTER] Before filter: <count> announcements
[ANNOUNCEMENT FILTER]   ✅ Included: "<title>" (Target barangays: [<ids>])
[ANNOUNCEMENT FILTER]   ❌ Filtered out: "<title>" (Target barangays: [<ids>])
[ANNOUNCEMENT FILTER] After filter: <count> announcements
```

### Frontend UI

Staff users should ONLY see announcements where:
- `announcement.target_barangays` includes their `user.barangay_id`

Example:
- Sergio (barangay_id: 38) should ONLY see announcements with `target_barangays: [38]`
- Demver (barangay_id: 37) should ONLY see announcements with `target_barangays: [37]`

---

## ❌ If Still Not Working

If after restarting the server, the issue persists:

1. **Check if code was saved**:
   ```bash
   cd backend
   grep -n "ANNOUNCEMENT FILTER" routes/announcements.js
   ```
   You should see multiple lines with `[ANNOUNCEMENT FILTER]`

2. **Check server startup**:
   - Make sure no errors during startup
   - Check if correct port (5000)

3. **Check frontend is pointing to correct backend**:
   ```bash
   # In frontend folder
   cat .env
   ```
   Should show: `REACT_APP_API_URL=http://localhost:5000/api`

4. **Clear browser cache and cookies**:
   - Logout
   - Clear cache (Ctrl+Shift+Delete)
   - Login again

5. **Take screenshot** of:
   - Backend console logs
   - Frontend announcements page
   - Send to developer for debugging

---

## 📊 Expected Results Summary

| User | Role | Barangay | Should See Anilao Announcements | Should See Aplaya Announcements |
|------|------|----------|--------------------------------|--------------------------------|
| Admin | admin | N/A | ✅ Yes | ✅ Yes |
| Sergio | staff | Aplaya | ❌ No | ✅ Yes |
| Demver | staff | Anilao | ✅ Yes | ❌ No |

---

## 🆘 Quick Fix Checklist

- [ ] Backend server restarted with new code
- [ ] Logged in as Sergio (Aplaya staff)
- [ ] Checked backend console for filter logs
- [ ] Verified Sergio does NOT see Anilao announcements
- [ ] Logged in as Demver (Anilao staff)
- [ ] Verified Demver does NOT see Aplaya announcements
- [ ] Logged in as Admin
- [ ] Verified Admin sees ALL announcements

If all checkboxes are ✅, the fix is working correctly!
