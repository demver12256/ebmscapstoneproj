# Activity Auto-Complete & Absence Notification Feature

## Overview
Implemented automatic activity completion system na nag-nonotify sa mga beneficiaries na absent sa attendance activities.

## Mga Features

### 1. Auto-Complete Activity
- **Backend Endpoint**: `POST /api/announcements/:id/complete`
- **Function**: Automatically marks all pending beneficiaries as "Absent" at nag-aarchive ng activity
- **Authorization**: Admin, Staff, Barangay roles only

### 2. Absence Notifications
Kapag nag-complete ng activity, automatic na mag-sesend ng:

#### In-App Notifications
- Title: "Absent: [Activity Name]"
- Message: Details kung kailan ang activity at instructions to contact office
- Type: 'program' notification with reference to announcement

#### SMS Notifications
- Automatically sends SMS sa lahat ng absent beneficiaries na may contact number
- Format: `[EBMS] You were marked ABSENT for "[Activity Title]" on [Date]. Please contact DSWD for details.`
- Status: Logged as 'sent' in sms_notifications table

### 3. Excel Export with Absent List
Enhanced ang Excel export to include:

#### Present Attendees Section
- RFID Number
- Beneficiary Name
- ID Code
- Barangay
- Category
- Time Scanned

#### Absent Beneficiaries Section
- RFID Number
- Beneficiary Name
- ID Code
- Barangay
- Category
- Contact Number (para madaling tawagan)

## How to Use

### Frontend - Announcement Management Page (Admin/Staff)

1. **Complete Activity Button**
   - Purple check icon (✓) sa action buttons
   - Available only for "published" announcements
   - Title: "Complete Activity & Notify Absent"

2. **Workflow**
   ```
   1. Click "Complete Activity" button
   2. Confirm the action (popup confirmation)
   3. System automatically:
      - Marks all pending beneficiaries as absent
      - Sends in-app notifications
      - Sends SMS notifications
      - Archives the announcement
      - Logs action in audit trail
   ```

3. **Export to Excel**
   - Click "Download" icon (⬇️) sa action buttons
   - Downloads CSV with present AND absent lists
   - Filename: `Attendance_Report_[ActivityName].csv`

1. **Two View Modes:**
   - **📢 Event Announcements** - Shows all activity announcements
   - **🔔 System Notifications** - Shows absence notifications and other system alerts

2. **In Event Announcements:**
   - Shows attendance status badges:
     - ✅ **ATTENDANCE CONFIRMED PRESENT** (green) - if scanned
     - ❌ **MARKED ABSENT** (red) - if marked absent after completion
     - ⏱️ **ATTENDANCE PENDING** (yellow) - not yet scanned

3. **In System Notifications:**
   - Red alert icon for absence notifications
   - Shows title: "Absent: [Activity Name]"
   - Message with activity details and contact instructions
   - Mark as read functionality

4. **Notification Badge:**
   - Shows total unread count (announcements + notifications)
   - Red badge on System Notifications tab showing unread count

1. **Complete Activity Button**
   - Purple check icon (✓) sa action buttons
   - Available only for "published" announcements
   - Title: "Complete Activity & Notify Absent"

2. **Workflow**
   ```
   1. Click "Complete Activity" button
   2. Confirm the action (popup confirmation)
   3. System automatically:
      - Marks all pending beneficiaries as absent
      - Sends in-app notifications
      - Sends SMS notifications
      - Archives the announcement
      - Logs action in audit trail
   ```

3. **Export to Excel**
   - Click "Download" icon (⬇️) sa action buttons
   - Downloads CSV with present AND absent lists
   - Filename: `Attendance_Report_[ActivityName].csv`

### Frontend - RFID Scanner Page

1. **Enhanced Export**
   - Export button now fetches full attendance data
   - Includes both present and absent beneficiaries
   - Separated into two sections sa Excel file

## Database Changes

### AnnouncementRecipient Table
- Uses existing `attendance_status` field: 'Pending' → 'Absent'
- No schema changes needed

### Notification Table
- New records created for each absent beneficiary
- Type: 'program'
- Reference type: 'announcement_absence'

### SMSNotification Table
- Bulk creates SMS records for absent beneficiaries
- Status: 'sent'
- Sent_at: Current timestamp

## API Response Format

### Complete Activity Response
```json
{
  "success": true,
  "message": "Activity completed successfully. 15 beneficiaries marked as absent and notified.",
  "data": {
    "total_absent": 15,
    "notifications_sent": 15,
    "sms_sent": 12
  }
}
```

