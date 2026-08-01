# Distribution Management Workflow - Complete Guide

## Overview
This document describes the complete distribution management workflow for the DSWD/MSWD Electronic Beneficiary Management System (EBMS). The workflow ensures secure, transparent, and organized benefit distribution with strict role-based access control and barangay-level restrictions.

---

## 🎭 User Roles & Permissions

### Admin
- **Full Access**: All distribution events across all barangays
- **Can**: Create, edit, publish, and delete distribution events
- **Can**: Assign staff members to distribution events
- **Can**: View all reports and statistics
- **Cannot**: Verify beneficiaries or release benefits (operational role for staff only)

### Barangay Staff
- **Restricted Access**: Only events in their assigned barangay
- **Can**: View assigned distribution events
- **Can**: Start/end distribution sessions
- **Can**: Verify beneficiaries and release benefits
- **Can**: Generate receipts
- **Cannot**: Access events from other barangays
- **Cannot**: Create or publish distribution events

### Beneficiary
- **Personal Access**: Only their own distribution records
- **Can**: View scheduled distributions
- **Can**: Receive notifications
- **Can**: View and download their receipts
- **Cannot**: Access other beneficiaries' information

---

## 📋 Complete Workflow

### Phase 1: Admin Creates Distribution Event (DRAFT)

**Endpoint**: `POST /api/distributions/events`

**Who**: Admin only

**Request Body**:
```json
{
  "title": "Cash Assistance for Senior Citizens - Q1 2026",
  "program_id": 5,
  "barangay_id": 3,
  "distribution_date": "2026-02-15",
  "venue": "Barangay Hall - Main Hall",
  "budget": 150000.00,
  "amount_per_beneficiary": 1500.00,
  "assigned_staff_id": 12,
  "notes": "Please bring valid ID and attendance sheet"
}
```

**What Happens**:
- Event is created with status: `draft`
- Admin can edit all fields at this stage
- No notifications are sent yet
- No transactions are created yet

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 45,
    "title": "Cash Assistance for Senior Citizens - Q1 2026",
    "status": "draft",
    "program_id": 5,
    "barangay_id": 3,
    "distribution_date": "2026-02-15",
    "venue": "Barangay Hall - Main Hall",
    "budget": "150000.00",
    "amount_per_beneficiary": "1500.00",
    "assigned_staff_id": 12,
    "total_beneficiaries": 0,
    "total_released": 0,
    "published_at": null,
    "Program": { "id": 5, "name": "Senior Citizen Assistance", "code": "SCA" },
    "Barangay": { "id": 3, "barangay_name": "Anilao", "barangay_code": "ANL" },
    "AssignedStaff": { "id": 12, "first_name": "Juan", "last_name": "Dela Cruz" }
  }
}
```

---

### Phase 2: Admin Edits Draft (Optional)

**Endpoint**: `PUT /api/distributions/events/:id`

**Who**: Admin only

**Restriction**: Only `draft` events can be edited

**Request Body**: (Same fields as creation)

---

### Phase 3: Preview Eligible Beneficiaries

**Endpoint**: `GET /api/distributions/events/:id/eligible-beneficiaries?program_id=5&barangay_id=3`

**Who**: Admin, Staff (for their barangay)

**What Happens**:
- System automatically retrieves beneficiaries who:
  - Belong to the selected barangay
  - Have status: `Approved`
  - Are enrolled in the selected program (status: `active`)
  - Match the program's eligibility category (if specified)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "enrollment_id": 234,
      "beneficiary_id": 156,
      "first_name": "Maria",
      "last_name": "Santos",
      "middle_name": "Reyes",
      "category": "Senior Citizen",
      "RFID_number": "1234567890",
      "beneficiary_id_code": "SC-ANL-00156",
      "contact_number": "09171234567",
      "barangay": {
        "id": 3,
        "barangay_name": "Anilao"
      }
    }
    // ... more beneficiaries
  ],
  "total": 87
}
```

---

### Phase 4: Admin Publishes Distribution Event

**Endpoint**: `POST /api/distributions/events/:id/publish`

**Who**: Admin only

**Automatic Validations**:

1. **Staff Assignment Check**
   - Assigned staff must be set
   - Error if missing: `"Please assign a Barangay Staff member before publishing"`

2. **Eligible Beneficiaries Check**
   - System automatically loads eligible beneficiaries
   - Error if none found: `"No eligible beneficiaries found for this event"`

