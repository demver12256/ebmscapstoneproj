# 📊 Distribution Workflow - Visual Guide

## 🔄 Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DISTRIBUTION WORKFLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: ADMIN CREATES DISTRIBUTION EVENT                                    │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Admin
     │
     ├─► POST /api/distributions/events
     │   ├─ title: "Cash Assistance - Q1 2026"
     │   ├─ program_id: 5
     │   ├─ barangay_id: 3
     │   ├─ distribution_date: "2026-02-15"
     │   ├─ venue: "Barangay Hall"
     │   ├─ budget: 150,000
     │   ├─ amount_per_beneficiary: 1,500
     │   └─ assigned_staff_id: 12
     │
     └─► 📄 Event Created (Status: DRAFT)

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: ADMIN PREVIEWS ELIGIBLE BENEFICIARIES                               │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Admin
     │
     ├─► GET /api/distributions/events/:id/eligible-beneficiaries
     │
     └─► 🔍 System Automatically Searches:
          ├─ ✓ Barangay = Event Barangay
          ├─ ✓ Status = Approved
          ├─ ✓ Enrolled in Program (Status: Active)
          └─ ✓ Category Matches (if specified)
          
          📊 Result: 87 Eligible Beneficiaries Found

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: ADMIN PUBLISHES DISTRIBUTION EVENT                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Admin
     │
     ├─► POST /api/distributions/events/:id/publish
     │
     └─► 🔒 AUTOMATIC VALIDATIONS:
          │
          ├─► 1️⃣ Staff Assigned?
          │    ├─ ✓ YES → Continue
          │    └─ ✗ NO  → ❌ Error: "Please assign staff first"
          │
          ├─► 2️⃣ Eligible Beneficiaries Exist?
          │    ├─ ✓ YES (87 found) → Continue
          │    └─ ✗ NO  → ❌ Error: "No eligible beneficiaries"
          │
          └─► 3️⃣ Budget Sufficient?
               │
               ├─ Calculate: 87 × ₱1,500 = ₱130,500
               ├─ Compare: ₱130,500 vs ₱150,000
               │
               ├─ ✓ SUFFICIENT → Continue
               │
               └─ ✗ INSUFFICIENT → ❌ Error: "Insufficient Budget"
                    Details:
                    • Total Required: ₱130,500
                    • Available: ₱100,000
                    • Deficit: ₱30,500

     ✅ ALL VALIDATIONS PASSED
     │
     ├─► Status: DRAFT → SCHEDULED
     │
     ├─► 📦 Generate Batch:
     │    Create 87 DistributionTransactions
     │    Transaction Numbers: TXN-20260215-0045-0001 to 0087
     │
     ├─► 🔔 Notify Staff:
     │    "You have been assigned to conduct..."
     │
     └─► 🔔 Notify All 87 Beneficiaries:
          "You are scheduled to receive ₱1,500 on 2026-02-15..."

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: STAFF VIEWS ASSIGNED EVENTS                                         │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Staff (Barangay: Anilao)
     │
     ├─► GET /api/distributions/events?status=scheduled
     │
     └─► 🔒 BARANGAY FILTER (Automatic):
          WHERE barangay_id = staff.barangay_id
          
          📋 Results: Shows ONLY events in Anilao
          ❌ Cannot see events from other barangays

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: STAFF STARTS DISTRIBUTION SESSION                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Staff
     │
     ├─► POST /api/distributions/events/:id/start-session
     │
     └─► ✅ Session Started
          ├─ Status: SCHEDULED → ONGOING
          ├─ started_at: 2026-02-15 08:00:00
          └─ Audit Log Created

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: BENEFICIARY ARRIVES & STAFF VERIFIES                                │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Beneficiary: Maria Santos
     │
     └─► Presents: RFID Card (1234567890)

    👤 Staff
     │
     ├─► Scans RFID Card
     │
     └─► POST /api/distributions/verify-beneficiary
          {
            "event_id": 45,
            "search_type": "rfid",
            "search_value": "1234567890"
          }

    🔍 AUTOMATIC 7-POINT VERIFICATION:
     │
     ├─► 1️⃣ Beneficiary Registered? ✓
     ├─► 2️⃣ Beneficiary Approved? ✓
     ├─► 3️⃣ Enrolled in Program? ✓
     ├─► 4️⃣ Has Transaction in Event? ✓
     ├─► 5️⃣ Benefit Not Yet Claimed? ✓
     ├─► 6️⃣ Correct Barangay? ✓
     └─► 7️⃣ Included in Batch? ✓

    ✅ VERIFICATION PASSED
     │
     └─► Display:
          ┌─────────────────────────────────────┐
          │ ✓ VERIFIED                          │
          │─────────────────────────────────────│
          │ Name: Maria Reyes Santos            │
          │ ID: SC-ANL-00156                    │
          │ Amount: ₱1,500.00                   │
          │ Program: Senior Citizen Assistance  │
          │ TXN: TXN-20260215-0045-0023        │
          └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 7: STAFF RELEASES BENEFIT                                              │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Staff
     │
     ├─► Gives ₱1,500 Cash to Beneficiary
     │
     ├─► Beneficiary Signs on Tablet/Phone
     │    (Captures Digital Signature)
     │
     └─► POST /api/distributions/events/45/transactions/789/release
          {
            "signature_data": "data:image/png;base64,...",
            "verification_method": "rfid",
            "notes": "Beneficiary received cash assistance"
          }

    🔒 DATABASE TRANSACTION LOCK (Prevent Duplicate)
     │
     ├─► Status: PENDING → RELEASED
     │
     ├─► Record:
     │    ├─ released_at: 2026-02-15 10:35:22
     │    ├─ released_by_staff_id: 12
     │    ├─ signature_data: [stored]
     │    └─ verification_method: rfid
     │
     ├─► Update Event Statistics:
     │    ├─ total_released: 45 → 46
     │    └─ total_amount_released: ₱67,500 → ₱69,000
     │
     ├─► 🔔 Notify Beneficiary:
     │    "Your benefit of ₱1,500.00 has been released..."
     │
     └─► 📝 Audit Log:
          "Staff Juan Dela Cruz released ₱1,500 to Maria Santos"

    ✅ BENEFIT RELEASED SUCCESSFULLY

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 8: GENERATE RECEIPT                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Staff / Beneficiary
     │
     ├─► GET /api/distributions/events/45/receipt/789
     │
     └─► 🧾 Receipt Generated:
          
          ┌──────────────────────────────────────────────┐
          │     OFFICIAL DISTRIBUTION RECEIPT            │
          │──────────────────────────────────────────────│
          │ Transaction: TXN-20260215-0045-0023         │
          │ Date: February 15, 2026 10:35 AM            │
          │──────────────────────────────────────────────│
          │ Beneficiary: Maria Reyes Santos              │
          │ ID Code: SC-ANL-00156                        │
          │ Barangay: Anilao                             │
          │──────────────────────────────────────────────│
          │ Program: Senior Citizen Assistance           │
          │ Event: Cash Assistance - Q1 2026            │
          │ Venue: Barangay Hall                         │
          │──────────────────────────────────────────────│
          │ Amount: ₱1,500.00                           │
          │ In Words: One Thousand Five Hundred Pesos   │
          │──────────────────────────────────────────────│
          │ Released By: Juan Dela Cruz                  │
          │ Verification: RFID Card                      │
          │ Signature: ✓ On File                        │
          │──────────────────────────────────────────────│
          │ [PRINT] [DOWNLOAD]                          │
          └──────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 9: STAFF ENDS DISTRIBUTION SESSION                                     │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Staff (End of Day)
     │
     ├─► POST /api/distributions/events/45/end-session
     │
     └─► 📊 System Checks:
          │
          ├─ Total Beneficiaries: 87
          ├─ Released: 82
          └─ Pending: 5
          
          ⚠️ PARTIAL COMPLETION
          │
          ├─ Status: ONGOING → SCHEDULED
          └─ Message: "5 beneficiaries still pending"

    OR (if all released):

          ✅ FULL COMPLETION
          │
          ├─ Status: ONGOING → COMPLETED
          ├─ completed_at: 2026-02-15 17:00:00
          └─ Message: "All benefits released!"

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 10: REAL-TIME DASHBOARD                                                │
└─────────────────────────────────────────────────────────────────────────────┘

    👤 Admin / Staff
     │
     ├─► GET /api/distributions/dashboard/stats
     │
     └─► 📊 Statistics:
          
          ┌────────────────────────────────────┐
          │ DISTRIBUTION DASHBOARD             │
          ├────────────────────────────────────┤
          │ EVENTS                             │
          │ • Total: 23                        │
          │ • Draft: 3                         │
          │ • Scheduled: 5                     │
          │ • Ongoing: 2                       │
          │ • Completed: 13                    │
          ├────────────────────────────────────┤
          │ TRANSACTIONS                       │
          │ • Total: 1,245                     │
          │ • Released: 1,089 (87.5%)         │
          │ • Pending: 156                     │
          ├────────────────────────────────────┤
          │ BUDGET                             │
          │ • Allocated: ₱1,867,500.00        │
          │ • Released: ₱1,633,500.00         │
          │ • Remaining: ₱234,000.00          │
          └────────────────────────────────────┘
