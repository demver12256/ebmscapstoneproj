# Distribution API - Quick Reference Guide

## 🚀 Quick Start for Frontend Developers

### Base URL
```
http://localhost:5000/api/distributions
```

### Authentication
All endpoints require JWT token in header:
```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## 📋 Admin Workflow

### 1. Create Distribution Event
```javascript
POST /events

{
  "title": "Cash Assistance - January 2026",
  "program_id": 5,
  "barangay_id": 3,
  "distribution_date": "2026-01-30",
  "venue": "Barangay Hall",
  "budget": 150000,
  "amount_per_beneficiary": 1500,
  "assigned_staff_id": 12,
  "notes": "Please bring valid ID"
}

// Response: { success: true, data: { id: 45, status: 'draft', ... } }
```

### 2. Preview Eligible Beneficiaries
```javascript
GET /events/45/eligible-beneficiaries?program_id=5&barangay_id=3

// Response: { success: true, data: [...beneficiaries], total: 87 }
```

### 3. Publish Event
```javascript
POST /events/45/publish

// Success: { success: true, message: "...87 beneficiaries notified" }
// Error: { success: false, error_code: "INSUFFICIENT_BUDGET", details: {...} }
```

### 4. View All Events
```javascript
GET /events?status=scheduled

// Response: { success: true, data: [...events] }
```

---

## 👥 Staff Workflow

### 1. View Assigned Events (Auto-filtered by barangay)
```javascript
GET /events?status=scheduled

// Only returns events where barangay_id = staff.barangay_id
```

### 2. Start Distribution Session
```javascript
POST /events/45/start-session

// Status changes: scheduled → ongoing
```

### 3. Search/Verify Beneficiary

**Option A: RFID Card**
```javascript
POST /verify-beneficiary

{
  "event_id": 45,
  "search_type": "rfid",
  "search_value": "1234567890"
}
```

**Option B: QR Code**
```javascript
{
  "event_id": 45,
  "search_type": "qr",
  "search_value": "SC-ANL-00156"
}
```

**Option C: Manual Search**
```javascript
{
  "event_id": 45,
  "search_type": "manual",
  "search_value": "Maria Santos"
}
```

**Response Structure**:
```javascript
{
  "success": true,
  "data": [{
    "beneficiary": { id: 156, full_name: "Maria Santos", ... },
    "transaction": { id: 789, transaction_number: "TXN-...", amount: 1500, status: "pending" },
    "verification": {
      "verified": true,
      "can_release": true,
      "checks": { ... }
    }
  }],
  "count": 1
}
```

### 4. Detailed Verification (Optional)
```javascript
POST /events/45/transactions/789/verify

// Returns detailed verification with all checks
```

### 5. Release Benefit
```javascript
POST /events/45/transactions/789/release

{
  "signature_data": "data:image/png;base64,iVBORw0KG...",
  "photo_proof": null,
  "verification_method": "rfid",
  "notes": "Beneficiary received assistance"
}

// Response: { success: true, receipt_available: true }
```

### 6. End Distribution Session
```javascript
POST /events/45/end-session

// Auto-completes if all transactions released
// Otherwise returns to 'scheduled' status
```

---

## 🎫 Beneficiary Workflow

### 1. View My Distributions
```javascript
GET /events

// Auto-filtered to show only events where beneficiary has a transaction
```

### 2. View My Transactions
```javascript
GET /events/45/transactions

// Auto-filtered to show only beneficiary's own transactions
```

### 3. View My Receipt
```javascript
GET /events/45/receipt/789

// Only accessible if transaction status = 'released'
```

---

## 📊 Dashboard & Reports

### Dashboard Statistics
```javascript
GET /dashboard/stats

// Admin: All barangays
// Staff: Only their barangay

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
      "release_percentage": 87.47
    }
  }
}
```

### Event Details with Stats
```javascript
GET /events/45