3. **Budget Validation** (STRICT)
   - Formula: `Total Required = Eligible Count × Amount Per Beneficiary`
   - If `Total Required > Available Budget`, event is blocked
   
   **Error Response**:
   ```json
   {
     "success": false,
     "message": "Insufficient Budget",
     "error_code": "INSUFFICIENT_BUDGET",
     "details": {
       "eligible_beneficiaries": 100,
       "amount_per_beneficiary": 1500.00,
       "total_required": "150000.00",
       "available_budget": "120000.00",
       "deficit": "30000.00",
       "message": "You need ₱30,000.00 more to publish this distribution."
     }
   }
   ```

**What Happens on Success**:

1. **Status Changes**: `draft` → `scheduled`
2. **Batch Generation**: Creates individual `DistributionTransaction` for each eligible beneficiary
3. **Transaction Numbers**: Auto-generated (format: `TXN-YYYYMMDD-EVENTID-INDEX`)
4. **Staff Notification**: Assigned staff receives notification
5. **Beneficiary Notifications**: All eligible beneficiaries receive notification
6. **Audit Log**: Records the publishing action

**Success Response**:
```json
{
  "success": true,
  "data": { /* event with updated status */ },
  "message": "Distribution event published successfully! 87 beneficiaries will be notified.",
  "summary": {
    "total_beneficiaries": 87,
    "total_budget_allocated": "130500.00",
    "amount_per_beneficiary": "1500.00"
  }
}
```

---

### Phase 5: Staff Views Assigned Distribution Events

**Endpoint**: `GET /api/distributions/events`

**Who**: Admin (all events), Staff (only their barangay)

**Filters**: `?status=scheduled` (optional)

