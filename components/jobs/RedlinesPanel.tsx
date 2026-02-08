/**
 * RedlinesPanel - Upload, view versions, and review redlines
 * THIS IS THE CORE OF THE NEW WORKFLOW
 *
 * Features:
 * - Upload new redline versions (Admin/Specialist)
 * - View version history
 * - Submit for client review
 * - Approve (with SR#) or Reject (with notes)
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, FileText, Clock, CheckCircle, XCircle, Send, Eye, Download, Plus,
  AlertCircle, X, File, Trash2
} from 'lucide-react';
import { Job, RedlineVersion, RedlineStatus } from '../../types/project';
import { jobRedlineService } from '../../services/jobRedlineService';
import { Language, User } from '../../types';

interface Props {
  job: Job;
  redlines: RedlineVersion[];
  user: User;
  lang?: Language;
  onUpload: () => void;
  onReview: () => void;
}

export const RedlinesPanel: React.FC<Props> = ({ job, redlines, user, lang = 'EN', onUpload, onReview }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingVersion, setReviewingVersion] = useState<RedlineVersion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Role checks
  const userRole = (user?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERVISOR';
  const isRedlineSpecialist = userRole === 'REDLINE_SPECIALIST';
  const isClientReviewer = userRole === 'CLIENT_REVIEWER';
  const canUpload = isAdmin || isRedlineSpecialist;
  const canReview = isAdmin || isClientReviewer;
  const canSubmitForReview = isAdmin || isRedlineSpecialist;

  // Get latest version
  const latestVersion = redlines[0];
  const hasPendingRedlines = job.productionData && redlines.length === 0;

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  // Remove selected file
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  // Handle upload
  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Convert files to base64
      const filesData = await Promise.all(
        selectedFiles.map(async (file) => ({
          fileName: file.name,
          dataUrl: await fileToBase64(file),
          mimeType: file.type,
          fileSize: file.size
        }))
      );

      const result = await jobRedlineService.uploadRedlineVersion(
        job.id,
        filesData,
        user.id,
        user.name,
        notes || undefined
      );

      if (result.success) {
        setShowUploadModal(false);
        setSelectedFiles([]);
        setNotes('');
        onUpload();
      } else {
        setError(result.error || 'Failed to upload');
      }
    } catch (err) {
      console.error('[RedlinesPanel] Upload error:', err);
      setError('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  }, [job.id, selectedFiles, user, notes, onUpload]);

  // Handle submit for review
  const handleSubmitForReview = useCallback(async (version: RedlineVersion) => {
    const result = await jobRedlineService.submitForReview(
      version.id,
      user.id,
      user.name,
      user.role
    );
    if (result.success) {
      onReview();
    } else {
      setError(result.error || 'Failed to submit for review');
    }
  }, [user, onReview]);

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
          <FileText className="w-4 h-4" />
          Redlines
          {redlines.length > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px]"
              style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
            >
              v{latestVersion.versionNumber}
            </span>
          )}
        </h3>

        {canUpload && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all hover:scale-105"
            style={{ background: 'var(--gradient-neural)', color: '#000' }}
          >
            <Plus className="w-4 h-4" />
            Upload New Version
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="p-3 rounded-xl mb-4 flex items-center gap-2"
          style={{ background: 'var(--critical-glow)', border: '1px solid var(--critical-core)' }}
        >
          <XCircle className="w-4 h-4" style={{ color: 'var(--critical-core)' }} />
          <span className="text-sm" style={{ color: 'var(--critical-core)' }}>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" style={{ color: 'var(--critical-core)' }} />
          </button>
        </div>
      )}

      {/* Alert: Pending Redlines */}
      {hasPendingRedlines && (
        <div
          className="p-4 rounded-xl mb-4 flex items-center gap-3"
          style={{ background: 'rgba(251, 146, 60, 0.15)', border: '1px solid #fb923c' }}
        >
          <AlertCircle className="w-6 h-6 flex-shrink-0" style={{ color: '#fb923c' }} />
          <div>
            <p className="font-bold" style={{ color: '#fb923c' }}>Pending Redlines</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Production submitted. Upload redline documents to proceed with client review.
            </p>
          </div>
        </div>
      )}

      {/* Version History */}
      {redlines.length > 0 ? (
        <div className="space-y-4">
          {redlines.map((version) => (
            <RedlineVersionCard
              key={version.id}
              version={version}
              isLatest={version.id === latestVersion.id}
              canSubmitForReview={canSubmitForReview && version.reviewStatus === 'uploaded'}
              canReview={canReview && version.reviewStatus === 'under_review'}
              onSubmitForReview={() => handleSubmitForReview(version)}
              onReview={() => {
                setReviewingVersion(version);
                setShowReviewModal(true);
              }}
            />
          ))}
        </div>
      ) : !hasPendingRedlines && (
        <div className="text-center py-8" style={{ color: 'var(--text-ghost)' }}>
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No redlines uploaded yet</p>
          {!job.productionData && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Waiting for production submission
            </p>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-lg rounded-2xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Upload Redline v{(job.lastRedlineVersionNumber || 0) + 1}
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setNotes('');
                }}
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            {/* File Drop Zone */}
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center mb-4 cursor-pointer transition-colors"
              style={{ borderColor: 'var(--border-default)' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p className="font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Drop files here or click to browse
              </p>
              <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                PDF, PNG, JPG up to 10MB each
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--elevated)' }}
                  >
                    <File className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
                    <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {file.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button onClick={() => removeFile(index)}>
                      <Trash2 className="w-4 h-4" style={{ color: 'var(--critical-core)' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-ghost)' }}>
                Internal Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl text-sm"
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)'
                }}
                rows={3}
                placeholder="Notes visible only to admin/specialists..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                  setNotes('');
                }}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold"
                style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--gradient-neural)', color: '#000' }}
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && reviewingVersion && (
        <ReviewRedlineModal
          version={reviewingVersion}
          user={user}
          onClose={() => {
            setShowReviewModal(false);
            setReviewingVersion(null);
          }}
          onReviewComplete={() => {
            setShowReviewModal(false);
            setReviewingVersion(null);
            onReview();
          }}
        />
      )}
    </div>
  );
};

