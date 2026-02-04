/**
 * OwnerInbox - Dashboard for business owner
 * Shows all projects organized by status with quick actions
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Inbox, Clock, CheckCircle2, AlertTriangle, DollarSign,
  Eye, Send, MoreHorizontal, Filter, RefreshCw, Search,
  ChevronRight, FileText, User, MapPin, Calendar, Zap,
  TrendingUp, AlertCircle, CheckSquare, XCircle, RotateCcw
} from 'lucide-react';
import { Project, ProjectStatus, DashboardStats } from '../types/project';
import { projectStorage, clientStorage } from '../services/projectStorage';
import { aiProcessingService } from '../services/aiProcessingService';
import { invoiceService } from '../services/invoiceService';
import { Language } from '../types';
import FiberLoader from './FiberLoader';

interface OwnerInboxProps {
  lang: Language;
  onViewProject?: (project: Project) => void;
  onApproveProject?: (project: Project) => void;
  onGenerateInvoice?: (project: Project) => void;
}

const translations = {
  EN: {
    title: 'Command Center',
    subtitle: 'All projects at a glance',
    tabs: {
      all: 'All',
      pending: 'AI Processing',
      ready: 'Ready to Invoice',
      attention: 'Needs Attention',
      invoiced: 'Invoiced',
      paid: 'Paid'
    },
    stats: {
      pending: 'Processing',
      ready: 'Ready',
      attention: 'Attention',
      revenue: 'Revenue'
    },
    empty: 'No projects in this category',
    emptyAll: 'No projects yet. Linemen can start submitting work.',
    view: 'View',
    approve: 'Approve',
    invoice: 'Generate Invoice',
    mapCode: 'Map Code',
    client: 'Client',
    lineman: 'Lineman',
    submitted: 'Submitted',
    status: 'Status',
    amount: 'Amount',
    refresh: 'Refresh',
    search: 'Search projects...',
    aiProcessing: 'AI is analyzing...',
    complianceScore: 'Compliance',
    flags: 'flags',
    reprocess: 'Reprocess',
    reprocessing: 'Reprocessing...',
    generating: 'Generating...',
    downloadPDF: 'Download PDF',
    downloadEN: 'English PDF',
    downloadPT: 'Portuguese PDF',
    markPaid: 'Mark Paid',
    invoiceNumber: 'Invoice'
  },
  PT: {
    title: 'Central de Comando',
    subtitle: 'Todos os projetos em um só lugar',
    tabs: {
      all: 'Todos',
      pending: 'AI Processando',
      ready: 'Prontos para Faturar',
      attention: 'Precisa Atenção',
      invoiced: 'Faturados',
      paid: 'Pagos'
    },
    stats: {
      pending: 'Processando',
      ready: 'Prontos',
      attention: 'Atenção',
      revenue: 'Receita'
    },
    empty: 'Nenhum projeto nesta categoria',
    emptyAll: 'Nenhum projeto ainda. Linemen podem começar a enviar trabalhos.',
    view: 'Ver',
    approve: 'Aprovar',
    invoice: 'Gerar Invoice',
    mapCode: 'Código do Mapa',
    client: 'Cliente',
    lineman: 'Lineman',
    submitted: 'Enviado',
    status: 'Status',
    amount: 'Valor',
    refresh: 'Atualizar',
    search: 'Buscar projetos...',
    aiProcessing: 'AI está analisando...',
    complianceScore: 'Conformidade',
    flags: 'alertas',
    reprocess: 'Reprocessar',
    reprocessing: 'Reprocessando...',
    generating: 'Gerando...',
    downloadPDF: 'Baixar PDF',
    downloadEN: 'PDF em Inglês',
    downloadPT: 'PDF em Português',
    markPaid: 'Marcar Pago',
    invoiceNumber: 'Fatura'
  },
  ES: {
    title: 'Centro de Comando',
    subtitle: 'Todos los proyectos de un vistazo',
    tabs: {
      all: 'Todos',
      pending: 'AI Procesando',
      ready: 'Listos para Facturar',
      attention: 'Necesita Atención',
      invoiced: 'Facturados',
      paid: 'Pagados'
    },
    stats: {
      pending: 'Procesando',
      ready: 'Listos',
      attention: 'Atención',
      revenue: 'Ingresos'
    },
    empty: 'No hay proyectos en esta categoría',
    emptyAll: 'No hay proyectos aún. Los linemen pueden comenzar a enviar trabajos.',
    view: 'Ver',
    approve: 'Aprobar',
    invoice: 'Generar Factura',
    mapCode: 'Código del Mapa',
    client: 'Cliente',
    lineman: 'Lineman',
    submitted: 'Enviado',
    status: 'Estado',
    amount: 'Monto',
    refresh: 'Actualizar',
    search: 'Buscar proyectos...',
    aiProcessing: 'AI está analizando...',
    complianceScore: 'Cumplimiento',
    flags: 'alertas',
    reprocess: 'Reprocesar',
    reprocessing: 'Reprocesando...',
    generating: 'Generando...',
    downloadPDF: 'Descargar PDF',
    downloadEN: 'PDF en Inglés',
    downloadPT: 'PDF en Portugués',
    markPaid: 'Marcar Pagado',
    invoiceNumber: 'Factura'
  }
};

type TabType = 'all' | 'pending' | 'ready' | 'attention' | 'invoiced' | 'paid';

const OwnerInbox: React.FC<OwnerInboxProps> = ({
  lang,
  onViewProject,
  onApproveProject,
  onGenerateInvoice
}) => {
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [processingProjectId, setProcessingProjectId] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      setProjects(projectStorage.getAll());
      setStats(projectStorage.getStats());
      setIsLoading(false);
    }, 300);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Subscribe to AI processing state changes
  useEffect(() => {
    const unsubscribe = aiProcessingService.subscribeToProcessingState((state) => {
      setProcessingProjectId(state.currentProjectId);
      // Refresh data when processing state changes
      if (state.currentProjectId === null) {
        loadData();
      }
    });
    return unsubscribe;
  }, [loadData]);

  // Auto-refresh while processing
  useEffect(() => {
    if (processingProjectId) {
      const interval = setInterval(loadData, 2000);
      return () => clearInterval(interval);
    }
  }, [processingProjectId, loadData]);

  // Handle reprocess
  const handleReprocess = useCallback(async (project: Project) => {
    setReprocessingId(project.id);
    try {
      await aiProcessingService.reprocessProject(project.id, lang);
      loadData();
    } finally {
      setReprocessingId(null);
    }
  }, [lang, loadData]);

  // Handle approve (move to READY_TO_INVOICE)
  const handleApprove = useCallback((project: Project) => {
    projectStorage.update(project.id, {
      status: ProjectStatus.READY_TO_INVOICE
    });
    projectStorage.addEvent(project.id, {
      action: 'approved',
      description: 'Project approved for invoicing'
    });
    loadData();
    onApproveProject?.(project);
  }, [loadData, onApproveProject]);

  // Handle invoice generation
  const [invoicingProjectId, setInvoicingProjectId] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handleGenerateInvoice = useCallback(async (project: Project) => {
    setInvoicingProjectId(project.id);
    try {
      const result = await invoiceService.generateFromProject(project.id);
      if (result) {
        // Download the PDF in current language
        const updatedProject = projectStorage.getById(project.id);
        if (updatedProject) {
          invoiceService.downloadPDF(result, updatedProject, lang);
        }
        loadData();
        onGenerateInvoice?.(updatedProject || project);
      }
    } catch (error) {
      console.error('Invoice generation failed:', error);
    } finally {
      setInvoicingProjectId(null);
    }
  }, [lang, loadData, onGenerateInvoice]);

  // Open invoice preview modal
  const handleViewInvoiceDetails = useCallback((project: Project) => {
    setSelectedProject(project);
    setShowInvoiceModal(true);
  }, []);

  // Download invoice in specific language
  const handleDownloadInvoice = useCallback((project: Project, downloadLang: Language) => {
    if (project.invoice) {
      invoiceService.downloadPDF(project.invoice, project, downloadLang);
    }
  }, []);

  // Mark invoice as paid
  const handleMarkPaid = useCallback((project: Project) => {
    if (project.invoice) {
      invoiceService.markPaid(project.invoice.id);
      loadData();
    }
  }, [loadData]);

  // Filter projects by tab
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Filter by tab
    switch (activeTab) {
      case 'pending':
        filtered = filtered.filter(p =>
          [ProjectStatus.SUBMITTED, ProjectStatus.AI_PROCESSING].includes(p.status)
        );
        break;
      case 'ready':
        filtered = filtered.filter(p =>
          [ProjectStatus.AI_COMPLETE, ProjectStatus.READY_TO_INVOICE].includes(p.status)
        );
        break;
      case 'attention':
        filtered = filtered.filter(p => p.status === ProjectStatus.NEEDS_ATTENTION);
        break;
      case 'invoiced':
        filtered = filtered.filter(p => p.status === ProjectStatus.INVOICED);
        break;
      case 'paid':
        filtered = filtered.filter(p => p.status === ProjectStatus.PAID);
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.mapCode.toLowerCase().includes(query) ||
        p.linemanName.toLowerCase().includes(query) ||
        p.location?.address?.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [projects, activeTab, searchQuery]);

  // Get client name
  const getClientName = (clientId: string): string => {
    const client = clientStorage.getById(clientId);
    return client?.name || 'Unknown Client';
  };

  // Status badge component
  const StatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
    const config: Record<ProjectStatus, { bg: string; text: string; label: string }> = {
      [ProjectStatus.DRAFT]: { bg: 'var(--elevated)', text: 'var(--text-tertiary)', label: 'Draft' },
      [ProjectStatus.SUBMITTED]: { bg: 'var(--neural-dim)', text: 'var(--neural-core)', label: 'Submitted' },
      [ProjectStatus.AI_PROCESSING]: { bg: 'var(--energy-pulse)', text: 'var(--energy-core)', label: 'AI Processing' },
      [ProjectStatus.AI_COMPLETE]: { bg: 'var(--online-glow)', text: 'var(--online-core)', label: 'AI Complete' },
      [ProjectStatus.NEEDS_ATTENTION]: { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c', label: 'Needs Attention' },
      [ProjectStatus.READY_TO_INVOICE]: { bg: 'var(--online-glow)', text: 'var(--online-core)', label: 'Ready' },
      [ProjectStatus.INVOICED]: { bg: 'var(--neural-dim)', text: 'var(--neural-core)', label: 'Invoiced' },
      [ProjectStatus.PAID]: { bg: 'var(--online-glow)', text: 'var(--online-core)', label: 'Paid' },
      [ProjectStatus.DISPUTED]: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--critical-core)', label: 'Disputed' },
      [ProjectStatus.CANCELLED]: { bg: 'var(--elevated)', text: 'var(--text-ghost)', label: 'Cancelled' }
    };

    const c = config[status];

    return (
      <span
        className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest"
        style={{ background: c.bg, color: c.text }}
      >
        {c.label}
      </span>
    );
  };

  // Tabs config
  const tabs: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'all', label: t.tabs.all, icon: <Inbox className="w-4 h-4" />, count: projects.length },
    { id: 'pending', label: t.tabs.pending, icon: <Clock className="w-4 h-4" />, count: stats?.pendingAI || 0 },
    { id: 'ready', label: t.tabs.ready, icon: <CheckCircle2 className="w-4 h-4" />, count: stats?.readyToInvoice || 0 },
    { id: 'attention', label: t.tabs.attention, icon: <AlertTriangle className="w-4 h-4" />, count: stats?.needsAttention || 0 },
    { id: 'invoiced', label: t.tabs.invoiced, icon: <FileText className="w-4 h-4" />, count: stats?.invoiced || 0 },
    { id: 'paid', label: t.tabs.paid, icon: <DollarSign className="w-4 h-4" />, count: stats?.paid || 0 }
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--void)' }}>
      {/* Header */}
      <div
        className="flex-shrink-0 px-6 lg:px-8 py-6"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-gradient-neural">
              {t.title}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {t.subtitle}
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-3 rounded-xl transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: t.stats.pending, value: stats?.pendingAI || 0, color: 'energy', icon: <Clock className="w-5 h-5" /> },
            { label: t.stats.ready, value: stats?.readyToInvoice || 0, color: 'online', icon: <CheckCircle2 className="w-5 h-5" /> },
            { label: t.stats.attention, value: stats?.needsAttention || 0, color: 'critical', icon: <AlertTriangle className="w-5 h-5" /> },
            { label: t.stats.revenue, value: `$${(stats?.totalRevenue || 0).toLocaleString()}`, color: 'neural', icon: <TrendingUp className="w-5 h-5" /> }
          ].map((stat, i) => (
            <div
              key={i}
              className="p-4 rounded-xl"
              style={{
                background: `var(--${stat.color === 'critical' ? 'elevated' : stat.color + '-dim'})`,
                border: `1px solid var(--border-${stat.color === 'critical' ? 'default' : stat.color})`
              }}
            >
              <div className="flex items-center gap-3">
                <div style={{ color: `var(--${stat.color}-core)` }}>{stat.icon}</div>
                <div>
                  <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Tabs */}
        <div className="flex items-center gap-4">
          <div
            className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <Search className="w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          <div
            className="flex gap-1 p-1 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest
                  transition-all
                `}
                style={{
                  background: activeTab === tab.id ? 'var(--gradient-neural)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--void)' : 'var(--text-tertiary)'
                }}
              >
                {tab.icon}
                <span className="hidden lg:inline">{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[8px]"
                    style={{
                      background: activeTab === tab.id ? 'rgba(0,0,0,0.2)' : 'var(--elevated)',
                      color: activeTab === tab.id ? 'white' : 'var(--text-tertiary)'
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <FiberLoader size={60} text="Loading..." />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-64 rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <Inbox className="w-12 h-12 mb-4" style={{ color: 'var(--text-ghost)' }} />
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {projects.length === 0 ? t.emptyAll : t.empty}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map(project => (
              <div
                key={project.id}
                className="p-5 rounded-2xl transition-all hover:scale-[1.005] cursor-pointer group"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-default)'
                }}
                onClick={() => onViewProject?.(project)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: project.status === ProjectStatus.AI_PROCESSING
                          ? 'var(--energy-pulse)'
                          : project.status === ProjectStatus.NEEDS_ATTENTION
                            ? 'rgba(251, 146, 60, 0.1)'
                            : 'var(--elevated)'
                      }}
                    >
                      {project.status === ProjectStatus.AI_PROCESSING ? (
                        <Zap className="w-6 h-6 animate-pulse" style={{ color: 'var(--energy-core)' }} />
                      ) : project.status === ProjectStatus.NEEDS_ATTENTION ? (
                        <AlertTriangle className="w-6 h-6" style={{ color: '#fb923c' }} />
                      ) : project.status === ProjectStatus.READY_TO_INVOICE ? (
                        <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--online-core)' }} />
                      ) : (
                        <FileText className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
                      )}
                    </div>

                    {/* Project info */}
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-black text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
                          {project.mapCode}
                        </span>
                        <StatusBadge status={project.status} />
                      </div>
                      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {project.linemanName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {getClientName(project.clientId)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-4">
                    {/* AI Processing indicator */}
                    {project.status === ProjectStatus.AI_PROCESSING && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--energy-pulse)' }}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--energy-core)' }} />
                        <span className="text-[10px] font-bold" style={{ color: 'var(--energy-core)' }}>{t.aiProcessing}</span>
                      </div>
                    )}

                    {/* Compliance score */}
                    {project.aiAnalysis && (
                      <div className="text-center">
                        <p className="text-xl font-black" style={{
                          color: project.aiAnalysis.complianceScore >= 90
                            ? 'var(--online-core)'
                            : project.aiAnalysis.complianceScore >= 70
                              ? 'var(--energy-core)'
                              : 'var(--critical-core)'
                        }}>
                          {project.aiAnalysis.complianceScore}%
                        </p>
                        <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{t.complianceScore}</p>
                      </div>
                    )}

                    {/* Invoice Number for invoiced projects */}
                    {project.invoice && (
                      <div className="text-center">
                        <p className="text-sm font-bold" style={{ color: 'var(--neural-core)' }}>
                          {project.invoice.invoiceNumber}
                        </p>
                        <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{t.invoiceNumber}</p>
                      </div>
                    )}

                    {/* Amount */}
                    {project.total > 0 && (
                      <div className="text-right">
                        <p className="text-xl font-black" style={{ color: 'var(--online-core)' }}>
                          ${project.total.toLocaleString()}
                        </p>
                        <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{t.amount}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {project.status === ProjectStatus.NEEDS_ATTENTION && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReprocess(project);
                            }}
                            disabled={reprocessingId === project.id}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                            style={{
                              background: 'rgba(251, 146, 60, 0.1)',
                              border: '1px solid rgba(251, 146, 60, 0.3)',
                              color: '#fb923c'
                            }}
                          >
                            <RotateCcw className={`w-4 h-4 ${reprocessingId === project.id ? 'animate-spin' : ''}`} />
                            {reprocessingId === project.id ? t.reprocessing : t.reprocess}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(project);
                            }}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                            style={{
                              background: 'var(--online-glow)',
                              border: '1px solid var(--border-online)',
                              color: 'var(--online-core)'
                            }}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {t.approve}
                          </button>
                        </>
                      )}
                      {project.status === ProjectStatus.AI_COMPLETE && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprove(project);
                          }}
                          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                          style={{
                            background: 'var(--online-glow)',
                            border: '1px solid var(--border-online)',
                            color: 'var(--online-core)'
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {t.approve}
                        </button>
                      )}
                      {project.status === ProjectStatus.READY_TO_INVOICE && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateInvoice(project);
                          }}
                          disabled={invoicingProjectId === project.id}
                          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                          style={{
                            background: 'var(--gradient-neural)',
                            color: 'var(--void)'
                          }}
                        >
                          {invoicingProjectId === project.id ? (
                            <>
                              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,0,0,0.3)', borderTopColor: 'var(--void)' }} />
                              {t.generating}
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              {t.invoice}
                            </>
                          )}
                        </button>
                      )}
                      {project.status === ProjectStatus.INVOICED && project.invoice && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadInvoice(project, lang);
                            }}
                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                            style={{
                              background: 'var(--neural-dim)',
                              border: '1px solid var(--border-neural)',
                              color: 'var(--neural-core)'
                            }}
                          >
                            <FileText className="w-4 h-4" />
                            PDF
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkPaid(project);
                            }}
                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                            style={{
                              background: 'var(--online-glow)',
                              border: '1px solid var(--border-online)',
                              color: 'var(--online-core)'
                            }}
                          >
                            <DollarSign className="w-4 h-4" />
                            {t.markPaid}
                          </button>
                        </>
                      )}
                      <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-ghost)' }} />
                    </div>
                  </div>
                </div>

                {/* Flags */}
                {project.aiAnalysis?.flags && project.aiAnalysis.flags.length > 0 && (
                  <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <AlertCircle className="w-4 h-4" style={{ color: '#fb923c' }} />
                    <span className="text-xs" style={{ color: '#fb923c' }}>
                      {project.aiAnalysis.flags.length} {t.flags}
                    </span>
                    <div className="flex gap-1">
                      {project.aiAnalysis.flags.slice(0, 3).map((flag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-[9px]"
                          style={{ background: 'rgba(251, 146, 60, 0.1)', color: '#fb923c' }}
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerInbox;