**Staff Restrictions**:
- Staff ONLY sees events where `barangay_id = staff.barangay_id`
- Cannot see events from other barangays
- Error if staff has no barangay assigned

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 45,
      "title": "Cash Assistance for Senior Citizens - Q1 2026",
      "status": "scheduled",
      "distribution_date": "2026-02-15",
      "venue": "Barangay Hall - Main Hall",
      "total_beneficiaries": 87,
      "total_released": 0,
      "budget": "130500.00",
      "amount_per_beneficiary": "1500.00",
      "Program": { "name": "Senior Citizen Assistance" },
      "Barangay": { "barangay_name": "Anilao" }
    }
  ]
}
```

---

### Phase 6: Staff Starts Distribution Session

**Endpoint**: `POST /api/distributions/events/:id/start-session`

**Who**: Staff/Barangay (only for their barangay)

**Restriction**: Middleware checks if `event.barangay_id = staff.barangay_id`

**What Happens**:
- Status changes: `scheduled` → `ongoing`
- `started_at` timestamp is recorded
- Audit log created

**Response**:
```json
{
  "success": true,
  "data": { /* event with status: ongoing */ },
  "message": "Distribution session started. You can now begin verifying and releasing benefits."
}
```

---

### Phase 7: Staff Verifies Beneficiary (Multiple Methods)

**Endpoint**: `POST /api/distributions/verify-beneficiary`

**Who**: Staff/Barangay (only for their barangay)

**Verification Methods**:

1. **RFID Card**
   ```json
   {
     "event_id": 45,
     "search_type": "rfid",
     "search_value": "1234567890"
   }
   ```

2. **QR Code**
   ```json
   {
     "event_id": 45,
     "search_type": "qr",
     "search_value": "SC-ANL-00156"
   }
   ```

3. **Beneficiary ID**
   ```json
   {
     "event_id": 45,
     "search_type": "id",
     "search_value": "SC-ANL-00156"
   }
   ```

4. **Manual Name Search**
   ```json
   {
     "event_id": 45,
     "search_type": "manual",
     "search_value": "Maria Santos"
   }
   ```

**Automatic Validation Checks**:
- ✅ Beneficiary is registered
- ✅ Beneficiary status is `Approved`
- ✅ Beneficiary is enrolled in the program
- ✅ Beneficiary has a transaction in this event
- ✅ Benefit not yet claimed (status: `pending`)
- ✅ Beneficiary belongs to correct barangay
- ✅ Included in distribution batch

**Success Response**:
```json
{
  "success": true,
  "data": [
    {
      "beneficiary": {
        "id": 156,
        "full_name": "Maria Reyes Santos",
        "beneficiary_id_code": "SC-ANL-00156",
        "RFID_number": "1234567890",
        "profile_photo": "/uploads/beneficiary-156.jpg",
        "category": "Senior Citizen",
        "barangay": "Anilao"
      },
      "transaction": {
        "id": 789,
        "transaction_number": "TXN-20260215-0045-0023",
        "amount": 1500.00,
        "formatted_amount": "₱1,500.00",
        "status": "pending"
      },
      "event": {
        "id": 45,
        "title": "Cash Assistance for Senior Citizens - Q1 2026",
        "program": "Senior Citizen Assistance",
        "distribution_date": "2026-02-15",
        "venue": "Barangay Hall - Main Hall"
      },
      "verification": {
        "verified": true,
        "can_release": true,
        "checks": {
          "registered": true,
          "eligible": true,
          "enrolled_in_program": true,
          "has_transaction": true,
          "not_yet_claimed": true,
          "correct_barangay": true,
          "included_in_batch": true
        }
      }
    }
  ],
  "count": 1
}
```

**Error Scenarios**:

1. **Already Claimed**
   ```json
   {
     "success": false,
     "verified": false,
     "message": "Benefit Already Claimed",
     "error_code": "ALREADY_CLAIMED"
   }
   ```

2. **Wrong Barangay**
   ```json
   {
     "success": false,
     "verified": false,
     "message": "Barangay Mismatch",
     "error_code": "WRONG_BARANGAY"
   }
   ```

3. **Not in Batch**
   ```json
   {
     "success": false,
     "message": "No beneficiary found matching the search criteria"
   }
   ```

---

### Phase 8: Detailed Transaction Verification

**Endpoint**: `POST /api/distributions/events/:id/transactions/:txnId/verify`

**Who**: Staff/Barangay

**Purpose**: Get full verification details before releasing

**Response**:
```json
{
  "success": true,
  "verified": true,
  "checks": {
    "beneficiary_registered": true,
    "beneficiary_approved": true,
    "correct_barangay": true,
    "not_yet_claimed": true,
    "event_is_active": true,
    "included_in_batch": true
  },
  "data": {
    "transaction_id": 789,
    "transaction_number": "TXN-20260215-0045-0023",
    "beneficiary_name": "Maria Reyes Santos",
    "amount": 1500.00,
    "formatted_amount": "₱1,500.00"
  }
}
```

---

### Phase 9: Staff Releases Benefit

**Endpoint**: `POST /api/distributions/events/:id/transactions/:txnId/release`

**Who**: Staff/Barangay (only for their barangay)

**Request Body**:
```json
{
  "signature_data": "data:image/png;base64,iVBORw0KG...",
  "photo_proof": "/uploads/proof-789.jpg",
  "verification_method": "rfid",
  "notes": "Beneficiary received cash assistance"
}
```

**Required**: Either `signature_data` OR `photo_proof` must be provided

**What Happens**:

1. **Transaction Lock**: Prevents duplicate releases (database transaction with lock)
2. **Status Update**: `pending` → `released`
3. **Record Keeping**:
   - `released_at` timestamp
   - `released_by_staff_id` (current staff)
   - Signature/photo stored
4. **Event Statistics Update**:
   - `total_released` counter incremented
   - `total_amount_released` updated
5. **Beneficiary Notification**: Sent automatically
6. **Audit Log**: Records the release action

**Success Response**:
```json
{
  "success": true,
  "data": {
    "id": 789,
    "transaction_number": "TXN-20260215-0045-0023",
    "status": "released",
    "amount": "1500.00",
    "released_at": "2026-02-15T10:35:22.000Z",
    "Beneficiary": {
      "full_name": "Maria Reyes Santos",
      "beneficiary_id_code": "SC-ANL-00156"
    },
    "ReleasedByStaff": {
      "first_name": "Juan",
      "last_name": "Dela Cruz"
    }
  },
  "message": "Benefit released successfully! Receipt can now be generated.",
  "receipt_available": true
}
```

**Error Scenarios**:

1. **Already Released**
   ```json
   {
     "success": false,
     "message": "Benefit already released for this transaction",
     "error_code": "ALREADY_RELEASED"
   }
   ```

2. **Session Not Active**
   ```json
   {
     "success": false,
     "message": "Distribution session is not active. Please start the session first.",
     "error_code": "SESSION_NOT_ACTIVE"
   }
   ```

3. **Missing Proof**
   ```json
   {
     "success": false,
     "message": "Please provide either a digital signature or photo proof of receipt"
   }
   ```

---

### Phase 10: Generate and View Receipt

**Endpoint**: `GET /api/distributions/events/:id/receipt/:txnId`

**Who**: Admin, Staff, Beneficiary (only their own)

**Response**:
```json
{
  "success": true,
  "data": {
    "transaction_number": "TXN-20260215-0045-0023",
    "status": "released",
    "released_at": "2026-02-15T10:35:22.000Z",
    "verification_method": "rfid",
    
    "beneficiary_name": "Maria Reyes Santos",
    "beneficiary_id_code": "SC-ANL-00156",
    "beneficiary_barangay": "Anilao",
    "beneficiary_contact": "09171234567",
    
    "program_name": "Senior Citizen Assistance",
    "program_code": "SCA",
    "event_title": "Cash Assistance for Senior Citizens - Q1 2026",
    "distribution_date": "2026-02-15",
    "venue": "Barangay Hall - Main Hall",
    
    "amount": 1500.00,
    "formatted_amount": "₱1,500.00",
    "amount_in_words": "One Thousand Five Hundred Pesos",
    
    "released_by": "Juan Dela Cruz",
    "released_by_email": "juan.delacruz@anilao.gov.ph",
    
    "signature_available": true,
    "photo_proof_available": false,
    
    "receipt_generated_at": "2026-02-15T10:36:00.000Z",
    "receipt_type": "Official Distribution Receipt"
  }
}
```

---

### Phase 11: View Event Details & Statistics

**Endpoint**: `GET /api/distributions/events/:id`

**Who**: Admin, Staff (only their barangay), Beneficiary (if in event)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 45,
    "title": "Cash Assistance for Senior Citizens - Q1 2026",
    "status": "ongoing",
    "distribution_date": "2026-02-15",
    "venue": "Barangay Hall - Main Hall",
    "budget": "130500.00",
    "amount_per_beneficiary": "1500.00",
    "total_beneficiaries": 87,
    "total_released": 45,
    "total_amount_released": "67500.00",
    "started_at": "2026-02-15T08:00:00.000Z",
    "published_at": "2026-02-10T14:30:00.000Z",
    
    "Program": { "name": "Senior Citizen Assistance" },
    "Barangay": { "barangay_name": "Anilao" },
    "AssignedStaff": { "first_name": "Juan", "last_name": "Dela Cruz" },
    
    "stats": {
      "total_beneficiaries": 87,
      "total_released": 45,
      "total_pending": 42,
      "total_amount_allocated": 130500.00,
      "total_amount_released": 67500.00,
      "total_amount_remaining": 63000.00,
      "release_percentage": "51.72"
    }
  }
}
```

