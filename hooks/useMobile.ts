import { useState, useEffect, useCallback, useRef, RefObject } from 'react';

// ============================================================================
// Types
// ============================================================================

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface HapticFeedback {
  light: () => void;
  medium: () => void;
  heavy: () => void;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface SwipeGestureOptions {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export interface SwipeGestureResult {
  swiping: boolean;
  direction: SwipeDirection;
  distance: { x: number; y: number };
}

export interface PullToRefreshResult {
  refreshing: boolean;
  pullDistance: number;
}

export interface OnlineStatus {
  online: boolean;
  effectiveType: string;
}

// ============================================================================
// useIsMobile
// ============================================================================

/**
 * Returns boolean if screen width < 768px
 * Uses matchMedia for performance and listens to resize events
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Legacy browsers (Safari < 14)
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return isMobile;
}

// ============================================================================
// useDeviceType
// ============================================================================

/**
 * Returns 'mobile' | 'tablet' | 'desktop' based on screen width
 * - mobile: < 768px
 * - tablet: 768px - 1024px
 * - desktop: > 1024px
 */
export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1024px)');

    const updateDeviceType = () => {
      if (mobileQuery.matches) {
        setDeviceType('mobile');
      } else if (tabletQuery.matches) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    // Set initial value
    updateDeviceType();

    const handleMobileChange = () => updateDeviceType();
    const handleTabletChange = () => updateDeviceType();

    // Modern browsers
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', handleMobileChange);
      tabletQuery.addEventListener('change', handleTabletChange);
      return () => {
        mobileQuery.removeEventListener('change', handleMobileChange);
        tabletQuery.removeEventListener('change', handleTabletChange);
      };
    } else {
      // Legacy browsers
      mobileQuery.addListener(handleMobileChange);
      tabletQuery.addListener(handleTabletChange);
      return () => {
        mobileQuery.removeListener(handleMobileChange);
        tabletQuery.removeListener(handleTabletChange);
      };
    }
  }, []);

  return deviceType;
}

// ============================================================================
// useSafeArea
// ============================================================================

/**
 * Returns safe area insets for notch devices
 * Uses CSS env() values with fallback to 0
 */
export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const updateInsets = () => {
      // Create a temporary element to compute CSS env() values
      const testElement = document.createElement('div');
      testElement.style.cssText = `
        position: fixed;
        top: env(safe-area-inset-top, 0px);
        bottom: env(safe-area-inset-bottom, 0px);
        left: env(safe-area-inset-left, 0px);
        right: env(safe-area-inset-right, 0px);
        pointer-events: none;
        visibility: hidden;
      `;
      document.body.appendChild(testElement);

      const computedStyle = window.getComputedStyle(testElement);

      setInsets({
        top: parseInt(computedStyle.top, 10) || 0,
        bottom: parseInt(computedStyle.bottom, 10) || 0,
        left: parseInt(computedStyle.left, 10) || 0,
        right: parseInt(computedStyle.right, 10) || 0,
      });

      document.body.removeChild(testElement);
    };

    updateInsets();

    // Update on orientation change
    window.addEventListener('orientationchange', updateInsets);
    window.addEventListener('resize', updateInsets);

    return () => {
      window.removeEventListener('orientationchange', updateInsets);
      window.removeEventListener('resize', updateInsets);
    };
  }, []);

  return insets;
}

// ============================================================================
// useHapticFeedback
// ============================================================================

/**
 * Provides haptic feedback functions
 * Uses navigator.vibrate if available, no-op fallback for unsupported devices
 */
export function useHapticFeedback(): HapticFeedback {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Silently fail if vibration not supported
      }
    }
  }, []);

  const light = useCallback(() => {
    vibrate(10);
  }, [vibrate]);

  const medium = useCallback(() => {
    vibrate(25);
  }, [vibrate]);

  const heavy = useCallback(() => {
    vibrate([50, 10, 50]);
  }, [vibrate]);

  return { light, medium, heavy };
}

// ============================================================================
// useSwipeGesture
// ============================================================================

/**
 * Swipe detection hook
 * Detects left, right, up, down swipes with configurable threshold
 */
