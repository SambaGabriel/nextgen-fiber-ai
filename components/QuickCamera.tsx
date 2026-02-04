/**
 * QuickCamera - One-tap photo capture for job documentation
 * Saves photos directly to job without navigation
 */

import React, { useRef, useState, useCallback } from 'react';
import { Camera, X, Check, RotateCcw, Image, Loader2 } from 'lucide-react';
import { offlineSync } from '../services/offlineSync';

interface QuickCameraProps {
  jobId: string;
  onPhotoTaken: (photo: JobPhoto) => void;
  onClose: () => void;
  lang?: 'EN' | 'PT' | 'ES';
}

export interface JobPhoto {
  id: string;
  jobId: string;
  base64: string;
  thumbnail: string;
  capturedAt: string;
  location?: { lat: number; lng: number };
  synced: boolean;
}

const JOB_PHOTOS_KEY = 'fs_job_photos';

const translations = {
  EN: {
    capture: 'Tap to capture',
    retake: 'Retake',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Photo saved!',
    error: 'Error capturing photo',
    permissionDenied: 'Camera permission denied',
  },
  PT: {
    capture: 'Toque para capturar',
    retake: 'Refazer',
    save: 'Salvar',
    saving: 'Salvando...',
    saved: 'Foto salva!',
    error: 'Erro ao capturar foto',
    permissionDenied: 'Permissão de câmera negada',
  },
  ES: {
    capture: 'Toca para capturar',
    retake: 'Repetir',
    save: 'Guardar',
    saving: 'Guardando...',
    saved: '¡Foto guardada!',
    error: 'Error al capturar foto',
    permissionDenied: 'Permiso de cámara denegado',
  }
};

// Generate unique ID
const generateId = () => `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Save photo to localStorage
const savePhotoToStorage = (photo: JobPhoto): void => {
  try {
    const data = JSON.parse(localStorage.getItem(JOB_PHOTOS_KEY) || '[]');
    data.push(photo);
    localStorage.setItem(JOB_PHOTOS_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save photo:', error);
  }
};

// Get photos for a job
export const getJobPhotos = (jobId: string): JobPhoto[] => {
  try {
    const data = JSON.parse(localStorage.getItem(JOB_PHOTOS_KEY) || '[]');
    return data.filter((p: JobPhoto) => p.jobId === jobId);
  } catch {
    return [];
  }
};

// Get photo count for a job
export const getJobPhotoCount = (jobId: string): number => {
  return getJobPhotos(jobId).length;
};

// Create thumbnail (resize image)
const createThumbnail = (base64: string, maxSize: number = 150): Promise<string> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = base64;
  });
};

// Compress image for storage
const compressImage = (base64: string, maxWidth: number = 1200): Promise<string> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = base64;
  });
};

const QuickCamera: React.FC<QuickCameraProps> = ({
  jobId,
  onPhotoTaken,
  onClose,
  lang = 'PT'
}) => {
  const t = translations[lang];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError(t.permissionDenied);
      } else {
        setError(t.error);
      }
    }
  }, [t]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Capture photo from video
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(base64);
    stopCamera();
  }, [stopCamera]);

  // Handle file input (fallback for devices without camera API)
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setCapturedImage(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  // Retake photo
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  // Save photo
  const handleSave = useCallback(async () => {
    if (!capturedImage) return;

    setIsSaving(true);

    try {
      // Compress and create thumbnail
      const [compressedImage, thumbnail] = await Promise.all([
        compressImage(capturedImage),
        createThumbnail(capturedImage)
      ]);

      // Get location if available
      let location: { lat: number; lng: number } | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch {
        // Location not available, continue without it
      }

      const photo: JobPhoto = {
        id: generateId(),
        jobId,
        base64: compressedImage,
        thumbnail,
        capturedAt: new Date().toISOString(),
        location,
        synced: navigator.onLine
      };

      // Save to localStorage
      savePhotoToStorage(photo);

      // Queue for sync if offline
      if (!navigator.onLine) {
        offlineSync.queueOperation('photo_upload', jobId, { photoId: photo.id });
      }

      onPhotoTaken(photo);
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      setError(t.error);
    } finally {
      setIsSaving(false);
    }
  }, [capturedImage, jobId, onPhotoTaken, onClose, t.error]);

  // Initialize camera on mount
  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input as fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Close button */}
      <button
        onClick={() => {
          stopCamera();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main content */}
      {capturedImage ? (
        // Preview captured image
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center bg-black">
            <img
              src={capturedImage}
              alt="Captured"
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Action buttons */}
          <div className="flex-shrink-0 p-4 flex gap-4">
            <button
              onClick={handleRetake}
              disabled={isSaving}
              className="flex-1 py-4 rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              {t.retake}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.saving}
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {t.save}
                </>
              )}
            </button>
          </div>
        </div>
      ) : error ? (
        // Error state - show file input option
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-center mb-8">
            <Camera className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-white font-bold">{error}</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-8 py-4 rounded-xl bg-blue-600 text-white font-bold flex items-center gap-2"
          >
            <Image className="w-5 h-5" />
            Select from Gallery
          </button>
        </div>
      ) : (
        // Camera view
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Crosshair overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/30 rounded-lg" />
            </div>
          </div>

          {/* Capture button */}
          <div className="flex-shrink-0 p-6 flex justify-center">
            <button
              onClick={capturePhoto}
              disabled={!cameraActive}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full border-4 border-slate-800" />
            </button>
          </div>
          <p className="text-center text-white/60 text-sm pb-4">{t.capture}</p>
        </div>
      )}
    </div>
  );
};

export default QuickCamera;
