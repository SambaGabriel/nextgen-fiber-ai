/**
 * Payroll Types
 * NextGen Fiber AI - CRM Completo + AI Agent Ready
 */

// =====================================================
// PAY PERIOD TYPES
// =====================================================

export interface PayPeriod {
  id: string;
  weekKey: string;              // '2026-02-03' (Monday)
  weekNumber: number;
  weekStart: string;            // ISO date
  weekEnd: string;              // ISO date
  payDate: string;              // Expected payment date
  status: 'open' | 'processing' | 'paid';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PayPeriodSummary extends PayPeriod {
  totalPayroll: number;
  totalInvestorReturns: number;
  recordsCount: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
}

// =====================================================
// PAYROLL RECORD TYPES
// =====================================================

export type PayrollStatus = 'pending' | 'approved' | 'paid' | 'disputed';

export interface PayrollRecord {
  id: string;
  payPeriodId: string;
  userId: string;
  userName: string;
  userRole: string;

  // Calculated totals
  totalAmount: number;
  jobsCount: number;
  totalFootage: number;

  // Breakdown
  breakdown: PayrollBreakdown;

  // Status tracking
  status: PayrollStatus;
  approvedAt?: string;
  approvedBy?: string;
  paidAt?: string;
  paidBy?: string;
  paymentReference?: string;

  // Dispute
  disputedAt?: string;
  disputeReason?: string;
  disputeResolvedAt?: string;

  createdAt: string;
  updatedAt?: string;
}

export interface PayrollBreakdown {
  byJob: JobPayBreakdown[];
  byWorkType: WorkTypeBreakdown[];
  foremanDetails?: ForemanPayDetails;
}

export interface JobPayBreakdown {
  jobId: string;
  jobCode: string;
  clientName: string;
  customerName: string;
  footage: number;
  amount: number;
  completedDate: string;
}

export interface WorkTypeBreakdown {
  type: 'aerial' | 'underground';
  amount: number;
  percentage: number;
  footage: number;
}

// =====================================================
// FOREMAN PAY TYPES (Underground)
// =====================================================

export interface ForemanPayDetails {
  // Day counts
  fullDays: number;
  halfDays: number;

  // Conduit work
  conduitFeet: number;
  conduitRate: number;          // 0.25 if <=500, 0.30 if >500

  // Bonus
  weeklyBonus: boolean;         // true if week total >= 4000
  bonusThreshold: number;       // 4000

  // Calculated amounts
  dayPay: number;               // (fullDays * 300) + (halfDays * 150)
  conduitPay: number;           // conduitFeet * conduitRate
  bonusPay: number;             // 300 if weeklyBonus, else 0
  totalPay: number;             // dayPay + conduitPay + bonusPay
}

// Foreman pay constants
export const FOREMAN_PAY_RATES = {
  fullDay: 300,
  halfDay: 150,
  conduitLte500: 0.25,          // Rate for first 500 feet
  conduitGt500: 0.30,           // Rate for feet above 500
  weeklyBonusThreshold: 4000,   // Weekly footage threshold for bonus
  weeklyBonus: 300              // Bonus amount
} as const;

// =====================================================
// INVESTOR RETURN TYPES
// =====================================================

export interface InvestorReturn {
  id: string;
  payPeriodId: string;
  investorId: string;
  investorName: string;
  investorType: 'truck' | 'drill';

  // Equipment info
  equipmentId: string;
  equipmentLabel: string;

  // Calculated totals
  totalReturns: number;
  jobsCount: number;
  totalFootage: number;

  // Breakdown
  breakdown: InvestorBreakdown;

  // Status
  status: 'pending' | 'approved' | 'paid';
  paidAt?: string;
  paidBy?: string;
  paymentReference?: string;

  createdAt: string;
  updatedAt?: string;
}

export interface InvestorBreakdown {
  byJob: InvestorJobBreakdown[];
}

export interface InvestorJobBreakdown {
  jobId: string;
  jobCode: string;
  clientName: string;
  customerName: string;
  footage: number;
  rate: number;
  amount: number;
  completedDate: string;
}

// =====================================================
// UNDERGROUND DAILY ENTRY TYPES
// =====================================================

export interface UndergroundDailyEntry {
  id: string;
  jobId: string;
  entryDate: string;            // ISO date
  isFullDay: boolean;
  isHalfDay: boolean;
  conduitFeet: number;
  groundType: 'Normal' | 'Cobble' | 'Rock';
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateDailyEntryInput {
  jobId: string;
  entryDate: string;
  isFullDay: boolean;
  isHalfDay: boolean;
  conduitFeet: number;
  groundType: 'Normal' | 'Cobble' | 'Rock';
  notes?: string;
}

// =====================================================
// PAY STUB TYPES (Display)
// =====================================================

export interface PayStub {
  payPeriod: PayPeriod;
  record: PayrollRecord;
  earnings: {
    grossPay: number;
    deductions: number;         // Future: taxes, etc.
    netPay: number;
  };
  yearToDate?: {
    grossPay: number;
    jobsCompleted: number;
    totalFootage: number;
  };
}

export interface InvestorStatement {
  payPeriod: PayPeriod;
  returns: InvestorReturn[];
  totals: {
    totalReturns: number;
    totalJobs: number;
    totalFootage: number;
  };
  yearToDate?: {
    totalReturns: number;
    totalJobs: number;
  };
}

// =====================================================
// PAYROLL ADMIN TYPES
// =====================================================

export interface WeeklyPayrollSummary {
  payPeriod: PayPeriod;
  workers: PayrollRecord[];
  investors: InvestorReturn[];
  totals: {
    workerPayTotal: number;
    investorReturnTotal: number;
    grandTotal: number;
    pendingCount: number;
    approvedCount: number;
    paidCount: number;
  };
}

export interface PayrollFilters {
  weekKey?: string;
  status?: PayrollStatus;
  userRole?: string;
  userId?: string;
}

export interface InvestorReturnFilters {
  weekKey?: string;
  status?: 'pending' | 'approved' | 'paid';
  investorType?: 'truck' | 'drill';
  investorId?: string;
  equipmentId?: string;
}
