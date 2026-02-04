/**
 * NextGen Fiber Mobile App
 * Entry point
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JobsNavigator } from './src/navigation/JobsNavigator';
import { initOfflineQueue } from './src/services/offlineQueue';
import { initTelemetry } from './src/services/telemetry';

export default function App() {
  useEffect(() => {
    // Initialize services
    initOfflineQueue();
    initTelemetry(null); // TODO: Pass actual user ID after auth
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <JobsNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
