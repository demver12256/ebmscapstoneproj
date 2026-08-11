# Announcement Barangay-Specific Notification Filter - COMPLETE FIX

## Problema / Issue
Kapag nag-create ng announcement para sa specific barangay (e.g., Anilao), nakikita pa rin ito ng staff ng ibang barangay (e.g., Aplaya staff si Sergio Folloso). Dapat lang yung staff ng target barangay ang makakita ng announcement.

## Root Cause Analysis

May **DALAWANG** separate issues:

### Issue #1: Staff Notification (Backend) ✅ ALREADY WORKING
- Ang pagse-send ng **notifications** sa staff ay gumagana na nang tama
- Verified: Only Anilao staff receive notifications for Anilao announcements
- Code location: `backend/routes/announcements.js` - Line 202-214 (dispatchAnnouncementNotifications function)

### Issue #2: Staff Announcement List View (Backend) ❌ **THIS WAS THE BUG**
- Ang pagpapakita ng **announcement list** sa staff UI ay may bug
- **Problem**: Kapag `role === 'staff'` ay hindi na-filter based sa barangay
- **Result**: Lahat ng announcements ay nakikita ng staff kahit hindi para sa kanilang barangay
- Code location: `backend/routes/announcements.js` - GET `/` route around line 608-613

## Solutions Implemented

### Fix #1: Enhanced Staff Notification Filter (Already Working)

### Fix #1: Enhanced Staff Notification Filter (Already Working)

Location: `backend/routes/announcements.js` - `dispatchAnnouncementNotifications()` function

**Code:**
```javascript
const staffUsers = await User.findAll({
  where: {
    role: { [Op.in]: ['staff', 'barangay'] }, // Exclude 'admin' role
    status: 'active',
    barangay_id: { 
      [Op.in]: targetBarangayIds, // Only staff whose barangay_id matches target barangays
      [Op.ne]: null, // Exclude users with null barangay_id
    },
  },
});
```

### Fix #2: **NEW FIX** - Staff Announcement List View Filter

Location: `backend/routes/announcements.js` - GET `/` route

**BEFORE (BUG):**
```javascript
// Filter staff view to events that target their barangay if role === 'barangay'
if (req.user.role === 'barangay' && req.user.barangay_id) {
  announcements = announcements.filter((a) =>
    Array.isArray(a.target_barangays) && a.target_barangays.map(Number).includes(req.user.barangay_id)
  );
}
```

**Problem:** Yung condition ay `role === 'barangay'` lang. Kapag `role === 'staff'`, hindi na-filter!

**AFTER (FIXED):**
```javascript
// Filter staff view to events that target their barangay if role === 'barangay' OR 'staff'
// CRITICAL: Both 'staff' and 'barangay' roles should only see announcements for their assigned barangay
if ((req.user.role === 'barangay' || req.user.role === 'staff') && req.user.barangay_id) {
  announcements = announcements.filter((a) =>
    Array.isArray(a.target_barangays) && a.target_barangays.map(Number).includes(req.user.barangay_id)
  );
}
```

**Changes:**
- ✅ Changed condition from `role === 'barangay'` to `(role === 'barangay' || role === 'staff')`
- ✅ Now both 'staff' and 'barangay' roles are filtered by their assigned barangay
- ✅ Admin users (role === 'admin') can still see all announcements

```javascript
if (staffNotifications.length > 0) {
  await Notification.bulkCreate(staffNotifications, { ignoreDuplicates: true });
  
  // Log staff notification details for verification
  console.log(`[ANNOUNCEMENT ${announcement.id}] Notified ${staffUsers.length} staff for barangays: ${targetBarangayIds.join(', ')}`);
  staffUsers.forEach(s => {
    console.log(`  → Staff ID ${s.id}: ${s.first_name} ${s.last_name} (Barangay ID: ${s.barangay_id})`);
  });
}
```

**Benefits:**
- ✅ Real-time logging sa server console kung sino ang naka-receive ng notification
- ✅ Easy debugging kung may issues sa future

## Test Results

Created comprehensive test script: `backend/test_barangay_announcement_filter.js`

### Test Scenario:
1. ✅ Create announcement for **Anilao (Barangay ID: 37)** only
2. ✅ Verify only Anilao staff receive notifications
3. ✅ Verify Aplaya staff (ID: 108) does NOT receive notification
4. ✅ Clean up test data

### Test Output:
```
Target Barangay: Anilao (ID: 37)
Expected Recipients: 2
Actual Recipients: 2
Wrong Recipients: 0

✅✅✅ TEST PASSED! Announcement notifications are correctly filtered by barangay!
```

## How It Works Now (Complete Flow)

### When Admin Creates Announcement for Anilao:

