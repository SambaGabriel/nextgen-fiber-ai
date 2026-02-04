# NextGen Fiber - Billing API Contracts

## Base URL
```
/api/v1/billing
```

## Authentication
All requests require `Authorization: Bearer <token>` header.
Permissions are enforced per endpoint based on user role.

---

## 1. PRODUCTION LINES

### GET /production-lines
List production lines with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| pageSize | number | Items per page (default: 50, max: 200) |
| sortBy | string | Field to sort by |
| sortOrder | 'asc' \| 'desc' | Sort direction |
| projectId | string | Filter by project |
| primeContractor | string | Filter by prime/customer |
| crewId | string | Filter by crew |
| status | string[] | Filter by status(es) |
| workDateFrom | string | ISO date |
| workDateTo | string | ISO date |
| hasEvidence | boolean | Only lines with evidence |
| complianceScoreMin | number | Minimum score (0-100) |
| searchQuery | string | Search job ID, description |
| notInvoiced | boolean | Only non-invoiced lines |

**Request Example:**
```
GET /api/v1/billing/production-lines?projectId=PROJ-001&status=READY_TO_INVOICE&notInvoiced=true&page=1&pageSize=50
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "line_abc123",
      "externalId": "SS-ROW-456",
      "sourceSystem": "smartsheet",
      "jobId": "JOB-2024-0001",
      "description": "Install 288F Aerial - Main St to Oak Ave",
      "quantity": 1250,
      "unit": "FT",
      "projectId": "PROJ-001",
      "projectName": "Spectrum Loudoun Phase 2",
      "primeContractor": "Spectrum",
      "crewId": "CREW-A",
      "crewName": "Potomac Valley Utility",
      "workDate": "2024-01-15",
      "completedDate": "2024-01-15",
      "location": {
        "latitude": 39.0458,
        "longitude": -77.4875,
        "address": "Main St & Oak Ave, Leesburg VA",
        "poleId": "P-30054"
      },
      "workType": "AERIAL",
      "activityCode": "FIBER-288-AERIAL",
      "status": "READY_TO_INVOICE",
      "statusChangedAt": "2024-01-16T10:30:00Z",
      "statusChangedBy": "user_reviewer1",
      "evidenceCount": 3,
      "hasRequiredEvidence": true,
      "billingLineItemId": "LI-AERIAL-288",
      "billingLineItemDescription": "Aerial Fiber Installation - 288F",
      "appliedRateCardId": "RC-SPECTRUM-001",
      "appliedRateCardVersion": 2,
      "appliedRate": 0.42,
      "extendedAmount": 525.00,
      "validationResults": [
        {
          "id": "val_001",
          "ruleId": "EVIDENCE_REQUIRED",
          "ruleName": "Required Evidence Check",
          "passed": true,
          "severity": "ERROR",
          "message": "All required evidence present",
          "checkedAt": "2024-01-16T10:30:00Z"
        }
      ],
      "complianceScore": 95,
      "flags": [],
      "createdAt": "2024-01-15T18:00:00Z",
      "updatedAt": "2024-01-16T10:30:00Z",
      "syncedAt": "2024-01-16T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 234,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### GET /production-lines/:id
Get single production line with full details.

**Response (200):**
```json
{
  "id": "line_abc123",
  "externalId": "SS-ROW-456",
  "sourceSystem": "smartsheet",
  "jobId": "JOB-2024-0001",
  "description": "Install 288F Aerial - Main St to Oak Ave",
  "quantity": 1250,
  "unit": "FT",
  "projectId": "PROJ-001",
  "projectName": "Spectrum Loudoun Phase 2",
  "primeContractor": "Spectrum",
  "crewId": "CREW-A",
  "crewName": "Potomac Valley Utility",
  "workDate": "2024-01-15",
  "completedDate": "2024-01-15",
  "location": {
    "latitude": 39.0458,
    "longitude": -77.4875,
    "address": "Main St & Oak Ave, Leesburg VA",
    "poleId": "P-30054"
  },
  "workType": "AERIAL",
  "activityCode": "FIBER-288-AERIAL",
  "status": "READY_TO_INVOICE",
  "statusChangedAt": "2024-01-16T10:30:00Z",
  "statusChangedBy": "user_reviewer1",
  "evidenceAssets": [
    {
      "id": "ev_001",
      "type": "PHOTO",
      "filename": "pole_installation_001.jpg",
      "mimeType": "image/jpeg",
      "fileSize": 2456789,
      "url": "https://storage.example.com/evidence/ev_001.jpg?signed=xxx",
      "thumbnailUrl": "https://storage.example.com/evidence/ev_001_thumb.jpg?signed=xxx",
      "metadata": {
        "latitude": 39.0458,
        "longitude": -77.4875,
        "capturedAt": "2024-01-15T14:30:00Z",
        "deviceModel": "iPhone 14 Pro"
      },
      "uploadedBy": "user_field1",
      "uploadedAt": "2024-01-15T16:00:00Z",
      "isVerified": true,
      "verifiedBy": "user_reviewer1",
      "verifiedAt": "2024-01-16T10:00:00Z"
    }
  ],
  "evidenceCount": 3,
  "hasRequiredEvidence": true,
  "billingLineItemId": "LI-AERIAL-288",
  "billingLineItemDescription": "Aerial Fiber Installation - 288F",
  "appliedRateCardId": "RC-SPECTRUM-001",
  "appliedRateCardVersion": 2,
  "appliedRate": 0.42,
  "extendedAmount": 525.00,
  "validationResults": [
    {
      "id": "val_001",
      "ruleId": "EVIDENCE_REQUIRED",
      "ruleName": "Required Evidence Check",
      "passed": true,
      "severity": "ERROR",
      "message": "All required evidence present",
      "checkedAt": "2024-01-16T10:30:00Z"
    },
    {
      "id": "val_002",
      "ruleId": "QTY_RANGE",
      "ruleName": "Quantity Range Check",
      "passed": true,
      "severity": "WARNING",
      "message": "Quantity within normal range",
      "checkedAt": "2024-01-16T10:30:00Z"
    }
  ],
  "complianceScore": 95,
  "flags": [],
  "createdAt": "2024-01-15T18:00:00Z",
  "updatedAt": "2024-01-16T10:30:00Z",
  "syncedAt": "2024-01-16T08:00:00Z"
}
```

---

### PATCH /production-lines/:id
Update production line (status, mapping, overrides).

**Request Body:**
```json
{
  "status": "REVIEWED",
  "billingLineItemId": "LI-AERIAL-288",
  "appliedRateCardId": "RC-SPECTRUM-001",
  "reason": "Reviewed and approved for billing"
}
```

**Request Body (with rate override - requires BILLING/ADMIN role):**
```json
{
  "rateOverride": {
    "rate": 0.45,
    "reason": "Premium rate approved per change order CO-2024-003"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { /* updated ProductionLine */ },
  "auditEventId": "audit_xyz789"
}
```

---

### POST /production-lines/:id/reject
Reject a production line with reason.

**Request Body:**
```json
{
  "reason": "EVIDENCE_MISMATCH",
  "details": "Photo shows wrong pole number. Expected P-30054, photo shows P-30055.",
  "createTask": true,
  "assignTo": "user_field1"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { /* updated ProductionLine with status REJECTED */ },
  "taskId": "task_001"
}
```

---

## 2. INVOICE BATCHES

### POST /invoice-batches
Create new invoice batch (draft).

**Request Body:**
```json
{
  "primeContractor": "Spectrum",
  "projectId": "PROJ-001",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-15",
  "lineIds": ["line_abc123", "line_def456", "line_ghi789"],
  "paymentTerms": "NET30",
  "internalNotes": "First half of January production"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "batch_001",
    "batchNumber": "B-2024-0001",
    "primeContractor": "Spectrum",
    "projectId": "PROJ-001",
    "projectName": "Spectrum Loudoun Phase 2",
    "periodStart": "2024-01-01",
    "periodEnd": "2024-01-15",
    "status": "DRAFT",
    "lineIds": ["line_abc123", "line_def456", "line_ghi789"],
    "lineItems": [
      {
        "lineItemCode": "LI-AERIAL-288",
        "description": "Aerial Fiber Installation - 288F",
        "unit": "FT",
        "totalQty": 3750,
        "rate": 0.42,
        "extendedAmount": 1575.00,
        "evidenceCount": 9,
        "complianceScore": 93,
        "hasIssues": false
      },
      {
        "lineItemCode": "LI-ANCHOR",
        "description": "Anchor Assembly",
        "unit": "EA",
        "totalQty": 5,
        "rate": 18.00,
        "extendedAmount": 90.00,
        "evidenceCount": 5,
        "complianceScore": 100,
        "hasIssues": false
      }
    ],
    "subtotal": 1665.00,
    "deductions": [],
    "deductionsTotal": 0,
    "total": 1665.00,
    "packageReadiness": {
      "isReady": false,
      "score": 85,
      "checklist": [
        {
          "id": "chk_001",
          "requirement": "All lines have required evidence",
          "category": "EVIDENCE",
          "isRequired": true,
          "isPassed": true
        },
        {
          "id": "chk_002",
          "requirement": "Cover letter attached",
          "category": "DOCUMENTATION",
          "isRequired": true,
          "isPassed": false,
          "message": "Cover letter not yet attached"
        }
      ]
    },
    "createdBy": "user_billing1",
    "createdAt": "2024-01-16T12:00:00Z",
    "updatedAt": "2024-01-16T12:00:00Z"
  }
}
```

---

### GET /invoice-batches/:id
Get full batch details.

**Response (200):**
```json
{
  "id": "batch_001",
  "batchNumber": "B-2024-0001",
  "invoiceNumber": null,
  "primeContractor": "Spectrum",
  "projectId": "PROJ-001",
  "projectName": "Spectrum Loudoun Phase 2",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-01-15",
  "status": "DRAFT",
  "statusHistory": [
    {
      "from": null,
      "to": "DRAFT",
      "changedBy": "user_billing1",
      "changedAt": "2024-01-16T12:00:00Z"
    }
  ],
  "lineIds": ["line_abc123", "line_def456", "line_ghi789"],
  "lineItems": [
    {
      "lineItemCode": "LI-AERIAL-288",
      "description": "Aerial Fiber Installation - 288F",
      "unit": "FT",
      "totalQty": 3750,
      "qtyBreakdown": [
        { "lineId": "line_abc123", "jobId": "JOB-2024-0001", "qty": 1250, "workDate": "2024-01-15" },
        { "lineId": "line_def456", "jobId": "JOB-2024-0002", "qty": 1500, "workDate": "2024-01-14" },
        { "lineId": "line_ghi789", "jobId": "JOB-2024-0003", "qty": 1000, "workDate": "2024-01-13" }
      ],
      "rate": 0.42,
      "rateCardId": "RC-SPECTRUM-001",
      "rateCardVersion": 2,
      "extendedAmount": 1575.00,
      "evidenceCount": 9,
      "evidenceLinks": [
        "https://storage.example.com/evidence/ev_001.jpg",
        "https://storage.example.com/evidence/ev_002.jpg"
      ],
      "complianceScore": 93,
      "hasIssues": false
    }
  ],
  "subtotal": 1665.00,
  "deductions": [],
  "deductionsTotal": 0,
  "retainagePercent": 5,
  "retainageAmount": 83.25,
  "total": 1581.75,
  "packageReadiness": {
    "isReady": false,
    "score": 85,
    "checklist": [
      {
        "id": "chk_001",
        "requirement": "All lines have required evidence",
        "category": "EVIDENCE",
        "isRequired": true,
        "isPassed": true
      }
    ]
  },
  "attachments": [],
  "paymentTerms": "NET30",
  "internalNotes": "First half of January production",
  "createdBy": "user_billing1",
  "createdAt": "2024-01-16T12:00:00Z",
  "updatedAt": "2024-01-16T12:00:00Z"
}
```

---

### PATCH /invoice-batches/:id
Update batch (add/remove lines, notes, attachments).

**Request Body:**
```json
{
  "lineIds": ["line_abc123", "line_def456", "line_ghi789", "line_jkl012"],
  "customerNotes": "Please reference PO# 12345",
  "attachmentIds": ["att_001"]
}
```

---

### POST /invoice-batches/:id/submit
Submit batch for customer approval. Freezes rate cards.

**Request Body:**
```json
{
  "invoiceNumber": "INV-2024-0001",
  "customerNotes": "January 1-15 production per contract terms"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "batch_001",
    "status": "SUBMITTED",
    "invoiceNumber": "INV-2024-0001",
    "submittedAt": "2024-01-16T14:00:00Z",
    "submittedBy": "user_billing1",
    "dueDate": "2024-02-15",
    "frozenRateCards": [
      {
        "rateCardId": "RC-SPECTRUM-001",
        "version": 2,
        "frozenAt": "2024-01-16T14:00:00Z",
        "rates": [/* full rate card snapshot */]
      }
    ],
    "packageUrl": "https://storage.example.com/packages/INV-2024-0001.pdf"
  }
}
```

---

### POST /invoice-batches/:id/record-payment
Record payment received.

**Request Body:**
```json
{
  "paidAmount": 1581.75,
  "paidAt": "2024-02-10",
  "paymentReference": "CHECK-98765",
  "notes": "Full payment received"
}
```

---

### POST /invoice-batches/:id/add-deduction
Add deduction to batch.

**Request Body:**
```json
{
  "category": "RETAINAGE",
  "description": "5% retainage per contract",
  "percentage": 5,
  "reason": "Standard contract terms"
}
```

---

## 3. RATE CARDS

### GET /rate-cards
List rate cards.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| primeContractor | string | Filter by prime |
| projectId | string | Filter by project |
| isActive | boolean | Only active cards |
| effectiveOn | string | Cards effective on date |

**Response (200):**
```json
{
  "data": [
    {
      "id": "RC-SPECTRUM-001",
      "name": "Spectrum Standard Rates 2024",
      "description": "Standard rates for Spectrum projects",
      "primeContractor": "Spectrum",
      "projectId": null,
      "region": null,
      "currentVersion": 2,
      "effectiveFrom": "2024-01-01",
      "effectiveTo": null,
      "isActive": true,
      "createdBy": "user_admin1",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-10T00:00:00Z"
    }
  ]
}
```

---

### GET /rate-cards/:id
Get rate card with current version rates.

**Response (200):**
```json
{
  "id": "RC-SPECTRUM-001",
  "name": "Spectrum Standard Rates 2024",
  "description": "Standard rates for Spectrum projects",
  "primeContractor": "Spectrum",
  "currentVersion": 2,
  "versions": [
    {
      "version": 2,
      "rates": [
        {
          "id": "rate_001",
          "lineItemCode": "LI-AERIAL-288",
          "description": "Aerial Fiber Installation - 288F",
          "unit": "FT",
          "rate": 0.42,
          "minQty": null,
          "maxQty": null
        },
        {
          "id": "rate_002",
          "lineItemCode": "LI-ANCHOR",
          "description": "Anchor Assembly",
          "unit": "EA",
          "rate": 18.00
        }
      ],
      "effectiveFrom": "2024-01-10",
      "createdBy": "user_admin1",
      "createdAt": "2024-01-10T00:00:00Z",
      "changeNotes": "Updated aerial rates per contract amendment"
    },
    {
      "version": 1,
      "rates": [/* previous rates */],
      "effectiveFrom": "2024-01-01",
      "effectiveTo": "2024-01-09",
      "createdBy": "user_admin1",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "effectiveFrom": "2024-01-01",
  "isActive": true
}
```

---

### POST /rate-cards
Create new rate card.

**Request Body:**
```json
{
  "name": "Spectrum Standard Rates 2024",
  "description": "Standard rates for Spectrum projects",
  "primeContractor": "Spectrum",
  "effectiveFrom": "2024-01-01",
  "rates": [
    {
      "lineItemCode": "LI-AERIAL-288",
      "description": "Aerial Fiber Installation - 288F",
      "unit": "FT",
      "rate": 0.40
    },
    {
      "lineItemCode": "LI-ANCHOR",
      "description": "Anchor Assembly",
      "unit": "EA",
      "rate": 18.00
    }
  ]
}
```

---

### POST /rate-cards/:id/versions
Create new version of rate card.

**Request Body:**
```json
{
  "rates": [
    {
      "lineItemCode": "LI-AERIAL-288",
      "description": "Aerial Fiber Installation - 288F",
      "unit": "FT",
      "rate": 0.42
    }
  ],
  "effectiveFrom": "2024-01-10",
  "changeNotes": "Updated aerial rates per contract amendment CA-2024-001"
}
```

---

## 4. VALIDATION

### POST /validation/run
Run validations on entities.

**Request Body:**
```json
{
  "entityType": "ProductionLine",
  "entityIds": ["line_abc123", "line_def456"],
  "ruleIds": ["EVIDENCE_REQUIRED", "QTY_RANGE", "DUPLICATE_CHECK"]
}
```

**Response (200):**
```json
{
  "results": [
    {
      "entityId": "line_abc123",
      "results": [
        {
          "id": "val_001",
          "ruleId": "EVIDENCE_REQUIRED",
          "ruleName": "Required Evidence Check",
          "passed": true,
          "severity": "ERROR",
          "message": "All required evidence present"
        },
        {
          "id": "val_002",
          "ruleId": "QTY_RANGE",
          "ruleName": "Quantity Range Check",
          "passed": true,
          "severity": "WARNING",
          "message": "Quantity 1250 FT is within normal range (100-5000)"
        }
      ],
      "complianceScore": {
        "overall": 95,
        "breakdown": {
          "evidenceScore": 100,
          "completenessScore": 90,
          "consistencyScore": 95,
          "timelinessScore": 95
        },
        "passingThreshold": 80,
        "isPassing": true
      },
      "canProceed": true
    }
  ]
}
```

---

## 5. AUDIT EVENTS

### POST /audit-events
Record audit event (called by frontend on significant actions).

**Request Body:**
```json
{
  "eventType": "LINE_QTY_ADJUSTED",
  "entityType": "ProductionLine",
  "entityId": "line_abc123",
  "previousValue": { "quantity": 1200 },
  "newValue": { "quantity": 1250 },
  "changedFields": ["quantity"],
  "reason": "Corrected based on field supervisor measurement"
}
```

**Response (201):**
```json
{
  "id": "audit_xyz789",
  "eventType": "LINE_QTY_ADJUSTED",
  "entityType": "ProductionLine",
  "entityId": "line_abc123",
  "performedBy": "user_reviewer1",
  "performedAt": "2024-01-16T10:30:00Z"
}
```

---

### GET /audit-events
Query audit trail.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| entityType | string | Filter by entity type |
| entityId | string | Filter by entity ID |
| eventType | string | Filter by event type |
| performedBy | string | Filter by user |
| from | string | ISO datetime |
| to | string | ISO datetime |

---

## 6. REPORTS

### GET /reports/aging
Get AR aging report.

**Response (200):**
```json
{
  "asOf": "2024-01-16",
  "summary": {
    "total": 125000.00,
    "buckets": {
      "0-30": 75000.00,
      "31-60": 30000.00,
      "61-90": 15000.00,
      "90+": 5000.00
    }
  },
  "entries": [
    {
      "invoiceBatchId": "batch_001",
      "invoiceNumber": "INV-2024-0001",
      "primeContractor": "Spectrum",
      "projectName": "Loudoun Phase 2",
      "invoiceAmount": 1581.75,
      "submittedAt": "2024-01-16",
      "dueDate": "2024-02-15",
      "status": "SUBMITTED",
      "daysOutstanding": 0,
      "agingBucket": "0-30"
    }
  ]
}
```

---

### GET /reports/rejections
Get rejection summary.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| from | string | Start date |
| to | string | End date |
| primeContractor | string | Filter by prime |

**Response (200):**
```json
{
  "period": {
    "from": "2024-01-01",
    "to": "2024-01-16"
  },
  "summary": {
    "totalRejections": 5,
    "totalAmount": 12500.00,
    "resolvedCount": 3,
    "pendingCount": 2,
    "byReason": {
      "MISSING_EVIDENCE": 2,
      "QTY_DISPUTE": 2,
      "DOCUMENTATION_ISSUE": 1
    }
  },
  "records": [/* RejectionRecord[] */]
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Cannot submit batch with validation errors",
    "details": [
      { "field": "lineIds[0]", "message": "Line has missing required evidence" }
    ],
    "requestId": "req_abc123"
  }
}
```

**Common Error Codes:**
- `VALIDATION_FAILED` - Input validation failed
- `NOT_FOUND` - Entity not found
- `FORBIDDEN` - User lacks permission
- `CONFLICT` - State conflict (e.g., line already invoiced)
- `INVALID_STATE` - Cannot perform action in current state