---

### Phase 12: View All Transactions in Event

**Endpoint**: `GET /api/distributions/events/:id/transactions`

**Who**: Admin, Staff (only their barangay), Beneficiary (only their own)

**Response**: Array of all transactions with beneficiary details, release status, and timestamps

---

### Phase 13: Staff Ends Distribution Session

**Endpoint**: `POST /api/distributions/events/:id/end-session`

**Who**: Staff/Barangay (only for their barangay)

**What Happens**:

1. **Check Completion**: Counts pending vs released transactions
2. **Auto-Complete**: If all transactions released → status: `completed`
3. **Partial Complete**: If pending remain → status: `scheduled`
4. **Audit Log**: Records session end with statistics

**Response**:
```json
{
  "success": true,
  "data": { /* event */ },
  "message": "Distribution session ended. 42 beneficiary(ies) still pending.",
  "summary": {
    "released": 45,
    "pending": 42,
    "status": "scheduled"
  }
}
```

**Auto-Completion Response**:
```json
{
  "success": true,
  "message": "Distribution session completed. All benefits have been released!",
  "summary": {
    "released": 87,
    "pending": 0,
    "status": "completed"
  }
}
```

---

### Phase 14: Dashboard Statistics

**Endpoint**: `GET /api/distributions/dashboard/stats`

**Who**: Admin (all barangays), Staff (their barangay only)

