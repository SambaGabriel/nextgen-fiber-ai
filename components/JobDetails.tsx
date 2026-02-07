/**
 * JobDetails - Detailed view of a specific job
 * Shows job info, map PDF, supervisor notes, and Submit button
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft, MapPin, Calendar, Clock, User, FileText,
  Download, Eye, Send, Play, CheckCircle2, AlertTriangle,
  Ruler, Building2, MessageSquare, ExternalLink, Camera, Image
} from 'lucide-react';
import { Job, JobStatus, WorkType } from '../types/project';
import { jobStorageSupabase } from '../services/jobStorageSupabase';
import { Language, User as UserType } from '../types';
import ChatSection from './ChatSection';
import SafetyChecklist, { isChecklistValid } from './SafetyChecklist';
import QuickCamera, { getJobPhotos, getJobPhotoCount, JobPhoto } from './QuickCamera';

interface JobDetailsProps {
  job: Job;
  user: UserType;
  lang: Language;
  onBack: () => void;
  onStartProduction: (job: Job) => void;
}

const translations = {
  EN: {
    back: 'Back to Jobs',
    jobInfo: 'Job Information',
    supervisorNotes: 'Supervisor Notes',
    mapDocument: 'Map / Document',
    viewMap: 'View Map',
    downloadMap: 'Download',
    noMap: 'No map uploaded for this job',
    noNotes: 'No notes from supervisor',
    startWork: 'Enter Production',
    submitProduction: 'Submit Production Sheet',
    continueWork: 'Enter Production',
    viewSubmission: 'View Submission',
    status: 'Status',
    client: 'Client',
    location: 'Location',
    scheduled: 'Scheduled Date',
    assigned: 'Assigned',
    estimatedFootage: 'Estimated Footage',
    workType: 'Work Type',
    dueDate: 'Due Date',
    assignedBy: 'Assigned By',
    workTypes: {
      aerial: 'Aerial',
      underground: 'Underground',
      overlash: 'Overlash',
      mixed: 'Mixed'
    },
    statusLabels: {
      assigned: 'New - Ready to Start',
      in_progress: 'In Progress',
      submitted: 'Submitted - Awaiting Review',
      approved: 'Approved',
      needs_revision: 'Needs Revision',
      completed: 'Completed'
    },
    submittedData: 'Submitted Production Data',
    totalFootage: 'Total Footage',
    anchors: 'Anchors',
    coils: 'Coils',
    snowshoes: 'Snowshoes'
  },
  PT: {
    back: 'Voltar para Jobs',
    jobInfo: 'Informações do Job',
    supervisorNotes: 'Notas do Supervisor',
    mapDocument: 'Mapa / Documento',
    viewMap: 'Ver Mapa',
    downloadMap: 'Baixar',
    noMap: 'Nenhum mapa enviado para este job',
    noNotes: 'Sem notas do supervisor',
    startWork: 'Lançar Produção',
    submitProduction: 'Enviar Production Sheet',
    continueWork: 'Lançar Produção',
    viewSubmission: 'Ver Envio',
    status: 'Status',
    client: 'Cliente',
    location: 'Localização',
    scheduled: 'Data Agendada',
    assigned: 'Atribuído',
    estimatedFootage: 'Metragem Estimada',
    workType: 'Tipo de Trabalho',
    dueDate: 'Data Limite',
    assignedBy: 'Atribuído Por',
    workTypes: {
      aerial: 'Aéreo',
      underground: 'Subterrâneo',
      overlash: 'Overlash',
      mixed: 'Misto'
    },
    statusLabels: {
      assigned: 'Novo - Pronto para Iniciar',
      in_progress: 'Em Progresso',
      submitted: 'Enviado - Aguardando Revisão',
      approved: 'Aprovado',
      needs_revision: 'Precisa Revisão',
      completed: 'Concluído'
    },
    submittedData: 'Dados de Produção Enviados',
    totalFootage: 'Metragem Total',
    anchors: 'Âncoras',
    coils: 'Bobinas',
    snowshoes: 'Snowshoes'
  },
  ES: {
    back: 'Volver a Jobs',
    jobInfo: 'Información del Job',
    supervisorNotes: 'Notas del Supervisor',
    mapDocument: 'Mapa / Documento',
    viewMap: 'Ver Mapa',
    downloadMap: 'Descargar',
    noMap: 'No hay mapa cargado para este job',
    noNotes: 'Sin notas del supervisor',
    startWork: 'Ingresar Producción',
    submitProduction: 'Enviar Production Sheet',
    continueWork: 'Ingresar Producción',
    viewSubmission: 'Ver Envío',
    status: 'Estado',
    client: 'Cliente',
    location: 'Ubicación',
    scheduled: 'Fecha Programada',
    assigned: 'Asignado',
    estimatedFootage: 'Metraje Estimado',
    workType: 'Tipo de Trabajo',
    dueDate: 'Fecha Límite',
    assignedBy: 'Asignado Por',
    workTypes: {
      aerial: 'Aéreo',
      underground: 'Subterráneo',
      overlash: 'Overlash',
      mixed: 'Mixto'
    },
    statusLabels: {
      assigned: 'Nuevo - Listo para Iniciar',
      in_progress: 'En Progreso',
      submitted: 'Enviado - Esperando Revisión',
      approved: 'Aprobado',
      needs_revision: 'Necesita Revisión',
      completed: 'Completado'
    },
    submittedData: 'Datos de Producción Enviados',
    totalFootage: 'Metraje Total',
    anchors: 'Anclas',
    coils: 'Bobinas',
    snowshoes: 'Snowshoes'
  }
};

const JobDetails: React.FC<JobDetailsProps> = ({ job, user, lang, onBack, onStartProduction }) => {
  const t = translations[lang];
  const [currentJob, setCurrentJob] = useState(job);
  const [isViewingMap, setIsViewingMap] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);

  // Load photos on mount
  useEffect(() => {
    console.log('[DEBUG] JobDetails mounted with job:', currentJob.id);
    console.log('[DEBUG] Job mapFile:', currentJob.mapFile);
    console.log('[DEBUG] Job mapFile?.url:', currentJob.mapFile?.url ? 'exists' : 'null/undefined');
    const jobPhotos = getJobPhotos(currentJob.id);
    setPhotos(jobPhotos);
    setPhotoCount(jobPhotos.length);
  }, [currentJob.id, currentJob.mapFile]);

  // Get status configuration
  const getStatusConfig = (status: JobStatus) => {
    const configs: Record<JobStatus, { bg: string; color: string; icon: React.ReactNode }> = {
      [JobStatus.ASSIGNED]: {
        bg: 'var(--neural-dim)',
        color: 'var(--neural-core)',
        icon: <Clock className="w-5 h-5" />
      },
      [JobStatus.IN_PROGRESS]: {
        bg: 'var(--energy-pulse)',
        color: 'var(--energy-core)',
        icon: <Play className="w-5 h-5" />
      },
      [JobStatus.SUBMITTED]: {
        bg: 'var(--online-glow)',
        color: 'var(--online-core)',
        icon: <Send className="w-5 h-5" />
      },
      [JobStatus.APPROVED]: {
        bg: 'var(--online-glow)',
        color: 'var(--online-core)',
        icon: <CheckCircle2 className="w-5 h-5" />
      },
      [JobStatus.NEEDS_REVISION]: {
        bg: 'rgba(251, 146, 60, 0.1)',
        color: '#fb923c',
        icon: <AlertTriangle className="w-5 h-5" />
      },
      [JobStatus.COMPLETED]: {
        bg: 'var(--online-glow)',
        color: 'var(--online-core)',
        icon: <CheckCircle2 className="w-5 h-5" />
      }
    };
    return configs[status];
  };

  const statusConfig = getStatusConfig(currentJob.status);

  // Handle photo taken
  const handlePhotoTaken = useCallback((photo: JobPhoto) => {
    setPhotos(prev => [...prev, photo]);
    setPhotoCount(prev => prev + 1);
  }, []);

  // Handle start work - requires safety checklist
  const handleStartWork = useCallback(async () => {
    // Check if safety checklist is valid
    if (!isChecklistValid(currentJob.id)) {
      setShowChecklist(true);
      return;
    }

    // Update job status to in_progress
    const updated = await jobStorageSupabase.update(currentJob.id, { status: JobStatus.IN_PROGRESS });
    if (updated) {
      setCurrentJob(updated);
    }
    // Navigate to production form
    onStartProduction(updated || currentJob);
  }, [currentJob, onStartProduction]);

  // Handle checklist complete
  const handleChecklistComplete = useCallback(async () => {
    setShowChecklist(false);
    // Now proceed with starting work
    const updated = await jobStorageSupabase.update(currentJob.id, { status: JobStatus.IN_PROGRESS });
    if (updated) {
      setCurrentJob(updated);
    }
    onStartProduction(updated || currentJob);
  }, [currentJob, onStartProduction]);

  // Handle view map (open in new tab)
  const handleViewMap = useCallback(() => {
    console.log('[DEBUG] handleViewMap called');
    console.log('[DEBUG] currentJob.mapFile:', currentJob.mapFile);
    if (currentJob.mapFile?.url) {
      console.log('[DEBUG] mapFile.url exists, opening in new tab');
      // Open in new tab for both base64 and regular URLs
      window.open(currentJob.mapFile.url, '_blank');
    } else {
      console.log('[DEBUG] No mapFile.url found');
      alert('No map file available for this job');
    }
  }, [currentJob.mapFile]);

  // Determine action button
  const getActionButton = () => {
    switch (currentJob.status) {
      case JobStatus.ASSIGNED:
        return {
          label: t.startWork,
          icon: <Play className="w-5 h-5" />,
          action: handleStartWork,
          style: { background: 'var(--gradient-neural)', color: 'var(--void)' }
        };
      case JobStatus.IN_PROGRESS:
      case JobStatus.NEEDS_REVISION:
        return {
          label: currentJob.status === JobStatus.NEEDS_REVISION ? t.submitProduction : t.continueWork,
          icon: <Send className="w-5 h-5" />,
          action: () => onStartProduction(currentJob),
          style: { background: 'var(--gradient-neural)', color: 'var(--void)' }
        };
      case JobStatus.SUBMITTED:
      case JobStatus.APPROVED:
      case JobStatus.COMPLETED:
        return {
          label: t.viewSubmission,
          icon: <Eye className="w-5 h-5" />,
          action: () => {}, // View only
          style: { background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }
        };
      default:
        return null;
    }
  };

  const actionButton = getActionButton();

  return (
    <div className="min-h-full" style={{ background: 'var(--void)' }}>
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold mb-4 transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          {t.back}
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {currentJob.title}
              </h1>
              <span
                className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
                style={{ background: statusConfig.bg, color: statusConfig.color }}
              >
                {statusConfig.icon}
                {t.statusLabels[currentJob.status]}
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {currentJob.jobCode} • {currentJob.clientName}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Quick Camera Button */}
            <button
              onClick={() => setShowCamera(true)}
              className="relative w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-105"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <Camera className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
              {photoCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center text-white"
                  style={{ background: 'var(--gradient-neural)' }}
                >
                  {photoCount}
                </span>
              )}
            </button>

            {/* Main Action Button */}
            {actionButton && (
              <button
                onClick={actionButton.action}
                className="px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-105"
                style={actionButton.style as React.CSSProperties}
              >
                {actionButton.icon}
                {actionButton.label}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Job Information Card */}
        <div
          className="rounded-xl sm:rounded-2xl p-4 sm:p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
        >
          <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-4 sm:mb-6 flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
            <Building2 className="w-4 h-4" /> {t.jobInfo}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-ghost)' }}>{t.client}</p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{currentJob.clientName}</p>
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-ghost)' }}>{t.workType}</p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.workTypes[currentJob.workType]}</p>
            </div>
            {currentJob.scheduledDate && (
              <div>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-ghost)' }}>{t.scheduled}</p>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {new Date(currentJob.scheduledDate).toLocaleDateString()}
                </p>
              </div>
            )}
            {currentJob.estimatedFootage && (
              <div>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-ghost)' }}>{t.estimatedFootage}</p>
                <p className="text-sm font-bold" style={{ color: 'var(--neural-core)' }}>
                  {currentJob.estimatedFootage.toLocaleString()} ft
                </p>
              </div>
            )}
            {currentJob.location?.address && (
              <div className="col-span-2">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-ghost)' }}>{t.location}</p>
                <p className="text-sm font-bold flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                  <MapPin className="w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
                  {currentJob.location.address}, {currentJob.location.city}, {currentJob.location.state}
                </p>
              </div>
            )}
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-ghost)' }}>{t.assignedBy}</p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{currentJob.assignedByName}</p>
            </div>
          </div>
        </div>

        {/* Map Document Card */}
        <div
          className="rounded-xl sm:rounded-2xl p-4 sm:p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
        >
          <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-4 sm:mb-6 flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
            <FileText className="w-4 h-4" /> {t.mapDocument}
          </h3>

          {currentJob.mapFile && currentJob.mapFile.url ? (
            <div className="space-y-4">
              {/* File info and actions */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--neural-dim)' }}
                  >
                    <FileText className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{currentJob.mapFile.filename}</p>
                    <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                      {(currentJob.mapFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleViewMap}
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105"
                    style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)', border: '1px solid var(--border-neural)' }}
                  >
                    <Eye className="w-4 h-4" />
                    {t.viewMap}
                  </button>
                  <a
                    href={currentJob.mapFile.url}
                    download={currentJob.mapFile.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105"
                    style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                  >
                    <Download className="w-4 h-4" />
                    {t.downloadMap}
                  </a>
                </div>
              </div>

              {/* Embedded PDF Preview */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                {currentJob.mapFile.url.startsWith('data:') ? (
                  <iframe
                    src={currentJob.mapFile.url}
                    className="w-full h-[400px] sm:h-[500px]"
                    title="Map Preview"
                  />
                ) : (
                  <object
                    data={`${currentJob.mapFile.url}#toolbar=1&navpanes=0`}
                    type="application/pdf"
                    className="w-full h-[400px] sm:h-[500px]"
                  >
                    {/* Fallback for browsers that can't display PDF */}
                    <div className="flex flex-col items-center justify-center h-[400px] p-8" style={{ background: 'var(--elevated)' }}>
                      <FileText className="w-16 h-16 mb-4" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-sm mb-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                        Unable to display PDF in browser
                      </p>
                      <a
                        href={currentJob.mapFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2"
                        style={{ background: 'var(--gradient-neural)', color: '#000' }}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open in New Tab
                      </a>
                    </div>
                  </object>
                )}
              </div>
            </div>
          ) : currentJob.mapFile ? (
            <div className="text-center py-8" style={{ color: 'var(--text-ghost)' }}>
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm mb-2">{currentJob.mapFile.filename}</p>
              <p className="text-xs" style={{ color: 'var(--critical-core)' }}>Map URL not available</p>
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: 'var(--text-ghost)' }}>
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t.noMap}</p>
            </div>
          )}
        </div>

        {/* Photos Section */}
        {photos.length > 0 && (
          <div
            className="rounded-xl sm:rounded-2xl p-4 sm:p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
          >
            <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
              <Image className="w-4 h-4" /> {lang === 'PT' ? 'Fotos do Job' : lang === 'ES' ? 'Fotos del Job' : 'Job Photos'} ({photoCount})
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {photos.slice(0, 12).map((photo) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-lg overflow-hidden bg-slate-800"
                >
                  <img
                    src={photo.thumbnail}
                    alt="Job photo"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {photos.length > 12 && (
                <div
                  className="aspect-square rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--elevated)' }}
                >
                  <span className="text-sm font-bold" style={{ color: 'var(--text-tertiary)' }}>
                    +{photos.length - 12}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat Section - AI Supervisor */}
        <ChatSection
          jobId={currentJob.id}
          job={currentJob}
          userId={user.id}
          userName={user.name}
          userRole={user.role}
          lang={lang}
        />

        {/* Submitted Production Data (if exists) */}
        {currentJob.productionData && (
          <div
            className="rounded-xl sm:rounded-2xl p-4 sm:p-6"
            style={{ background: 'var(--online-glow)', border: '1px solid var(--border-online)' }}
          >
            <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-4 sm:mb-6 flex items-center gap-2" style={{ color: 'var(--online-core)' }}>
              <CheckCircle2 className="w-4 h-4" /> {t.submittedData}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <p className="text-2xl font-black" style={{ color: 'var(--online-core)' }}>
                  {currentJob.productionData.totalFootage.toLocaleString()}
                </p>
                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{t.totalFootage}</p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {currentJob.productionData.anchorCount}
                </p>
                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{t.anchors}</p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {currentJob.productionData.coilCount}
                </p>
                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{t.coils}</p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {currentJob.productionData.snowshoeCount}
                </p>
                <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{t.snowshoes}</p>
              </div>
            </div>

            <p className="text-xs mt-4" style={{ color: 'var(--text-ghost)' }}>
              Submitted: {new Date(currentJob.productionData.submittedAt).toLocaleString()}
            </p>
          </div>
        )}

      </div>

      {/* Safety Checklist Modal */}
      {showChecklist && (
        <SafetyChecklist
          jobId={currentJob.id}
          onComplete={handleChecklistComplete}
          onCancel={() => setShowChecklist(false)}
          lang={lang}
        />
      )}

      {/* Quick Camera Modal */}
      {showCamera && (
        <QuickCamera
          jobId={currentJob.id}
          onPhotoTaken={handlePhotoTaken}
          onClose={() => setShowCamera(false)}
          lang={lang}
        />
      )}
    </div>
  );
};

export default JobDetails;