```

---

## 🔐 Access Control Matrix

```
┌──────────────────┬───────────┬────────────┬──────────────┐
│ Action           │ Admin     │ Staff      │ Beneficiary  │
├──────────────────┼───────────┼────────────┼──────────────┤
│ Create Event     │ ✓ Yes     │ ✗ No       │ ✗ No         │
│ Edit Draft       │ ✓ Yes     │ ✗ No       │ ✗ No         │
│ Publish Event    │ ✓ Yes     │ ✗ No       │ ✗ No         │
│ View All Events  │ ✓ Yes     │ ✗ No       │ ✗ No         │
│ View Own Brgy    │ ✓ Yes     │ ✓ Yes      │ ✗ No         │
│ Start Session    │ ✗ No      │ ✓ Yes      │ ✗ No         │
│ Verify Benefic.  │ ✗ No      │ ✓ Yes      │ ✗ No         │
│ Release Benefit  │ ✗ No      │ ✓ Yes      │ ✗ No         │
│ End Session      │ ✗ No      │ ✓ Yes      │ ✗ No         │
│ View Own Receipt │ ✗ No      │ ✗ No       │ ✓ Yes        │
│ View All Stats   │ ✓ Yes     │ ✗ No       │ ✗ No         │
│ View Brgy Stats  │ ✓ Yes     │ ✓ Yes      │ ✗ No         │
└──────────────────┴───────────┴────────────┴──────────────┘
```

---

## 🚦 Status Transitions

```
        DRAFT
          │
          │ Admin Publishes
          │ (Budget Validated)
          ▼
      SCHEDULED ◄────────┐
          │               │
          │ Staff Starts  │ Staff Ends
          │ Session       │ (Partial)
          ▼               │
       ONGOING ───────────┘
          │
          │ Staff Ends
          │ (All Released)
          ▼
      COMPLETED
          │
          │ Admin Archives
          ▼
       ARCHIVED
