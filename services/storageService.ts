
import { User, Project, AuditResult, Invoice, Transaction, UnitRates, Report, MapAuditReport, FieldReport } from '../types';

const KEYS = {
    USER: 'fs_user',
    PROJECTS: 'fs_projects',
    AUDITS: 'fs_audits',
    INVOICES: 'fs_invoices',
    TRANSACTIONS: 'fs_transactions',
    RATES: 'fs_rates',
    REPORTS: 'fs_reports',
    FIELD_REPORTS: 'fs_field_reports', // New key
    CREWS: 'fs_crews'
};

// --- SEED DATA FROM PDF "VALOUD0409" ---
const VALOUD_SEED_REPORT: MapAuditReport = {
    id: 'VALOUD-0409-INIT',
    fileName: 'VALOUD0409_PERMIT_PACKET.pdf',
    date: new Date().toISOString(),
    certifiedBy: 'NextGen AI Agent',
    result: {
        totalCableLength: 3450,
        aerialFootage: 2890,
        undergroundFootage: 560,
        strandFootage: 2890,
        cableType: 'LOUD04-MULTI_TIER (144F/288F)',
        spanCount: 18,
        anchorCount: 5,
        mstCount: 8,
        difficultyRating: 'MODERATE - Roadside/Driveway Crossings',
        projectStartGps: {
            lat: 39.10658,
            lng: -77.682816,
            label: 'PEDESTAL 15.75x14.75'
        },
        segments: [
            { id: 'LOUD04-MULTI_TIER_CABLE_0195', length: 145, type: 'AERIAL', startNode: 'P-101', endNode: 'P-102' },
            { id: 'LOUD04-MULTI_TIER_CABLE_0293', length: 690, type: 'AERIAL', startNode: 'P-105', endNode: 'P-106' },
            { id: 'LOUD04-TAIL_CABLE_0365', length: 117, type: 'AERIAL', startNode: 'P-102', endNode: 'P-103' },
            { id: 'LOUD04-MULTI_TIER_CABLE_0543', length: 234, type: 'UNDERGROUND', startNode: 'HH-20', endNode: 'CAB-01' }
        ],
        equipmentCounts: [
            { name: 'Passve Cabinet (288)', quantity: 1 },
            { name: 'AFL FDH HANDHOLE', quantity: 1 },
            { name: 'SLACKLOOP (288-C)', quantity: 3 },
            { name: 'LOUD04-T2_SPLICE (X-2)', quantity: 4 }
        ],
        financials: {
            estimatedLaborCost: 4250.00,
            potentialSavings: 350.00
        },
        materialList: [
            { item: 'LOUD04-MULTI_TIER_CABLE_0294 (288F)', quantity: 1200, unit: 'FT', category: 'AERIAL' },
            { item: 'LOUD04-TAIL_CABLE_0364 (8F)', quantity: 450, unit: 'FT', category: 'AERIAL' },
            { item: '1/4" EHS Strand', quantity: 2890, unit: 'FT', category: 'AERIAL' },
            { item: 'Down Guy / Anchor Assembly', quantity: 5, unit: 'EA', category: 'AERIAL' },
            { item: 'MST Terminal (X-2)', quantity: 8, unit: 'EA', category: 'AERIAL' },
            { item: 'Handhole 30x48x36', quantity: 2, unit: 'EA', category: 'UNDERGROUND' }
        ],
        detectedAnomalies: []
    }
};

const INITIAL_CREWS = [
    "Potomac Valley Utility Services",
    "Dominion Fiber Construction",
    "Loudoun Broadband Ops",
    "Virginia Underground Inc."
];

export const storage = {
    saveUser: (user: User | null) => localStorage.setItem(KEYS.USER, JSON.stringify(user)),
    getUser: (): User | null => JSON.parse(localStorage.getItem(KEYS.USER) || 'null'),
    
    getProjects: (): Project[] => JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]'),
    saveProject: (project: Project) => {
        const projects = storage.getProjects();
        const existing = projects.findIndex(p => p.id === project.id);
        if (existing >= 0) projects[existing] = project;
        else projects.push(project);
        localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
    },

    getAudits: (): AuditResult[] => JSON.parse(localStorage.getItem(KEYS.AUDITS) || '[]'),
    saveAudit: (audit: AuditResult) => {
        const audits = storage.getAudits();
        audits.unshift(audit);
        localStorage.setItem(KEYS.AUDITS, JSON.stringify(audits));
    },

    // Injects the VALOUD report if list is empty
    getReports: (): MapAuditReport[] => {
        const stored = JSON.parse(localStorage.getItem(KEYS.REPORTS) || '[]');
        if (stored.length === 0) {
            return [VALOUD_SEED_REPORT];
        }
        return stored;
    },
    saveReport: (report: MapAuditReport) => {
        const reports = storage.getReports();
        reports.unshift(report);
        localStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));
    },

    // Field/Voice Reports
    getFieldReports: (): FieldReport[] => JSON.parse(localStorage.getItem(KEYS.FIELD_REPORTS) || '[]'),
    saveFieldReport: (report: FieldReport) => {
        const reports = storage.getFieldReports();
        reports.unshift(report);
        localStorage.setItem(KEYS.FIELD_REPORTS, JSON.stringify(reports));
    },

    getInvoices: (): Invoice[] => JSON.parse(localStorage.getItem(KEYS.INVOICES) || '[]'),
    saveInvoice: (invoice: Invoice) => {
        const invoices = storage.getInvoices();
        invoices.unshift(invoice);
        localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
    },

    getTransactions: (): Transaction[] => JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]'),
    saveTransaction: (tx: Transaction) => {
        const txs = storage.getTransactions();
        txs.unshift(tx);
        localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
    },

    getRates: (): UnitRates | null => JSON.parse(localStorage.getItem(KEYS.RATES) || 'null'),
    saveRates: (rates: UnitRates) => localStorage.setItem(KEYS.RATES, JSON.stringify(rates)),

    // CREW MANAGEMENT
    getCrews: (): string[] => {
        const stored = JSON.parse(localStorage.getItem(KEYS.CREWS) || '[]');
        return stored.length > 0 ? stored : INITIAL_CREWS;
    },
    saveCrew: (crewName: string) => {
        const crews = storage.getCrews();
        if (!crews.includes(crewName)) {
            crews.push(crewName);
            localStorage.setItem(KEYS.CREWS, JSON.stringify(crews));
        }
    },

    clear: () => localStorage.clear()
};
