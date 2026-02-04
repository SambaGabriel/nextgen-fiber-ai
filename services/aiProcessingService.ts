/**
 * AI Processing Service
 * Automated analysis of submitted projects using Gemini AI
 * Zero-Touch workflow: Upload → AI Analysis → Auto-Invoice
 */

import { analyzeMapBoQ, analyzeConstructionImage } from './geminiService';
import { projectStorage, rateCardStorage, clientStorage } from './projectStorage';
import {
  Project,
  ProjectStatus,
  AIAnalysis,
  LineItem,
  Violation,
  ViolationSeverity,
  WorkType
} from '../types/project';
import { Language, MapAnalysisResult } from '../types';

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// AI PROCESSING QUEUE
// ============================================

interface ProcessingState {
  isRunning: boolean;
  currentProjectId: string | null;
  queue: string[];
  listeners: Set<(state: ProcessingState) => void>;
}

const state: ProcessingState = {
  isRunning: false,
  currentProjectId: null,
  queue: [],
  listeners: new Set()
};

const notifyListeners = () => {
  state.listeners.forEach(listener => listener({ ...state }));
};

// ============================================
// MAIN PROCESSING FUNCTIONS
// ============================================

/**
 * Process a single project through AI analysis
 */
export const processProject = async (
  projectId: string,
  lang: Language = Language.EN
): Promise<Project | null> => {
  const project = projectStorage.getById(projectId);
  if (!project) {
    console.error(`[AI] Project ${projectId} not found`);
    return null;
  }

  console.log(`[AI] Starting analysis for ${project.mapCode}`);
  const startTime = Date.now();

  // Update status to AI_PROCESSING
  projectStorage.update(projectId, {
    status: ProjectStatus.AI_PROCESSING
  });

  projectStorage.addEvent(projectId, {
    action: 'ai_processing_started',
    description: 'AI analysis started',
    metadata: { lang }
  });

  try {
    // Initialize analysis results
    let mapAnalysis: MapAnalysisResult | null = null;
    const photoAnalyses: any[] = [];
    const violations: Violation[] = [];
    const flags: string[] = [];

    // 1. Analyze map file if present
    if (project.uploads.mapFile?.url) {
      console.log(`[AI] Analyzing map file: ${project.uploads.mapFile.filename}`);
      try {
        // Determine MIME type from filename
        const ext = project.uploads.mapFile.filename.toLowerCase();
        let mimeType = 'application/pdf';
        if (ext.endsWith('.kmz')) mimeType = 'application/vnd.google-earth.kmz';
        if (ext.endsWith('.kml')) mimeType = 'application/vnd.google-earth.kml+xml';
        if (ext.endsWith('.png')) mimeType = 'image/png';
        if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) mimeType = 'image/jpeg';

        mapAnalysis = await analyzeMapBoQ(project.uploads.mapFile.url, mimeType, lang);
        console.log(`[AI] Map analysis complete: ${mapAnalysis.totalCableLength} ft total`);
      } catch (error) {
        console.error('[AI] Map analysis failed:', error);
        flags.push('map_analysis_failed');
        violations.push({
          id: generateId(),
          code: 'MAP_ANALYSIS_ERROR',
          severity: ViolationSeverity.WARNING,
          title: 'Map Analysis Issue',
          description: 'AI could not fully analyze the map file. Manual review may be needed.',
          detectedAt: new Date().toISOString()
        });
      }
    }

    // 2. Analyze photos
    if (project.uploads.photos.length > 0) {
      console.log(`[AI] Analyzing ${project.uploads.photos.length} photos`);

      // Process up to 5 photos (to avoid rate limits)
      const photosToAnalyze = project.uploads.photos.slice(0, 5);

      for (const photo of photosToAnalyze) {
        try {
          const analysis = await analyzeConstructionImage(photo.url, lang);
          photoAnalyses.push({
            photoId: photo.id,
            ...analysis
          });

          // Update photo with AI notes
          const updatedPhotos = project.uploads.photos.map(p =>
            p.id === photo.id
              ? { ...p, aiNotes: analysis.aiSummary, isVerified: analysis.complianceScore > 70 }
              : p
          );
          projectStorage.update(projectId, {
            uploads: { ...project.uploads, photos: updatedPhotos }
          });

          // Check for compliance issues in photos
          if (analysis.complianceScore < 50) {
            violations.push({
              id: generateId(),
              code: 'PHOTO_COMPLIANCE',
              severity: ViolationSeverity.WARNING,
              title: `Photo Compliance Issue: ${photo.filename}`,
              description: analysis.aiSummary || 'Photo may show compliance issues',
              detectedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error(`[AI] Photo analysis failed for ${photo.filename}:`, error);
        }
      }
    }

    // 3. Calculate footage and hardware from map analysis
    const footage = {
      aerial: mapAnalysis?.aerialFootage || 0,
      underground: mapAnalysis?.undergroundFootage || 0,
      overlash: 0,
      total: mapAnalysis?.totalCableLength || 0
    };

    // Override with segment data if available
    if (mapAnalysis?.segments && mapAnalysis.segments.length > 0) {
      footage.aerial = mapAnalysis.segments
        .filter(s => s.type === 'AERIAL')
        .reduce((sum, s) => sum + s.length, 0);
      footage.underground = mapAnalysis.segments
        .filter(s => s.type === 'UNDERGROUND')
        .reduce((sum, s) => sum + s.length, 0);
      footage.total = footage.aerial + footage.underground + footage.overlash;
    }

    const hardware = {
      anchors: mapAnalysis?.anchorCount || 0,
      coils: 0,
      snowshoes: 0,
      poles: mapAnalysis?.spanCount || 0
    };

    // 4. Calculate confidence score
    let confidence = 80;
    if (!mapAnalysis) confidence -= 30;
    if (photoAnalyses.length === 0) confidence -= 20;
    if (footage.total === 0) confidence -= 30;
    confidence = Math.max(0, Math.min(100, confidence));

    // 5. Check for issues that require attention
    if (footage.total === 0) {
      flags.push('zero_footage_detected');
      violations.push({
        id: generateId(),
        code: 'ZERO_FOOTAGE',
        severity: ViolationSeverity.ERROR,
        title: 'No Footage Detected',
        description: 'AI could not detect any cable footage in the submitted files.',
        suggestion: 'Please verify the map file is correct or add footage manually.',
        detectedAt: new Date().toISOString()
      });
    }

    if (mapAnalysis?.detectedAnomalies && mapAnalysis.detectedAnomalies.length > 0) {
      mapAnalysis.detectedAnomalies.forEach(anomaly => {
        flags.push('anomaly_detected');
        violations.push({
          id: generateId(),
          code: 'MAP_ANOMALY',
          severity: ViolationSeverity.WARNING,
          title: 'Map Anomaly Detected',
          description: anomaly,
          detectedAt: new Date().toISOString()
        });
      });
    }

    // 6. Calculate compliance score
    const avgPhotoCompliance = photoAnalyses.length > 0
      ? photoAnalyses.reduce((sum, p) => sum + (p.complianceScore || 80), 0) / photoAnalyses.length
      : 80;
    const complianceScore = Math.round((avgPhotoCompliance + (mapAnalysis ? 90 : 50)) / 2);
    const nescCompliant = complianceScore >= 70 && violations.filter(v => v.severity === ViolationSeverity.CRITICAL).length === 0;

    // 7. Build AI Analysis result
    const processingTimeMs = Date.now() - startTime;
    const aiAnalysis: AIAnalysis = {
      processedAt: new Date().toISOString(),
      processingTimeMs,
      footage,
      hardware,
      complianceScore,
      violations,
      nescCompliant,
      confidence,
      notes: buildAnalysisNotes(mapAnalysis, photoAnalyses, lang),
      notes_pt: lang === Language.PT ? undefined : buildAnalysisNotes(mapAnalysis, photoAnalyses, Language.PT),
      flags,
      requiresReview: flags.length > 0 || confidence < 60 || violations.some(v => v.severity === ViolationSeverity.ERROR)
    };

    // 8. Calculate line items based on rate card
    const client = clientStorage.getById(project.clientId);
    const rateCard = rateCardStorage.getForClient(project.clientId);
    const lineItems = calculateLineItems(aiAnalysis, rateCard, project.workType, lang);
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

    // 9. Determine final status
    const finalStatus = aiAnalysis.requiresReview
      ? ProjectStatus.NEEDS_ATTENTION
      : ProjectStatus.READY_TO_INVOICE;

    // 10. Update project with all analysis results
    const updatedProject = projectStorage.update(projectId, {
      status: finalStatus,
      aiAnalysis,
      lineItems,
      subtotal,
      total: subtotal, // No tax by default
      rateCardId: rateCard.id
    });

    projectStorage.addEvent(projectId, {
      action: 'ai_processing_complete',
      description: finalStatus === ProjectStatus.READY_TO_INVOICE
        ? 'AI analysis complete - Ready to invoice'
        : 'AI analysis complete - Requires review',
      metadata: {
        processingTimeMs,
        confidence,
        complianceScore,
        totalFootage: footage.total,
        flagsCount: flags.length,
        violationsCount: violations.length
      }
    });

    console.log(`[AI] Completed analysis for ${project.mapCode} in ${processingTimeMs}ms (confidence: ${confidence}%)`);

    return updatedProject;

  } catch (error) {
    console.error(`[AI] Processing failed for ${project.mapCode}:`, error);

    projectStorage.update(projectId, {
      status: ProjectStatus.NEEDS_ATTENTION
    });

    projectStorage.addEvent(projectId, {
      action: 'ai_processing_failed',
      description: 'AI processing encountered an error',
      metadata: { error: String(error) }
    });

    return projectStorage.getById(projectId);
  }
};

/**
 * Build human-readable analysis notes
 */
const buildAnalysisNotes = (
  mapAnalysis: MapAnalysisResult | null,
  photoAnalyses: any[],
  lang: Language
): string => {
  const notes: string[] = [];

  if (lang === Language.PT) {
    if (mapAnalysis) {
      notes.push(`Análise do mapa concluída: ${mapAnalysis.totalCableLength} pés de cabo detectados.`);
      if (mapAnalysis.cableType) notes.push(`Tipo de cabo: ${mapAnalysis.cableType}`);
      if (mapAnalysis.aerialFootage) notes.push(`Aéreo: ${mapAnalysis.aerialFootage} pés`);
      if (mapAnalysis.undergroundFootage) notes.push(`Subterrâneo: ${mapAnalysis.undergroundFootage} pés`);
    } else {
      notes.push('Análise do mapa não disponível.');
    }
    notes.push(`${photoAnalyses.length} fotos analisadas.`);
  } else {
    if (mapAnalysis) {
      notes.push(`Map analysis complete: ${mapAnalysis.totalCableLength} feet of cable detected.`);
      if (mapAnalysis.cableType) notes.push(`Cable type: ${mapAnalysis.cableType}`);
      if (mapAnalysis.aerialFootage) notes.push(`Aerial: ${mapAnalysis.aerialFootage} ft`);
      if (mapAnalysis.undergroundFootage) notes.push(`Underground: ${mapAnalysis.undergroundFootage} ft`);
    } else {
      notes.push('Map analysis not available.');
    }
    notes.push(`${photoAnalyses.length} photos analyzed.`);
  }

  return notes.join(' ');
};

/**
 * Calculate line items based on AI analysis and rate card
 */
const calculateLineItems = (
  analysis: AIAnalysis,
  rateCard: { rates: any },
  workType: WorkType,
  lang: Language
): LineItem[] => {
  const items: LineItem[] = [];
  const rates = rateCard.rates;

  // Footage items
  if (analysis.footage.aerial > 0) {
    items.push({
      id: generateId(),
      description: 'Aerial Fiber Installation',
      description_pt: 'Instalação de Fibra Aérea',
      quantity: analysis.footage.aerial,
      unit: 'ft',
      unitPrice: rates.fiber_per_foot || 0.35,
      total: analysis.footage.aerial * (rates.fiber_per_foot || 0.35),
      category: 'footage'
    });
  }

  if (analysis.footage.underground > 0) {
    items.push({
      id: generateId(),
      description: 'Underground Fiber Installation',
      description_pt: 'Instalação de Fibra Subterrânea',
      quantity: analysis.footage.underground,
      unit: 'ft',
      unitPrice: rates.fiber_per_foot || 0.35,
      total: analysis.footage.underground * (rates.fiber_per_foot || 0.35),
      category: 'footage'
    });
  }

  if (analysis.footage.overlash > 0) {
    items.push({
      id: generateId(),
      description: 'Overlash Installation',
      description_pt: 'Instalação de Overlash',
      quantity: analysis.footage.overlash,
      unit: 'ft',
      unitPrice: rates.overlash_per_foot || 0.30,
      total: analysis.footage.overlash * (rates.overlash_per_foot || 0.30),
      category: 'footage'
    });
  }

  // Hardware items
  if (analysis.hardware.anchors > 0) {
    items.push({
      id: generateId(),
      description: 'Anchor Installation',
      description_pt: 'Instalação de Âncora',
      quantity: analysis.hardware.anchors,
      unit: 'each',
      unitPrice: rates.anchor_each || 18.00,
      total: analysis.hardware.anchors * (rates.anchor_each || 18.00),
      category: 'hardware'
    });
  }

  if (analysis.hardware.coils > 0) {
    items.push({
      id: generateId(),
      description: 'Coil Installation',
      description_pt: 'Instalação de Bobina',
      quantity: analysis.hardware.coils,
      unit: 'each',
      unitPrice: rates.coil_each || 25.00,
      total: analysis.hardware.coils * (rates.coil_each || 25.00),
      category: 'hardware'
    });
  }

  if (analysis.hardware.snowshoes > 0) {
    items.push({
      id: generateId(),
      description: 'Snowshoe Installation',
      description_pt: 'Instalação de Snowshoe',
      quantity: analysis.hardware.snowshoes,
      unit: 'each',
      unitPrice: rates.snowshoe_each || 15.00,
      total: analysis.hardware.snowshoes * (rates.snowshoe_each || 15.00),
      category: 'hardware'
    });
  }

  return items;
};

// ============================================
// QUEUE MANAGEMENT
// ============================================

/**
 * Start the AI processing queue
 */
export const startProcessingQueue = (lang: Language = Language.EN) => {
  if (state.isRunning) return;

  state.isRunning = true;
  notifyListeners();

  console.log('[AI] Processing queue started');
  processQueue(lang);
};

/**
 * Stop the AI processing queue
 */
export const stopProcessingQueue = () => {
  state.isRunning = false;
  notifyListeners();
  console.log('[AI] Processing queue stopped');
};

/**
 * Process the queue
 */
const processQueue = async (lang: Language) => {
  while (state.isRunning) {
    // Find projects that need processing
    const pendingProjects = projectStorage.getByStatus([
      ProjectStatus.SUBMITTED,
      ProjectStatus.AI_PROCESSING
    ]);

    if (pendingProjects.length > 0) {
      const project = pendingProjects[0];
      state.currentProjectId = project.id;
      state.queue = pendingProjects.slice(1).map(p => p.id);
      notifyListeners();

      await processProject(project.id, lang);

      state.currentProjectId = null;
      notifyListeners();
    }

    // Wait before checking for new projects
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
};

/**
 * Subscribe to processing state changes
 */
export const subscribeToProcessingState = (
  listener: (state: ProcessingState) => void
): (() => void) => {
  state.listeners.add(listener);
  listener({ ...state }); // Immediate callback with current state
  return () => state.listeners.delete(listener);
};

/**
 * Get current processing state
 */
export const getProcessingState = (): ProcessingState => ({ ...state });

/**
 * Manually trigger processing for a specific project
 */
export const triggerProcessing = async (
  projectId: string,
  lang: Language = Language.EN
): Promise<Project | null> => {
  return processProject(projectId, lang);
};

// ============================================
// REPROCESSING
// ============================================

/**
 * Reprocess a project (for manual retries)
 */
export const reprocessProject = async (
  projectId: string,
  lang: Language = Language.EN
): Promise<Project | null> => {
  const project = projectStorage.getById(projectId);
  if (!project) return null;

  // Reset status to allow reprocessing
  projectStorage.update(projectId, {
    status: ProjectStatus.SUBMITTED,
    aiAnalysis: undefined,
    lineItems: [],
    subtotal: 0,
    total: 0
  });

  projectStorage.addEvent(projectId, {
    action: 'reprocess_requested',
    description: 'Manual reprocessing requested'
  });

  return processProject(projectId, lang);
};

// ============================================
// EXPORT
// ============================================

export const aiProcessingService = {
  processProject,
  startProcessingQueue,
  stopProcessingQueue,
  subscribeToProcessingState,
  getProcessingState,
  triggerProcessing,
  reprocessProject
};

export default aiProcessingService;