export function useSwipeGesture(
  ref: RefObject<HTMLElement | null>,
  options: SwipeGestureOptions = {}
): SwipeGestureResult {
  const {
    threshold = 50,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
  } = options;

  const [swiping, setSwiping] = useState(false);
  const [direction, setDirection] = useState<SwipeDirection>(null);
  const [distance, setDistance] = useState({ x: 0, y: 0 });

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const currentDistance = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
      currentDistance.current = { x: 0, y: 0 };
      setSwiping(true);
      setDirection(null);
      setDistance({ x: 0, y: 0 });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;

      currentDistance.current = { x: deltaX, y: deltaY };
      setDistance({ x: deltaX, y: deltaY });

      // Determine direction based on which axis has more movement
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY && absX > threshold / 2) {
        setDirection(deltaX > 0 ? 'right' : 'left');
      } else if (absY > absX && absY > threshold / 2) {
        setDirection(deltaY > 0 ? 'down' : 'up');
      }
    };

    const handleTouchEnd = () => {
      if (!touchStart.current) return;

      const { x: deltaX, y: deltaY } = currentDistance.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Trigger callbacks if threshold is met
      if (absX > absY && absX >= threshold) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } else if (absY > absX && absY >= threshold) {
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }

      // Reset state
      touchStart.current = null;
      currentDistance.current = { x: 0, y: 0 };
      setSwiping(false);
      setDirection(null);
      setDistance({ x: 0, y: 0 });
    };

    const handleTouchCancel = () => {
      touchStart.current = null;
      currentDistance.current = { x: 0, y: 0 };
      setSwiping(false);
      setDirection(null);
      setDistance({ x: 0, y: 0 });
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [ref, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return { swiping, direction, distance };
}

// ============================================================================
// usePullToRefresh
// ============================================================================

/**
 * Pull-to-refresh hook
 * Triggers onRefresh when pulled past threshold
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  options: { threshold?: number; disabled?: boolean } = {}
): PullToRefreshResult {
  const { threshold = 80, disabled = false } = options;

  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const touchStartY = useRef<number | null>(null);
  const currentPullDistance = useRef(0);
  const isAtTop = useRef(true);

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull-to-refresh if scrolled to top
      isAtTop.current = window.scrollY <= 0;
      if (isAtTop.current) {
        touchStartY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY.current === null || !isAtTop.current || refreshing) return;

      const touchY = e.touches[0].clientY;
      const delta = touchY - touchStartY.current;

      // Only track downward pull
      if (delta > 0) {
        // Apply resistance to pull
        const resistance = 0.5;
        const adjustedDelta = delta * resistance;
        const newDistance = Math.min(adjustedDelta, threshold * 1.5);
        currentPullDistance.current = newDistance;
        setPullDistance(newDistance);
      }
    };

    const handleTouchEnd = async () => {
      if (touchStartY.current === null) return;

      const finalDistance = currentPullDistance.current;

      if (finalDistance >= threshold && !refreshing) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }

      touchStartY.current = null;
      currentPullDistance.current = 0;
      setPullDistance(0);
    };

    const handleTouchCancel = () => {
      touchStartY.current = null;
      currentPullDistance.current = 0;
      setPullDistance(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [disabled, threshold, refreshing, onRefresh]);

  return { refreshing, pullDistance };
}

// ============================================================================
// useOnlineStatus
// ============================================================================

interface NavigatorConnection {
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

declare global {
  interface Navigator {
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  }
}

/**
 * Network status hook
 * Returns online status and effective connection type
 */
export function useOnlineStatus(): OnlineStatus {
  const getConnection = (): NavigatorConnection | undefined => {
    if (typeof navigator === 'undefined') return undefined;
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  };

  const [status, setStatus] = useState<OnlineStatus>(() => {
    if (typeof navigator === 'undefined') {
      return { online: true, effectiveType: 'unknown' };
    }
    const connection = getConnection();
    return {
      online: navigator.onLine ?? true,
      effectiveType: connection?.effectiveType ?? 'unknown',
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOnlineStatus = () => {
      const connection = getConnection();
      setStatus({
        online: navigator.onLine ?? true,
        effectiveType: connection?.effectiveType ?? 'unknown',
      });
    };

    const handleOnline = () => {
      updateOnlineStatus();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, online: false }));
    };

    const handleConnectionChange = () => {
      updateOnlineStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = getConnection();
    if (connection?.addEventListener) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      const conn = getConnection();
      if (conn?.removeEventListener) {
        conn.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return status;
}

// ============================================================================
// Legacy exports for backwards compatibility
// ============================================================================

/**
 * Hook that returns both mobile state and a manual toggle
 * Useful for testing or forcing mobile view
 */
export function useMobileWithToggle() {
  const isMobileViewport = useIsMobile();
  const [forceMobile, setForceMobile] = useState(false);

  const toggleMobile = useCallback(() => {
    setForceMobile(prev => !prev);
  }, []);

  return {
    isMobile: forceMobile || isMobileViewport,
    isMobileViewport,
    forceMobile,
    toggleMobile,
    setForceMobile
  };
}

export default useIsMobile;
