/**
 * JobsAdmin - Admin module for managing field jobs
 * Create, assign, and track jobs sent to linemen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, Plus, Search, Filter, ChevronRight, User, MapPin,
  Calendar, Clock, FileText, Upload, X, Check, AlertCircle,
  Building2, Ruler, Edit2, Eye, UserPlus, Copy, Archive,
  ChevronDown, Loader2, Download, ExternalLink, Sparkles, Trash2
} from 'lucide-react';
import { Language, User as UserType } from '../types';
import { Job, JobStatus, WorkType } from '../types/project';
import { jobStorageSupabase } from '../services/jobStorageSupabase';
import { supabase } from '../services/supabase';
import { getClients, PrimeClient } from '../services/clientService';
import { getCustomers, EndCustomer } from '../services/customerService';
import { getTrucks, Truck } from '../services/truckService';
import { RedlinesPanel } from './jobs/RedlinesPanel';
import { jobRedlineService } from '../services/jobRedlineService';
import { RedlineVersion } from '../types/project';

interface JobsAdminProps {
  user: UserType;
  lang: Language;
}

// Work type options
const WORK_TYPES = [
  { value: 'aerial', label: 'Aerial' },
  { value: 'underground', label: 'Underground' },
  { value: 'overlash', label: 'Overlash' },
  { value: 'splicing', label: 'Splicing' },
  { value: 'mixed', label: 'Mixed' },
];

// Status options
const STATUS_OPTIONS = [
  { value: 'unassigned', label: 'Unassigned', color: '#9CA3AF' },
  { value: 'assigned', label: 'Assigned', color: '#3B82F6' },
  { value: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { value: 'production_submitted', label: 'Production Submitted', color: '#8B5CF6' },
  { value: 'pending_redlines', label: 'Pending Redlines', color: '#fb923c' },
  { value: 'redline_uploaded', label: 'Redline Uploaded', color: '#06b6d4' },
  { value: 'under_client_review', label: 'Under Review', color: '#a855f7' },
  { value: 'approved', label: 'Approved', color: '#10B981' },
  { value: 'rejected', label: 'Rejected', color: '#EF4444' },
  { value: 'ready_to_invoice', label: 'Ready to Invoice', color: '#22c55e' },
  { value: 'submitted', label: 'Submitted', color: '#8B5CF6' },
  { value: 'needs_revision', label: 'Needs Revision', color: '#EF4444' },
  { value: 'completed', label: 'Completed', color: '#6B7280' },
];

// US States
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Note: Clients and Customers are now loaded from database

type TabType = 'assigned' | 'unassigned' | 'all';

interface CreateJobForm {
  title: string;
  clientId: string;
  clientName: string;
  customerId: string;
  customerName: string;
  truckId: string;
  city: string;
  state: string;
  address: string;
  olt: string;
  feederId: string;
  runNumber: string;
  workType: string;
  scheduledDate: string;
  estimatedFootage: string;
  supervisorNotes: string;
  assignedToId: string;
  assignedToName: string;
  status: string;
}

const initialFormState: CreateJobForm = {
  title: '',
  clientId: '',
  clientName: '',
  customerId: '',
  customerName: '',
  truckId: '',
  city: '',
  state: '',
  address: '',
  olt: '',
  feederId: '',
  runNumber: '',
  workType: 'aerial',
  scheduledDate: '',
  estimatedFootage: '',
  supervisorNotes: '',
  assignedToId: '',
  assignedToName: '',
  status: 'assigned',
};

const JobsAdmin: React.FC<JobsAdminProps> = ({ user, lang }) => {
  // State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [linemen, setLinemen] = useState<{ id: string; name: string; email: string }[]>([]);
  const [clients, setClients] = useState<PrimeClient[]>([]);
  const [customers, setCustomers] = useState<EndCustomer[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateJobForm>(initialFormState);
  const [editFormData, setEditFormData] = useState<CreateJobForm>(initialFormState);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [isExtractingMap, setIsExtractingMap] = useState(false);

  // Redlines state
  const [redlines, setRedlines] = useState<RedlineVersion[]>([]);
  const [isLoadingRedlines, setIsLoadingRedlines] = useState(false);

  // Load redlines when job detail modal opens
  const loadRedlines = useCallback(async (jobId: string) => {
    setIsLoadingRedlines(true);
    try {
      const versions = await jobRedlineService.getJobRedlines(jobId);
      setRedlines(versions);
    } catch (error) {
      console.error('[JobsAdmin] Error loading redlines:', error);
    } finally {
      setIsLoadingRedlines(false);
    }
  }, []);

  // Extract job info from map using Claude Vision API
  const extractMapInfo = async (fileToExtract?: File) => {
    const file = fileToExtract || mapFile;
    if (!file) return;

    setIsExtractingMap(true);
    setFormErrors([]);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Determine media type
      const mediaType = file.type === 'application/pdf' ? 'application/pdf' :
                       file.type.startsWith('image/') ? file.type : 'application/pdf';

      // Call Claude API
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
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: [
              {
                type: mediaType === 'application/pdf' ? 'document' : 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64
                }
              },
              {
                type: 'text',
                text: `You are a fiber optic construction map analyzer. Extract ONLY information that is EXPLICITLY VISIBLE on the map. DO NOT invent or assume any data.

EXTRACTION LOCATIONS:
1. HEADER/TITLE BLOCK (usually top-right corner):
   - "PROJECT: XXXXX FEEDER" → OLT code (e.g., FLVLALXA)
   - Company logo (MasTec, Brightspeed, AT&T, Lumen) → client name
   - "CONSTRUCTION DRAWING#" or "DWG#" → run/drawing number
   - Look for span numbers like "22,23,24" or "SPAN 22-24"

2. FEEDER ID (CRITICAL - look carefully on cable labels):
   - Feeder ID format: letters + numbers + period + numbers + TRAILING LETTER (e.g., BSPD001.04h, BSPD002.01a)
   - IMPORTANT: The feeder ID ALWAYS ends with a lowercase letter (a, b, c, d, e, f, g, h, etc.)
   - Look for labels like "Armored 48F BSPD001.04h" → feeder ID is BSPD001.04h (include the 'h')
   - Look for labels like "MGNV 96F BSPD002.01a" → feeder ID is BSPD002.01a (include the 'a')
   - Pattern: [LETTERS][NUMBERS].[NUMBERS][LETTER] - always include the final letter!
   - The feeder ID is NOT: MST, MasTec, company names, or abbreviations
   - Feeder ID always has a PERIOD in it AND a trailing letter (e.g., BSPD001.04h NOT BSPD001.04)
   - Cable type: Armored/MGNV = aerial, Conduit/Buried = underground

3. FOOTAGE MEASUREMENTS:
   - Numbers with ' symbol (e.g., 328', 262', 280')
   - SUM ALL visible footage measurements to get total

4. LOCATION INFO:
   - Street/road names visible on map
   - City name if explicitly written
   - State abbreviation if visible

TITLE FORMAT:
Create title as: "[FeederID with trailing letter] -[FiberCount]ct – [SpanNumbers]"
Example: "BSPD001.01g -48ct – 22,23,24" (note: 'g' is the trailing letter of the feeder ID)

RULES:
- Extract ONLY what you can SEE on the document
- If city is not explicitly written, use ""
- If state is not explicitly written, use ""
- DO NOT guess or infer data not visible
- estimatedFootage must be a NUMBER (integer), not text

Return ONLY valid JSON:
{
  "client": "company name from logo",
  "city": "city if visible or empty string",
  "state": "state abbrev if visible or empty string",
  "address": "main road/street names",
  "olt": "project code from header",
  "feederId": "feeder ID with period AND trailing letter like BSPD001.04h - MUST include final letter (a,b,c,d,e,f,g,h)",
  "fiberCount": "fiber count number like 96 (just the number, from '96ct' or '96 count')",
  "runNumber": "map page numbers like 117-122",
  "workType": "aerial or underground",
  "estimatedFootage": 0
}`
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse response');
      }

      const extracted = JSON.parse(jsonMatch[0]);
      console.log('[EXTRACT] Raw extracted data:', extracted);

      // Parse estimatedFootage - handle both number and string
      let footage = '';
      if (extracted.estimatedFootage) {
        const footageNum = typeof extracted.estimatedFootage === 'number'
          ? extracted.estimatedFootage
          : parseInt(String(extracted.estimatedFootage).replace(/[^\d]/g, ''), 10);
        footage = isNaN(footageNum) || footageNum === 0 ? '' : String(footageNum);
      }

      // Get feeder ID from filename to ensure trailing letter is included
      // Filename format: "FLVLALXA - BSPD001.04h - (Map for Linemen) 2.pdf"
      const fileName = file.name;
      const fileNameParts = fileName.split(/\s*-\s*/);
      const feederFromFileName = fileNameParts[1]?.trim() || '';

      // Use feeder from filename if it has trailing letter and Claude's doesn't
      let finalFeederId = extracted.feederId || '';
      if (feederFromFileName && feederFromFileName.match(/[a-z]$/i)) {
        // Filename has trailing letter, use it
        finalFeederId = feederFromFileName;
      }

      // Generate title from Feeder ID + Map Pages: "BSPD001.04h - 117-122"
      const titleParts = [];
      if (finalFeederId) titleParts.push(finalFeederId);
      if (extracted.runNumber) titleParts.push(extracted.runNumber);

      let finalTitle = titleParts.length > 0 ? titleParts.join(' - ') : '';

      // Update form with extracted data
      console.log('[EXTRACT] Filling form with:', {
        title: finalTitle,
        client: extracted.client,
        city: extracted.city,
        state: extracted.state,
        olt: extracted.olt,
        feederId: finalFeederId,
        runNumber: extracted.runNumber,
        workType: extracted.workType,
        estimatedFootage: footage
      });

      // Look up clientId from extracted clientName
      const matchedClient = extracted.client ? clients.find(c =>
        c.name.toLowerCase().includes(extracted.client!.toLowerCase()) ||
        extracted.client!.toLowerCase().includes(c.name.toLowerCase())
      ) : null;

      // Look up customerId from extracted customer (if present)
      const matchedCustomer = extracted.customer ? customers.find(c =>
        c.name.toLowerCase().includes(extracted.customer!.toLowerCase()) ||
        extracted.customer!.toLowerCase().includes(c.name.toLowerCase())
      ) : null;

      console.log('[EXTRACT] Matched client:', matchedClient?.name, 'ID:', matchedClient?.id);
      console.log('[EXTRACT] Matched customer:', matchedCustomer?.name, 'ID:', matchedCustomer?.id);

      setFormData(prev => ({
        ...prev,
        title: finalTitle || prev.title,
        clientId: matchedClient?.id || prev.clientId,
        clientName: matchedClient?.name || extracted.client || prev.clientName,
        customerId: matchedCustomer?.id || prev.customerId,
        customerName: matchedCustomer?.name || extracted.customer || prev.customerName,
        city: extracted.city || prev.city,
        state: extracted.state || prev.state,
        address: extracted.address || prev.address,
        olt: extracted.olt || prev.olt,
        feederId: finalFeederId || prev.feederId,
        runNumber: extracted.runNumber || prev.runNumber,
        workType: extracted.workType === 'underground' ? 'underground' : 'aerial',
        estimatedFootage: footage || prev.estimatedFootage,
      }));

    } catch (error) {
      console.error('[DEBUG] Error extracting map info:', error);
      setFormErrors([`Failed to extract info: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsExtractingMap(false);
    }
  };

  // Load jobs
  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const allJobs = await jobStorageSupabase.getAll();
      setJobs(allJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load linemen for assignment dropdown
  const loadLinemen = useCallback(async () => {
    try {
      // First try to get from profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('role', 'LINEMAN');

      if (!error && data && data.length > 0) {
        setLinemen(data.map(d => ({ id: d.id, name: d.name, email: d.email })));
        return;
      }

      // Fallback: Try to get from users table (if exists)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('role', 'LINEMAN');

      if (!usersError && usersData && usersData.length > 0) {
        setLinemen(usersData.map(d => ({ id: d.id, name: d.name, email: d.email })));
        return;
      }

      // Final fallback: Use localStorage registered users
      const storedUsers = localStorage.getItem('fs_registered_users');
      if (storedUsers) {
        try {
          const parsedUsers = JSON.parse(storedUsers);
          const linemanUsers = Object.values(parsedUsers)
            .filter((u: any) => u.role === 'LINEMAN')
            .map((u: any) => ({
              id: u.id || u.email,
              name: u.name || 'Unknown',
              email: u.email || ''
            }));
          setLinemen(linemanUsers as { id: string; name: string; email: string }[]);
        } catch (e) {
          console.error('Error parsing stored users:', e);
        }
      }
    } catch (error) {
      console.error('Error loading linemen:', error);
      setLinemen([]);
    }
  }, []);

  // Load clients, customers, and trucks from database
  const loadClientsAndCustomers = useCallback(async () => {
    try {
      const [clientsData, customersData, trucksData] = await Promise.all([
        getClients(),
        getCustomers(),
        getTrucks()
      ]);
      setClients(clientsData);
      setCustomers(customersData);
      setTrucks(trucksData);
    } catch (error) {
      console.error('Error loading clients/customers/trucks:', error);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    loadLinemen();
    loadClientsAndCustomers();
  }, [loadJobs, loadLinemen, loadClientsAndCustomers]);

  // Debug: monitor edit modal state
  useEffect(() => {
    console.log('[DEBUG] showEditModal changed to:', showEditModal, 'selectedJob:', selectedJob?.id);
  }, [showEditModal, selectedJob]);

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    // Tab filter
    if (activeTab === 'assigned' && (!job.assignedToId || job.assignedToId === 'lineman-default')) {
      return false;
    }
    if (activeTab === 'unassigned' && job.assignedToId && job.assignedToId !== 'lineman-default') {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        job.title?.toLowerCase().includes(query) ||
        job.jobCode?.toLowerCase().includes(query) ||
        job.clientName?.toLowerCase().includes(query) ||
        job.location?.city?.toLowerCase().includes(query) ||
        job.assignedToName?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (selectedStatus && job.status !== selectedStatus) {
      return false;
    }

    // Client filter
    if (selectedClient && job.clientName !== selectedClient) {
      return false;
    }

    return true;
  });

  // Validate form
  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.title.trim()) errors.push('Title is required');
    if (!formData.clientId) errors.push('Client is required');
    if (!formData.customerId) errors.push('Customer is required');
    if (!formData.city.trim()) errors.push('City is required');
    if (!formData.state) errors.push('State is required');
    if (!formData.olt.trim()) errors.push('OLT is required');
    if (!formData.feederId.trim() && !formData.runNumber.trim()) {
      errors.push('Feeder ID or Map Pages is required');
    }

    setFormErrors(errors);
    return errors.length === 0;
  };

  // Upload map file to Supabase storage or fallback to base64
  const uploadMapFile = async (file: File, jobId: string): Promise<string> => {
    // Helper to convert file to base64
    const toBase64 = (f: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          console.log('[UPLOAD] Base64 conversion complete, length:', result?.length);
          resolve(result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(f);
      });
    };

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${jobId}-${Date.now()}.${fileExt}`;
      const filePath = `job-maps/${fileName}`;

      console.log('[UPLOAD] Attempting Supabase storage upload:', filePath);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('maps')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('[UPLOAD] Supabase storage error:', error);
        console.log('[UPLOAD] Falling back to base64');
        return await toBase64(file);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('maps')
        .getPublicUrl(filePath);

      console.log('[UPLOAD] Supabase public URL:', urlData?.publicUrl);

      if (urlData?.publicUrl) {
        return urlData.publicUrl;
      }

      // If no public URL, fallback to base64
      console.log('[UPLOAD] No public URL, falling back to base64');
      return await toBase64(file);
    } catch (error) {
      console.error('[UPLOAD] Error in uploadMapFile:', error);
      console.log('[UPLOAD] Falling back to base64');
      return await toBase64(file);
    }
  };

  // Create job
  const handleCreateJob = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Generate temp job ID for file upload
      const tempJobId = `job-${Date.now()}`;

      // Upload map file if exists
      let mapFileUrl = '';
      if (mapFile) {
        console.log('[CREATE JOB] Uploading map file:', mapFile.name);
        mapFileUrl = await uploadMapFile(mapFile, tempJobId);
        console.log('[CREATE JOB] Map file URL obtained, length:', mapFileUrl?.length);
      }

      const newJob = await jobStorageSupabase.create({
        title: formData.title,
        assignedToId: formData.assignedToId || 'lineman-default',
        assignedToName: formData.assignedToName || 'Unassigned',
        assignedById: user.id,
        assignedByName: user.name,
        assignedAt: new Date().toISOString(),
        clientId: formData.clientId,
        clientName: formData.clientName,
        customerId: formData.customerId,
        customerName: formData.customerName,
        truckId: formData.truckId || undefined,
        workType: formData.workType as WorkType,
        location: {
          address: formData.address,
          city: formData.city,
          state: formData.state,
        },
        scheduledDate: formData.scheduledDate || undefined,
        estimatedFootage: formData.estimatedFootage ? parseInt(formData.estimatedFootage) : undefined,
        supervisorNotes: `OLT: ${formData.olt}\nFeeder ID: ${formData.feederId}\nMap Pages: ${formData.runNumber}\n\n${formData.supervisorNotes}`,
        status: JobStatus.ASSIGNED,
        mapFile: mapFile ? (() => {
          const mapData = {
            filename: mapFile.name,
            url: mapFileUrl,
            size: mapFile.size,
            uploadedAt: new Date().toISOString()
          };
          console.log('[CREATE JOB] Saving mapFile:', { ...mapData, url: mapData.url?.substring(0, 50) + '...' });
          return mapData;
        })() : undefined
      });

      if (newJob) {
        // Success
        setShowCreateModal(false);
        setFormData(initialFormState);
        setMapFile(null);
        loadJobs();

        // Show success toast (simplified)
        alert(`Job ${newJob.jobCode} created successfully!`);
      }
    } catch (error) {
      console.error('Error creating job:', error);
      setFormErrors(['Failed to create job. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign job
  const handleAssignJob = async (jobId: string, linemanId: string, linemanName: string) => {
    try {
      await jobStorageSupabase.update(jobId, {
        assignedToId: linemanId,
        assignedToName: linemanName,
      });
      loadJobs();
    } catch (error) {
      console.error('Error assigning job:', error);
    }
  };

  // Open edit modal with job data
  const openEditModal = (job: Job) => {
    console.log('[DEBUG] openEditModal called with job:', job.id, job.title);
    // Parse supervisor notes to extract OLT, Feeder ID, Map Pages
    const notes = job.supervisorNotes || '';
    const oltMatch = notes.match(/OLT:\s*([^\n]*)/);
    const feederMatch = notes.match(/Feeder ID:\s*([^\n]*)/);
    const runMatch = notes.match(/Map Pages:\s*([^\n]*)/);
    const cleanNotes = notes
      .replace(/OLT:\s*[^\n]*\n?/, '')
      .replace(/Feeder ID:\s*[^\n]*\n?/, '')
      .replace(/Map Pages:\s*[^\n]*\n?/, '')
      .replace(/^\n+/, '')
      .trim();

    setEditFormData({
      title: job.title || '',
      clientId: job.clientId || '',
      clientName: job.clientName || '',
      customerId: job.customerId || '',
      customerName: job.customerName || '',
      truckId: job.truckId || '',
      city: job.location?.city || '',
      state: job.location?.state || '',
      address: job.location?.address || '',
      olt: oltMatch ? oltMatch[1].trim() : '',
      feederId: feederMatch ? feederMatch[1].trim() : '',
      runNumber: runMatch ? runMatch[1].trim() : '',
      workType: job.workType || 'aerial',
      scheduledDate: job.scheduledDate || '',
      estimatedFootage: job.estimatedFootage?.toString() || '',
      supervisorNotes: cleanNotes,
      assignedToId: job.assignedToId || '',
      assignedToName: job.assignedToName || '',
      status: job.status || 'assigned',
    });
    setSelectedJob(job);
    setShowEditModal(true);
    setFormErrors([]);
    console.log('[DEBUG] Edit modal should open now. showEditModal:', true, 'selectedJob:', job.id);
  };

  // Update job
  const handleUpdateJob = async () => {
    console.log('[DEBUG] handleUpdateJob called with:', editFormData);

    // Validate required fields
    const errors: string[] = [];
    if (!editFormData.title.trim()) errors.push('Title is required');
    if (!editFormData.clientId) errors.push('Client is required');
    if (!editFormData.customerId) errors.push('Customer is required');
    if (!editFormData.city.trim()) errors.push('City is required');
    if (!editFormData.state) errors.push('State is required');
    if (!editFormData.status) errors.push('Status is required');

    if (errors.length > 0) {
      console.log('[DEBUG] Validation errors:', errors);
      setFormErrors(errors);
      return;
    }

    if (!selectedJob) {
      console.error('[DEBUG] No selected job');
      return;
    }

    setIsSubmitting(true);
    setFormErrors([]);

    try {
      // Determine if job is being unassigned
      const isUnassigned = !editFormData.assignedToId ||
                           editFormData.assignedToId === 'unassigned' ||
                           editFormData.assignedToId === '';

      const updatePayload = {
        title: editFormData.title.trim(),
        clientId: editFormData.clientId,
        clientName: editFormData.clientName,
        customerId: editFormData.customerId,
        customerName: editFormData.customerName,
        truckId: editFormData.truckId || undefined,
        workType: editFormData.workType as WorkType,
        location: {
          address: editFormData.address.trim(),
          city: editFormData.city.trim(),
          state: editFormData.state,
        },
        scheduledDate: editFormData.scheduledDate || undefined,
        estimatedFootage: editFormData.estimatedFootage ? parseInt(editFormData.estimatedFootage) : undefined,
        supervisorNotes: [
          editFormData.olt ? `OLT: ${editFormData.olt}` : '',
          editFormData.feederId ? `Feeder ID: ${editFormData.feederId}` : '',
          editFormData.runNumber ? `Map Pages: ${editFormData.runNumber}` : '',
          editFormData.supervisorNotes
        ].filter(Boolean).join('\n').trim(),
        assignedToId: isUnassigned ? '' : editFormData.assignedToId,
        assignedToName: isUnassigned ? 'Unassigned' : editFormData.assignedToName,
        status: editFormData.status as JobStatus,
      };

      console.log('[DEBUG] Sending update payload:', updatePayload);

      const result = await jobStorageSupabase.update(selectedJob.id, updatePayload);

      if (result) {
        console.log('[DEBUG] Job updated successfully:', result.id);
        setShowEditModal(false);
        setSelectedJob(null);
        setEditFormData(initialFormState);
        await loadJobs(); // Reload jobs to reflect changes
      } else {
        throw new Error('Update returned undefined');
      }
    } catch (error) {
      console.error('[DEBUG] Error updating job:', error);
      setFormErrors(['Failed to update job. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option?.color || '#6B7280';
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option?.label || status;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--abyss)' }}>
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl" style={{ background: 'var(--neural-dim)' }}>
              <Briefcase className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Jobs Management
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Create and manage field jobs for linemen
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-105"
            style={{ background: 'var(--gradient-neural)', color: '#000' }}
          >
            <Plus className="w-5 h-5" />
            New Job
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
            {[
              { id: 'all' as TabType, label: 'All Jobs' },
              { id: 'assigned' as TabType, label: 'Assigned' },
              { id: 'unassigned' as TabType, label: 'Unassigned' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  background: activeTab === tab.id ? 'var(--neural-dim)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--neural-core)' : 'var(--text-secondary)',
                  border: activeTab === tab.id ? '1px solid var(--border-neural)' : '1px solid transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search jobs..."
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

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none cursor-pointer"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)'
            }}
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Client Filter */}
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none cursor-pointer"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)'
            }}
          >
            <option value="">All Clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Briefcase className="w-16 h-16" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
              No jobs found
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
            >
              <Plus className="w-4 h-4" />
              Create First Job
            </button>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--elevated)' }}>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Job</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Client</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Location</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Type</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Status</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Created</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job, index) => (
                  <tr
                    key={job.id}
                    className="border-t transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{job.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{job.jobCode}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {job.clientName || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium" style={{ color: 'var(--neural-core)' }}>
                        {job.customerName || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {job.location?.city ? `${job.location.city}, ${job.location.state}` : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="px-2 py-1 rounded-lg text-xs font-bold uppercase"
                        style={{
                          background: 'var(--neural-dim)',
                          color: 'var(--neural-core)'
                        }}
                      >
                        {job.workType || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {job.assignedToId && job.assignedToId !== 'lineman-default' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--neural-dim)' }}>
                            <User className="w-3 h-3" style={{ color: 'var(--neural-core)' }} />
                          </div>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {job.assignedToName}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedJob(job);
                            setShowDetailModal(true);
                            loadRedlines(job.id);
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors hover:opacity-80"
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}
                        >
                          <UserPlus className="w-3 h-3" />
                          Assign
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {!job.assignedToId || job.assignedToId === '' ? (
                        <span
                          className="px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 w-fit"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#EF4444'
                          }}
                        >
                          Not Assigned
                        </span>
                      ) : (
                        <span
                          className="px-2 py-1 rounded-lg text-xs font-bold"
                          style={{
                            background: `${getStatusColor(job.status)}20`,
                            color: getStatusColor(job.status)
                          }}
                        >
                          {getStatusLabel(job.status)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        {formatDate(job.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedJob(job);
                            setShowDetailModal(true);
                            loadRedlines(job.id);
                          }}
                          className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        <button
                          onClick={() => openEditModal(job)}
                          className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete job "${job.title || job.jobCode}"?`)) return;

                            console.log('[DELETE] Deleting job:', job.id);
                            const success = await jobStorageSupabase.remove(job.id);
                            console.log('[DELETE] Result:', success);

                            if (success) {
                              await loadJobs();
                            } else {
                              alert('Failed to delete job');
                            }
                          }}
                          className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" style={{ color: '#EF4444' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                  <Plus className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
                </div>
                <h2 className="text-xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                  Create New Job
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
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
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Job Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Fiber Installation - Oak Street"
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                />
              </div>

              {/* Client & Work Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Client (Prime Contractor) *
                  </label>
                  <select
                    value={formData.clientId}
                    onChange={(e) => {
                      const client = clients.find(c => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        clientId: e.target.value,
                        clientName: client?.name || '',
                        // Reset customer when client changes
                        customerId: '',
                        customerName: ''
                      });
                    }}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Customer (End Operator) *
                  </label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        customerId: e.target.value,
                        customerName: customer?.name || ''
                      });
                    }}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Truck Row */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Truck (Optional)
                </label>
                <select
                  value={formData.truckId}
                  onChange={(e) => setFormData({ ...formData, truckId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <option value="">No Truck Assigned</option>
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.truck_number}{t.investor_name ? ` (${t.investor_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Type Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Work Type
                  </label>
                  <select
                    value={formData.workType}
                    onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    {WORK_TYPES.map(w => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    State *
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <option value="">State</option>
                    {US_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Address (Optional)
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                />
              </div>

              {/* OLT, Feeder ID, Map Pages */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    OLT *
                  </label>
                  <input
                    type="text"
                    value={formData.olt}
                    onChange={(e) => setFormData({ ...formData, olt: e.target.value })}
                    placeholder="OLT"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Feeder ID
                  </label>
                  <input
                    type="text"
                    value={formData.feederId}
                    onChange={(e) => setFormData({ ...formData, feederId: e.target.value })}
                    placeholder="Feeder ID"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Map Pages
                  </label>
                  <input
                    type="text"
                    value={formData.runNumber}
                    onChange={(e) => setFormData({ ...formData, runNumber: e.target.value })}
                    placeholder="e.g. 117-122"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
              </div>

              {/* Scheduled Date & Estimated Footage */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Estimated Footage
                  </label>
                  <input
                    type="number"
                    value={formData.estimatedFootage}
                    onChange={(e) => setFormData({ ...formData, estimatedFootage: e.target.value })}
                    placeholder="e.g., 2500"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
              </div>

              {/* Supervisor Notes */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Supervisor Notes / Instructions
                </label>
                <textarea
                  value={formData.supervisorNotes}
                  onChange={(e) => setFormData({ ...formData, supervisorNotes: e.target.value })}
                  placeholder="Add any special instructions for the lineman..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none resize-none"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                />
              </div>

              {/* Map Upload */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Map / Document
                </label>
                <div
                  className="relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer hover:border-opacity-100"
                  style={{ borderColor: 'var(--border-default)' }}
                  onClick={() => document.getElementById('map-upload')?.click()}
                >
                  <input
                    id="map-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setMapFile(file);
                      if (file) {
                        // Auto-extract info when file is uploaded - pass file directly
                        extractMapInfo(file);
                      }
                    }}
                  />
                  {mapFile ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8" style={{ color: 'var(--neural-core)' }} />
                        <div className="text-left">
                          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{mapFile.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {(mapFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMapFile(null);
                          }}
                          className="p-1 rounded-lg hover:bg-white/10"
                        >
                          <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                      </div>
                      {/* Auto-extraction status */}
                      {isExtractingMap && (
                        <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--neural-core)' }}>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Reading map and filling form...
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Click to upload map or document
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        PDF, JPG, PNG (max 500MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Assign to Lineman */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Assign to Lineman (Optional)
                </label>
                {linemen.length > 0 ? (
                  <select
                    value={formData.assignedToId}
                    onChange={(e) => {
                      const lineman = linemen.find(l => l.id === e.target.value);
                      setFormData({
                        ...formData,
                        assignedToId: e.target.value,
                        assignedToName: lineman?.name || ''
                      });
                    }}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <option value="">Leave Unassigned</option>
                    {linemen.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.email})</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--elevated)', border: '1px solid var(--border-default)' }}>
                      <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                        No linemen registered yet. Enter manually:
                      </p>
                      <input
                        type="text"
                        value={formData.assignedToName}
                        onChange={(e) => setFormData({
                          ...formData,
                          assignedToName: e.target.value,
                          assignedToId: e.target.value ? `manual-${Date.now()}` : ''
                        })}
                        placeholder="Lineman name (or leave empty)"
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium outline-none"
                        style={{
                          background: 'var(--surface)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  If assigned, the job will appear immediately in the lineman's app
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData(initialFormState);
                  setFormErrors([]);
                }}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateJob}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'var(--gradient-neural)', color: '#000' }}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Create Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Detail Modal */}
      {showDetailModal && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                  {selectedJob.jobCode}
                </p>
                <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {selectedJob.title}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedJob(null);
                  setRedlines([]);
                }}
                className="p-2 rounded-xl transition-colors hover:bg-white/10"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Job Details */}
            <div className="space-y-6">
              {/* Status & Assignment */}
              <div className="flex items-center gap-4">
                <span
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{
                    background: `${getStatusColor(selectedJob.status)}20`,
                    color: getStatusColor(selectedJob.status)
                  }}
                >
                  {getStatusLabel(selectedJob.status)}
                </span>
                {selectedJob.assignedToId && selectedJob.assignedToId !== 'lineman-default' ? (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Assigned to: {selectedJob.assignedToName}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-medium" style={{ color: '#EF4444' }}>
                    Unassigned
                  </span>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
                  <p className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-tertiary)' }}>Client</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedJob.clientName || '-'}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
                  <p className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-tertiary)' }}>Customer</p>
                  <p className="font-medium" style={{ color: 'var(--neural-core)' }}>{selectedJob.customerName || '-'}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
                  <p className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-tertiary)' }}>Work Type</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedJob.workType || '-'}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
                  <p className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-tertiary)' }}>Location</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {selectedJob.location?.city ? `${selectedJob.location.city}, ${selectedJob.location.state}` : '-'}
                  </p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
                  <p className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-tertiary)' }}>Estimated Footage</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {selectedJob.estimatedFootage ? `${selectedJob.estimatedFootage.toLocaleString()} ft` : '-'}
                  </p>
                </div>
              </div>

              {/* Supervisor Notes */}
              {selectedJob.supervisorNotes && (
                <div>
                  <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Supervisor Notes
                  </p>
                  <div className="p-4 rounded-xl whitespace-pre-wrap text-sm" style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}>
                    {selectedJob.supervisorNotes}
                  </div>
                </div>
              )}

              {/* Assign Section */}
              {(!selectedJob.assignedToId || selectedJob.assignedToId === 'lineman-default') && (
                <div className="p-4 rounded-xl" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
                  <p className="text-xs font-bold uppercase mb-3" style={{ color: 'var(--neural-core)' }}>
                    Assign to Lineman
                  </p>
                  <div className="flex gap-3">
                    <select
                      id="assign-select"
                      className="flex-1 px-4 py-2 rounded-xl text-sm font-medium outline-none cursor-pointer"
                      style={{
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      <option value="">Select Lineman</option>
                      {linemen.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const select = document.getElementById('assign-select') as HTMLSelectElement;
                        const linemanId = select.value;
                        const lineman = linemen.find(l => l.id === linemanId);
                        if (lineman) {
                          handleAssignJob(selectedJob.id, lineman.id, lineman.name);
                          setShowDetailModal(false);
                          setSelectedJob(null);
                          setRedlines([]);
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                      style={{ background: 'var(--gradient-neural)', color: '#000' }}
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}

              {/* Map/Document */}
              {selectedJob.mapFile && (
                <div>
                  <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Map / Document
                  </p>
                  <div
                    className={`p-4 rounded-xl transition-all ${selectedJob.mapFile.url ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
                    style={{ background: 'var(--elevated)' }}
                    onClick={() => {
                      if (selectedJob.mapFile?.url) {
                        window.open(selectedJob.mapFile.url, '_blank');
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: 'var(--neural-dim)' }}>
                          <FileText className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                            {selectedJob.mapFile.filename}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {(selectedJob.mapFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedJob.mapFile.url ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(selectedJob.mapFile!.url, '_blank');
                              }}
                              className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105"
                              style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)', border: '1px solid var(--border-neural)' }}
                            >
                              <Eye className="w-4 h-4" />
                              View Map
                            </button>
                            <a
                              href={selectedJob.mapFile.url}
                              download={selectedJob.mapFile.filename}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105"
                              style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </a>
                          </>
                        ) : (
                          <span className="text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
                            URL not available
                          </span>
                        )}
                      </div>
                    </div>
                    {/* PDF Preview */}
                    {selectedJob.mapFile.url && (
                      <div className="mt-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                        <iframe
                          src={selectedJob.mapFile.url.startsWith('data:') ? selectedJob.mapFile.url : `${selectedJob.mapFile.url}#toolbar=0`}
                          className="w-full h-64"
                          title="Map Preview"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Redlines Section */}
              <RedlinesPanel
                job={selectedJob}
                redlines={redlines}
                user={user}
                lang={lang}
                onUpload={() => {
                  loadRedlines(selectedJob.id);
                  // Also reload jobs to update status
                  loadJobs();
                }}
                onReview={() => {
                  loadRedlines(selectedJob.id);
                  loadJobs();
                }}
              />

              {/* Audit Log */}
              <div>
                <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Activity Log
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--neural-core)' }} />
                    Created on {formatDate(selectedJob.createdAt)} by {selectedJob.assignedByName || 'Admin'}
                  </div>
                  {selectedJob.assignedToId && selectedJob.assignedToId !== 'lineman-default' && (
                    <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
                      Assigned to {selectedJob.assignedToName} on {formatDate(selectedJob.assignedAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedJob(null);
                  setRedlines([]);
                }}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:bg-white/10"
                style={{ color: 'var(--text-secondary)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {showEditModal && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                  <Edit2 className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase" style={{ color: 'var(--text-primary)' }}>
                    Edit Job
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{selectedJob.jobCode}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditFormData(initialFormState);
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
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Job Title *
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  placeholder="e.g., Fiber Installation - Oak Street"
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                />
              </div>

              {/* Client & Customer */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Client (Prime Contractor) *
                  </label>
                  <select
                    value={editFormData.clientId}
                    onChange={(e) => {
                      const client = clients.find(c => c.id === e.target.value);
                      setEditFormData({
                        ...editFormData,
                        clientId: e.target.value,
                        clientName: client?.name || '',
                        customerId: '',
                        customerName: ''
                      });
                    }}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Customer (End Operator) *
                  </label>
                  <select
                    value={editFormData.customerId}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value);
                      setEditFormData({
                        ...editFormData,
                        customerId: e.target.value,
                        customerName: customer?.name || ''
                      });
                    }}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Truck */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Truck (Optional)
                </label>
                <select
                  value={editFormData.truckId}
                  onChange={(e) => setEditFormData({ ...editFormData, truckId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <option value="">No Truck Assigned</option>
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.truck_number}{t.investor_name ? ` (${t.investor_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Work Type
                  </label>
                  <select
                    value={editFormData.workType}
                    onChange={(e) => setEditFormData({ ...editFormData, workType: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    {WORK_TYPES.map(w => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    placeholder="City"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    State *
                  </label>
                  <select
                    value={editFormData.state}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <option value="">State</option>
                    {US_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Address
                </label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  placeholder="Street address"
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                />
              </div>

              {/* OLT, Feeder ID, Map Pages */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    OLT
                  </label>
                  <input
                    type="text"
                    value={editFormData.olt}
                    onChange={(e) => setEditFormData({ ...editFormData, olt: e.target.value })}
                    placeholder="OLT"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Feeder ID
                  </label>
                  <input
                    type="text"
                    value={editFormData.feederId}
                    onChange={(e) => setEditFormData({ ...editFormData, feederId: e.target.value })}
                    placeholder="Feeder ID"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Map Pages
                  </label>
                  <input
                    type="text"
                    value={editFormData.runNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, runNumber: e.target.value })}
                    placeholder="e.g. 117-122"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
              </div>

              {/* Scheduled Date & Estimated Footage */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.scheduledDate}
                    onChange={(e) => setEditFormData({ ...editFormData, scheduledDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Estimated Footage
                  </label>
                  <input
                    type="number"
                    value={editFormData.estimatedFootage}
                    onChange={(e) => setEditFormData({ ...editFormData, estimatedFootage: e.target.value })}
                    placeholder="e.g., 2500"
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'var(--elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)'
                    }}
                  />
                </div>
              </div>

              {/* Supervisor Notes */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Supervisor Notes / Instructions
                </label>
                <textarea
                  value={editFormData.supervisorNotes}
                  onChange={(e) => setEditFormData({ ...editFormData, supervisorNotes: e.target.value })}
                  placeholder="Add any special instructions..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none resize-none"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                />
              </div>

              {/* Assign to Lineman */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Assigned Lineman
                </label>
                <select
                  value={editFormData.assignedToId || 'unassigned'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'unassigned') {
                      setEditFormData({
                        ...editFormData,
                        assignedToId: '',
                        assignedToName: 'Unassigned'
                      });
                    } else {
                      const lineman = linemen.find(l => l.id === value);
                      setEditFormData({
                        ...editFormData,
                        assignedToId: value,
                        assignedToName: lineman?.name || value
                      });
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <option value="unassigned">-- Unassigned --</option>
                  {linemen.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.email})</option>
                  ))}
                </select>
              </div>

              {/* Job Status */}
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  Job Status *
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none cursor-pointer"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditFormData(initialFormState);
                  setFormErrors([]);
                }}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateJob}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'var(--gradient-neural)', color: '#000' }}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default JobsAdmin;
