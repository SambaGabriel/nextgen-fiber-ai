/**
 * Project Storage Service
 * Handles persistence of projects, clients, and related data
 * Uses localStorage with IndexedDB-like structure
 */

import {
  Project,
  ProjectStatus,
  Client,
  RateCard,
  Invoice,
  DashboardStats,
  WorkType,
  ProjectEvent
} from '../types/project';

const STORAGE_KEYS = {
  PROJECTS: 'ngf_projects',
  CLIENTS: 'ngf_clients',
  RATE_CARDS: 'ngf_rate_cards',
  INVOICES: 'ngf_invoices',
  INVOICE_COUNTER: 'ngf_invoice_counter',
  PROJECT_COUNTER: 'ngf_project_counter'
};

// ============================================
// UTILITIES
// ============================================

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateMapCode = (counter: number): string => {
  const year = new Date().getFullYear();
  return `MAP-${year}-${String(counter).padStart(4, '0')}`;
};

const generateInvoiceNumber = (counter: number): string => {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(counter).padStart(4, '0')}`;
};

// ============================================
// PROJECT STORAGE
// ============================================

export const projectStorage = {
  // Get all projects
  getAll: (): Project[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Get project by ID
  getById: (id: string): Project | null => {
    const projects = projectStorage.getAll();
    return projects.find(p => p.id === id) || null;
  },

  // Get projects by status
  getByStatus: (status: ProjectStatus | ProjectStatus[]): Project[] => {
    const projects = projectStorage.getAll();
    const statuses = Array.isArray(status) ? status : [status];
    return projects.filter(p => statuses.includes(p.status));
  },

  // Get projects by client
  getByClient: (clientId: string): Project[] => {
    const projects = projectStorage.getAll();
    return projects.filter(p => p.clientId === clientId);
  },

  // Get projects by lineman
  getByLineman: (linemanId: string): Project[] => {
    const projects = projectStorage.getAll();
    return projects.filter(p => p.linemanId === linemanId);
  },

  // Create new project
  create: (data: Partial<Project>): Project => {
    const projects = projectStorage.getAll();

    // Get next map code
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.PROJECT_COUNTER) || '0') + 1;
    localStorage.setItem(STORAGE_KEYS.PROJECT_COUNTER, String(counter));

    const now = new Date().toISOString();

    const project: Project = {
      id: generateId(),
      mapCode: data.mapCode || generateMapCode(counter),
      clientId: data.clientId || '',
      linemanId: data.linemanId || '',
      linemanName: data.linemanName || '',
      status: ProjectStatus.DRAFT,
      statusChangedAt: now,
      workType: data.workType || WorkType.AERIAL,
      location: data.location || {},
      workDate: data.workDate || now.split('T')[0],
      uploads: {
        photos: [],
        ...data.uploads
      },
      lineItems: [],
      subtotal: 0,
      total: 0,
      reports: [],
      history: [{
        id: generateId(),
        timestamp: now,
        action: 'created',
        description: 'Project created',
        userId: data.linemanId,
        userName: data.linemanName
      }],
      createdAt: now,
      updatedAt: now,
      ...data
    };

    projects.push(project);
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));

    return project;
  },

  // Update project
  update: (id: string, updates: Partial<Project>): Project | null => {
    const projects = projectStorage.getAll();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) return null;

    const now = new Date().toISOString();
    const updated: Project = {
      ...projects[index],
      ...updates,
      updatedAt: now
    };

    // Track status changes
    if (updates.status && updates.status !== projects[index].status) {
      updated.statusChangedAt = now;
      updated.history = [
        ...updated.history,
        {
          id: generateId(),
          timestamp: now,
          action: 'status_change',
          description: `Status changed from ${projects[index].status} to ${updates.status}`,
          metadata: { from: projects[index].status, to: updates.status }
        }
      ];
    }

    projects[index] = updated;
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));

    return updated;
  },

  // Add event to history
  addEvent: (id: string, event: Omit<ProjectEvent, 'id' | 'timestamp'>): void => {
    const project = projectStorage.getById(id);
    if (!project) return;

    const newEvent: ProjectEvent = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...event
    };

    projectStorage.update(id, {
      history: [...project.history, newEvent]
    });
  },

  // Delete project
  delete: (id: string): boolean => {
    const projects = projectStorage.getAll();
    const filtered = projects.filter(p => p.id !== id);

    if (filtered.length === projects.length) return false;

    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(filtered));
    return true;
  },

  // Get dashboard stats
  getStats: (): DashboardStats => {
    const projects = projectStorage.getAll();
    const clients = clientStorage.getAll();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats: DashboardStats = {
      totalProjects: projects.length,
      pendingAI: projects.filter(p => [ProjectStatus.SUBMITTED, ProjectStatus.AI_PROCESSING].includes(p.status)).length,
      readyToInvoice: projects.filter(p => p.status === ProjectStatus.READY_TO_INVOICE).length,
      needsAttention: projects.filter(p => p.status === ProjectStatus.NEEDS_ATTENTION).length,
      invoiced: projects.filter(p => p.status === ProjectStatus.INVOICED).length,
      paid: projects.filter(p => p.status === ProjectStatus.PAID).length,

      totalRevenue: projects.filter(p => p.status === ProjectStatus.PAID).reduce((sum, p) => sum + p.total, 0),
      pendingRevenue: projects.filter(p => p.status === ProjectStatus.INVOICED).reduce((sum, p) => sum + p.total, 0),
      overdueAmount: 0, // TODO: Calculate based on due dates

      submittedThisWeek: projects.filter(p => new Date(p.createdAt) >= weekAgo).length,
      invoicedThisWeek: projects.filter(p =>
        p.invoice?.sentAt && new Date(p.invoice.sentAt) >= weekAgo
      ).length,

      byLineman: [],
      byClient: []
    };

    // Group by lineman
    const linemanMap = new Map<string, { name: string; submitted: number; pending: number }>();
    projects.forEach(p => {
      const current = linemanMap.get(p.linemanId) || { name: p.linemanName, submitted: 0, pending: 0 };
      current.submitted++;
      if ([ProjectStatus.SUBMITTED, ProjectStatus.AI_PROCESSING, ProjectStatus.NEEDS_ATTENTION].includes(p.status)) {
        current.pending++;
      }
      linemanMap.set(p.linemanId, current);
    });
    stats.byLineman = Array.from(linemanMap.entries()).map(([id, data]) => ({ id, ...data }));

    // Group by client
    const clientMap = new Map<string, { name: string; projects: number; revenue: number }>();
    projects.forEach(p => {
      const client = clients.find(c => c.id === p.clientId);
      const current = clientMap.get(p.clientId) || { name: client?.name || 'Unknown', projects: 0, revenue: 0 };
      current.projects++;
      if (p.status === ProjectStatus.PAID) {
        current.revenue += p.total;
      }
      clientMap.set(p.clientId, current);
    });
    stats.byClient = Array.from(clientMap.entries()).map(([id, data]) => ({ id, ...data }));

    return stats;
  }
};

// ============================================
// CLIENT STORAGE
// ============================================

export const clientStorage = {
  getAll: (): Client[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getById: (id: string): Client | null => {
    const clients = clientStorage.getAll();
    return clients.find(c => c.id === id) || null;
  },

  create: (data: Omit<Client, 'id' | 'createdAt'>): Client => {
    const clients = clientStorage.getAll();

    const client: Client = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...data
    };

    clients.push(client);
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));

    return client;
  },

  update: (id: string, updates: Partial<Client>): Client | null => {
    const clients = clientStorage.getAll();
    const index = clients.findIndex(c => c.id === id);

    if (index === -1) return null;

    clients[index] = { ...clients[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));

    return clients[index];
  },

  delete: (id: string): boolean => {
    const clients = clientStorage.getAll();
    const filtered = clients.filter(c => c.id !== id);

    if (filtered.length === clients.length) return false;

    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(filtered));
    return true;
  }
};

// ============================================
// RATE CARD STORAGE
// ============================================

export const rateCardStorage = {
  getAll: (): RateCard[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RATE_CARDS);
      if (data) return JSON.parse(data);

      // Return default rate card if none exist
      const defaultCard: RateCard = {
        id: 'default',
        name: 'Default Rates',
        rates: {
          fiber_per_foot: 0.35,
          strand_per_foot: 0.25,
          overlash_per_foot: 0.30,
          anchor_each: 18.00,
          coil_each: 25.00,
          snowshoe_each: 15.00
        },
        effectiveDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEYS.RATE_CARDS, JSON.stringify([defaultCard]));
      return [defaultCard];
    } catch {
      return [];
    }
  },

  getById: (id: string): RateCard | null => {
    const cards = rateCardStorage.getAll();
    return cards.find(c => c.id === id) || null;
  },

  getForClient: (clientId: string): RateCard => {
    const cards = rateCardStorage.getAll();
    return cards.find(c => c.clientId === clientId) || cards.find(c => c.id === 'default') || cards[0];
  },

  create: (data: Omit<RateCard, 'id' | 'createdAt'>): RateCard => {
    const cards = rateCardStorage.getAll();

    const card: RateCard = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      ...data
    };

    cards.push(card);
    localStorage.setItem(STORAGE_KEYS.RATE_CARDS, JSON.stringify(cards));

    return card;
  },

  update: (id: string, updates: Partial<RateCard>): RateCard | null => {
    const cards = rateCardStorage.getAll();
    const index = cards.findIndex(c => c.id === id);

    if (index === -1) return null;

    cards[index] = { ...cards[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.RATE_CARDS, JSON.stringify(cards));

    return cards[index];
  }
};

// ============================================
// INVOICE STORAGE
// ============================================

export const invoiceStorage = {
  getAll: (): Invoice[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INVOICES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getById: (id: string): Invoice | null => {
    const invoices = invoiceStorage.getAll();
    return invoices.find(i => i.id === id) || null;
  },

  create: (data: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>): Invoice => {
    const invoices = invoiceStorage.getAll();

    // Get next invoice number
    let counter = parseInt(localStorage.getItem(STORAGE_KEYS.INVOICE_COUNTER) || '0') + 1;
    localStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, String(counter));

    const invoice: Invoice = {
      id: generateId(),
      invoiceNumber: generateInvoiceNumber(counter),
      createdAt: new Date().toISOString(),
      ...data
    };

    invoices.push(invoice);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));

    return invoice;
  },

  update: (id: string, updates: Partial<Invoice>): Invoice | null => {
    const invoices = invoiceStorage.getAll();
    const index = invoices.findIndex(i => i.id === id);

    if (index === -1) return null;

    invoices[index] = { ...invoices[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));

    return invoices[index];
  }
};

// ============================================
// EXPORT ALL
// ============================================

export const storage = {
  projects: projectStorage,
  clients: clientStorage,
  rateCards: rateCardStorage,
  invoices: invoiceStorage
};

export default storage;
