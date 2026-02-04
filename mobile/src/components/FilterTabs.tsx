/**
 * NextGen Fiber - FilterTabs Component
 * Horizontal scrollable filter tabs for job list
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { JobFilter } from '../hooks/useJobs';

// ============================================
// TYPES
// ============================================

interface FilterTabsProps {
  currentFilter: JobFilter;
  onFilterChange: (filter: JobFilter) => void;
  counts?: Record<JobFilter, number>;
}

// ============================================
// FILTER CONFIG
// ============================================

const FILTERS: { value: JobFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'AVAILABLE', label: 'Disponíveis' },
  { value: 'IN_PROGRESS', label: 'Em Andamento' },
  { value: 'SUBMITTED', label: 'Enviados' },
  { value: 'CLOSED', label: 'Fechados' },
];

// ============================================
// COMPONENT
// ============================================

export function FilterTabs({
  currentFilter,
  onFilterChange,
  counts,
}: FilterTabsProps): JSX.Element {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTERS.map((filter) => {
          const isActive = currentFilter === filter.value;
          const count = counts?.[filter.value];

          return (
            <TouchableOpacity
              key={filter.value}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onFilterChange(filter.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {filter.label}
              </Text>
              {count !== undefined && count > 0 && (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text
                    style={[styles.badgeText, isActive && styles.badgeTextActive]}
                  >
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#1F2937',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
});
