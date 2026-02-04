/**
 * NextGen Fiber - MapViewer Component
 * Displays job map asset with zoom/pan capabilities
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Linking,
} from 'react-native';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';
import { MapAsset, MapAssetType } from '../types/jobs';
import { trackEvent } from '../services/telemetry';

// ============================================
// TYPES
// ============================================

interface MapViewerProps {
  mapAsset: MapAsset | null;
  jobId: string;
}

// ============================================
// COMPONENT
// ============================================

export function MapViewer({ mapAsset, jobId }: MapViewerProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const zoomableViewRef = useRef(null);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    trackEvent({ type: 'MAP_VIEWED', jobId, assetType: mapAsset?.type || MapAssetType.IMAGE });
  }, [jobId, mapAsset?.type]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleZoom = useCallback(() => {
    trackEvent({ type: 'MAP_ZOOMED', jobId });
  }, [jobId]);

  const openExternal = useCallback(() => {
    if (mapAsset?.url) {
      Linking.openURL(mapAsset.url);
    }
  }, [mapAsset?.url]);

  // No map asset
  if (!mapAsset) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyText}>Nenhum mapa disponível</Text>
      </View>
    );
  }

  // External link
  if (mapAsset.type === MapAssetType.EXTERNAL_LINK) {
    return (
      <View style={styles.externalContainer}>
        <Text style={styles.externalIcon}>🔗</Text>
        <Text style={styles.externalText}>Mapa externo</Text>
        <TouchableOpacity style={styles.externalButton} onPress={openExternal}>
          <Text style={styles.externalButtonText}>Abrir no navegador</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // PDF - open externally
  if (mapAsset.type === MapAssetType.PDF) {
    return (
      <View style={styles.pdfContainer}>
        <Text style={styles.pdfIcon}>📄</Text>
        <Text style={styles.pdfFilename}>{mapAsset.fileName}</Text>
        <Text style={styles.pdfSize}>
          {(mapAsset.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
        </Text>
        <TouchableOpacity style={styles.pdfButton} onPress={openExternal}>
          <Text style={styles.pdfButtonText}>Abrir PDF</Text>
        </TouchableOpacity>
        {mapAsset.cachedLocally && (
          <Text style={styles.cachedBadge}>✓ Disponível offline</Text>
        )}
      </View>
    );
  }

  // Image viewer
  const imageUrl = mapAsset.cachedLocally && mapAsset.localPath
    ? `file://${mapAsset.localPath}`
    : mapAsset.url;

  const renderImage = (fullscreen: boolean = false) => (
    <View style={fullscreen ? styles.fullscreenImageContainer : styles.imageContainer}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Carregando mapa...</Text>
        </View>
      )}

      {hasError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Erro ao carregar mapa</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              setIsLoading(true);
            }}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ReactNativeZoomableView
          ref={zoomableViewRef}
          maxZoom={5}
          minZoom={0.5}
          initialZoom={1}
          bindToBorders={true}
          onZoomAfter={handleZoom}
          style={styles.zoomableView}
        >
          <Image
            source={{ uri: imageUrl }}
            style={fullscreen ? styles.fullscreenImage : styles.image}
            resizeMode="contain"
            onLoad={handleLoad}
            onError={handleError}
          />
        </ReactNativeZoomableView>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Thumbnail view */}
      <TouchableOpacity
        style={styles.thumbnailContainer}
        onPress={() => setIsFullscreen(true)}
        activeOpacity={0.9}
      >
        {renderImage(false)}
        <View style={styles.expandHint}>
          <Text style={styles.expandHintText}>Toque para expandir</Text>
        </View>
      </TouchableOpacity>

      {/* Cache indicator */}
      {mapAsset.cachedLocally && (
        <View style={styles.offlineBadge}>
          <Text style={styles.offlineBadgeText}>✓ Offline</Text>
        </View>
      )}

      {/* Fullscreen modal */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setIsFullscreen(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          {renderImage(true)}
        </View>
      </Modal>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },

  // External link
  externalContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  externalIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  externalText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  externalButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  externalButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // PDF
  pdfContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  pdfIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  pdfFilename: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  pdfSize: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  pdfButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  pdfButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cachedBadge: {
    marginTop: 12,
    fontSize: 12,
    color: '#059669',
  },

  // Image viewer
  thumbnailContainer: {
    height: 200,
    position: 'relative',
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#1F2937',
  },
  zoomableView: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  expandHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expandHintText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  offlineBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  offlineBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // Fullscreen
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenImageContainer: {
    flex: 1,
  },
  fullscreenImage: {
    width: screenWidth,
    height: screenHeight,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
});
