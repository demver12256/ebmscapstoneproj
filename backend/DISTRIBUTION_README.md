# 📦 Distribution Management Module

## Overview

The Distribution Management Module provides a complete, secure, and transparent workflow for managing benefit distributions in the DSWD/MSWD Electronic Beneficiary Management System (EBMS). It follows real-world distribution processes used by municipalities, ensuring proper accountability, role-based access control, and barangay-level restrictions.

---

## ✨ Key Features

### 🔒 **Security & Access Control**
- **Role-Based Permissions**: Admin, Staff, and Beneficiary roles with distinct capabilities
- **Barangay-Level Restrictions**: Staff can ONLY access distributions in their assigned barangay
- **Duplicate Prevention**: Database transaction locks prevent concurrent benefit releases
- **Complete Audit Trail**: Every action is logged with user, timestamp, and details

### 💰 **Budget Management**
- **Automatic Budget Validation**: Prevents publishing if insufficient funds
- **Real-Time Tracking**: Monitor allocated vs. released amounts
- **Detailed Budget Breakdown**: Shows deficit amount when budget is insufficient
- **Per-Beneficiary Allocation**: Flexible amount configuration per event

### 👥 **Beneficiary Management**
- **Automatic Eligibility Detection**: System automatically finds eligible beneficiaries based on:
  - Barangay assignment
  - Program enrollment status
  - Beneficiary approval status
  - Category matching (if specified)
- **Multiple Verification Methods**:
  - RFID card scanning
  - QR code scanning
  - Beneficiary ID lookup
  - Manual name search
- **Comprehensive Verification Checks**: 7-point validation before release

### 📋 **Distribution Workflow**
- **Draft → Scheduled → Ongoing → Completed**: Clear state machine
- **Session Management**: Staff can start/end distribution sessions
- **Batch Processing**: Automatically creates transactions for all eligible beneficiaries
- **Real-Time Statistics**: Live updates on release progress and budget utilization

### 🔔 **Notifications**
- **Automatic Notifications** sent to:
  - Assigned staff when event is published
  - All eligible beneficiaries when event is scheduled
  - Beneficiary when their benefit is released
- **In-App Notifications**: Stored in database for tracking

### 🧾 **Receipts & Proof**
- **Digital Signatures**: Capture beneficiary signature on tablet/phone
- **Photo Proof**: Alternative to signature (photo of beneficiary receiving benefit)
- **Official Receipts**: Generate printable/downloadable receipts with:
  - Transaction number
  - Beneficiary details
  - Amount in numbers and words
  - Release timestamp and staff details
  - Program and event information

### 📊 **Dashboard & Reporting**
- **Real-Time Statistics**: 
  - Events by status (draft, scheduled, ongoing, completed)
  - Total transactions (pending, released)
  - Budget allocation and utilization
  - Release percentage
- **Role-Based Views**:
  - Admin: All barangays
  - Staff: Only their assigned barangay

---

## 🎭 User Roles

| Role | Capabilities | Restrictions |
|------|-------------|--------------|
| **Admin** | • Create/edit/delete distribution events<br>• Assign staff to events<br>• Publish distribution events<br>• View all events across all barangays<br>• Access all reports and statistics | • Cannot verify beneficiaries<br>• Cannot release benefits |
| **Staff / Barangay** | • View events in their barangay only<br>• Start/end distribution sessions<br>• Verify beneficiaries<br>• Release benefits<br>• Generate receipts | • Cannot access other barangays<br>• Cannot create/publish events<br>• Cannot edit event details |
| **Beneficiary** | • View their scheduled distributions<br>• Receive notifications<br>• View their receipts<br>• Download proof of receipt | • Cannot access other beneficiaries' data<br>• Cannot modify any records |

---

## 📋 Complete Workflow

### For Admin:

1. **Create Distribution Event** (status: `draft`)
   - Select benefit program
   - Select target barangay
   - Set distribution date and venue
   - Allocate budget
   - Set amount per beneficiary
   - Assign staff member

2. **Preview Eligible Beneficiaries**
   - System automatically loads eligible beneficiaries
   - Review count and budget requirements

