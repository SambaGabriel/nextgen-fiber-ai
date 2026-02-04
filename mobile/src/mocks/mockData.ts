/**
 * Mock data for testing the app without backend
 */

import {
  Job,
  JobListItem,
  JobStatus,
  ProductionSubmission,
  Comment,
  SubmissionStatus,
  FormFieldType,
  MapAssetType,
} from '../types/jobs';

// ============================================
// MOCK JOBS LIST
// ============================================

export const mockJobsList: JobListItem[] = [
  {
    id: 'job-001',
    city: 'Charlotte',
    state: 'NC',
    client: 'Brightspeed',
    olt: 'OLT-CLT-001',
    feederId: 'FDR-2234',
    runNumber: 'R-15',
    status: JobStatus.IN_PROGRESS,
    priority: 'HIGH',
    dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    submissionCount: 2,
    hasUnreadComments: true,
    lastActivityAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 'job-002',
    city: 'Raleigh',
    state: 'NC',
    client: 'Spectrum',
    olt: 'OLT-RLG-042',
    feederId: 'FDR-1122',
    runNumber: null,
    status: JobStatus.AVAILABLE,
    priority: 'NORMAL',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days
    submissionCount: 0,
    hasUnreadComments: false,
    lastActivityAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
  },
  {
    id: 'job-003',
    city: 'Durham',
    state: 'NC',
    client: 'Brightspeed',
    olt: 'OLT-DRM-018',
    feederId: null,
    runNumber: 'R-8',
    status: JobStatus.SUBMITTED,
    priority: 'LOW',
    dueDate: null,
    submissionCount: 1,
    hasUnreadComments: false,
    lastActivityAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
  },
  {
    id: 'job-004',
    city: 'Greensboro',
    state: 'NC',
    client: 'AT&T',
    olt: 'OLT-GSO-099',
    feederId: 'FDR-5566',
    runNumber: 'R-22',
    status: JobStatus.NEEDS_INFO,
    priority: 'URGENT',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    submissionCount: 3,
    hasUnreadComments: true,
    lastActivityAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
  },
  {
    id: 'job-005',
    city: 'Winston-Salem',
    state: 'NC',
    client: 'Spectrum',
    olt: 'OLT-WSM-033',
    feederId: 'FDR-7788',
    runNumber: null,
    status: JobStatus.APPROVED,
    priority: 'NORMAL',
    dueDate: null,
    submissionCount: 5,
    hasUnreadComments: false,
    lastActivityAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
  },
];

// ============================================
// MOCK JOB DETAIL
// ============================================

