/**
 * Equipment Types - Trucks and Drills
 * NextGen Fiber AI - CRM Completo + AI Agent Ready
 */

// =====================================================
// TRUCK TYPES
// =====================================================

export interface Truck {
  id: string;
  truckNumber: string;          // e.g., "TRK-101"
  vehicleDescription?: string;  // e.g., "2023 Ford F-250 - Bucket Truck"
  ownerType: 'company' | 'investor';
  investorId?: string;
  investorName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TruckStats {
  truckId: string;
  truckNumber: string;
  totalJobs: number;
  totalFootage: number;
  totalRevenue: number;
  totalInvestorReturns: number;
  lastJobDate?: string;
  utilizationRate: number;      // Percentage of weeks with activity
}

export interface TruckAssignment {
  id: string;
  jobId: string;
  truckId: string;
  assignedAt: string;
  assignedBy: string;
}

// =====================================================
// DRILL TYPES
// =====================================================

export interface Drill {
  id: string;
  label: string;                // e.g., "DRILL-001"
  equipmentDescription?: string; // e.g., "Vermeer D24x40 Series III"
  ownerType: 'company' | 'investor';
  investorId?: string;
  investorName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface DrillStats {
  drillId: string;
  label: string;
  totalJobs: number;
  totalFootage: number;
  totalRevenue: number;
  totalInvestorReturns: number;
  lastJobDate?: string;
  utilizationRate: number;
}

export interface DrillAssignment {
  id: string;
  jobId: string;
  drillId: string;
  assignedAt: string;
  assignedBy: string;
}

// =====================================================
// INVESTOR TYPES
// =====================================================

export interface EquipmentInvestor {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  investorType: 'truck' | 'drill' | 'both';
  trucks: Truck[];
  drills: Drill[];
  isActive: boolean;
  createdAt: string;
}

// =====================================================
// EQUIPMENT FORM TYPES
// =====================================================

export interface CreateTruckInput {
  truckNumber: string;
  vehicleDescription?: string;
  ownerType: 'company' | 'investor';
  investorId?: string;
}

export interface UpdateTruckInput {
  truckNumber?: string;
  vehicleDescription?: string;
  ownerType?: 'company' | 'investor';
  investorId?: string;
  isActive?: boolean;
}

export interface CreateDrillInput {
  label: string;
  equipmentDescription?: string;
  ownerType: 'company' | 'investor';
  investorId?: string;
}

export interface UpdateDrillInput {
  label?: string;
  equipmentDescription?: string;
  ownerType?: 'company' | 'investor';
  investorId?: string;
  isActive?: boolean;
}

// =====================================================
// GROUND TYPE (for Underground jobs)
// =====================================================

export type GroundType = 'Normal' | 'Cobble' | 'Rock';

export const GROUND_TYPE_LABELS: Record<GroundType, string> = {
  Normal: 'Normal Ground',
  Cobble: 'Cobble/Gravel',
  Rock: 'Rock'
};

export const GROUND_TYPE_RATE_CODES: Record<GroundType, string> = {
  Normal: 'DBI',
  Cobble: 'DBIC',
  Rock: 'DBIR'
};

// Rate multipliers (base rate is Normal)
export const GROUND_TYPE_MULTIPLIERS: Record<GroundType, number> = {
  Normal: 1.0,
  Cobble: 1.67,  // ~13.00/7.80
  Rock: 7.44     // ~58.00/7.80
};
