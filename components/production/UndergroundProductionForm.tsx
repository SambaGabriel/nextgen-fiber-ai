/**
 * Underground Production Form Component
 * Foreman daily entry form for day rate + conduit work
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Ruler, Save, Plus, Trash2, Clock, Award, AlertCircle,
  ChevronDown, Check, HardHat
} from 'lucide-react';
import {
  createDailyEntry,
  getJobDailyEntries,
  updateDailyEntry,
  deleteDailyEntry,
  getForemanBonusProgress,
  FOREMAN_PAY
} from '../../services/undergroundCalculationService';
import type { UndergroundDailyEntry } from '../../types/payroll';
import type { GroundType } from '../../types/equipment';
import type { User } from '../../types';

interface Props {
  jobId: string;
  user: User | null;
  onSave?: () => void;
}

const GROUND_TYPES: { value: GroundType; label: string; color: string }[] = [
  { value: 'Normal', label: 'Normal Ground', color: 'var(--success-core)' },
  { value: 'Cobble', label: 'Cobble/Gravel', color: 'var(--warning-core)' },
  { value: 'Rock', label: 'Rock', color: 'var(--critical-core)' }
];

const UndergroundProductionForm: React.FC<Props> = ({ jobId, user, onSave }) => {
  const [entries, setEntries] = useState<UndergroundDailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [bonusProgress, setBonusProgress] = useState<{
    currentFootage: number;
    targetFootage: number;
    percentComplete: number;
    isEligible: boolean;
    bonusAmount: number;
  } | null>(null);

  // Form for new entry
  const [newEntry, setNewEntry] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    isFullDay: true,
    isHalfDay: false,
    conduitFeet: 0,
    groundType: 'Normal' as GroundType,
    notes: ''
  });

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [entriesData, progressData] = await Promise.all([
        getJobDailyEntries(jobId),
        getForemanBonusProgress(user.id)
      ]);
      setEntries(entriesData);
      setBonusProgress(progressData);
    } catch (err) {
      console.error('[UndergroundProductionForm] Error loading data:', err);
    }
    setLoading(false);
  }, [jobId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle day type toggle
  const handleDayType = (type: 'full' | 'half' | 'none') => {
    setNewEntry({
      ...newEntry,
      isFullDay: type === 'full',
      isHalfDay: type === 'half'
    });
  };

  // Save new entry
  const handleSave = async () => {
    if (!user?.id) return;

    if (!newEntry.entryDate) {
      setError('Please select a date');
      return;
    }

    if (!newEntry.isFullDay && !newEntry.isHalfDay && newEntry.conduitFeet === 0) {
      setError('Please enter day type or conduit footage');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await createDailyEntry({
        jobId,
        entryDate: newEntry.entryDate,
        isFullDay: newEntry.isFullDay,
        isHalfDay: newEntry.isHalfDay,
        conduitFeet: newEntry.conduitFeet,
        groundType: newEntry.groundType,
        notes: newEntry.notes || undefined,
        createdBy: user.id
      });

      // Reset form
      setNewEntry({
        entryDate: new Date().toISOString().split('T')[0],
        isFullDay: true,
        isHalfDay: false,
        conduitFeet: 0,
        groundType: 'Normal',
        notes: ''
      });

      // Reload data
      await loadData();
      onSave?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save entry');
    }

    setSaving(false);
  };

  // Delete entry
  const handleDelete = async (entryId: string) => {
    if (!confirm('Delete this entry?')) return;

    try {
      await deleteDailyEntry(entryId);
      await loadData();
    } catch (err) {
      console.error('[UndergroundProductionForm] Error deleting:', err);
    }
  };

  // Calculate estimated pay for current form
  const calculateEstimatedPay = () => {
    let total = 0;

    if (newEntry.isFullDay) total += FOREMAN_PAY.fullDay;
    if (newEntry.isHalfDay) total += FOREMAN_PAY.halfDay;

    if (newEntry.conduitFeet > 0) {
      if (newEntry.conduitFeet <= 500) {
        total += newEntry.conduitFeet * FOREMAN_PAY.conduitLte500;
      } else {
        total += (500 * FOREMAN_PAY.conduitLte500) + ((newEntry.conduitFeet - 500) * FOREMAN_PAY.conduitGt500);
      }
    }

    return total;
  };

  return (
    <div className="space-y-6">
      {/* Bonus Progress Bar */}
      {bonusProgress && (
        <div
          className="p-4 rounded-2xl"
          style={{
            background: bonusProgress.isEligible ? 'var(--success-dim)' : 'var(--surface)',
            border: `2px solid ${bonusProgress.isEligible ? 'var(--success-core)' : 'var(--border-default)'}`
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5" style={{ color: bonusProgress.isEligible ? 'var(--success-core)' : 'var(--warning-core)' }} />
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Weekly Bonus: {bonusProgress.currentFootage.toLocaleString()} / {bonusProgress.targetFootage.toLocaleString()} ft
              </span>
            </div>
            {bonusProgress.isEligible ? (
              <span className="text-sm font-bold" style={{ color: 'var(--success-core)' }}>
                +${bonusProgress.bonusAmount} EARNED!
              </span>
            ) : (
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {(bonusProgress.targetFootage - bonusProgress.currentFootage).toLocaleString()} ft to go
              </span>
            )}
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(bonusProgress.percentComplete, 100)}%`,
                background: bonusProgress.isEligible ? 'var(--success-core)' : 'var(--warning-core)'
              }}
            />
          </div>
        </div>
      )}

      {/* New Entry Form */}
      <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
        <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Add Daily Entry
        </h3>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Date
            </label>
            <div className="relative">
              <Calendar className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="date"
                value={newEntry.entryDate}
                onChange={(e) => setNewEntry({ ...newEntry, entryDate: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          {/* Day Type */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Day Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleDayType('full')}
                className="py-3 rounded-xl text-center transition-all"
                style={{
                  background: newEntry.isFullDay ? 'var(--neural-dim)' : 'var(--elevated)',
                  border: newEntry.isFullDay ? '2px solid var(--neural-core)' : '1px solid var(--border-default)',
                  color: newEntry.isFullDay ? 'var(--neural-core)' : 'var(--text-secondary)'
                }}
              >
                <p className="font-bold">Full Day</p>
                <p className="text-xs">${FOREMAN_PAY.fullDay}</p>
              </button>
              <button
                onClick={() => handleDayType('half')}
                className="py-3 rounded-xl text-center transition-all"
                style={{
                  background: newEntry.isHalfDay ? 'var(--neural-dim)' : 'var(--elevated)',
                  border: newEntry.isHalfDay ? '2px solid var(--neural-core)' : '1px solid var(--border-default)',
                  color: newEntry.isHalfDay ? 'var(--neural-core)' : 'var(--text-secondary)'
                }}
              >
                <p className="font-bold">Half Day</p>
                <p className="text-xs">${FOREMAN_PAY.halfDay}</p>
              </button>
              <button
                onClick={() => handleDayType('none')}
                className="py-3 rounded-xl text-center transition-all"
                style={{
                  background: !newEntry.isFullDay && !newEntry.isHalfDay ? 'var(--neural-dim)' : 'var(--elevated)',
                  border: !newEntry.isFullDay && !newEntry.isHalfDay ? '2px solid var(--neural-core)' : '1px solid var(--border-default)',
                  color: !newEntry.isFullDay && !newEntry.isHalfDay ? 'var(--neural-core)' : 'var(--text-secondary)'
                }}
              >
                <p className="font-bold">Conduit Only</p>
                <p className="text-xs">No day rate</p>
              </button>
            </div>
          </div>

          {/* Conduit Feet */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Conduit Installed (feet)
            </label>
            <div className="relative">
              <Ruler className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="number"
                value={newEntry.conduitFeet || ''}
                onChange={(e) => setNewEntry({ ...newEntry, conduitFeet: parseInt(e.target.value) || 0 })}
                placeholder="0"
                min="0"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
              First 500 ft: ${FOREMAN_PAY.conduitLte500}/ft · Above 500 ft: ${FOREMAN_PAY.conduitGt500}/ft
            </p>
          </div>

          {/* Ground Type */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Ground Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {GROUND_TYPES.map(gt => (
                <button
                  key={gt.value}
                  onClick={() => setNewEntry({ ...newEntry, groundType: gt.value })}
                  className="py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: newEntry.groundType === gt.value ? 'var(--neural-dim)' : 'var(--elevated)',
                    border: newEntry.groundType === gt.value ? '2px solid var(--neural-core)' : '1px solid var(--border-default)',
                    color: newEntry.groundType === gt.value ? 'var(--neural-core)' : 'var(--text-secondary)'
                  }}
                >
                  {gt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Notes (optional)
            </label>
            <textarea
              value={newEntry.notes}
              onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
              placeholder="Any notes about today's work..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl text-sm resize-none"
              style={{
                background: 'var(--elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Estimated Pay */}
          <div
            className="p-4 rounded-xl flex items-center justify-between"
            style={{ background: 'var(--neural-dim)', border: '1px solid var(--neural-core)' }}
          >
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Estimated Pay:</span>
            <span className="text-xl font-bold" style={{ color: 'var(--neural-core)' }}>
              ${calculateEstimatedPay().toFixed(2)}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'var(--critical-dim)', color: 'var(--critical-core)' }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all"
            style={{ background: 'var(--neural-core)' }}
          >
            {saving ? (
              <div className="animate-spin w-5 h-5 border-2 rounded-full border-white border-t-transparent" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Entry
              </>
            )}
          </button>
        </div>
      </div>

      {/* Existing Entries */}
      <div className="rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
            This Job's Entries ({entries.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 rounded-full" style={{ borderColor: 'var(--neural-core)', borderTopColor: 'transparent' }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
            No entries yet
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {entries.map(entry => (
              <div key={entry.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--warning-dim)' }}
                  >
                    <HardHat className="w-6 h-6" style={{ color: 'var(--warning-core)' }} />
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {new Date(entry.entryDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {entry.isFullDay ? 'Full Day' : entry.isHalfDay ? 'Half Day' : 'Conduit Only'}
                      {entry.conduitFeet > 0 && ` · ${entry.conduitFeet.toLocaleString()} ft`}
                      {` · ${entry.groundType}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold" style={{ color: 'var(--success-core)' }}>
                    ${(
                      (entry.isFullDay ? FOREMAN_PAY.fullDay : entry.isHalfDay ? FOREMAN_PAY.halfDay : 0) +
                      (entry.conduitFeet <= 500
                        ? entry.conduitFeet * FOREMAN_PAY.conduitLte500
                        : 500 * FOREMAN_PAY.conduitLte500 + (entry.conduitFeet - 500) * FOREMAN_PAY.conduitGt500)
                    ).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: 'var(--critical-core)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UndergroundProductionForm;