export const mockJobDetail: Job = {
  id: 'job-001',
  city: 'Charlotte',
  state: 'NC',
  client: 'Brightspeed',
  olt: 'OLT-CLT-001',
  feederId: 'FDR-2234',
  runNumber: 'R-15',
  status: JobStatus.IN_PROGRESS,
  priority: 'HIGH',
  dueDate: new Date(Date.now() + 86400000).toISOString(),
  startedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
  completedAt: null,
  assignedToUserId: 'user-001',
  assignedToCrewId: 'crew-001',
  assignedByUserId: 'admin-001',
  assignedAt: new Date(Date.now() - 86400000).toISOString(),
  instructions: {
    id: 'inst-001',
    text: `## Instruções para o Run R-15

1. Iniciar no poste MRE#301 e seguir até MRE#315
2. Verificar todas as ancoragens
3. Medir cada span com precisão
4. Fotografar qualquer dano encontrado

**ATENÇÃO:** Área com tráfego pesado - usar cones de segurança.`,
    attachments: [
      {
        id: 'att-001',
        fileName: 'mapa-detalhado.pdf',
        url: 'https://example.com/mapa.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2500000,
      },
    ],
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  mapAsset: {
    id: 'map-001',
    type: MapAssetType.IMAGE,
    url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    thumbnailUrl: null,
    fileName: 'mapa-r15.png',
    fileSizeBytes: 1500000,
    mimeType: 'image/png',
    cachedLocally: false,
    localPath: null,
  },
  formSchema: {
    id: 'form-001',
    version: 1,
    fields: [
      {
        id: 'field-001',
        name: 'total_footage',
        label: 'Metragem Total (ft)',
        type: FormFieldType.NUMBER,
        required: true,
        placeholder: 'Ex: 1250',
        helpText: 'Soma de todos os spans instalados',
        defaultValue: null,
        options: null,
        validation: { min: 0, max: 50000, minLength: null, maxLength: null, pattern: null, patternMessage: null },
        order: 1,
      },
      {
        id: 'field-002',
        name: 'pole_count',
        label: 'Quantidade de Postes',
        type: FormFieldType.NUMBER,
        required: true,
        placeholder: 'Ex: 15',
        helpText: null,
        defaultValue: null,
        options: null,
        validation: { min: 0, max: 500, minLength: null, maxLength: null, pattern: null, patternMessage: null },
        order: 2,
      },
      {
        id: 'field-003',
        name: 'cable_type',
        label: 'Tipo de Cabo',
        type: FormFieldType.SELECT,
        required: true,
        placeholder: null,
        helpText: null,
        defaultValue: null,
        options: [
          { value: '12F', label: '12 Fibras' },
          { value: '24F', label: '24 Fibras' },
          { value: '48F', label: '48 Fibras' },
          { value: '96F', label: '96 Fibras' },
          { value: '144F', label: '144 Fibras' },
        ],
        validation: null,
        order: 3,
      },
      {
        id: 'field-004',
        name: 'anchor_count',
        label: 'Quantidade de Âncoras',
        type: FormFieldType.NUMBER,
        required: false,
        placeholder: 'Ex: 5',
        helpText: null,
        defaultValue: null,
        options: null,
        validation: { min: 0, max: 100, minLength: null, maxLength: null, pattern: null, patternMessage: null },
        order: 4,
      },
      {
        id: 'field-005',
        name: 'notes',
        label: 'Observações',
        type: FormFieldType.TEXTAREA,
        required: false,
        placeholder: 'Adicione observações relevantes...',
        helpText: 'Problemas encontrados, condições climáticas, etc.',
        defaultValue: null,
        options: null,
        validation: { min: null, max: null, minLength: null, maxLength: 1000, pattern: null, patternMessage: null },
        order: 5,
      },
    ],
  },
  submissionCount: 2,
  commentCount: 4,
  lastActivityAt: new Date(Date.now() - 3600000).toISOString(),
  createdAt: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
  updatedAt: new Date(Date.now() - 3600000).toISOString(),
};

// ============================================
// MOCK SUBMISSIONS
// ============================================

export const mockSubmissions: ProductionSubmission[] = [
  {
    id: 'sub-001',
    jobId: 'job-001',
    formData: {
      total_footage: 850,
      pole_count: 12,
      cable_type: '48F',
      anchor_count: 4,
      notes: 'Primeiro trecho concluído sem problemas.',
    },
    completionDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    submittedByUserId: 'user-001',
    submittedByName: 'João Silva',
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
    syncStatus: SubmissionStatus.SENT,
    syncError: null,
    syncRetryCount: 0,
    serverSubmissionId: 'srv-sub-001',
    serverReceivedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'sub-002',
    jobId: 'job-001',
    formData: {
      total_footage: 400,
      pole_count: 5,
      cable_type: '48F',
      anchor_count: 2,
      notes: null,
    },
    completionDate: new Date().toISOString().split('T')[0],
    submittedByUserId: 'user-001',
    submittedByName: 'João Silva',
    submittedAt: new Date(Date.now() - 7200000).toISOString(),
    syncStatus: SubmissionStatus.SENT,
    syncError: null,
    syncRetryCount: 0,
    serverSubmissionId: 'srv-sub-002',
    serverReceivedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

// ============================================
// MOCK COMMENTS
// ============================================

export const mockComments: Comment[] = [
  {
    id: 'cmt-001',
    jobId: 'job-001',
    authorId: 'admin-001',
    authorName: 'Maria Santos',
    authorRole: 'OFFICE',
    authorAvatarUrl: null,
    text: 'Olá João, este job tem prioridade alta. Por favor inicie assim que possível.',
    attachments: [],
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    editedAt: null,
    isFromOffice: true,
    syncStatus: SubmissionStatus.SENT,
    syncError: null,
  },
  {
    id: 'cmt-002',
    jobId: 'job-001',
    authorId: 'user-001',
    authorName: 'João Silva',
    authorRole: 'LINEMAN',
    authorAvatarUrl: null,
    text: 'Entendido! Vou iniciar amanhã cedo.',
    attachments: [],
    createdAt: new Date(Date.now() - 158400000).toISOString(),
    editedAt: null,
    isFromOffice: false,
    syncStatus: SubmissionStatus.SENT,
    syncError: null,
  },
  {
    id: 'cmt-003',
    jobId: 'job-001',
    authorId: 'user-001',
    authorName: 'João Silva',
    authorRole: 'LINEMAN',
    authorAvatarUrl: null,
    text: 'Primeiro trecho concluído. Encontrei um poste com dano na base, já reportei.',
    attachments: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    editedAt: null,
    isFromOffice: false,
    syncStatus: SubmissionStatus.SENT,
    syncError: null,
  },
  {
    id: 'cmt-004',
    jobId: 'job-001',
    authorId: 'admin-001',
    authorName: 'Maria Santos',
    authorRole: 'OFFICE',
    authorAvatarUrl: null,
    text: 'Obrigada pelo update! Já notifiquei a equipe de manutenção sobre o poste.',
    attachments: [],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    editedAt: null,
    isFromOffice: true,
    syncStatus: SubmissionStatus.SENT,
    syncError: null,
  },
];