```

---

## 🔍 Verification Methods Flow

```
┌─────────────────────────────────────────────────────────┐
│ BENEFICIARY ARRIVES AT DISTRIBUTION VENUE               │
└─────────────────────────────────────────────────────────┘
              │
              ├──────────┬──────────┬──────────┐
              ▼          ▼          ▼          ▼
          ┌───────┐ ┌───────┐ ┌───────┐ ┌──────────┐
          │ RFID  │ │  QR   │ │  ID   │ │  Manual  │
          │ Card  │ │ Code  │ │ Code  │ │  Search  │
          └───┬───┘ └───┬───┘ └───┬───┘ └────┬─────┘
              │         │         │          │
              └─────────┴─────────┴──────────┘
                        │
                        ▼
            POST /verify-beneficiary
                        │
                        ▼
         ┌──────────────────────────────┐
         │ 7-POINT AUTOMATIC VALIDATION │
         └──────────────┬───────────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
          ✅ VERIFIED         ❌ FAILED
              │                   │
              ▼                   └─► Show Error
      Show Beneficiary               (Already Claimed,
      Details & Amount               Wrong Barangay, etc.)
              │
              ▼
      Staff Confirms
      & Captures Signature
              │
              ▼
      POST /transactions/:id/release
              │
              ▼
      ✅ BENEFIT RELEASED
```

---

## 💰 Budget Validation Logic

```
┌─────────────────────────────────────────────────────────┐
│ BUDGET VALIDATION PROCESS                               │
└─────────────────────────────────────────────────────────┘

Input:
├─ Program ID: 5
├─ Barangay ID: 3
├─ Budget: ₱150,000
└─ Amount Per Beneficiary: ₱1,500

Step 1: Load Eligible Beneficiaries
├─ WHERE barangay_id = 3
├─ AND status = 'Approved'
├─ AND enrolled in program_id = 5
└─ RESULT: 87 beneficiaries

Step 2: Calculate Total Required
└─ 87 × ₱1,500 = ₱130,500

Step 3: Compare with Budget
├─ Required: ₱130,500
└─ Available: ₱150,000

Step 4: Decision
├─ ₱130,500 ≤ ₱150,000 ? YES
└─ ✅ SUFFICIENT → Publish Allowed

───────────────────────────────────────────────────────