### Export Attendance Report
```json
{
  "success": true,
  "event": {
    "title": "4Ps Family Development Session",
    "event_date": "2026-08-10",
    "venue": "Barangay Hall"
  },
  "summary": {
    "total_recipients": 50,
    "total_present": 35,
    "total_absent": 15
  },
  "report": [
    {
      "row_number": 1,
      "beneficiary_id_code": "BEN-2024-001",
      "beneficiary_name": "Juan Dela Cruz",
      "barangay": "Poblacion",
      "rfid_number": "1234567890",
      "contact_number": "09171234567",
      "attendance_status": "Present",
      "scanned_at": "8/9/2026, 9:30:00 AM",
      "facilitated_by": "Admin User"
    }
  ]
}
```

## Audit Trail

### Complete Activity Action
```
COMPLETED_ACTIVITY: "[Activity Title]" - Marked 15 beneficiaries as absent and sent 15 notifications
Module: Announcements
User: Admin/Staff ID
Timestamp: ISO DateTime
```

### Export Report Action
```
GENERATED_ATTENDANCE_REPORT: "[Activity Title]"
Module: Reports
User: Admin/Staff ID
Timestamp: ISO DateTime
```

## Security & Permissions

- **Complete Activity**: Requires `admin`, `staff`, or `barangay` role
- **Export Report**: Requires `admin`, `staff`, or `barangay` role
- **View Notifications**: Beneficiaries can see their own absence notifications

## Notifications Beneficiary Will See

### In-App Notification
```
Title: Absent: 4Ps Family Development Session
Message: You were marked absent for "4Ps Family Development Session" held on 2026-08-10. Please contact the municipal office for more information.
Status: Unread (red dot indicator)
```

### SMS Notification
```
[EBMS] You were marked ABSENT for "4Ps Family Development Session" on 2026-08-10. Please contact DSWD for details.
```

## Best Practices

1. **Timing**: Complete activity after the event date has passed
2. **Verification**: Review attendance stats before completing
3. **Communication**: Make sure venue and date info is accurate for notifications
4. **Follow-up**: Use the exported Excel file with contact numbers for follow-up calls

## Files Modified

### Backend
- `backend/routes/announcements.js` - Added complete endpoint
- Database models (no changes, uses existing tables)

### Frontend
- `frontend/src/services/api.js` - Added completeActivity API call
- `frontend/src/pages/AnnouncementManagementPage.jsx` - Added complete button & handler
- `frontend/src/pages/RfidAnnouncementScannerPage.jsx` - Enhanced Excel export

## Testing Checklist

- [ ] Complete activity button appears for published announcements
- [ ] Confirmation dialog shows before completing
- [ ] Absent beneficiaries receive in-app notifications
- [ ] Absent beneficiaries with contact numbers receive SMS
- [ ] Announcement status changes to "archived" after completion
- [ ] Excel export includes both present and absent sections
- [ ] Audit log records the completion action
- [ ] Stats update correctly after completion
- [ ] **Archived announcements do NOT show on dashboard**
- [ ] **Notification bell shows correct unread count**
- [ ] **Clicking notification bell navigates to notifications page**
- [ ] **Unread count updates automatically (polls every 30 seconds)**

## Changes Summary

### Backend
- ✅ Added `POST /api/announcements/:id/complete` endpoint
- ✅ Auto-marks pending as absent
- ✅ Sends in-app and SMS notifications

### Frontend - Header Component
- ✅ **Notification bell now functional**
- ✅ Shows real-time unread count from API
- ✅ Clicking navigates to `/dashboard/notifications`
- ✅ Auto-refreshes count every 30 seconds
- ✅ Shows "9+" if more than 9 unread

### Frontend - Dashboard
- ✅ **Filters out archived announcements**
- ✅ Only shows published announcements in widget
- ✅ Count updates to match published only

### Frontend - Notifications Page
- ✅ Two-tab view (Announcements + System Notifications)
- ✅ Shows absence notifications with red alert
- ✅ Displays attendance status badges
- ✅ Mark as read functionality

## Future Enhancements

1. **Scheduled Auto-Complete**: Automatically complete activities 1 day after event date
2. **Custom Absence Messages**: Allow staff to customize the absence notification message
3. **Absence Reasons**: Add field for beneficiaries to explain their absence
4. **Make-up Sessions**: Link absent beneficiaries to alternative session schedules

## Tagalog Summary

**Bagong Feature: Auto-Complete at Absence Notification**

Kapag nag-end na ang isang activity:
1. I-click ang purple check (✓) button sa Announcement Management
2. Lahat ng hindi naka-attend (Pending status) ay automatic na magiging "Absent"
3. Makakatanggap sila ng notification sa app at SMS
4. Pag-export ng Excel, kasama na yung list ng absent beneficiaries with contact numbers
5. Madaling tawagan ang mga absent para sa follow-up

**Nota**: Ang feature na ito ay para lamang sa mga Admin, Staff, at Barangay Staff roles.