// ============================================
// Sub-component: Redline Version Card
// ============================================

interface VersionCardProps {
  version: RedlineVersion;
  isLatest: boolean;
  canSubmitForReview: boolean;
  canReview: boolean;
  onSubmitForReview: () => void;
  onReview: () => void;
}

const RedlineVersionCard: React.FC<VersionCardProps> = ({
  version,
  isLatest,
  canSubmitForReview,
  canReview,
  onSubmitForReview,
  onReview
}) => {
  const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    uploaded: { icon: Upload, color: 'var(--neural-core)', bg: 'var(--neural-dim)', label: 'Uploaded' },
    under_review: { icon: Clock, color: 'var(--energy-core)', bg: 'var(--energy-pulse)', label: 'Under Review' },
    approved: { icon: CheckCircle, color: 'var(--online-core)', bg: 'var(--online-glow)', label: 'Approved' },
    rejected: { icon: XCircle, color: 'var(--critical-core)', bg: 'var(--critical-glow)', label: 'Rejected' }
  };

  const config = statusConfig[version.reviewStatus] || statusConfig.uploaded;
  const StatusIcon = config.icon;

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: 'var(--elevated)',
        border: isLatest ? `2px solid ${config.color}` : '1px solid var(--border-default)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-black"
            style={{ color: 'var(--text-primary)' }}
          >
            Version {version.versionNumber}
          </span>
          {isLatest && (
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
              style={{ background: config.bg, color: config.color }}
            >
              Latest
            </span>
          )}
        </div>
        <span
          className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1"
          style={{ background: config.bg, color: config.color }}
        >
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </span>
      </div>

      {/* Files */}
      <div className="space-y-2 mb-3">
        {version.files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-2 p-2 rounded-lg"
            style={{ background: 'var(--surface)' }}
          >
            <FileText className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
            <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
              {file.fileName}
            </span>
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--elevated)' }}
            >
              <Eye className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </a>
            <a
              href={file.fileUrl}
              download={file.fileName}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--elevated)' }}
            >
              <Download className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </a>
          </div>
        ))}
      </div>

      {/* Metadata */}
      <div className="text-xs mb-3" style={{ color: 'var(--text-ghost)' }}>
        Uploaded by {version.uploadedByName} on {new Date(version.uploadedAt).toLocaleString()}
      </div>

      {/* Rejection Notes */}
      {version.reviewStatus === 'rejected' && version.reviewerNotes && (
        <div
          className="p-3 rounded-lg mb-3"
          style={{ background: 'var(--critical-glow)', border: '1px solid var(--critical-core)' }}
        >
          <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--critical-core)' }}>
            Rejection Reason
          </p>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{version.reviewerNotes}</p>
        </div>
      )}

      {/* Internal Notes */}
      {version.internalNotes && (
        <div className="p-3 rounded-lg mb-3" style={{ background: 'var(--surface)' }}>
          <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-ghost)' }}>
            Internal Notes
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{version.internalNotes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {canSubmitForReview && (
          <button
            onClick={onSubmitForReview}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            style={{ background: 'var(--gradient-neural)', color: '#000' }}
          >
            <Send className="w-4 h-4" />
            Submit for Review
          </button>
        )}
        {canReview && (
          <button
            onClick={onReview}
            className="flex-1 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            style={{ background: 'var(--energy-core)', color: '#fff' }}
          >
            Review
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// Sub-component: Review Modal
// ============================================

interface ReviewModalProps {
  version: RedlineVersion;
  user: User;
  onClose: () => void;
  onReviewComplete: () => void;
}

const ReviewRedlineModal: React.FC<ReviewModalProps> = ({ version, user, onClose, onReviewComplete }) => {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [srNumber, setSrNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!action) return;

    setIsSubmitting(true);
    setError(null);

    let result;
    if (action === 'approve') {
      if (!srNumber.trim()) {
        setError('SR Number is required for approval');
        setIsSubmitting(false);
        return;
      }
      result = await jobRedlineService.approveRedline(
        version.id,
        user.id,
        user.name,
        user.role,
        srNumber.trim()
      );
    } else {
      if (!notes.trim()) {
        setError('Rejection notes are required');
        setIsSubmitting(false);
        return;
      }
      result = await jobRedlineService.rejectRedline(
        version.id,
        user.id,
        user.name,
        user.role,
        notes.trim()
      );
    }

    if (result.success) {
      onReviewComplete();
    } else {
      setError(result.error || 'Review failed');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Review Redline v{version.versionNumber}
          </h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* Files Preview */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-ghost)' }}>Files</p>
          <div className="space-y-2">
            {version.files.map((file) => (
              <a
                key={file.id}
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                style={{ background: 'var(--elevated)' }}
              >
                <FileText className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
                <span className="flex-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{file.fileName}</span>
                <Eye className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </a>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="p-3 rounded-xl mb-4"
            style={{ background: 'var(--critical-glow)', border: '1px solid var(--critical-core)' }}
          >
            <p className="text-sm" style={{ color: 'var(--critical-core)' }}>{error}</p>
          </div>
        )}

        {/* Action Selection */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setAction('approve')}
            className={`flex-1 p-4 rounded-xl text-center transition-all ${action === 'approve' ? 'ring-2 ring-green-500' : ''}`}
            style={{
              background: action === 'approve' ? 'var(--online-glow)' : 'var(--elevated)'
            }}
          >
            <CheckCircle
              className="w-8 h-8 mx-auto mb-2"
              style={{ color: action === 'approve' ? 'var(--online-core)' : 'var(--text-tertiary)' }}
            />
            <p className="font-bold" style={{ color: action === 'approve' ? 'var(--online-core)' : 'var(--text-secondary)' }}>
              Approve
            </p>
          </button>
          <button
            onClick={() => setAction('reject')}
            className={`flex-1 p-4 rounded-xl text-center transition-all ${action === 'reject' ? 'ring-2 ring-red-500' : ''}`}
            style={{
              background: action === 'reject' ? 'var(--critical-glow)' : 'var(--elevated)'
            }}
          >
            <XCircle
              className="w-8 h-8 mx-auto mb-2"
              style={{ color: action === 'reject' ? 'var(--critical-core)' : 'var(--text-tertiary)' }}
            />
            <p className="font-bold" style={{ color: action === 'reject' ? 'var(--critical-core)' : 'var(--text-secondary)' }}>
              Reject
            </p>
          </button>
        </div>

        {/* Conditional Fields */}
        {action === 'approve' && (
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-ghost)' }}>
              SR Number <span style={{ color: 'var(--critical-core)' }}>*</span>
            </label>
            <input
              type="text"
              value={srNumber}
              onChange={(e) => setSrNumber(e.target.value)}
              className="w-full p-3 rounded-xl text-sm"
              style={{
                background: 'var(--elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)'
              }}
              placeholder="e.g., SR-2024-0042"
            />
          </div>
        )}

        {action === 'reject' && (
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-ghost)' }}>
              Rejection Notes <span style={{ color: 'var(--critical-core)' }}>*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 rounded-xl text-sm"
              style={{
                background: 'var(--elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)'
              }}
              rows={4}
              placeholder="Explain what needs to be fixed..."
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!action || isSubmitting}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{
              background: action === 'approve' ? 'var(--online-core)' : action === 'reject' ? 'var(--critical-core)' : 'var(--elevated)',
              color: action ? '#fff' : 'var(--text-tertiary)'
            }}
          >
            {isSubmitting ? 'Submitting...' : action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Select Action'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RedlinesPanel;