3. **Publish Distribution Event**
   - System validates:
     - Staff is assigned ✓
     - Eligible beneficiaries exist ✓
     - Budget is sufficient ✓
   - Creates distribution batch (individual transactions)
   - Sends notifications to staff and beneficiaries
   - Status changes to `scheduled`

### For Staff:

1. **View Assigned Events** (auto-filtered to their barangay)

2. **Start Distribution Session** (status: `scheduled` → `ongoing`)

3. **Verify Beneficiary** (using RFID/QR/ID/Manual search)
   - System automatically validates:
     - Beneficiary is registered ✓
     - Beneficiary is approved ✓
     - Belongs to correct barangay ✓
     - Enrolled in program ✓
     - Has transaction in this event ✓
     - Benefit not yet claimed ✓
     - Event is active ✓

4. **Release Benefit**
   - Capture signature OR photo proof
   - Record verification method
   - System updates counters and statistics
   - Sends notification to beneficiary
   - Creates audit log

5. **End Distribution Session**
   - Auto-completes if all benefits released
   - Returns to `scheduled` if pending benefits remain

### For Beneficiary:

1. **Receive Notification** (automatic when event is published)

2. **Visit Distribution Venue** (on scheduled date)

3. **Present RFID/QR/ID** for verification

4. **Receive Benefit** and provide signature/thumbmark

5. **Get Receipt** (printed or digital)

---

## 🚀 Getting Started

### Prerequisites

- Node.js and npm installed
- MySQL database running
- Backend server configured

### Installation

The distribution module is already integrated into the EBMS backend. No additional installation required.

### Configuration

1. Ensure database migrations are applied:
   ```bash
   npm run migrate
   ```

2. The following tables are used:
   - `distribution_events` - Main event records
   - `distribution_transactions` - Individual beneficiary transactions
   - `benefit_programs` - Program definitions
   - `beneficiaries` - Beneficiary records
   - `enrollments` - Program enrollment records
   - `notifications` - Notification records
   - `audit_logs` - Audit trail

---

## 📚 Documentation

### Available Documentation Files:

1. **DISTRIBUTION_WORKFLOW.md** - Complete workflow documentation
   - Detailed explanation of each phase
   - Request/response examples for every endpoint
   - Error handling and validation rules
   - Security and access control details

2. **DISTRIBUTION_API_QUICK_REFERENCE.md** - Quick reference for developers
   - Quick start guide
   - Endpoint summaries with code examples
   - Common error codes
   - Frontend implementation tips

3. **test_distribution_workflow.js** - Automated testing script
   - Tests complete workflow end-to-end
   - Validates all endpoints
   - Generates test reports

---

## 🧪 Testing

### Manual Testing

Use the provided test endpoints document or Postman collection.

### Automated Testing

Run the automated test suite:

```bash
# 1. Update config in test_distribution_workflow.js:
#    - Set adminToken and staffToken
#    - Set programId, barangayId, staffId

# 2. Run tests:
node test_distribution_workflow.js
```

The test suite will:
- ✅ Create a distribution event
- ✅ Preview eligible beneficiaries
- ✅ Publish the event (with budget validation)
- ✅ Start distribution session
- ✅ Verify beneficiary
- ✅ Release benefit
- ✅ Prevent duplicate release
- ✅ Generate receipt
- ✅ End distribution session
- ✅ Generate dashboard statistics

---

## 📊 API Endpoints Summary

| Endpoint | Method | Role | Purpose |
|----------|--------|------|---------|
| `/distributions/events` | GET | All | List events |
| `/distributions/events` | POST | Admin | Create event |
| `/distributions/events/:id` | GET | All | Get event details |
| `/distributions/events/:id` | PUT | Admin | Edit draft event |
| `/distributions/events/:id` | DELETE | Admin | Delete draft event |
| `/distributions/events/:id/eligible-beneficiaries` | GET | Admin, Staff | Preview eligible beneficiaries |
| `/distributions/events/:id/publish` | POST | Admin | Publish event |
| `/distributions/events/:id/start-session` | POST | Staff | Start session |
| `/distributions/events/:id/end-session` | POST | Staff | End session |
| `/distributions/events/:id/transactions` | GET | All | List transactions |
| `/distributions/verify-beneficiary` | POST | Staff | Search & verify beneficiary |
| `/distributions/events/:id/transactions/:txnId/verify` | POST | Staff | Detailed verification |
| `/distributions/events/:id/transactions/:txnId/release` | POST | Staff | Release benefit |
| `/distributions/events/:id/receipt/:txnId` | GET | All | Generate receipt |
| `/distributions/dashboard/stats` | GET | Admin, Staff | Dashboard statistics |