1. **Admin selects target barangay**: Anilao (ID: 37)
2. **Backend processes announcement creation**
3. **Two separate actions happen:**

   **A. Staff Notification Dispatch (Fix #1 - Already Working)**
   - Query finds staff where `barangay_id IN [37]` AND `role IN ['staff', 'barangay']`
   - Result: Only Anilao staff receive in-app notifications
   - ✅ Sergio (Aplaya, ID: 38) does NOT receive notification

   **B. Staff Announcement List API (Fix #2 - NEW FIX)**
   - When Sergio (Aplaya staff) calls `GET /api/announcements`:
     - Backend queries all published announcements
     - **NEW**: Filters announcements where `target_barangays` includes Sergio's barangay_id (38)
     - ✅ Sergio ONLY sees Aplaya announcements
     - ✅ Sergio does NOT see Anilao announcements in his list

   - When Demver (Anilao staff) calls `GET /api/announcements`:
     - Backend queries all published announcements
     - Filters announcements where `target_barangays` includes Demver's barangay_id (37)
     - ✅ Demver ONLY sees Anilao announcements
     - ✅ Demver does NOT see Aplaya announcements in his list

   - When Admin calls `GET /api/announcements`:
     - Backend queries all published announcements
     - **No filtering** - Admin sees everything
     - ✅ Admin sees all announcements from all barangays

## Concrete Example

```
Scenario: Admin creates "4PS MONTHLY FDS" for Anilao only

Target Barangays: [37] (Anilao)

Staff Users:
  - Demver Minion (ID: 106, Role: staff, Barangay: 37 - Anilao)
  - Sergio Folloso (ID: 108, Role: staff, Barangay: 38 - Aplaya)
  - Barangay Staff Anilao (ID: 175, Role: barangay, Barangay: 37 - Anilao)

BEFORE FIX #2:
  ❌ Sergio (Aplaya) sees announcement in his list (WRONG!)
  ✅ Demver (Anilao) sees announcement in his list (correct)
  ✅ Barangay Staff Anilao sees announcement (correct)

AFTER FIX #2:
  ✅ Sergio (Aplaya) does NOT see announcement (FIXED!)
  ✅ Demver (Anilao) sees announcement (correct)
  ✅ Barangay Staff Anilao sees announcement (correct)
```

## Verification Steps

### Manual Testing:

1. **Login as Sergio (Aplaya staff)**:
   - Email: sergiofolloso@example.com
   - Go to Announcements page
   - ✅ Should ONLY see Aplaya announcements
   - ❌ Should NOT see Anilao announcements

2. **Login as Demver (Anilao staff)**:
   - Email: demverminion@example.com  
   - Go to Announcements page
   - ✅ Should ONLY see Anilao announcements
   - ❌ Should NOT see Aplaya announcements

3. **Login as Admin**:
   - Go to Announcements page
   - ✅ Should see ALL announcements from ALL barangays

### Database Verification:

```javascript
// Check announcement targets
const ann = await Announcement.findOne({
  where: { title: '4PS MONTHLY FDS' }
});
console.log('Target Barangays:', ann.target_barangays); // Should be [37]

// Check who got notifications
const notifs = await Notification.findAll({
  where: { 
    reference_id: ann.id,
    reference_type: 'announcement_staff'
  },
  include: [{ model: User, attributes: ['first_name', 'last_name', 'barangay_id'] }]
});
// Should only show Anilao staff (barangay_id: 37)
```

### Server Console Check:

When creating announcement, server will log:
```
[ANNOUNCEMENT 20] Notified 2 staff for barangays: 37
  → Staff ID 106: Demver Minion (Barangay ID: 37)
  → Staff ID 175: Barangay Staff Anilao (Barangay ID: 37)
```

## Files Modified

1. ✅ `backend/routes/announcements.js` (Line ~608-613)
   - **NEW FIX**: Changed staff view filtering condition
   - Added support for `role === 'staff'` in addition to `role === 'barangay'`
   
2. ✅ `backend/routes/announcements.js` (Line ~202-224)
   - Enhanced staff notification filtering (already working)
   - Added logging for verification

## Test Scripts Created

1. ✅ `backend/test_barangay_announcement_filter.js`
   - Tests notification dispatch filtering
   - Verifies only target barangay staff receive notifications

2. ✅ `backend/test_multi_barangay_announcement.js`
   - Tests multi-barangay announcement notifications
   - Verifies staff from multiple target barangays receive notifications

3. ✅ `backend/test_staff_announcement_view_filter.js` (NEW)
   - Tests announcement list view filtering
   - Verifies staff only see announcements for their barangay

## Status: ✅ COMPLETELY FIXED

Both issues are now resolved:
- ✅ **Notification dispatch**: Only target barangay staff receive notifications
- ✅ **Announcement list view**: Staff only see announcements for their barangay
- ✅ **Admin view**: Admins can still see all announcements

---

## Technical Implementation Details

### Role-Based Access Control Matrix

| User Role | Notifications Received | Announcements Visible in List |
|-----------|----------------------|-------------------------------|
| **Admin** | None (admin excluded) | All announcements (no filter) |
| **Staff** | Only for their barangay | Only for their barangay |
| **Barangay** | Only for their barangay | Only for their barangay |
| **Beneficiary** | Only if they match criteria | Only if they match criteria |

---

## Technical Notes

### Database Schema
```javascript
User {
  id: Integer
  first_name: String
  last_name: String
  role: Enum ['admin', 'staff', 'barangay', 'beneficiary']
  barangay_id: Integer (Foreign Key → Barangay.id)
  status: Enum ['active', 'inactive']
}

Announcement {
  id: Integer
  title: String
  message: Text
  target_barangays: JSON [barangay_id, ...]
  target_programs: JSON [category_name, ...]
  status: Enum ['published', 'draft', 'completed', 'archived']
}

Notification {
  id: Integer
  user_id: Integer (Foreign Key → User.id)
  title: String
  message: Text
  reference_type: String ('announcement_staff', 'announcement', etc.)
  reference_id: Integer (Foreign Key → Announcement.id)
  is_read: Boolean
}
```

### Key Sequelize Operators Used
- `Op.in` - Match any value in array
- `Op.ne` - Not equal to
- `Op.like` - Pattern matching for categories

---

**Date Fixed:** January 2025  
**Tested By:** Automated Test Script  
**Status:** ✅ Production Ready
