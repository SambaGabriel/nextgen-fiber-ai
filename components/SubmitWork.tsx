/**
 * SubmitWork - Lineman's upload interface
 * Mobile-first, clean, simple flow for uploading map + photos
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, MapPin, Camera, FileText, Send, X, CheckCircle2,
  AlertCircle, Loader2, Image as ImageIcon, File, Plus, Trash2
} from 'lucide-react';
import { Project, ProjectStatus, WorkType, Photo } from '../types/project';
import { projectStorage, clientStorage } from '../services/projectStorage';
import { Language } from '../types';
import FiberLoader from './FiberLoader';

interface SubmitWorkProps {
  userId: string;
  userName: string;
  lang: Language;
  onSubmitSuccess?: (project: Project) => void;
}

const translations = {
  EN: {
    title: 'Submit Work',
    subtitle: 'Upload your completed map and photos',
    step1: 'Map File',
    step1_desc: 'Upload KMZ or KML file',
    step2: 'Photos',
    step2_desc: 'Add evidence photos',
    step3: 'Details',
    step3_desc: 'Work information',
    dragDrop: 'Drag & drop or click to upload',
    mapFormats: 'KMZ, KML files accepted',
    photoFormats: 'JPG, PNG files accepted',
    addPhotos: 'Add Photos',
    mapCode: 'Map Code',
    mapCodePlaceholder: 'e.g., MAP-001',
    client: 'Client',
    selectClient: 'Select client',
    workType: 'Work Type',
    aerial: 'Aerial',
    underground: 'Underground',
    overlash: 'Overlash',
    mixed: 'Mixed',
    location: 'Location',
    locationPlaceholder: 'City, State',
    workDate: 'Work Date',
    notes: 'Notes (optional)',
    notesPlaceholder: 'Any additional information...',
    submit: 'Submit for AI Review',
    submitting: 'Submitting...',
    success: 'Submitted Successfully!',
    successDesc: 'AI is now processing your submission',
    error: 'Error submitting',
    requiredFields: 'Please fill all required fields',
    noMap: 'Please upload a map file',
    noPhotos: 'Please add at least one photo'
  },
  PT: {
    title: 'Enviar Trabalho',
    subtitle: 'Faça upload do mapa e fotos',
    step1: 'Arquivo do Mapa',
    step1_desc: 'Upload do arquivo KMZ ou KML',
    step2: 'Fotos',
    step2_desc: 'Adicionar fotos de evidência',
    step3: 'Detalhes',
    step3_desc: 'Informações do trabalho',
    dragDrop: 'Arraste ou clique para upload',
    mapFormats: 'Arquivos KMZ, KML aceitos',
    photoFormats: 'Arquivos JPG, PNG aceitos',
    addPhotos: 'Adicionar Fotos',
    mapCode: 'Código do Mapa',
    mapCodePlaceholder: 'ex: MAP-001',
    client: 'Cliente',
    selectClient: 'Selecionar cliente',
    workType: 'Tipo de Trabalho',
    aerial: 'Aéreo',
    underground: 'Subterrâneo',
    overlash: 'Overlash',
    mixed: 'Misto',
    location: 'Localização',
    locationPlaceholder: 'Cidade, Estado',
    workDate: 'Data do Trabalho',
    notes: 'Notas (opcional)',
    notesPlaceholder: 'Informações adicionais...',
    submit: 'Enviar para Análise AI',
    submitting: 'Enviando...',
    success: 'Enviado com Sucesso!',
    successDesc: 'AI está processando sua submissão',
    error: 'Erro ao enviar',
    requiredFields: 'Preencha todos os campos obrigatórios',
    noMap: 'Por favor, faça upload do arquivo do mapa',
    noPhotos: 'Por favor, adicione pelo menos uma foto'
  },
  ES: {
    title: 'Enviar Trabajo',
    subtitle: 'Sube tu mapa y fotos completados',
    step1: 'Archivo del Mapa',
    step1_desc: 'Subir archivo KMZ o KML',
    step2: 'Fotos',
    step2_desc: 'Agregar fotos de evidencia',
    step3: 'Detalles',
    step3_desc: 'Información del trabajo',
    dragDrop: 'Arrastra o haz clic para subir',
    mapFormats: 'Archivos KMZ, KML aceptados',
    photoFormats: 'Archivos JPG, PNG aceptados',
    addPhotos: 'Agregar Fotos',
    mapCode: 'Código del Mapa',
    mapCodePlaceholder: 'ej: MAP-001',
    client: 'Cliente',
    selectClient: 'Seleccionar cliente',
    workType: 'Tipo de Trabajo',
    aerial: 'Aéreo',
    underground: 'Subterráneo',
    overlash: 'Overlash',
    mixed: 'Mixto',
    location: 'Ubicación',
    locationPlaceholder: 'Ciudad, Estado',
    workDate: 'Fecha del Trabajo',
    notes: 'Notas (opcional)',
    notesPlaceholder: 'Información adicional...',
    submit: 'Enviar para Análisis AI',
    submitting: 'Enviando...',
    success: '¡Enviado con Éxito!',
    successDesc: 'AI está procesando tu envío',
    error: 'Error al enviar',
    requiredFields: 'Por favor complete todos los campos requeridos',
    noMap: 'Por favor sube un archivo de mapa',
    noPhotos: 'Por favor agrega al menos una foto'
  }
};

const SubmitWork: React.FC<SubmitWorkProps> = ({
  userId,
  userName,
  lang,
  onSubmitSuccess
}) => {
  const t = translations[lang];
  const clients = clientStorage.getAll();

  // Form state
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [mapCode, setMapCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [workType, setWorkType] = useState<WorkType>(WorkType.AERIAL);
  const [location, setLocation] = useState('');
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const mapInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Handle map file upload
  const handleMapUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.kmz') || file.name.endsWith('.kml'))) {
      setMapFile(file);
      setError('');
    }
  }, []);

  // Handle photo upload
  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => f.type.startsWith('image/'));

    const newPhotos = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
    setError('');
  }, []);

  // Remove photo
  const removePhoto = useCallback((index: number) => {
    setPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  // Submit work
  const handleSubmit = async () => {
    // Validation
    if (!mapCode || !clientId) {
      setError(t.requiredFields);
      return;
    }
    if (!mapFile) {
      setError(t.noMap);
      return;
    }
    if (photos.length === 0) {
      setError(t.noPhotos);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Convert map file to base64
      const mapBase64 = await fileToBase64(mapFile);

      // Convert photos to base64
      const photoData: Photo[] = await Promise.all(
        photos.map(async (p, index) => {
          const base64 = await fileToBase64(p.file);
          return {
            id: `photo-${Date.now()}-${index}`,
            filename: p.file.name,
            url: base64,
            metadata: {
              capturedAt: new Date().toISOString()
            },
            uploadedAt: new Date().toISOString(),
            isVerified: false
          };
        })
      );

      // Create project
      const project = projectStorage.create({
        mapCode,
        clientId,
        linemanId: userId,
        linemanName: userName,
        workType,
        location: { address: location },
        workDate,
        description: notes,
        status: ProjectStatus.SUBMITTED,
        uploads: {
          mapFile: {
            filename: mapFile.name,
            url: mapBase64,
            size: mapFile.size,
            uploadedAt: new Date().toISOString()
          },
          photos: photoData,
          notes,
          submittedAt: new Date().toISOString()
        }
      });

      // Simulate AI processing start
      setTimeout(() => {
        projectStorage.update(project.id, {
          status: ProjectStatus.AI_PROCESSING
        });
      }, 1000);

      setIsSuccess(true);
      onSubmitSuccess?.(project);

      // Reset form after success
      setTimeout(() => {
        setMapFile(null);
        setPhotos([]);
        setMapCode('');
        setClientId('');
        setLocation('');
        setNotes('');
        setIsSuccess(false);
      }, 3000);

    } catch (err) {
      setError(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Success screen
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 animate-in fade-in">
        <div
          className="p-6 rounded-full mb-6"
          style={{ background: 'var(--online-glow)' }}
        >
          <CheckCircle2 className="w-16 h-16" style={{ color: 'var(--online-core)' }} />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          {t.success}
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t.successDesc}
        </p>
        <div className="mt-8">
          <FiberLoader size={40} text="AI Processing..." />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto pb-24">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight text-gradient-neural">
            {t.title}
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {t.subtitle}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
          >
            <AlertCircle className="w-5 h-5 shrink-0" style={{ color: 'var(--critical-core)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--critical-core)' }}>{error}</p>
          </div>
        )}

        {/* Step 1: Map File */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: 'var(--gradient-neural)', color: 'var(--void)' }}
            >
              1
            </div>
            <div>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t.step1}</h3>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.step1_desc}</p>
            </div>
          </div>

          <input
            ref={mapInputRef}
            type="file"
            accept=".kmz,.kml"
            onChange={handleMapUpload}
            className="hidden"
          />

          {mapFile ? (
            <div
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <div className="flex items-center gap-3">
                <File className="w-8 h-8" style={{ color: 'var(--neural-core)' }} />
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{mapFile.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {(mapFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMapFile(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => mapInputRef.current?.click()}
              className="w-full p-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-3 transition-all hover:scale-[1.01]"
              style={{ borderColor: 'var(--border-default)', background: 'var(--surface)' }}
            >
              <Upload className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
              <div className="text-center">
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t.dragDrop}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>{t.mapFormats}</p>
              </div>
            </button>
          )}
        </div>

        {/* Step 2: Photos */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: 'var(--gradient-neural)', color: 'var(--void)' }}
            >
              2
            </div>
            <div>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t.step2}</h3>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.step2_desc}</p>
            </div>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />

          <div className="grid grid-cols-3 gap-3">
            {photos.map((photo, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-xl overflow-hidden group"
                style={{ border: '1px solid var(--border-default)' }}
              >
                <img
                  src={photo.preview}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(239, 68, 68, 0.9)' }}
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}

            <button
              onClick={() => photoInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              style={{ borderColor: 'var(--border-default)', background: 'var(--surface)' }}
            >
              <Plus className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>
                {t.addPhotos}
              </span>
            </button>
          </div>
        </div>

        {/* Step 3: Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: 'var(--gradient-neural)', color: 'var(--void)' }}
            >
              3
            </div>
            <div>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t.step3}</h3>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.step3_desc}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Map Code */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t.mapCode} *
              </label>
              <input
                type="text"
                value={mapCode}
                onChange={(e) => setMapCode(e.target.value)}
                placeholder={t.mapCodePlaceholder}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            {/* Client */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t.client} *
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="">{t.selectClient}</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </div>

            {/* Work Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t.workType}
              </label>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value as WorkType)}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value={WorkType.AERIAL}>{t.aerial}</option>
                <option value={WorkType.UNDERGROUND}>{t.underground}</option>
                <option value={WorkType.OVERLASH}>{t.overlash}</option>
                <option value={WorkType.MIXED}>{t.mixed}</option>
              </select>
            </div>

            {/* Work Date */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {t.workDate}
              </label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t.location}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t.locationPlaceholder}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t.notes}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.notesPlaceholder}
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none transition-all resize-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          style={{
            background: 'var(--gradient-neural)',
            color: 'var(--void)',
            boxShadow: 'var(--shadow-neural)'
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t.submitting}
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              {t.submit}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SubmitWork;