---

## ⚠️ Common Issues & Solutions

### Issue: "Insufficient Budget" when publishing

**Cause**: Total required budget exceeds allocated budget

**Solution**: 
- Increase the `budget` field, OR
- Reduce `amount_per_beneficiary`, OR
- Reduce number of eligible beneficiaries (adjust enrollment)

**Formula**: `Total Required = Eligible Count × Amount Per Beneficiary`

---

### Issue: Staff cannot see any events

**Cause**: Staff user's `barangay_id` is not set or doesn't match event barangay

**Solution**: 
- Verify staff user has `barangay_id` set in user profile
- Ensure event's `barangay_id` matches staff's assigned barangay

---

### Issue: "Access Denied" when trying to release benefit

**Cause**: Staff trying to access event in different barangay

**Solution**: Staff can only access events where `event.barangay_id = staff.barangay_id`

---

### Issue: Cannot start distribution session

**Cause**: Event is not in `scheduled` status

**Solution**: 
- Event must be published first (status: `scheduled`)
- Only `scheduled` events can transition to `ongoing`

---

### Issue: "Benefit Already Claimed" error

**Cause**: Transaction status is already `released`

**Solution**: This is expected behavior. Check transaction history to see when benefit was released.

---

## 🔐 Security Features

### 1. **Role-Based Access Control (RBAC)**
- Middleware: `authorize(roles...)`
- Validates user role before allowing access

### 2. **Barangay-Level Restrictions**
- Middleware: `restrictToAssignedBarangay`
- Ensures staff can only access their barangay's data
- Admin has full access across all barangays

### 3. **Transaction Locks**
- Database-level locks prevent race conditions
- Prevents duplicate benefit releases

### 4. **Audit Logging**
- Every create, update, release action is logged
- Tracks: user_id, action, timestamp, details

### 5. **Input Validation**
- All endpoints validate required fields
- Budget calculations verified before publishing

---

## 📈 Performance Considerations

### Optimizations Implemented:

1. **Bulk Transaction Creation**: Uses `bulkCreate()` for batch processing
2. **Database Indexes**: Key foreign keys and status fields indexed
3. **Transaction Locks**: Prevents concurrent access issues
4. **Eager Loading**: Uses `include` to load associations efficiently

### Recommended Limits:

- **Max beneficiaries per event**: 1,000 (for optimal performance)
- **Concurrent staff sessions**: Unlimited (with proper barangay isolation)

---

## 🛠️ Maintenance

### Database Cleanup:

To archive old completed distributions:

```sql
UPDATE distribution_events 
SET status = 'archived' 
WHERE status = 'completed' 
AND completed_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

### Backup Recommendations:

- Daily backups of `distribution_events` and `distribution_transactions` tables
- Retain audit logs for at least 2 years
- Export receipts for long-term storage

---

## 📞 Support

For questions or issues:

1. Check the documentation files
2. Review the automated test script
3. Check audit logs for detailed error information
4. Contact system administrator

---

## 🎉 Features Checklist

- ✅ Role-based access control
- ✅ Barangay-level restrictions
- ✅ Automatic budget validation
- ✅ Batch transaction creation
- ✅ Multiple verification methods (RFID, QR, ID, Manual)
- ✅ Duplicate prevention
- ✅ Digital signatures and photo proof
- ✅ Automatic notifications
- ✅ Receipt generation
- ✅ Real-time statistics
- ✅ Complete audit trail
- ✅ Session management
- ✅ Dashboard with analytics

---

## 📝 Version History

**Version 1.0** - January 2026
- Initial implementation
- Complete workflow support
- All security features implemented
- Documentation completed

---

**Module**: Distribution Management  
**System**: EBMS (Electronic Beneficiary Management System)  
**Organization**: DSWD/MSWD  
**Last Updated**: January 2026
