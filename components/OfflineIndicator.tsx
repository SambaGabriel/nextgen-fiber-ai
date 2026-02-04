/**
 * OfflineIndicator - Shows connection status and pending sync count
 * Displays at top of screen when offline or has pending syncs
 */

import React, { useState, useEffect } from 'react';
import { WifiOff, Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { offlineSync } from '../services/offlineSync';

interface OfflineIndicatorProps {
  lang?: 'EN' | 'PT' | 'ES';
}

const translations = {
  EN: {
    offline: 'Offline - Changes saved locally',
    syncing: 'Syncing...',
    pending: 'pending to sync',
    synced: 'All synced!',
    tapToSync: 'Tap to sync now'
  },
  PT: {
    offline: 'Offline - Alterações salvas localmente',
    syncing: 'Sincronizando...',
    pending: 'pendentes para sincronizar',
    synced: 'Tudo sincronizado!',
    tapToSync: 'Toque para sincronizar'
  },
  ES: {
    offline: 'Sin conexión - Cambios guardados localmente',
    syncing: 'Sincronizando...',
    pending: 'pendientes para sincronizar',
    synced: '¡Todo sincronizado!',
    tapToSync: 'Toca para sincronizar'
  }
};

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lang = 'PT' }) => {
  const t = translations[lang];
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Initial state
    setPendingCount(offlineSync.getPendingSyncCount());

    // Listen for connection changes
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Listen for sync queue updates
    const handleQueueUpdate = (e: CustomEvent) => {
      setPendingCount(e.detail.count);
    };

    // Listen for sync complete
    const handleSyncComplete = (e: CustomEvent) => {
      setIsSyncing(false);
      setPendingCount(offlineSync.getPendingSyncCount());
      if (e.detail.success > 0) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('syncQueueUpdated', handleQueueUpdate as EventListener);
    window.addEventListener('syncComplete', handleSyncComplete as EventListener);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('syncQueueUpdated', handleQueueUpdate as EventListener);
      window.removeEventListener('syncComplete', handleSyncComplete as EventListener);
    };
  }, []);

  // Handle manual sync
  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    await offlineSync.syncAll();
  };

  // Don't show if online and nothing pending
  if (isOnline && pendingCount === 0 && !showSuccess) {
    return null;
  }

  // Success message
  if (showSuccess) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-emerald-600 text-white px-4 py-2 flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm font-bold">{t.synced}</span>
      </div>
    );
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 flex items-center justify-between gap-2 animate-in slide-in-from-top duration-300 ${
        isOnline ? 'bg-amber-600' : 'bg-slate-800'
      }`}
      onClick={isOnline && pendingCount > 0 ? handleSync : undefined}
      style={{ cursor: isOnline && pendingCount > 0 ? 'pointer' : 'default' }}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">{t.offline}</span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 text-white animate-spin" />
            <span className="text-sm font-bold text-white">{t.syncing}</span>
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white">
              {pendingCount} {t.pending}
            </span>
          </>
        )}
      </div>

      {isOnline && pendingCount > 0 && !isSyncing && (
        <span className="text-xs text-white/80">{t.tapToSync}</span>
      )}
    </div>
  );
};

export default OfflineIndicator;
