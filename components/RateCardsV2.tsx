/**
 * RateCards V2 - Multi-column rates with Groups, Profiles, and Excel Import
 * MVP Implementation
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Plus, Search, Edit2, Save, X, Check, AlertCircle,
  Loader2, Building2, MapPin, Upload, FileText, FolderOpen,
  ArrowLeft, Download, Copy, ChevronDown, FileSpreadsheet
} from 'lucide-react';
import { Language, User } from '../types';
import {
  getGroups, getProfiles, getItems, updateItem, createProfile, importItems,
  RateCardGroup, RateCardProfile, RateCardItem
} from '../services/rateCardService';
import { parseExcelFile, createTemplateExcel, ParseResult } from '../services/excelParser';

interface RateCardsV2Props {
  user: User;
  lang: Language;
}

// Customers list
const CUSTOMERS = [
  'Brightspeed', 'AT&T', 'Spectrum', 'Verizon', 'Lumen', 'Frontier', 'Other'
];

// Regions (US States)
const REGIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const RateCardsV2: React.FC<RateCardsV2Props> = ({ user, lang }) => {
  // Data state
  const [groups, setGroups] = useState<RateCardGroup[]>([]);
  const [profiles, setProfiles] = useState<RateCardProfile[]>([]);
  const [items, setItems] = useState<RateCardItem[]>([]);

  // Selection state
  const [selectedGroup, setSelectedGroup] = useState<RateCardGroup | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<RateCardProfile | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    nextgen_rate: string;
    lineman_rate: string;
    truck_investor_rate: string;
  }>({ nextgen_rate: '', lineman_rate: '', truck_investor_rate: '' });

  // Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ParseResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // Create profile state
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileType, setNewProfileType] = useState<'NEXTGEN' | 'LINEMAN' | 'INVESTOR'>('NEXTGEN');
  const [duplicateFromProfile, setDuplicateFromProfile] = useState<string>('');

  // Create group state
  const [newGroupCustomer, setNewGroupCustomer] = useState('');
  const [newGroupRegion, setNewGroupRegion] = useState('');

  // Load groups on mount
  useEffect(() => {
    loadGroups();
  }, []);

  // Load profiles when group changes
  useEffect(() => {
    if (selectedGroup) {
      loadProfiles(selectedGroup.id);
    } else {
      setProfiles([]);
      setSelectedProfile(null);
    }
  }, [selectedGroup]);

  // Load items when profile changes
  useEffect(() => {
    if (selectedGroup && selectedProfile) {
      loadItems(selectedGroup.id, selectedProfile.id);
    } else {
      setItems([]);
    }
  }, [selectedGroup, selectedProfile]);

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await getGroups();
      setGroups(data);

      // Auto-select first group if exists
      if (data.length > 0 && !selectedGroup) {
        setSelectedGroup(data[0]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfiles = async (groupId: string) => {
    try {
      const data = await getProfiles(groupId);
      setProfiles(data);

      // Auto-select default or first profile
      const defaultProfile = data.find(p => p.is_default) || data[0];
      if (defaultProfile) {
        setSelectedProfile(defaultProfile);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const loadItems = async (groupId: string, profileId: string) => {
    setIsLoading(true);
    try {
      const data = await getItems(groupId, profileId);
      setItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter items by search
  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.code.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
    );
  });

  // Start editing an item
  const startEditing = (item: RateCardItem) => {
    setEditingItemId(item.id);
    setEditValues({
      nextgen_rate: item.nextgen_rate.toString(),
      lineman_rate: item.lineman_rate.toString(),
      truck_investor_rate: item.truck_investor_rate.toString(),
    });
  };

  // Save edited item
  const saveEditing = async () => {
    if (!editingItemId) return;

    try {
      await updateItem(editingItemId, {
        nextgen_rate: parseFloat(editValues.nextgen_rate) || 0,
        lineman_rate: parseFloat(editValues.lineman_rate) || 0,
        truck_investor_rate: parseFloat(editValues.truck_investor_rate) || 0,
      });

      // Reload items
      if (selectedGroup && selectedProfile) {
        await loadItems(selectedGroup.id, selectedProfile.id);
      }

      setEditingItemId(null);
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingItemId(null);
    setEditValues({ nextgen_rate: '', lineman_rate: '', truck_investor_rate: '' });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError('');
    setImportPreview(null);

    try {
      const result = await parseExcelFile(file);
      setImportPreview(result);
    } catch (error: any) {
      setImportError(error.message || 'Failed to parse file');
    }
  };

  // Confirm import
  const confirmImport = async () => {
    if (!importPreview || !selectedGroup || !selectedProfile) return;

    setIsImporting(true);
    try {
      // Import from all sheets
      let totalCreated = 0;
      let totalUpdated = 0;

      for (const sheet of importPreview.sheets) {
        const itemsWithActive = sheet.items.map(item => ({
          ...item,
          is_active: true
        }));
        const result = await importItems(
          selectedGroup.id,
          selectedProfile.id,
          itemsWithActive
        );
        totalCreated += result.created;
        totalUpdated += result.updated;
      }

      // Reload items
      await loadItems(selectedGroup.id, selectedProfile.id);

      // Close modal
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview(null);

      alert(`Import complete: ${totalCreated} created, ${totalUpdated} updated`);
    } catch (error: any) {
      setImportError(error.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Create new profile
  const handleCreateProfile = async () => {
    if (!selectedGroup || !newProfileName.trim()) return;

    try {
      const profile = await createProfile(
        selectedGroup.id,
        newProfileName.trim(),
        newProfileType,
        false,
        duplicateFromProfile || undefined
      );

      await loadProfiles(selectedGroup.id);
      setSelectedProfile(profile);

      setShowCreateProfileModal(false);
      setNewProfileName('');
      setDuplicateFromProfile('');
    } catch (error: any) {
      alert('Error creating profile: ' + error.message);
    }
  };

  // Download template
  const downloadTemplate = () => {
    const blob = createTemplateExcel();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate_card_template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format currency
  const formatRate = (rate: number) => {
    return `$${rate.toFixed(2)}`;
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--abyss)' }}>
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl" style={{ background: 'var(--neural-dim)' }}>
              <DollarSign className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Rate Cards
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {selectedGroup ? `${selectedGroup.customer_name} - ${selectedGroup.region}` : 'Select a customer/region'}
                {selectedProfile && ` • ${selectedProfile.name}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
            >
              <Download className="w-4 h-4" />
              Template
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-105"
              style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            >
              <Upload className="w-5 h-5" />
              Import Excel
            </button>
          </div>
        </div>

        {/* Filters: Customer → Region → Profile */}
        <div className="flex items-center gap-4">
          {/* Customer/Region Selector */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            <select
              value={selectedGroup?.id || ''}
              onChange={(e) => {
                const group = groups.find(g => g.id === e.target.value);
                setSelectedGroup(group || null);
              }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none cursor-pointer"
              style={{
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)'
              }}
            >
              <option value="">Select Customer/Region</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.customer_name} - {g.region}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="p-2 rounded-lg hover:bg-white/10"
              title="Add Customer/Region"
            >
              <Plus className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
            </button>
          </div>

          {/* Profile Selector */}
          {selectedGroup && (
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <select
                value={selectedProfile?.id || ''}
                onChange={(e) => {
                  const profile = profiles.find(p => p.id === e.target.value);
                  setSelectedProfile(profile || null);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none cursor-pointer"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)'
                }}
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_default ? '(Default)' : ''} - {p.type}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowCreateProfileModal(true)}
                className="p-2 rounded-lg hover:bg-white/10"
                title="Add Profile"
              >
                <Plus className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
              </button>
            </div>
          )}

          {/* Search */}
          <div className="flex-1 max-w-md ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search by code or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium outline-none"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
          </div>
        ) : !selectedGroup || !selectedProfile ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Building2 className="w-16 h-16" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
              Select a customer and region to view rates
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <FileSpreadsheet className="w-16 h-16" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
              No rate items found
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
            >
              <Upload className="w-4 h-4" />
              Import from Excel
            </button>
          </div>
        ) : (
          /* Rate Items Table */
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--elevated)' }}>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Description
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Unit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider" style={{ color: 'var(--success)' }}>
                    NextGen
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider" style={{ color: 'var(--warning)' }}>
                    Lineman
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider" style={{ color: 'var(--info)' }}>
                    Investor
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-4 py-4">
                      <span
                        className="px-2 py-1 rounded-lg text-xs font-bold uppercase"
                        style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
                      >
                        {item.code}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {item.description || '-'}
                    </td>
                    <td className="px-4 py-4 text-center text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {item.unit === 'FT' ? 'Per Foot' : item.unit === 'EA' ? 'Each' : item.unit}
                    </td>

                    {/* Editable Rate Cells */}
                    {editingItemId === item.id ? (
                      <>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.nextgen_rate}
                            onChange={(e) => setEditValues({ ...editValues, nextgen_rate: e.target.value })}
                            className="w-20 px-2 py-1 rounded text-right text-sm font-bold"
                            style={{ background: 'var(--elevated)', color: 'var(--success)', border: '1px solid var(--success)' }}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.lineman_rate}
                            onChange={(e) => setEditValues({ ...editValues, lineman_rate: e.target.value })}
                            className="w-20 px-2 py-1 rounded text-right text-sm font-bold"
                            style={{ background: 'var(--elevated)', color: 'var(--warning)', border: '1px solid var(--warning)' }}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.truck_investor_rate}
                            onChange={(e) => setEditValues({ ...editValues, truck_investor_rate: e.target.value })}
                            className="w-20 px-2 py-1 rounded text-right text-sm font-bold"
                            style={{ background: 'var(--elevated)', color: 'var(--info)', border: '1px solid var(--info)' }}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4 text-right text-lg font-black" style={{ color: 'var(--success)' }}>
                          {formatRate(item.nextgen_rate)}
                        </td>
                        <td className="px-4 py-4 text-right text-lg font-black" style={{ color: 'var(--warning)' }}>
                          {item.lineman_rate > 0 ? formatRate(item.lineman_rate) : '-'}
                        </td>
                        <td className="px-4 py-4 text-right text-lg font-black" style={{ color: 'var(--info)' }}>
                          {item.truck_investor_rate > 0 ? formatRate(item.truck_investor_rate) : '-'}
                        </td>
                      </>
                    )}

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {editingItemId === item.id ? (
                          <>
                            <button
                              onClick={saveEditing}
                              className="p-2 rounded-lg transition-colors hover:bg-green-500/20"
                              title="Save"
                            >
                              <Check className="w-4 h-4" style={{ color: 'var(--success)' }} />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" style={{ color: '#EF4444' }} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEditing(item)}
                            className="p-2 rounded-lg transition-colors hover:bg-white/10"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer */}
            <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--elevated)' }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Showing {filteredItems.length} of {items.length} items
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                  <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                    Import Rate Card
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Upload Excel file with rate data
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview(null);
                  setImportError('');
                }}
                className="p-2 rounded-xl transition-colors hover:bg-white/10"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {importError && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: '#EF4444' }}>
                  <AlertCircle className="w-4 h-4" />
                  {importError}
                </div>
              </div>
            )}

            {!importPreview ? (
              /* File Upload */
              <div className="space-y-4">
                <div
                  className="relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer hover:border-opacity-100"
                  style={{ borderColor: importFile ? 'var(--neural-core)' : 'var(--border-default)' }}
                  onClick={() => document.getElementById('excel-upload')?.click()}
                >
                  <input
                    id="excel-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {importFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="w-10 h-10" style={{ color: 'var(--neural-core)' }} />
                      <div className="text-left">
                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{importFile.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {(importFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Click to upload Excel file
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        .xlsx or .xls format
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-6 py-3 rounded-xl text-sm font-bold uppercase"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Preview */
              <div className="space-y-4">
                <div className="p-3 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--neural-core)' }}>
                    Found {importPreview.summary.totalItems} items in {importPreview.summary.totalSheets} sheet(s)
                  </p>
                  {importPreview.summary.totalWarnings > 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--warning)' }}>
                      {importPreview.summary.totalWarnings} warning(s)
                    </p>
                  )}
                </div>

                {/* Preview Table */}
                <div className="rounded-xl overflow-hidden max-h-[300px] overflow-auto" style={{ background: 'var(--elevated)', border: '1px solid var(--border-default)' }}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>Code</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>Description</th>
                        <th className="px-3 py-2 text-right text-xs font-bold uppercase" style={{ color: 'var(--success)' }}>NextGen</th>
                        <th className="px-3 py-2 text-right text-xs font-bold uppercase" style={{ color: 'var(--warning)' }}>Lineman</th>
                        <th className="px-3 py-2 text-right text-xs font-bold uppercase" style={{ color: 'var(--info)' }}>Investor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.sheets.flatMap(sheet =>
                        sheet.items.slice(0, 20).map((item, idx) => (
                          <tr key={`${sheet.sheetName}-${idx}`} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                            <td className="px-3 py-2 font-bold" style={{ color: 'var(--neural-core)' }}>{item.code}</td>
                            <td className="px-3 py-2 truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>{item.description}</td>
                            <td className="px-3 py-2 text-right font-bold" style={{ color: 'var(--success)' }}>${item.nextgen_rate.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-bold" style={{ color: 'var(--warning)' }}>
                              {item.lineman_rate > 0 ? `$${item.lineman_rate.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-bold" style={{ color: 'var(--info)' }}>
                              {item.truck_investor_rate > 0 ? `$${item.truck_investor_rate.toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Warnings */}
                {importPreview.sheets.some(s => s.warnings.length > 0) && (
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(234, 179, 8, 0.1)' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: 'var(--warning)' }}>Warnings:</p>
                    {importPreview.sheets.flatMap(s => s.warnings.slice(0, 5)).map((w, i) => (
                      <p key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Row {w.row}: {w.message}
                      </p>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    onClick={() => {
                      setImportPreview(null);
                      setImportFile(null);
                    }}
                    className="flex items-center gap-2 text-sm font-bold"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowImportModal(false)}
                      className="px-6 py-3 rounded-xl text-sm font-bold uppercase"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmImport}
                      disabled={isImporting || importPreview.summary.totalErrors > 0}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase transition-all hover:scale-105 disabled:opacity-50"
                      style={{ background: 'var(--gradient-neural)', color: '#000' }}
                    >
                      {isImporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Import {importPreview.summary.totalItems} Items
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Profile Modal */}
      {showCreateProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full max-w-md rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                Create Profile
              </h2>
              <button
                onClick={() => setShowCreateProfileModal(false)}
                className="p-2 rounded-xl transition-colors hover:bg-white/10"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Profile Name
                </label>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="e.g., Crew A, Investor X"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Profile Type
                </label>
                <select
                  value={newProfileType}
                  onChange={(e) => setNewProfileType(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                >
                  <option value="NEXTGEN">NextGen (Company)</option>
                  <option value="LINEMAN">Lineman</option>
                  <option value="INVESTOR">Truck Investor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Duplicate From (Optional)
                </label>
                <select
                  value={duplicateFromProfile}
                  onChange={(e) => setDuplicateFromProfile(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                >
                  <option value="">Start empty</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowCreateProfileModal(false)}
                  className="px-6 py-3 rounded-xl text-sm font-bold uppercase"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProfile}
                  disabled={!newProfileName.trim()}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'var(--gradient-neural)', color: '#000' }}
                >
                  <Plus className="w-4 h-4" />
                  Create Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full max-w-md rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                Add Customer/Region
              </h2>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="p-2 rounded-xl transition-colors hover:bg-white/10"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Customer
                </label>
                <select
                  value={newGroupCustomer}
                  onChange={(e) => setNewGroupCustomer(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                >
                  <option value="">Select Customer</option>
                  {CUSTOMERS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Region
                </label>
                <select
                  value={newGroupRegion}
                  onChange={(e) => setNewGroupRegion(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                >
                  <option value="">Select Region</option>
                  {REGIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-6 py-3 rounded-xl text-sm font-bold uppercase"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newGroupCustomer || !newGroupRegion) return;
                    try {
                      const { createGroup } = await import('../services/rateCardService');
                      const group = await createGroup(newGroupCustomer, newGroupRegion);
                      await loadGroups();
                      setSelectedGroup(group);
                      setShowCreateGroupModal(false);
                      setNewGroupCustomer('');
                      setNewGroupRegion('');
                    } catch (error: any) {
                      alert('Error: ' + error.message);
                    }
                  }}
                  disabled={!newGroupCustomer || !newGroupRegion}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'var(--gradient-neural)', color: '#000' }}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RateCardsV2;
