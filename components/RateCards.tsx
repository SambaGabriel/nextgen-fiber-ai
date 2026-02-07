/**
 * RateCards - Admin module for managing unit rates per client/region
 * CRUD for rate cards with filters
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Plus, Search, Filter, Edit2, Trash2, Archive,
  X, Check, AlertCircle, Loader2, ChevronDown, Building2, MapPin,
  Upload, FileText, Sparkles, FolderOpen, ArrowLeft, Calendar, Hash
} from 'lucide-react';
import { Language, User } from '../types';
import { supabase } from '../services/supabase';
import Anthropic from '@anthropic-ai/sdk';

interface RateCardsProps {
  user: User;
  lang: Language;
}

// Rate Card Set interface (folder/master)
interface RateCardSet {
  id: string;
  name: string;
  customer_name: string;
  region: string;
  source_file: string;
  total_items: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// Rate Card Item interface
interface RateCardItem {
  id: string;
  set_id?: string;
  customer_id: string;
  customer_name: string;
  region: string;
  code: string;
  description: string;
  unit: 'FT' | 'EA' | 'HR' | 'DAY';
  rate: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// Customers list
const CUSTOMERS = [
  'Brightspeed',
  'AT&T',
  'Spectrum',
  'Verizon',
  'Lumen',
  'Frontier',
  'Other'
];

// Regions (US States + All Regions)
const REGIONS = [
  'All Regions',
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Unit types
const UNITS = [
  { value: 'FT', label: 'Per Foot' },
  { value: 'EA', label: 'Each' },
  { value: 'HR', label: 'Per Hour' },
  { value: 'DAY', label: 'Per Day' },
];

// Sample rate codes (commonly used)
const SAMPLE_CODES = [
  { code: 'BSPDLASH', description: 'Lashing' },
  { code: 'BSPD82C', description: '82 Count' },
  { code: 'BSPDSTRAND', description: 'Strand' },
  { code: 'AERIAL', description: 'Aerial Installation' },
  { code: 'UNDERGROUND', description: 'Underground Installation' },
  { code: 'OVERLASH', description: 'Overlash' },
  { code: 'SPLICE', description: 'Splicing' },
  { code: 'ANCHOR', description: 'Anchor Installation' },
];

interface CreateRateForm {
  customer_name: string;
  region: string;
  code: string;
  description: string;
  unit: string;
  rate: string;
}

const initialFormState: CreateRateForm = {
  customer_name: '',
  region: '',
  code: '',
  description: '',
  unit: 'FT',
  rate: '',
};

const RateCards: React.FC<RateCardsProps> = ({ user, lang }) => {
  // View mode: 'sets' shows folders, 'rates' shows all rates, 'set-detail' shows rates in a set
  const [viewMode, setViewMode] = useState<'sets' | 'rates' | 'set-detail'>('sets');
  const [selectedSet, setSelectedSet] = useState<RateCardSet | null>(null);

  // State
  const [rateSets, setRateSets] = useState<RateCardSet[]>([]);
  const [rateCards, setRateCards] = useState<RateCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingRate, setEditingRate] = useState<RateCardItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateRateForm>(initialFormState);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // PDF Upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCustomer, setUploadCustomer] = useState('');
  const [uploadRegion, setUploadRegion] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedRates, setExtractedRates] = useState<Partial<RateCardItem>[]>([]);
  const [extractionError, setExtractionError] = useState('');

  // Load rate cards from Supabase
  const loadRateCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rate_cards')
        .select('*')
        .order('customer_name', { ascending: true });

      if (error) {
        console.error('Error loading rate cards:', error);
        // If table doesn't exist, use sample data
        setRateCards(getSampleRateCards());
      } else {
        setRateCards(data || []);
      }
    } catch (error) {
      console.error('Error loading rate cards:', error);
      // Use sample data as fallback
      setRateCards(getSampleRateCards());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sample data for demo
  const getSampleRateCards = (): RateCardItem[] => [
    {
      id: '1',
      customer_id: 'brightspeed',
      customer_name: 'Brightspeed',
      region: 'NC',
      code: 'BSPDLASH',
      description: 'Lashing',
      unit: 'FT',
      rate: 0.90,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '2',
      customer_id: 'brightspeed',
      customer_name: 'Brightspeed',
      region: 'NC',
      code: 'BSPD82C',
      description: '82 Count Fiber',
      unit: 'FT',
      rate: 0.70,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '3',
      customer_id: 'brightspeed',
      customer_name: 'Brightspeed',
      region: 'NC',
      code: 'BSPDSTRAND',
      description: 'Strand Installation',
      unit: 'FT',
      rate: 0.70,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '4',
      customer_id: 'att',
      customer_name: 'AT&T',
      region: 'TX',
      code: 'AERIAL',
      description: 'Aerial Fiber Installation',
      unit: 'FT',
      rate: 0.85,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: '5',
      customer_id: 'spectrum',
      customer_name: 'Spectrum',
      region: 'All Regions',
      code: 'SPLICE',
      description: 'Fiber Splicing',
      unit: 'EA',
      rate: 45.00,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    loadRateCards();
  }, [loadRateCards]);

  // Filter rate cards
  const filteredRateCards = rateCards.filter(rate => {
    // Archive filter
    if (!showArchived && rate.is_archived) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        rate.code.toLowerCase().includes(query) ||
        rate.description.toLowerCase().includes(query) ||
        rate.customer_name.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Customer filter
    if (selectedCustomer && rate.customer_name !== selectedCustomer) {
      return false;
    }

    // Region filter
    if (selectedRegion && rate.region !== selectedRegion && rate.region !== 'All Regions') {
      return false;
    }

    return true;
  });

  // Extract rates from PDF using Claude AI
  const extractRatesFromPDF = async () => {
    if (!uploadFile || !uploadCustomer || !uploadRegion) {
      setExtractionError('Please select a file, customer, and region');
      return;
    }

    setIsExtracting(true);
    setExtractionError('');
    setExtractedRates([]);

    try {
      // Convert PDF to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });

      // Call Claude API to extract rate card data
      const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('API key not configured');
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64
                }
              },
              {
                type: 'text',
                text: `You are a fiber optic construction rate card expert.

IMPORTANT: Read ALL PAGES of this PDF document from start to finish. Do not stop at the first page.

Extract EVERY rate item from ALL pages. This is a rate card with pricing for construction work items.

For each item found, extract:
- code: The item code/number (e.g., "BSPDLASH", "SP001", "1.1", etc.)
- description: What the item is for (the work description)
- unit: The unit - must be one of: "FT" (per foot/linear foot/LF), "EA" (each/unit), "HR" (per hour), "DAY" (per day)
- rate: The dollar amount as a number (no $ sign)

CRITICAL INSTRUCTIONS:
1. Go through EVERY page of the document
2. Extract EVERY line item with a price
3. Include items from all sections and categories
4. Do not skip any items

Return ONLY a valid JSON array with ALL items found. Example:
[
  {"code": "BSPDLASH", "description": "Lashing", "unit": "FT", "rate": 0.90},
  {"code": "ANCHOR", "description": "Anchor Installation", "unit": "EA", "rate": 45.00}
]

Be thorough - extract hundreds of items if they exist in the document.`
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      console.log('[RATE EXTRACT] Raw response:', content.substring(0, 500));

      // Parse JSON array from response - try multiple patterns
      let jsonMatch = content.match(/\[[\s\S]*?\]/);

      // If no array found, try to find JSON objects and wrap them
      if (!jsonMatch) {
        const objectMatches = content.match(/\{[^{}]*\}/g);
        if (objectMatches && objectMatches.length > 0) {
          jsonMatch = [`[${objectMatches.join(',')}]`];
        }
      }

      if (!jsonMatch) {
        console.error('[RATE EXTRACT] No JSON found:', content);
        throw new Error('Could not find rates in PDF. Try a clearer document.');
      }

      let rates;
      try {
        rates = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('[RATE EXTRACT] Parse error:', parseError);
        throw new Error('Invalid data format. Try again.');
      }

      if (!Array.isArray(rates) || rates.length === 0) {
        throw new Error('No rates found in document.');
      }

      console.log('[RATE EXTRACT] Found', rates.length, 'rates');

      // Add customer and region to each rate
      const ratesWithCustomer = rates.map((r: any) => ({
        customer_id: uploadCustomer.toLowerCase().replace(/\s+/g, '-'),
        customer_name: uploadCustomer,
        region: uploadRegion,
        code: r.code?.toUpperCase() || 'UNKNOWN',
        description: r.description || '',
        unit: ['FT', 'EA', 'HR', 'DAY'].includes(r.unit) ? r.unit : 'FT',
        rate: parseFloat(r.rate) || 0,
        is_archived: false
      }));

      setExtractedRates(ratesWithCustomer);

    } catch (error: any) {
      console.error('Error extracting rates:', error);
      setExtractionError(error.message || 'Failed to extract rates from PDF');
    } finally {
      setIsExtracting(false);
    }
  };

  // Import extracted rates to database with Set organization
  const importExtractedRates = async () => {
    if (extractedRates.length === 0) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const setId = `set-${Date.now()}`;

      // Create the Rate Card Set (folder)
      const newSet: RateCardSet = {
        id: setId,
        name: `${uploadCustomer} - ${uploadRegion} - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
        customer_name: uploadCustomer,
        region: uploadRegion,
        source_file: uploadFile?.name || 'Manual Upload',
        total_items: extractedRates.length,
        is_archived: false,
        created_at: now,
        updated_at: now
      };

      // Try to save set to Supabase
      const { error: setError } = await supabase
        .from('rate_card_sets')
        .insert(newSet);

      if (setError) {
        console.log('[RATE CARDS] Set table may not exist, using local storage');
      }

      // Add set to local state
      setRateSets(prev => [newSet, ...prev]);

      // Create rates with set_id
      const ratesToInsert = extractedRates.map(r => ({
        ...r,
        set_id: setId,
        created_at: now,
        updated_at: now
      }));

      const { data, error } = await supabase
        .from('rate_cards')
        .insert(ratesToInsert)
        .select();

      if (error) {
        // Fallback: add to local state
        const localRates = ratesToInsert.map((r, i) => ({
          ...r,
          id: `imported-${Date.now()}-${i}`
        })) as RateCardItem[];
        setRateCards(prev => [...prev, ...localRates]);
      } else if (data) {
        setRateCards(prev => [...prev, ...data]);
      }

      // Reset upload modal and show sets view
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadCustomer('');
      setUploadRegion('');
      setExtractedRates([]);
      setExtractionError('');
      setViewMode('sets');

    } catch (error) {
      console.error('Error importing rates:', error);
      setExtractionError('Failed to import rates');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.customer_name) errors.push('Customer is required');
    if (!formData.region) errors.push('Region is required');
    if (!formData.code.trim()) errors.push('Code is required');
    if (!formData.rate || parseFloat(formData.rate) < 0) {
      errors.push('Rate must be a positive number');
    }

    setFormErrors(errors);
    return errors.length === 0;
  };

  // Create rate card
  const handleCreateRate = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const newRate: Partial<RateCardItem> = {
        customer_id: formData.customer_name.toLowerCase().replace(/\s+/g, '-'),
        customer_name: formData.customer_name,
        region: formData.region,
        code: formData.code.toUpperCase(),
        description: formData.description,
        unit: formData.unit as 'FT' | 'EA' | 'HR' | 'DAY',
        rate: parseFloat(formData.rate),
        is_archived: false,
      };

      const { data, error } = await supabase
        .from('rate_cards')
        .insert([newRate])
        .select()
        .single();

      if (error) {
        // Fallback: add to local state
        const localRate: RateCardItem = {
          ...newRate as RateCardItem,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setRateCards(prev => [...prev, localRate]);
      } else {
        setRateCards(prev => [...prev, data]);
      }

      setShowCreateModal(false);
      setFormData(initialFormState);
      setFormErrors([]);
    } catch (error) {
      console.error('Error creating rate card:', error);
      setFormErrors(['Failed to create rate card. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update rate card
  const handleUpdateRate = async () => {
    if (!editingRate || !validateForm()) return;

    const rateId = editingRate.id;
    setIsSubmitting(true);
    try {
      const updatedRate: Partial<RateCardItem> = {
        customer_id: formData.customer_name.toLowerCase().replace(/\s+/g, '-'),
        customer_name: formData.customer_name,
        region: formData.region,
        code: formData.code.toUpperCase(),
        description: formData.description,
        unit: formData.unit as 'FT' | 'EA' | 'HR' | 'DAY',
        rate: parseFloat(formData.rate),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('rate_cards')
        .update(updatedRate)
        .eq('id', rateId);

      // Update local state regardless
      setRateCards(prev => prev.map(r =>
        r.id === rateId ? { ...r, ...updatedRate } as RateCardItem : r
      ));

      if (error) {
        console.log('Supabase update error (using local state):', error);
      }

      setEditingRate(null);
      setFormData(initialFormState);
      setFormErrors([]);
    } catch (error) {
      console.error('Error updating rate card:', error);
      setFormErrors(['Failed to update rate card. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Archive rate card
  const handleArchiveRate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('rate_cards')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        // Fallback: update local state
        setRateCards(prev => prev.map(r =>
          r.id === id ? { ...r, is_archived: true } : r
        ));
      } else {
        setRateCards(prev => prev.map(r =>
          r.id === id ? { ...r, is_archived: true } : r
        ));
      }
    } catch (error) {
      console.error('Error archiving rate card:', error);
    }
  };

  // Open edit modal
  const openEditModal = (rate: RateCardItem) => {
    setEditingRate(rate);
    setFormData({
      customer_name: rate.customer_name,
      region: rate.region,
      code: rate.code,
      description: rate.description,
      unit: rate.unit,
      rate: rate.rate.toString(),
    });
    setFormErrors([]);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
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
                {viewMode === 'sets' ? `${rateSets.length} Rate Card Sets` :
                 viewMode === 'set-detail' && selectedSet ? `${selectedSet.name}` :
                 `${rateCards.length} rates total`}
              </p>
            </div>
            {/* View Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-xl ml-4" style={{ background: 'var(--surface)' }}>
              <button
                onClick={() => { setViewMode('sets'); setSelectedSet(null); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${viewMode === 'sets' || viewMode === 'set-detail' ? 'text-black' : ''}`}
                style={{ background: viewMode === 'sets' || viewMode === 'set-detail' ? 'var(--neural-core)' : 'transparent', color: viewMode === 'sets' || viewMode === 'set-detail' ? '#000' : 'var(--text-tertiary)' }}
              >
                <FolderOpen className="w-4 h-4 inline mr-1" /> Sets
              </button>
              <button
                onClick={() => setViewMode('rates')}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all`}
                style={{ background: viewMode === 'rates' ? 'var(--neural-core)' : 'transparent', color: viewMode === 'rates' ? '#000' : 'var(--text-tertiary)' }}
              >
                <Hash className="w-4 h-4 inline mr-1" /> All Rates
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setUploadFile(null);
                setUploadCustomer('');
                setUploadRegion('');
                setExtractedRates([]);
                setExtractionError('');
                setShowUploadModal(true);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-105"
              style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            >
              <Upload className="w-5 h-5" />
              Upload PDF
            </button>
            <button
              onClick={() => {
                setFormData(initialFormState);
                setFormErrors([]);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-105"
              style={{ background: 'var(--gradient-neural)', color: '#000' }}
            >
              <Plus className="w-5 h-5" />
              Add Rate
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
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

          {/* Customer Filter */}
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none cursor-pointer"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)'
            }}
          >
            <option value="">All Customers</option>
            {CUSTOMERS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Region Filter */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none cursor-pointer"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)'
            }}
          >
            <option value="">All Regions</option>
            {REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Show Archived Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Show Archived
            </span>
          </label>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
          </div>
        ) : viewMode === 'sets' ? (
          /* SETS VIEW - Card/Folder style */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rateSets.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center h-64 gap-4">
                <FolderOpen className="w-16 h-16" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
                  No rate card sets yet
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Upload a PDF to create your first rate card set
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
                >
                  <Upload className="w-4 h-4" />
                  Upload PDF
                </button>
              </div>
            ) : (
              rateSets.map((set) => (
                <div
                  key={set.id}
                  onClick={() => {
                    setSelectedSet(set);
                    setViewMode('set-detail');
                  }}
                  className="p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                      <FolderOpen className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                    </div>
                    {set.is_archived && (
                      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase" style={{ background: 'var(--elevated)', color: 'var(--text-tertiary)' }}>
                        Archived
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                    {set.name}
                  </h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
                    {set.source_file}
                  </p>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {set.customer_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {set.region}
                    </span>
                    <span className="flex items-center gap-1 ml-auto font-bold" style={{ color: 'var(--neural-core)' }}>
                      <Hash className="w-3 h-3" />
                      {set.total_items} items
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : viewMode === 'set-detail' && selectedSet ? (
          /* SET DETAIL VIEW */
          <div>
            <button
              onClick={() => { setViewMode('sets'); setSelectedSet(null); }}
              className="flex items-center gap-2 mb-4 text-sm font-bold"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sets
            </button>
            <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{selectedSet.name}</h2>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {selectedSet.source_file} • {selectedSet.total_items} items • {new Date(selectedSet.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Delete this entire rate card set?')) {
                      setRateSets(prev => prev.filter(s => s.id !== selectedSet.id));
                      setRateCards(prev => prev.filter(r => r.set_id !== selectedSet.id));
                      setViewMode('sets');
                      setSelectedSet(null);
                    }
                  }}
                  className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                  title="Delete Set"
                >
                  <Trash2 className="w-5 h-5" style={{ color: '#EF4444' }} />
                </button>
              </div>
            </div>
            {/* Show rates in this set */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--elevated)' }}>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Code</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Description</th>
                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rateCards.filter(r => r.set_id === selectedSet.id).map((rate) => (
                    <tr key={rate.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <td className="px-4 py-3">
                        <span className="font-bold" style={{ color: 'var(--neural-core)' }}>{rate.code}</span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{rate.description}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>{rate.unit === 'FT' ? 'Per Foot' : rate.unit === 'EA' ? 'Each' : rate.unit === 'HR' ? 'Per Hour' : 'Per Day'}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--neural-core)' }}>${rate.rate.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : filteredRateCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <DollarSign className="w-16 h-16" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
              No rate cards found
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
            >
              <Plus className="w-4 h-4" />
              Add First Rate
            </button>
          </div>
        ) : (
          /* ALL RATES TABLE VIEW */
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--elevated)' }}>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Region</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Code</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Description</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Unit</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRateCards.map((rate) => (
                  <tr
                    key={rate.id}
                    className="border-t transition-colors hover:bg-white/5"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      opacity: rate.is_archived ? 0.5 : 1
                    }}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {rate.customer_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {rate.region}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="px-2 py-1 rounded-lg text-xs font-bold uppercase"
                        style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
                      >
                        {rate.code}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {rate.description || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        {UNITS.find(u => u.value === rate.unit)?.label || rate.unit}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-lg font-black" style={{ color: 'var(--neural-core)' }}>
                        {formatCurrency(rate.rate)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(rate)}
                          className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        {!rate.is_archived && (
                          <button
                            onClick={() => handleArchiveRate(rate.id)}
                            className="p-2 rounded-lg transition-colors hover:bg-white/10"
                            title="Archive"
                          >
                            <Archive className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingRate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                  {editingRate ? <Edit2 className="w-5 h-5" style={{ color: 'var(--neural-core)' }} /> : <Plus className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />}
                </div>
                <h2 className="text-xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                  {editingRate ? 'Edit Rate Card' : 'Add Rate Card'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRate(null);
                  setFormData(initialFormState);
                  setFormErrors([]);
                }}
                className="p-2 rounded-xl transition-colors hover:bg-white/10"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Error Messages */}
            {formErrors.length > 0 && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                {formErrors.map((error, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm" style={{ color: '#EF4444' }}>
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                ))}
              </div>
            )}

            {/* Form */}
            <div className="space-y-5">
              {/* Customer */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Customer *
                </label>
                <select
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <option value="">Select Customer</option>
                  {CUSTOMERS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Region */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Region *
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <option value="">Select Region</option>
                  {REGIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Code */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Rate Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., BSPDLASH"
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                />
                {/* Quick code suggestions */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {SAMPLE_CODES.slice(0, 4).map(sc => (
                    <button
                      key={sc.code}
                      type="button"
                      onClick={() => setFormData({ ...formData, code: sc.code, description: sc.description })}
                      className="px-2 py-1 rounded text-[10px] font-bold transition-colors"
                      style={{ background: 'var(--elevated)', color: 'var(--text-tertiary)' }}
                    >
                      {sc.code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                />
              </div>

              {/* Unit & Rate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Unit *
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    {UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Rate ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRate(null);
                  setFormData(initialFormState);
                  setFormErrors([]);
                }}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={editingRate ? handleUpdateRate : handleCreateRate}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'var(--gradient-neural)', color: '#000' }}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingRate ? 'Update Rate' : 'Add Rate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload PDF Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                    Upload Rate Card PDF
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    AI will extract rates automatically
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setExtractedRates([]);
                  setExtractionError('');
                }}
                className="p-2 rounded-xl transition-colors hover:bg-white/10"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Error Message */}
            {extractionError && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: '#EF4444' }}>
                  <AlertCircle className="w-4 h-4" />
                  {extractionError}
                </div>
              </div>
            )}

            {/* Step 1: Select Customer & Region */}
            {extractedRates.length === 0 && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                      Customer *
                    </label>
                    <select
                      value={uploadCustomer}
                      onChange={(e) => setUploadCustomer(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                      style={{
                        background: 'var(--elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      <option value="">Select Customer</option>
                      {CUSTOMERS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                      Region *
                    </label>
                    <select
                      value={uploadRegion}
                      onChange={(e) => setUploadRegion(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                      style={{
                        background: 'var(--elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      <option value="">Select Region</option>
                      {REGIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Rate Card PDF *
                  </label>
                  <div
                    className="relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer hover:border-opacity-100"
                    style={{ borderColor: uploadFile ? 'var(--neural-core)' : 'var(--border-default)' }}
                    onClick={() => document.getElementById('rate-pdf-upload')?.click()}
                  >
                    <input
                      id="rate-pdf-upload"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                    {uploadFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="w-10 h-10" style={{ color: 'var(--neural-core)' }} />
                        <div className="text-left">
                          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{uploadFile.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadFile(null);
                          }}
                          className="p-1 rounded-lg hover:bg-white/10"
                        >
                          <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                          Click to upload rate card PDF
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                          AI will extract item codes, descriptions, units, and rates
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Extract Button */}
                <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={extractRatesFromPDF}
                    disabled={!uploadFile || !uploadCustomer || !uploadRegion || isExtracting}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-50"
                    style={{ background: 'var(--gradient-neural)', color: '#000' }}
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Extract Rates
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Review Extracted Rates */}
            {extractedRates.length > 0 && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--neural-core)' }}>
                    Found {extractedRates.length} rates for {uploadCustomer} - {uploadRegion}
                  </p>
                </div>

                {/* Rates Table */}
                <div className="rounded-xl overflow-hidden max-h-[400px] overflow-auto" style={{ background: 'var(--elevated)', border: '1px solid var(--border-default)' }}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>Code</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>Description</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>Unit</th>
                        <th className="px-3 py-2 text-right text-xs font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedRates.map((rate, idx) => (
                        <tr key={idx} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2 font-bold" style={{ color: 'var(--neural-core)' }}>{rate.code}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{rate.description}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{rate.unit}</td>
                          <td className="px-3 py-2 text-right font-bold" style={{ color: 'var(--text-primary)' }}>${rate.rate?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Import Actions */}
                <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    onClick={() => {
                      setExtractedRates([]);
                      setUploadFile(null);
                    }}
                    className="flex items-center gap-2 text-sm font-bold"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <X className="w-4 h-4" />
                    Start Over
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowUploadModal(false)}
                      className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={importExtractedRates}
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-50"
                      style={{ background: 'var(--gradient-neural)', color: '#000' }}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Import {extractedRates.length} Rates
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RateCards;