{
  "success": true,
  "data": {
    "id": 45,
    "title": "...",
    "status": "ongoing",
    "total_beneficiaries": 87,
    "total_released": 45,
    // ...
    "stats": {
      "total_pending": 42,
      "total_amount_released": 67500.00,
      "total_amount_remaining": 63000.00,
      "release_percentage": "51.72"
    }
  }
}
```

---

## ⚠️ Common Error Codes

| Error Code | Meaning | Solution |
|-----------|---------|----------|
| `INSUFFICIENT_BUDGET` | Budget too low | Increase budget or reduce amount |
| `ALREADY_CLAIMED` | Benefit already released | Check transaction history |
| `ALREADY_RELEASED` | Duplicate release attempt | Transaction is already complete |
| `WRONG_BARANGAY` | Beneficiary from different barangay | Verify beneficiary details |
| `SESSION_NOT_ACTIVE` | Distribution not started | Start session first |
| `WRONG_BARANGAY_STAFF` | Staff accessing wrong barangay | Check barangay assignment |

---

## 🎨 Frontend Implementation Tips

### 1. Real-Time Updates
Poll the event details endpoint every 10-30 seconds during active sessions:
```javascript
setInterval(() => {
  fetch(`/api/distributions/events/${eventId}`)
    .then(res => res.json())
    .then(data => updateUI(data.stats));
}, 10000);
```

### 2. Search Debouncing
For manual search, debounce input:
```javascript
const debouncedSearch = debounce((value) => {
  searchBeneficiary('manual', value);
}, 300);
```

### 3. Signature Capture
Use a canvas library to capture signatures:
```javascript
const signatureDataURL = signaturePad.toDataURL('image/png');
// Send as signature_data in release request
```

### 4. Receipt Generation
Use the receipt data to generate a printable PDF or HTML:
```javascript
fetch(`/api/distributions/events/${eventId}/receipt/${txnId}`)
  .then(res => res.json())
  .then(data => generatePrintableReceipt(data));
```

### 5. Status Badges
Map statuses to colors:
```javascript
const statusColors = {
  draft: 'gray',
  scheduled: 'blue',
  ongoing: 'yellow',
  completed: 'green',
  archived: 'gray'
};

const transactionStatusColors = {
  pending: 'orange',
  released: 'green',
  failed: 'red',
  cancelled: 'gray'
};
```

---

## 🔍 Testing Endpoints

### Using cURL

**Create Event**:
```bash
curl -X POST http://localhost:5000/api/distributions/events \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Distribution",
    "program_id": 5,
    "barangay_id": 3,
    "distribution_date": "2026-02-15",
    "venue": "Test Venue",
    "budget": 50000,
    "amount_per_beneficiary": 1000,
    "assigned_staff_id": 12
  }'
```

**Verify Beneficiary**:
```bash
curl -X POST http://localhost:5000/api/distributions/verify-beneficiary \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 45,
    "search_type": "manual",
    "search_value": "Maria Santos"
  }'
```

---

## 🎯 State Machine

```
DRAFT → SCHEDULED → ONGOING → COMPLETED → ARCHIVED
  ↓         ↓          ↓
Edit     Start      End
         Session   Session
```

**Allowed Transitions**:
- `draft` → `scheduled` (via publish)
- `scheduled` → `ongoing` (via start-session)
- `ongoing` → `completed` (via end-session, if all released)
- `ongoing` → `scheduled` (via end-session, if pending remain)
- `completed` → `archived` (manual)

---

## 📱 Mobile App Considerations

### QR Code Scanning
Use device camera to scan beneficiary QR codes:
```javascript
onQRCodeScanned(qrValue) {
  verifyBeneficiary({
    event_id: currentEventId,
    search_type: 'qr',
    search_value: qrValue
  });
}
```

### RFID Integration
If using RFID readers, integrate with device API:
```javascript
rfidReader.on('scan', (rfidNumber) => {
  verifyBeneficiary({
    event_id: currentEventId,
    search_type: 'rfid',
    search_value: rfidNumber
  });
});
```

### Offline Mode
Cache essential data for offline verification:
```javascript
// Store event and beneficiary list locally
localStorage.setItem(`event_${eventId}`, JSON.stringify(eventData));
localStorage.setItem(`beneficiaries_${eventId}`, JSON.stringify(beneficiaries));

// Queue release transactions when offline
offlineQueue.add(releaseTransaction);

// Sync when online
window.addEventListener('online', syncOfflineQueue);
```

---

## 🛠️ Troubleshooting

### Issue: "Access denied" for staff
**Solution**: Verify `barangay_id` is set in user profile and matches event barangay

### Issue: Budget validation fails
**Solution**: Calculate: `eligible_count × amount_per_beneficiary` must be ≤ `budget`

### Issue: Cannot start session
**Solution**: Event must be in `scheduled` status

### Issue: Cannot release benefit
**Solution**: 
1. Session must be `ongoing`
2. Transaction must be `pending`
3. Must provide signature OR photo proof

---

## 📚 Additional Resources

- Full workflow documentation: `DISTRIBUTION_WORKFLOW.md`
- Database schema: Check models in `/backend/models/`
- Authentication: See `/backend/middleware/auth.middleware.js`
- Role permissions: See `/backend/middleware/role.middleware.js`

---

**Quick Reference Version**: 1.0  
**For**: Frontend Developers  
**Last Updated**: January 2026
