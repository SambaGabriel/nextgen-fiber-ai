/**
 * QuickProductionEntry - Mobile-optimized quick production entry for linemen
 * Designed for ONE HAND OPERATION in the field
 *
 * Features:
 * - Large numeric keypad for footage entry
 * - Quick toggle counters for Anchor, Coil, Snowshoe
 * - Photo capture with thumbnails
 * - High contrast dark theme for outdoor visibility
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Camera,
  Delete,
  X,
  Check,
  Anchor,
  RefreshCw,
  Snowflake
} from 'lucide-react';
import { Job, Photo } from '../../types/project';

// ============================================
// TYPES
// ============================================

export interface ProductionData {
  footage: number;
  anchorCount: number;
  coilCount: number;
  snowshoeCount: number;
  photos: CapturedPhoto[];
}

interface CapturedPhoto {
  id: string;
  dataUrl: string;
  timestamp: string;
}

interface QuickProductionEntryProps {
  job: Job;
  onSubmit: (data: ProductionData) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const KEYPAD_BUTTONS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '.', '0', 'backspace'
] as const;

const MAX_PHOTOS = 3;

// ============================================
// COMPONENT
// ============================================

const QuickProductionEntry: React.FC<QuickProductionEntryProps> = ({
  job,
  onSubmit,
  onCancel
}) => {
  // State
  const [footageDisplay, setFootageDisplay] = useState('0');
  const [anchorCount, setAnchorCount] = useState(0);
  const [coilCount, setCoilCount] = useState(0);
  const [snowshoeCount, setSnowshoeCount] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // ============================================
  // KEYPAD HANDLERS
  // ============================================

  const handleKeyPress = useCallback((key: string) => {
    // Visual feedback
    setPressedKey(key);
    setTimeout(() => setPressedKey(null), 100);

    setFootageDisplay(prev => {
      if (key === 'backspace') {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      }

      if (key === '.') {
        // Only allow one decimal point
        if (prev.includes('.')) return prev;
        return prev + '.';
      }

      // Number key
      if (prev === '0' && key !== '.') {
        return key;
      }

      // Limit to reasonable length (e.g., 99999.99)
      if (prev.replace('.', '').length >= 7) return prev;

      return prev + key;
    });
  }, []);

  const handleClear = useCallback(() => {
    setFootageDisplay('0');
  }, []);

  // ============================================
  // COUNTER HANDLERS
  // ============================================

  const handleCounterIncrement = useCallback((
    setter: React.Dispatch<React.SetStateAction<number>>
  ) => {
    setter(prev => prev + 1);
  }, []);

  const handleCounterDecrement = useCallback((
    setter: React.Dispatch<React.SetStateAction<number>>
  ) => {
    setter(prev => Math.max(0, prev - 1));
  }, []);

  const handleCounterTouchStart = useCallback((
    setter: React.Dispatch<React.SetStateAction<number>>
  ) => {
    // Start long press timer for decrement
    const timer = setTimeout(() => {
      handleCounterDecrement(setter);
    }, 500);
    setLongPressTimer(timer);
  }, [handleCounterDecrement]);

  const handleCounterTouchEnd = useCallback((
    setter: React.Dispatch<React.SetStateAction<number>>,
    wasLongPress: boolean
  ) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    // Only increment if it wasn't a long press
    if (!wasLongPress) {
      handleCounterIncrement(setter);
    }
  }, [longPressTimer, handleCounterIncrement]);

  // ============================================
  // PHOTO HANDLERS
  // ============================================

  const handleAddPhoto = useCallback(() => {
    if (photos.length >= MAX_PHOTOS) return;
    fileInputRef.current?.click();
  }, [photos.length]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newPhoto: CapturedPhoto = {
        id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        dataUrl,
        timestamp: new Date().toISOString()
      };
      setPhotos(prev => [...prev, newPhoto]);
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  }, []);

  const handleRemovePhoto = useCallback((photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  }, []);

  // ============================================
  // SUBMIT HANDLER
  // ============================================

  const handleSubmit = useCallback(async () => {
    const footage = parseFloat(footageDisplay) || 0;

    if (footage <= 0) {
      // Could show an error toast here
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        footage,
        anchorCount,
        coilCount,
        snowshoeCount,
        photos
      });
    } catch (error) {
      console.error('[QuickProductionEntry] Submit error:', error);
      setIsSubmitting(false);
    }
  }, [footageDisplay, anchorCount, coilCount, snowshoeCount, photos, onSubmit]);

  // ============================================
  // RENDER
  // ============================================

  const footage = parseFloat(footageDisplay) || 0;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        background: 'var(--base, #0a0a0f)',
        color: 'var(--text-primary, #ffffff)',
        zIndex: 1100
      }}
    >
      {/* Hidden file input for photo capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: 'var(--surface, #1a1a1f)',
          borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.1))'
        }}
      >
        <button
          onClick={onCancel}
          className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
          style={{
            width: '48px',
            height: '48px',
            background: 'var(--elevated, #2a2a2f)',
            color: 'var(--text-primary, #ffffff)'
          }}
          aria-label="Back"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="flex-1 mx-4 text-center">
          <div
            className="text-sm font-medium truncate"
            style={{ color: 'var(--text-secondary, rgba(255,255,255,0.7))' }}
          >
            {job.jobCode}
          </div>
          <div
            className="text-base font-bold truncate"
            style={{ color: 'var(--text-primary, #ffffff)' }}
          >
            {job.title}
          </div>
        </div>

        <div
          className="px-3 py-2 rounded-xl text-right"
          style={{
            background: 'var(--elevated, #2a2a2f)',
            minWidth: '80px'
          }}
        >
          <div
            className="text-xs"
            style={{ color: 'var(--text-tertiary, rgba(255,255,255,0.5))' }}
          >
            Total
          </div>
          <div
            className="text-lg font-bold"
            style={{ color: 'var(--success-core, #34C759)' }}
          >
            {footage.toLocaleString()} ft
          </div>
        </div>
      </header>

      {/* ============================================ */}
      {/* MAIN CONTENT - Scrollable */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto">
        {/* FOOTAGE DISPLAY */}
        <div
          className="px-6 py-6"
          style={{ background: 'var(--surface, #1a1a1f)' }}
        >
          <div
            className="text-center py-6 px-4 rounded-2xl"
            style={{
              background: 'var(--base, #0a0a0f)',
              border: '2px solid var(--border-default, rgba(255,255,255,0.15))'
            }}
          >
            <div
              className="text-5xl font-bold tracking-tight"
              style={{
                color: 'var(--text-primary, #ffffff)',
                fontFamily: 'system-ui, -apple-system, monospace'
              }}
            >
              {footageDisplay}
            </div>
            <div
              className="text-lg mt-2"
              style={{ color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}
            >
              feet
            </div>
          </div>

          {/* Clear button */}
          <button
            onClick={handleClear}
            className="w-full mt-3 py-2 rounded-xl text-sm font-medium active:scale-98 transition-transform"
            style={{
              background: 'var(--elevated, #2a2a2f)',
              color: 'var(--text-secondary, rgba(255,255,255,0.7))'
            }}
          >
            Clear
          </button>
        </div>

        {/* NUMERIC KEYPAD */}
        <div
          className="px-4 py-4"
          style={{ background: 'var(--base, #0a0a0f)' }}
        >
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: 'repeat(3, 1fr)'
            }}
          >
            {KEYPAD_BUTTONS.map((key) => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className="flex items-center justify-center rounded-2xl font-bold active:scale-95 transition-all"
                style={{
                  height: '64px',
                  fontSize: key === 'backspace' ? '24px' : '28px',
                  background: pressedKey === key
                    ? 'var(--neural-core, #00D4FF)'
                    : 'var(--elevated, #2a2a2f)',
                  color: pressedKey === key
                    ? '#000000'
                    : 'var(--text-primary, #ffffff)',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))'
                }}
                aria-label={key === 'backspace' ? 'Delete' : key}
              >
                {key === 'backspace' ? (
                  <Delete size={28} />
                ) : (
                  key
                )}
              </button>
            ))}
          </div>
        </div>

        {/* COUNTER TOGGLES */}
        <div
          className="px-4 py-4"
          style={{
            background: 'var(--surface, #1a1a1f)',
            borderTop: '1px solid var(--border-default, rgba(255,255,255,0.1))'
          }}
        >
          <div
            className="text-xs font-medium mb-3 uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary, rgba(255,255,255,0.5))' }}
          >
            Hardware (tap +1, hold -1)
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* Anchor Counter */}
            <CounterToggle
              icon={<Anchor size={24} />}
              label="Anchor"
              emoji={null}
              count={anchorCount}
              onTouchStart={() => handleCounterTouchStart(setAnchorCount)}
              onTouchEnd={(wasLongPress) => handleCounterTouchEnd(setAnchorCount, wasLongPress)}
              onClick={() => handleCounterIncrement(setAnchorCount)}
            />

            {/* Coil Counter */}
            <CounterToggle
              icon={<RefreshCw size={24} />}
              label="Coil"
              emoji={null}
              count={coilCount}
              onTouchStart={() => handleCounterTouchStart(setCoilCount)}
              onTouchEnd={(wasLongPress) => handleCounterTouchEnd(setCoilCount, wasLongPress)}
              onClick={() => handleCounterIncrement(setCoilCount)}
            />

            {/* Snowshoe Counter */}
            <CounterToggle
              icon={<Snowflake size={24} />}
              label="Snowshoe"
              emoji={null}
              count={snowshoeCount}
              onTouchStart={() => handleCounterTouchStart(setSnowshoeCount)}
              onTouchEnd={(wasLongPress) => handleCounterTouchEnd(setSnowshoeCount, wasLongPress)}
              onClick={() => handleCounterIncrement(setSnowshoeCount)}
            />
          </div>
        </div>

        {/* PHOTO SECTION */}
        <div
          className="px-4 py-4"
          style={{
            background: 'var(--base, #0a0a0f)',
            borderTop: '1px solid var(--border-default, rgba(255,255,255,0.1))'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary, rgba(255,255,255,0.5))' }}
            >
              Photos ({photos.length}/{MAX_PHOTOS})
            </div>
            {photos.length < MAX_PHOTOS && (
              <button
                onClick={handleAddPhoto}
                className="flex items-center gap-2 px-4 py-2 rounded-xl active:scale-95 transition-transform"
                style={{
                  background: 'var(--info-core, #007AFF)',
                  color: '#ffffff'
                }}
              >
                <Camera size={18} />
                <span className="text-sm font-medium">Add Photo</span>
              </button>
            )}
          </div>

          {/* Photo thumbnails */}
          {photos.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative flex-shrink-0 rounded-xl overflow-hidden"
                  style={{
                    width: '80px',
                    height: '80px',
                    border: '2px solid var(--border-default, rgba(255,255,255,0.15))'
                  }}
                >
                  <img
                    src={photo.dataUrl}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="absolute top-1 right-1 flex items-center justify-center rounded-full"
                    style={{
                      width: '24px',
                      height: '24px',
                      background: 'rgba(0,0,0,0.7)',
                      color: '#ffffff'
                    }}
                    aria-label="Remove photo"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.length === 0 && (
            <div
              className="text-center py-6 rounded-xl"
              style={{
                background: 'var(--elevated, #2a2a2f)',
                border: '1px dashed var(--border-default, rgba(255,255,255,0.2))'
              }}
            >
              <Camera
                size={32}
                style={{ color: 'var(--text-tertiary, rgba(255,255,255,0.4))', margin: '0 auto' }}
              />
              <div
                className="text-sm mt-2"
                style={{ color: 'var(--text-tertiary, rgba(255,255,255,0.5))' }}
              >
                No photos yet
              </div>
            </div>
          )}
        </div>

        {/* Bottom spacer for submit button */}
        <div style={{ height: '100px' }} />
      </div>

      {/* ============================================ */}
      {/* SUBMIT BUTTON - Fixed at bottom */}
      {/* ============================================ */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 py-4"
        style={{
          background: 'linear-gradient(to top, var(--base, #0a0a0f) 80%, transparent)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))'
        }}
      >
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || footage <= 0}
          className="w-full flex items-center justify-center gap-3 rounded-2xl font-bold text-lg active:scale-98 transition-all"
          style={{
            height: '60px',
            background: footage > 0
              ? 'var(--success-core, #34C759)'
              : 'var(--elevated, #2a2a2f)',
            color: footage > 0 ? '#ffffff' : 'var(--text-tertiary, rgba(255,255,255,0.4))',
            opacity: isSubmitting ? 0.7 : 1
          }}
        >
          {isSubmitting ? (
            <>
              <div
                className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"
              />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Check size={24} />
              <span>Submit {footage > 0 ? `${footage.toLocaleString()} ft` : 'Production'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ============================================
// COUNTER TOGGLE SUB-COMPONENT
// ============================================

interface CounterToggleProps {
  icon: React.ReactNode;
  label: string;
  emoji: string | null;
  count: number;
  onTouchStart: () => void;
  onTouchEnd: (wasLongPress: boolean) => void;
  onClick: () => void;
}

const CounterToggle: React.FC<CounterToggleProps> = ({
  icon,
  label,
  emoji,
  count,
  onTouchStart,
  onTouchEnd,
  onClick
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [wasLongPress, setWasLongPress] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = useCallback(() => {
    setIsPressed(true);
    setWasLongPress(false);

    // Set up long press detection
    longPressTimerRef.current = setTimeout(() => {
      setWasLongPress(true);
      onTouchStart();
    }, 500);
  }, [onTouchStart]);

  const handleTouchEnd = useCallback(() => {
    setIsPressed(false);

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    onTouchEnd(wasLongPress);
  }, [wasLongPress, onTouchEnd]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Prevent double-triggering on touch devices
    e.preventDefault();
  }, []);

  return (
    <button
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={() => {
        if (isPressed) {
          setIsPressed(false);
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      }}
      onClick={handleClick}
      className="flex flex-col items-center justify-center rounded-2xl transition-all"
      style={{
        height: '80px',
        background: isPressed
          ? 'var(--neural-core, #00D4FF)'
          : count > 0
            ? 'var(--success-muted, rgba(52, 199, 89, 0.2))'
            : 'var(--elevated, #2a2a2f)',
        color: isPressed
          ? '#000000'
          : count > 0
            ? 'var(--success-core, #34C759)'
            : 'var(--text-primary, #ffffff)',
        border: count > 0
          ? '2px solid var(--success-core, #34C759)'
          : '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        transform: isPressed ? 'scale(0.95)' : 'scale(1)'
      }}
      aria-label={`${label}: ${count}`}
    >
      <div className="flex items-center gap-1">
        {icon}
      </div>
      <div
        className="text-2xl font-bold mt-1"
        style={{
          color: isPressed
            ? '#000000'
            : count > 0
              ? 'var(--success-core, #34C759)'
              : 'var(--text-primary, #ffffff)'
        }}
      >
        {count}
      </div>
      <div
        className="text-xs font-medium"
        style={{
          color: isPressed
            ? 'rgba(0,0,0,0.7)'
            : 'var(--text-tertiary, rgba(255,255,255,0.5))'
        }}
      >
        {label}
      </div>
    </button>
  );
};

export default QuickProductionEntry;
