# Qualified Beneficiaries Fix - Distribution Management

## Problem
Ang staff ay nakikita ang **0 Total Beneficiaries** sa distribution events kahit may mga qualified beneficiaries. Ang beneficiaries ay hindi nalalabas sa distribution page ng staff.

### Root Cause
- Ang `total_beneficiaries` count ay nagiging 0 para sa **Draft** events
- Ang eligible beneficiaries ay nagiging kumpletong counted lang kapag ang event ay **published**
- Staff na nag-view ng draft event ay walang makikita na beneficiaries para ma-verify kung ilan ang matatanggap

## Solution Implemented

### 1. New Backend Endpoint: `GET /events/:id/count-eligible`
**File**: `backend/routes/distributions.js`

Added a new endpoint na nag-calculate ng eligible beneficiaries count para sa draft events:

```javascript
router.get('/events/:id/count-eligible', authorize('admin', 'staff', 'barangay'), restrictToAssignedBarangay, async (req, res, next) => {
  // Counts eligible beneficiaries based on:
  // - Program enrollment status
  // - Beneficiary approval status
  // - Category matching (if target_category is specified)
  // - Barangay assignment
  
  // Returns:
  // - eligible_count: Number of qualified beneficiaries
  // - budget_sufficient: Whether budget covers all beneficiaries
  // - budget_deficit: Amount needed if budget is insufficient
  // - total_required: Total amount needed for all eligible beneficiaries
});
```

### 2. Frontend API Method: `distributionApi.getEligibleCount()`
**File**: `frontend/src/services/api.js`

Added method to call the new endpoint:
```javascript
getEligibleCount: (id) => apiClient.get(`/distributions/events/${id}/count-eligible`)
```

### 3. Updated Distribution Details Modal
**File**: `frontend/src/pages/DistributionPage.jsx`

Modified `handleViewDetails()` function na:
- Checks kung draft event with 0 beneficiaries
- Calls new `getEligibleCount` endpoint para sa preview
- Displays eligible count sa modal kahit sa draft status
- Shows indicator na "Preview (will be finalized on publish)"

## How It Works

### Step 1: Staff Views Draft Event
- Staff opens distribution event details
- Backend checks event status at total_beneficiaries count

### Step 2: System Calculates Eligible Beneficiaries
- Para sa draft events, system automatically calls `count-eligible` endpoint
- Endpoint queries database para sa:
  - Active enrollments sa program
  - Approved beneficiaries sa correct barangay
  - Matching category (if specified)

### Step 3: Staff Sees Preview
- Modal displays eligible beneficiary count
- Staff makikita kung gaano karaming beneficiaries ang makakakuha ng benefits
- Shows budget validation info

### Step 4: Staff Publishes Event
- When admin publishes, eligible beneficiaries ay finalized
- Transactions ay na-create para sa each qualified beneficiary
- Status changes from "draft" to "scheduled"

## Qualification Criteria

Ang isang beneficiary ay "qualified" kung:

1. ✅ **Status**: Approved
2. ✅ **Barangay**: Match sa distribution event's barangay
3. ✅ **Program Enrollment**: Active enrollment sa selected program
4. ✅ **Category Match**: 
   - If event has `target_category` → Must match target category
   - If program has `eligibility_category` → Must match program category
   - If neither specified → All categories eligible

## Testing

### To test the new endpoint:

```bash
# Get a draft event
GET /distributions/events?status=draft

# Get eligible count for that event
GET /distributions/events/:id/count-eligible

# Response example:
{
  "success": true,
  "data": {
    "event_id": 66,
    "program_name": "Education Grant",
    "eligible_count": 45,
    "amount_per_beneficiary": 1500,
    "total_required": 67500,
    "available_budget": 75000,
    "budget_sufficient": true,
    "budget_deficit": 0
  }
}
```

## Files Changed

1. **Backend**
   - `routes/distributions.js` - Added new endpoint

2. **Frontend**
   - `services/api.js` - Added API method
   - `pages/DistributionPage.jsx` - Updated modal logic

## Expected Behavior After Fix

### Before:
- Staff views draft event → Sees "0 Total Beneficiaries"
- No information about how many people will receive benefits

### After:
- Staff views draft event → Sees actual eligible beneficiary count
- Shows "📋 Preview (will be finalized on publish)" indicator
- Budget validation info displayed
- When published → Actual count confirmed and finalized

## Benefits

✅ Staff nakakakita ng realistic count bago mag-publish
✅ Budget validation before creating transactions  
✅ Better planning at monitoring ng distributions
✅ Reduced errors from publishing with wrong assumptions
✅ Clear feedback na count ay preview lang hanggang sa publish
