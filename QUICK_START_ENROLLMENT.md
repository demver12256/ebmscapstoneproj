# Quick Start: Program Enrollment Workflow

## Mabilis na Gabay (Quick Guide)

### 1️⃣ Gumawa ng Program (Create Program)
```
Programs → Create Program
```
- Fill in details
- Select barangay
- Select category
- Click "Create Program"
- ✅ Program saved (WALANG auto-enrollment)

### 2️⃣ Mag-enroll ng Beneficiaries
```
Programs → Click program name → Enroll Beneficiaries
```
- System shows eligible beneficiaries only
- Search/filter kung kailangan
- Select beneficiaries (checkbox)
- Click "Enroll X Selected"
- ✅ Beneficiaries enrolled

### 3️⃣ Gumawa ng Distribution
```
Distributions → Create Event
```
- Select program
- System auto-loads enrolled beneficiaries
- Set date, venue, amount
- Assign staff
- Publish event
- ✅ Distribution created for enrolled beneficiaries

### 4️⃣ Magdagdag pa ng Beneficiaries (Later)
```
Programs → Click program name → Enroll Beneficiaries
```
- Select new beneficiaries
- Click "Enroll X Selected"
- ✅ New beneficiaries included in future distributions

---

## API Quick Reference

### Get Enrolled Beneficiaries
```bash
GET /api/programs/:id/beneficiaries
Authorization: Bearer <token>
```

### Enroll Beneficiaries
```bash
POST /api/programs/:id/enroll
Authorization: Bearer <token>
Content-Type: application/json

{
  "beneficiary_ids": [1, 2, 3, 4, 5]
}
```

### Count Eligible (Draft Distribution)
```bash
GET /api/distributions/events/:id/count-eligible
Authorization: Bearer <token>
```

---

## Eligibility Rules

Ang beneficiary ay **qualified** kung:
1. ✅ Status: **Approved**
2. ✅ Barangay: **Same as program**
3. ✅ Category: **Matches program** (if specified)
4. ✅ NOT yet enrolled in the program

---

## Common Scenarios

### Scenario 1: Create Medical Assistance Program
```
1. Create program "Medical Assistance"
2. Category: "Senior Citizens"
3. Barangay: "Anilao Proper"
4. Program saved → 0 enrolled
5. Click "Enroll Beneficiaries"
6. System shows only:
   - Approved Senior Citizens
   - In Anilao Proper
   - Not yet enrolled
7. Select 10 beneficiaries → Enroll
8. Result: 10 beneficiaries enrolled
```

### Scenario 2: Create Distribution for Enrolled Beneficiaries
```
1. Create distribution event
2. Program: "Medical Assistance"
3. Barangay: "Anilao Proper"
4. System auto-loads: 10 enrolled beneficiaries
5. Amount: ₱1,000 per beneficiary
6. Budget needed: ₱10,000
7. Publish → 10 transactions created
```

### Scenario 3: Add More Beneficiaries Later
```
1. New Senior Citizen approved
2. Go to "Medical Assistance" program
3. Click "Enroll Beneficiaries"
4. New beneficiary appears in eligible list
5. Select and enroll
6. Result: Now 11 enrolled
7. Future distributions will include all 11
```

### Scenario 4: Prevent Duplicate Enrollment
```
1. Try to enroll same beneficiary again
2. System shows: "Already enrolled"
3. Cannot select (already filtered out)
4. Backend prevents if bypassed
5. Database constraint as final safeguard
```

---

## Testing

### Run Test Script
```bash
cd backend
node test_enrollment_workflow.js
```

### Manual Testing Checklist
- [ ] Create program → Verify 0 enrollments
- [ ] Open program details → See enrolled table (empty)
- [ ] Click "Enroll Beneficiaries" → See eligible beneficiaries
- [ ] Select and enroll → Verify enrolled count increased
- [ ] Try duplicate enrollment → Verify prevented
- [ ] Create distribution → Verify auto-uses enrolled beneficiaries
- [ ] Publish distribution → Verify transactions created for enrolled only
- [ ] Add new beneficiary → Verify appears in eligible list

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No eligible beneficiaries | Check: Approved status, correct barangay, matching category |
| Cannot enroll (already enrolled) | Expected! Preventing duplicates. Check enrolled table |
| Distribution shows 0 beneficiaries | Enroll beneficiaries first in program |
| Budget insufficient | Reduce beneficiaries or increase budget |
| Cannot publish distribution | Assign staff first |

---

## Files Reference

| File | Purpose |
|------|---------|
| `backend/routes/programs.js` | Enrollment API endpoints |
| `backend/routes/distributions.js` | Distribution integration |
| `frontend/src/pages/ProgramDetailsPage.jsx` | Enrollment UI |
| `frontend/src/pages/ProgramListPage.jsx` | Program list with links |
| `frontend/src/services/api.js` | API methods |

---

## Status: ✅ COMPLETE

All features implemented and tested! 🎉