Example: INSUFFICIENT BUDGET

Input:
└─ Budget: ₱100,000

Step 2: Calculate
└─ 87 × ₱1,500 = ₱130,500

Step 3: Compare
├─ Required: ₱130,500
└─ Available: ₱100,000

Step 4: Decision
├─ ₱130,500 > ₱100,000 ? YES
└─ ❌ INSUFFICIENT → Publish BLOCKED

Error Details:
├─ Deficit: ₱30,500
└─ Message: "You need ₱30,500.00 more to publish"
```

---

## 🔔 Notification Flow

```
┌─────────────────────────────────────────────────────────┐
│ EVENT PUBLISHED                                         │
└─────────────────────────────────────────────────────────┘
              │
              ├──────────────┬───────────────────────┐
              ▼              ▼                       ▼
        ┌──────────┐   ┌──────────┐         ┌──────────┐
        │  Staff   │   │ Benefic. │         │ Benefic. │
        │          │   │    #1    │   ...   │   #87    │
        └────┬─────┘   └────┬─────┘         └────┬─────┘
             │              │                     │
             ▼              ▼                     ▼
    "You have been   "You are scheduled    "You are scheduled
     assigned..."     to receive ₱1,500"    to receive ₱1,500"


┌─────────────────────────────────────────────────────────┐
│ BENEFIT RELEASED                                        │
└─────────────────────────────────────────────────────────┘
              │
              ▼
        ┌──────────┐
        │ Benefic. │
        │  Maria   │
        └────┬─────┘
             │
             ▼
    "Your benefit of ₱1,500
     has been released.
     Transaction: TXN-..."
```

---

## 🛡️ Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ INCOMING REQUEST                                        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ 1. JWT Authentication │
              │    ✓ Valid Token?    │
              └──────────┬───────────┘
                         │ Yes
                         ▼
              ┌──────────────────────┐
              │ 2. Role Authorization│
              │    ✓ Has Permission? │
              └──────────┬───────────┘
                         │ Yes
                         ▼
              ┌──────────────────────┐
              │ 3. Barangay Check    │
              │    ✓ Correct Brgy?   │
              └──────────┬───────────┘
                         │ Yes (Staff)
                         ▼
              ┌──────────────────────┐
              │ 4. Business Logic    │
              │    ✓ Status Valid?   │
              │    ✓ Not Duplicate?  │
              └──────────┬───────────┘
                         │ Yes
                         ▼
              ┌──────────────────────┐
              │ 5. Database Lock     │
              │    ✓ Lock Record     │
              └──────────┬───────────┘
                         │ Acquired
                         ▼
              ┌──────────────────────┐
              │ 6. Execute Action    │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ 7. Audit Log         │
              │    Record Action     │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ ✅ SUCCESS           │
              └──────────────────────┘
```

---

## 📊 Real-Time Statistics Update

```
┌─────────────────────────────────────────────────────────┐
│ BEFORE RELEASE                                          │
└─────────────────────────────────────────────────────────┘

Event Statistics:
├─ total_beneficiaries: 87
├─ total_released: 45
├─ total_amount_released: ₱67,500.00
└─ release_percentage: 51.72%

Transaction:
└─ Status: PENDING

┌─────────────────────────────────────────────────────────┐
│ RELEASE BENEFIT (TXN-...-0046)                          │
└─────────────────────────────────────────────────────────┘
              │
              ▼
    Update Transaction Status
              │
              ▼
    Recalculate Event Counters
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ AFTER RELEASE                                           │
└─────────────────────────────────────────────────────────┘

Event Statistics:
├─ total_beneficiaries: 87
├─ total_released: 46 (+1)
├─ total_amount_released: ₱69,000.00 (+₱1,500)
└─ release_percentage: 52.87% (+1.15%)

Transaction:
└─ Status: RELEASED
```

---

## 🎯 Key Features Summary

```
✅ AUTOMATIC FEATURES:
   ├─ Budget validation
   ├─ Eligibility detection
   ├─ Transaction batch creation
   ├─ Transaction number generation
   ├─ Notification sending
   ├─ Statistics updates
   └─ Audit logging

✅ SECURITY FEATURES:
   ├─ Role-based access control
   ├─ Barangay-level restrictions
   ├─ Database transaction locks
   ├─ Duplicate prevention
   └─ Complete audit trail

✅ USER FEATURES:
   ├─ Multiple verification methods
   ├─ Digital signatures
   ├─ Receipt generation
   ├─ Real-time statistics
   └─ Automatic notifications
```

---

**End of Visual Workflow Guide**