**Response**:
```json
{
  "success": true,
  "data": {
    "events": {
      "total": 23,
      "draft": 3,
      "scheduled": 5,
      "ongoing": 2,
      "completed": 13
    },
    "transactions": {
      "total_transactions": 1245,
      "pending_transactions": 156,
      "released_transactions": 1089,
      "total_amount_allocated": "1867500.00",
      "total_amount_released": "1633500.00",
      "total_amount_pending": "234000.00",
      "release_percentage": 87.47
    },
    "scope": "assigned_barangay",
    "generated_at": "2026-02-15T11:00:00.000Z"
  }
}
```

---

## 🔒 Security & Access Control

### Barangay-Level Restrictions

**Middleware**: `restrictToAssignedBarangay`

**Applied to**:
- GET `/events/:id`
- POST `/events/:id/start-session`
- POST `/events/:id/end-session`
- POST `/events/:id/transactions/:txnId/verify`
- POST `/events/:id/transactions/:txnId/release`

**Logic**:
```javascript
if (user.role === 'admin') {
  // Allow all access
  next();
} else if (user.role === 'staff' || user.role === 'barangay') {
  if (user.barangay_id !== event.barangay_id && user.id !== event.assigned_staff_id) {
    // DENY ACCESS
    return 403 Forbidden;
  }
  next();
}
```

### Duplicate Prevention

- **Database Transaction Locks**: Prevents concurrent releases
- **Status Checks**: Validates transaction status before release
- **Unique Transaction Numbers**: Auto-generated, collision-free

### Audit Trail

Every action is logged:
- Who performed the action
- When it was performed
- What was changed
- Related entity IDs

---

## 🔔 Notification Flow

### When Event is Published
- **To Assigned Staff**: "You have been assigned to conduct [Event Title]..."
- **To All Eligible Beneficiaries**: "You are scheduled to receive ₱[Amount]..."

### When Benefit is Released
- **To Beneficiary**: "Your benefit of ₱[Amount] has been successfully released. Transaction Number: [TXN]..."

---

## 📊 Real-Time Dashboard Updates

All counters update automatically:
- Event statistics (total_beneficiaries, total_released, total_amount_released)
- Transaction counts by status
- Budget tracking
- Release percentage

---

## 🚨 Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE",
  "details": { /* additional context */ }
}
```

**Common Error Codes**:
- `INSUFFICIENT_BUDGET`
- `ALREADY_CLAIMED`
- `ALREADY_RELEASED`
- `WRONG_BARANGAY`
- `SESSION_NOT_ACTIVE`
- `WRONG_BARANGAY_STAFF`

---

## 📝 Best Practices

1. **Always verify before release**: Use the verify endpoint first
2. **Capture proof**: Require signature OR photo proof
3. **Monitor real-time stats**: Use the dashboard endpoint
4. **End sessions properly**: Don't leave events in "ongoing" status indefinitely
5. **Review audit logs**: Track all actions for accountability
6. **Test budget calculations**: Preview eligible beneficiaries before publishing

---

## 🎯 Complete API Endpoint Summary

| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/events` | GET | All | List distribution events |
| `/events` | POST | Admin | Create distribution event |
| `/events/:id` | GET | All | Get event details + stats |
| `/events/:id` | PUT | Admin | Edit draft event |
| `/events/:id` | DELETE | Admin | Delete draft event |
| `/events/:id/eligible-beneficiaries` | GET | Admin, Staff | Preview eligible beneficiaries |
| `/events/:id/publish` | POST | Admin | Publish event (validate & create batch) |
| `/events/:id/start-session` | POST | Staff | Start distribution session |
| `/events/:id/end-session` | POST | Staff | End distribution session |
| `/events/:id/transactions` | GET | All | List all transactions |
| `/verify-beneficiary` | POST | Staff | Search & verify beneficiary |
| `/events/:id/transactions/:txnId/verify` | POST | Staff | Detailed verification |
| `/events/:id/transactions/:txnId/release` | POST | Staff | Release benefit |
| `/events/:id/receipt/:txnId` | GET | All | Generate receipt |
| `/dashboard/stats` | GET | Admin, Staff | Dashboard statistics |

---

## 🎉 Workflow Complete!

This comprehensive distribution management system ensures:
✅ **Security**: Role-based access control and barangay restrictions
✅ **Transparency**: Complete audit trail and real-time statistics
✅ **Organization**: Structured workflow from draft to completion
✅ **Accountability**: Digital signatures, receipts, and proof of delivery
✅ **Efficiency**: Automated validations and batch processing
✅ **User Experience**: Clear notifications and error messages

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**System**: EBMS Distribution Management Module
