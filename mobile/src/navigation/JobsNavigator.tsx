/**
 * NextGen Fiber - JobsNavigator
 * Navigation stack for Jobs/Tasks feature
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { JobsListScreen } from '../screens/JobsListScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';

// ============================================
// TYPES
// ============================================

export type JobsStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: string };
  OfflineQueue: undefined;
};

// ============================================
// NAVIGATOR
// ============================================

const Stack = createNativeStackNavigator<JobsStackParamList>();

export function JobsNavigator(): JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="JobsList"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1F2937',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="JobsList"
        component={JobsListScreen}
        options={{
          title: 'Meus Jobs',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="JobDetail"
        component={JobDetailScreen}
        options={({ route }) => ({
          title: 'Detalhes do Job',
        })}
      />
    </Stack.Navigator>
  );
}
