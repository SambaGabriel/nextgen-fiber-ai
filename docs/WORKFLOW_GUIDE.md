# NextGen Fiber AI - Complete Workflow Guide

## Step-by-Step Process: Job Lifecycle

---

### PHASE 1: JOB CREATION (Admin/Supervisor)

```
1. Admin accesses Jobs Management
2. Clicks "New Job"
3. Fills in:
   - Job title (e.g., "Oak Ridge Fiber Run 01")
   - Client (MasTec, Brightspeed, etc.)
   - Location/Address
   - Work Type (Aerial, Underground, Overlash)
   - Estimated Footage
   - Upload Map/PDF
4. Assigns Lineman
5. Saves → Status: ASSIGNED
```

---

### PHASE 2: FIELD EXECUTION (Lineman)

```
1. Lineman sees job in "My Jobs" → Status: ASSIGNED
2. Clicks on job → JobDetails
3. Views:
   - Work map/PDF
   - Supervisor notes
   - AI Chat
4. Clicks "Enter Production" → Safety Checklist
5. Completes safety checklist
6. Status changes to: IN_PROGRESS
```

---

### PHASE 3: PRODUCTION (Lineman)

```
1. Lineman adds production entries:
   - Span (ft) - footage
   - Anchor (yes/no)
   - Fiber #
   - Coil (yes/no)
   - Snowshoe (yes/no)
   - Notes
2. Can add multiple rows
3. Takes photos of work (QuickCamera)
4. Clicks "Submit Production"
5. Status changes to: PRODUCTION_SUBMITTED → PENDING_REDLINES
```

---

### PHASE 4: REDLINES (Admin/Redline Specialist)

```
1. Admin/Specialist sees job with status PENDING_REDLINES
2. Opens JobDetails → sees "Pending Redlines" alert
3. Clicks "Upload New Version" in RedlinesPanel
4. Uploads redline PDF/image files
5. Adds internal notes (optional)
6. Clicks "Upload" → Creates version v1
7. Status changes to: REDLINE_UPLOADED
8. Clicks "Submit for Review"
9. Status changes to: UNDER_CLIENT_REVIEW
```

---

### PHASE 5: CLIENT REVIEW (Client Reviewer)

```
1. Client Reviewer accesses the system
2. Sees jobs "Under Client Review"
3. Opens JobDetails
4. Views:
   - Complete Production Data (entries table)
   - Redline files (download/view)
5. Clicks "Review" in RedlinesPanel
6. Chooses:

   A) APPROVE:
      - REQUIRED: Enter SR Number (e.g., SR-2024-0042)
      - Clicks "Approve"
      - Status: APPROVED
      - SR Number is saved to the job

   B) REJECT:
      - REQUIRED: Write rejection notes
      - Clicks "Reject"
      - Status: REJECTED
      - Specialist can upload new version (v2)
```

---

### PHASE 6: POST-APPROVAL

```
If APPROVED:
1. Job has SR Number assigned
2. Status: APPROVED → READY_TO_INVOICE
3. Job appears in billing dashboard
4. After invoicing: COMPLETED

If REJECTED:
1. Specialist sees rejection notes
2. Makes corrections
3. Uploads new version (v2, v3...)
4. Submits for review again
5. Repeats until approval
```

---

## Workflow Diagram

```
UNASSIGNED
    ↓ (assign lineman)
ASSIGNED
    ↓ (lineman starts)
IN_PROGRESS
    ↓ (submit production)
PRODUCTION_SUBMITTED → PENDING_REDLINES
    ↓ (upload redlines)
REDLINE_UPLOADED
    ↓ (submit for review)
UNDER_CLIENT_REVIEW
    ↓
    ├─→ APPROVED (with SR#) → READY_TO_INVOICE → COMPLETED
    │
    └─→ REJECTED → (new upload) → REDLINE_UPLOADED → ...
```

---

## Status Reference

| Status | Description | Next Action |
|--------|-------------|-------------|
| `UNASSIGNED` | Job created, no lineman assigned | Admin assigns lineman |
| `ASSIGNED` | Lineman assigned, ready to start | Lineman starts work |
| `IN_PROGRESS` | Lineman actively working | Lineman submits production |
| `PRODUCTION_SUBMITTED` | Production data submitted | System auto-transitions |
| `PENDING_REDLINES` | Awaiting redline upload | Specialist uploads redlines |
| `REDLINE_UPLOADED` | Redlines uploaded, not yet submitted | Specialist submits for review |
| `UNDER_CLIENT_REVIEW` | Client reviewing redlines | Client approves or rejects |
| `APPROVED` | Client approved with SR# | Ready for invoicing |
| `REJECTED` | Client rejected with notes | Specialist uploads new version |
| `READY_TO_INVOICE` | Approved, pending invoice | Billing processes |
| `COMPLETED` | Job fully completed | Archive |

---

## Important Business Rules

### 1. SR Number Requirement
- **SR Number is REQUIRED to approve**
- Client Reviewer cannot approve without entering an SR Number
- Example format: `SR-2024-0042`

### 2. Rejection Notes Requirement
- **Rejection notes are REQUIRED**
- Must explain what needs to be fixed
- Visible to Specialist for corrections

### 3. Version Immutability
- Once a redline version (v1) is created, it **cannot be edited**
- Corrections require creating a new version (v2, v3, etc.)
- All versions are preserved for audit trail

### 4. Complete Audit Trail
- All actions are logged with:
  - User ID and name
  - Timestamp
  - Action type
  - Notes/comments

---

## Role Permissions

| Action | Admin | Supervisor | Redline Specialist | Client Reviewer | Lineman |
|--------|-------|------------|-------------------|-----------------|---------|
| Create Jobs | ✓ | ✓ | - | - | - |
| Assign Lineman | ✓ | ✓ | - | - | - |
| View All Jobs | ✓ | ✓ | ✓ | Scoped | Own |
| Submit Production | - | - | - | - | ✓ |
| Upload Redlines | ✓ | ✓ | ✓ | - | - |
| Submit for Review | ✓ | ✓ | ✓ | - | - |
| Approve/Reject | ✓ | - | - | ✓ | - |
| View Rate Cards | ✓ | ✓ | - | - | - |

---

## Key Components

### JobDetails Page
- **Map/Document Preview**: View and download job map/PDF
- **Production Data Card**: Full entries table with all submitted data
- **Redlines Panel**: Upload versions, submit for review, approve/reject

### Production Entry Fields
| Field | Type | Description |
|-------|------|-------------|
| Span (ft) | Number | Footage for this span |
| Anchor | Boolean | Anchor installed |
| Fiber # | Text | Fiber identification number |
| Coil | Boolean | Coil installed |
| Snowshoe | Boolean | Snowshoe installed |
| Notes | Text | Additional notes |

---

## Database Tables

- `jobs` - Main job records with status tracking
- `job_redline_versions` - Versioned redline uploads
- `job_redline_files` - Files attached to each version
- `job_redline_reviews` - Audit log of review actions

---

*Last Updated: February 2026*
