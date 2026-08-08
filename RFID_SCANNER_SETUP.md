# RFID Scanner System - Complete Setup

## Overview
Dalawang magkaibang RFID scanner pages para sa iba't ibang purposes, pero gumagamit ng **same RFID card**.

---

## 1. RFID Distribution Scanner (`/dashboard/rfid-scanner`)
**Purpose:** Para sa pag-claim ng cash benefits sa distribution events

### Features:
✅ Select distribution event (scheduled/ongoing)
✅ Scan RFID to **release benefits**
✅ Automatic transaction status update: `pending` → `released`
✅ Real-time progress tracking sa Distribution Management page
✅ Budget tracking - automatic deduction
✅ Export to Excel with amounts

### Flow:
1. Staff selects active distribution event
2. Beneficiary taps RFID card
3. System verifies:
   - Enrolled sa program
   - May pending transaction
   - Valid RFID
4. System releases benefit:
   - Marks transaction as "released"
   - Records release time
   - Updates progress counter
   - Deducts from allocated budget
5. Success message: "✅ [Name] - Benefit released! Amount: ₱X,XXX.XX"

### What Gets Updated:
- `distribution_transactions.status` → "released"
- `distribution_transactions.released_at` → current timestamp
- `distribution_transactions.released_by_staff_id` → staff user ID
- `distribution_transactions.verification_method` → "rfid"
- Distribution event progress: `released_count / total_beneficiaries`
- Remaining budget calculation

---

## 2. RFID Attendance Scanner (`/dashboard/rfid-attendance`)
**Purpose:** Para sa pag-record ng attendance sa announcements/events

### Features:
✅ Select announcement/event
✅ Scan RFID to **record attendance**
✅ Duplicate scan prevention
✅ Export to Excel (attendance records)

### Flow:
1. Staff selects announcement/event
2. Beneficiary taps RFID card
3. System records attendance:
   - Scan date and time
   - Beneficiary info
   - Status: "present"
4. Success message: "✓ [Name] - Attendance recorded!"

### What Gets Updated:
- `announcement_recipients` or attendance table
- Attendance count for the event
- No budget/financial implications

---

## Sidebar Navigation:
- **Distribution Scanner** - For benefit claims (admin, staff, barangay)
- **Attendance Scanner** - For event attendance (staff, barangay)

---

## Same RFID Card, Different Uses:
Ang beneficiary ay may **isang RFID card lang** na pwedeng gamitin sa:
1. ✅ Pag-claim ng distribution benefits
2. ✅ Pag-attend sa announcements/events
3. ✅ Future: Access control, verification, etc.

---

## Distribution Management Page Updates:
Makikita dito ang real-time progress:
- **Progress:** "X / Y" (released / total)
- **Release Rate:** "X%"
- **Total Released:** "₱X,XXX.XX" 
- Automatic updates kapag may nag-scan sa RFID Distribution Scanner

---

## Files Created/Modified:

### New Files:
- `frontend/src/pages/RfidAttendancePage.jsx` - Attendance scanner

### Modified Files:
- `frontend/src/pages/RfidScannerPage.jsx` - Updated for distribution claiming
- `frontend/src/App.jsx` - Added route for attendance scanner
- `frontend/src/components/layout/Sidebar.jsx` - Updated navigation labels
- `backend/routes/beneficiaries.js` - Improved error handling
- `backend/fix_cascade_delete.js` - Fixed foreign key constraints

---

## How to Test:

### Distribution Scanner:
1. Login as staff/admin
2. Go to "Distribution Scanner"
3. Select a distribution event (must be scheduled/ongoing)
4. Scan beneficiary RFID
5. Check Distribution Management page - progress should update

### Attendance Scanner:
1. Login as staff
2. Go to "Attendance Scanner"  
3. Select an announcement/event
4. Scan beneficiary RFID
5. Export to Excel to verify

---

## Database Schema:

### Distribution Transactions:
```sql
distribution_transactions
- id
- transaction_number
- distribution_event_id
- beneficiary_id
- amount
- status (pending → released)
- released_at (timestamp)
- released_by_staff_id
- verification_method ('rfid')
- notes
```

### Cascade Delete:
✅ Fixed foreign key constraint
- Deleting distribution_event → automatically deletes transactions

---

## Notes:
- ✅ All working and tested
- ✅ Real-time updates
- ✅ Budget tracking automatic
- ✅ Progress updates live
- ✅ Same RFID for both purposes
- ✅ Export functionality included
