'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import {
  ArrowLeft, CheckCircle, ChevronDown, ChevronUp, AlertCircle,
  Sparkles, Check, Edit3, X, Upload, Loader2, FileDown, Send,
  Image as ImageIcon, Trash2, Plus, ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type SectionStatus = 'draft' | 'enhanced' | 'accepted';

interface EnhanceState {
  loading: boolean;
  enhanced: string | null;
  changes: string[];
  visible: boolean;
}

interface PhotoEntry {
  id: string;
  base64: string;
  caption: string;
  mimeType: string;
  previewUrl: string;
}

interface ReportData {
  // Claim info (from Prime)
  jobNumber: string;
  jobUuid: string;
  claimNumber: string;
  insurer: string;
  insuredName: string;
  propertyAddress: string;
  inspectedBy: string;
  eventType: string;
  incidentDate: string;
  propertyNotes: string;
  reportRef: string;

  // Inspection sub-fields
  inspectionDate: string;
  inspectionTime: string;
  metOnSite: string;

  // Property Details
  buildingType: string;
  buildingDescription: string;
  wallCladding: string;
  roofCladding: string;
  internalLinings: string;
  foundation: string;
  outbuildings: string;
  constructionAge: string;

  // Inspection Details
  propertyCategory: string;
  altAccommodation: string;
  hazmat: string;
  makeSafeRequired: string;
  makeSafeCompleted: string;
  hailDamage: string;

  // Narratives
  circumstancesOfLoss: string;
  damageAssessment: string;
  damageConsistent: string;
  contentsDamaged: string;
  causeOfDamage: string;
  causeStoppedY: string;
  specialistRequired: string;
  specialistType: string;
  suddenGradual: string;
  maintenanceRepairs: string;
  conclusion: string;
  canWarrant: string;
  allocationType: string;
  insuredAware: string;
  repairLeadTime: string;
  repairTimeframe: string;
  allExternalInspected: string;

  // Photos
  frontElevationPhoto: PhotoEntry | null;
  photos: PhotoEntry[];
}

const EMPTY_REPORT: ReportData = {
  jobNumber: '', jobUuid: '', claimNumber: '', insurer: '', insuredName: '',
  propertyAddress: '', inspectedBy: '', eventType: '', incidentDate: '',
  propertyNotes: '', reportRef: '1',
  inspectionDate: '', inspectionTime: '', metOnSite: '',
  buildingType: '', buildingDescription: '', wallCladding: '', roofCladding: '',
  internalLinings: '', foundation: '', outbuildings: '', constructionAge: '',
  propertyCategory: '', altAccommodation: '', hazmat: '', makeSafeRequired: '',
  makeSafeCompleted: '', hailDamage: '',
  circumstancesOfLoss: '', damageAssessment: '', damageConsistent: '', contentsDamaged: '',
  causeOfDamage: '', causeStoppedY: '', specialistRequired: '', specialistType: '',
  suddenGradual: '', maintenanceRepairs: '',
  conclusion: '', canWarrant: '', allocationType: '', insuredAware: '',
  repairLeadTime: '', repairTimeframe: '', allExternalInspected: '',
  frontElevationPhoto: null,
  photos: [],
};

const YES_NO = ['', 'Yes', 'No', 'N/A'];
const YESNO_OPTS = YES_NO.map(v => <option key={v} value={v}>{v || '— select —'}</option>);
const CAT_OPTS = ['', 'CAT-A', 'CAT-B', 'CAT-C', 'CAT-D'].map(v => <option key={v} value={v}>{v || '— select —'}</option>);
const ALLOC_OPTS = ['', 'Scope of Works', 'Cash Settlement', 'Denial', 'Partial'].map(v => <option key={v} value={v}>{v || '— select —'}</option>);

// ─── Section wrapper component ────────────────────────────────────────────────
function Section({
  title, sectionKey, status, onStatusChange, children, textField, reportData, onFieldChange,
}: {
  title: string;
  sectionKey: string;
  status: SectionStatus;
  onStatusChange: (key: string, s: SectionStatus) => void;
  children: React.ReactNode;
  textField?: string;
  reportData: ReportData;
  onFieldChange: (key: string, val: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [enhance, setEnhance] = useState<EnhanceState>({ loading: false, enhanced: null, changes: [], visible: false });

  const canEnhance = !!textField;
  const currentText = textField ? ((reportData as unknown as Record<string, string>)[textField] || '') : '';

  const handleEnhance = async () => {
    if (!currentText.trim()) return;
    setEnhance(e => ({ ...e, loading: true, visible: false }));
    try {
      const res = await fetch('/api/report-assist/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: title,
          currentText,
          jobContext: {
            jobNumber: reportData.jobNumber,
            insurer: reportData.insurer,
            address: reportData.propertyAddress,
            eventType: reportData.eventType,
            incidentDate: reportData.incidentDate,
            claimNumber: reportData.claimNumber,
          },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEnhance({ loading: false, enhanced: data.enhanced, changes: data.changes || [], visible: true });
      onStatusChange(sectionKey, 'enhanced');
    } catch (err) {
      console.error(err);
      setEnhance(e => ({ ...e, loading: false }));
    }
  };

  const handleAccept = () => {
    if (textField && enhance.enhanced) {
      onFieldChange(textField, enhance.enhanced);
      onStatusChange(sectionKey, 'accepted');
      setEnhance(e => ({ ...e, visible: false }));
    }
  };

  const handleEdit = () => {
    if (textField && enhance.enhanced) {
      onFieldChange(textField, enhance.enhanced);
      setEnhance(e => ({ ...e, visible: false }));
    }
  };

  const handleKeep = () => {
    onStatusChange(sectionKey, 'draft');
    setEnhance(e => ({ ...e, visible: false }));
  };

  const statusBadge = {
    draft: <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">Draft</span>,
    enhanced: <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50">✨ Enhanced</span>,
    accepted: <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/60 text-green-300 border border-green-700/50">✅ Accepted</span>,
  }[status];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-800/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {statusBadge}
        </div>
        <div className="flex items-center gap-2">
          {canEnhance && open && (
            <button
              onClick={e => { e.stopPropagation(); handleEnhance(); }}
              disabled={enhance.loading || !currentText.trim()}
              className="flex items-center gap-1.5 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 text-purple-300 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {enhance.loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Enhance with AI
            </button>
          )}
          {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="px-5 pb-5 pt-1">
          {children}

          {/* AI enhancement result */}
          {enhance.visible && enhance.enhanced && (
            <div className="mt-4 rounded-lg border border-green-700/50 bg-green-950/20 overflow-hidden">
              <div className="px-4 py-2 border-b border-green-700/30 flex items-center gap-2">
                <Sparkles size={13} className="text-green-400" />
                <span className="text-xs font-semibold text-green-300">AI-Enhanced Version</span>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-green-100 leading-relaxed whitespace-pre-wrap">{enhance.enhanced}</p>
                {enhance.changes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-green-400 font-medium mb-1">Changes made:</p>
                    <ul className="space-y-0.5">
                      {enhance.changes.map((c, i) => (
                        <li key={i} className="text-xs text-green-300/70 flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-green-700/30 flex items-center gap-2">
                <button onClick={handleAccept} className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                  <Check size={12} /> Accept
                </button>
                <button onClick={handleEdit} className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                  <Edit3 size={12} /> Edit First
                </button>
                <button onClick={handleKeep} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                  <X size={12} /> Keep Original
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Textarea field ───────────────────────────────────────────────────────────
function TextArea({ fieldKey, value, onChange, placeholder, rows = 5 }: {
  fieldKey: string; value: string; onChange: (key: string, v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={e => onChange(fieldKey, e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-red-500 resize-y placeholder:text-gray-600"
    />
  );
}

// ─── Select field ─────────────────────────────────────────────────────────────
function SelectField({ fieldKey, value, onChange, children }: {
  fieldKey: string; value: string; onChange: (k: string, v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(fieldKey, e.target.value)}
      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500"
    >
      {children}
    </select>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────
function InputField({ fieldKey, value, onChange, placeholder, type = 'text', className = '' }: {
  fieldKey: string; value: string; onChange: (k: string, v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(fieldKey, e.target.value)}
      placeholder={placeholder}
      className={`bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-500 ${className}`}
    />
  );
}

// ─── 2-col form grid ──────────────────────────────────────────────────────────
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2 sm:gap-4 items-start py-2">
      <label className="text-xs font-semibold text-gray-400 sm:pt-2.5">{label}</label>
      <div className="w-full">{children}</div>
    </div>
  );
}

// ─── Photo upload section ─────────────────────────────────────────────────────
function PhotoUploader({
  label,
  photo,
  onAdd,
  onRemove,
  onCaptionChange,
  multiple = false,
  photos,
  onAddMultiple,
  onRemoveMultiple,
  onCaptionChangeMultiple,
}: {
  label: string;
  photo?: PhotoEntry | null;
  onAdd?: (p: PhotoEntry) => void;
  onRemove?: () => void;
  onCaptionChange?: (caption: string) => void;
  multiple?: boolean;
  photos?: PhotoEntry[];
  onAddMultiple?: (p: PhotoEntry) => void;
  onRemoveMultiple?: (id: string) => void;
  onCaptionChangeMultiple?: (id: string, caption: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const processFile = (file: File, callback: (p: PhotoEntry) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      callback({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        base64,
        caption: '',
        mimeType: file.type,
        previewUrl: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (multiple && onAddMultiple) {
        processFile(file, onAddMultiple);
      } else if (onAdd) {
        processFile(file, onAdd);
      }
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  if (!multiple) {
    return (
      <div>
        {photo ? (
          <div className="rounded-lg border border-gray-700 overflow-hidden">
            <img src={photo.previewUrl} alt="preview" className="w-full max-h-48 object-contain bg-gray-800" />
            <div className="p-3 flex items-center gap-2">
              <input
                value={photo.caption}
                onChange={e => onCaptionChange?.(e.target.value)}
                placeholder="Caption (optional)"
                className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button onClick={onRemove} className="text-gray-500 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${dragging ? 'border-red-500 bg-red-950/20' : 'border-gray-700 hover:border-gray-500'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon size={24} className="mx-auto mb-2 text-gray-600" />
            <p className="text-xs text-gray-500">{label} — drag & drop or click to upload</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>
        )}
      </div>
    );
  }

  // Multiple photos
  return (
    <div className="space-y-3">
      {(photos || []).map(p => (
        <div key={p.id} className="rounded-lg border border-gray-700 overflow-hidden">
          <img src={p.previewUrl} alt="photo" className="w-full max-h-48 object-contain bg-gray-800" />
          <div className="p-3 flex items-center gap-2">
            <input
              value={p.caption}
              onChange={e => onCaptionChangeMultiple?.(p.id, e.target.value)}
              placeholder="Caption (optional)"
              className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <button onClick={() => onRemoveMultiple?.(p.id)} className="text-gray-500 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${dragging ? 'border-red-500 bg-red-950/20' : 'border-gray-700 hover:border-gray-500'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <Plus size={18} className="mx-auto mb-1 text-gray-600" />
        <p className="text-xs text-gray-500">Add photo — drag & drop or click</p>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>
    </div>
  );
}

// ─── History list ─────────────────────────────────────────────────────────────
function ReportHistoryItem({ url, jobUuid, jobNumber }: { url: string; jobUuid: string; jobNumber: string }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Extract timestamp from URL
  const ts = url.split('/').pop()?.replace('-assessment-report.pdf', '').replace('T', ' ').replace(/-/g, (m, i) => i > 10 ? ':' : m) || '';

  const reUpload = async () => {
    setUploading(true); setErr(null);
    try {
      const pdfRes = await fetch(url);
      const buf = await pdfRes.arrayBuffer();
      const uint8 = new Uint8Array(buf);
      const b64 = btoa(Array.from(uint8).map(b => String.fromCharCode(b)).join(''));
      const res = await fetch('/api/report-assist/upload-to-prime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobUuid, pdfBase64: b64, jobNumber }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      setUploaded(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-2 px-4 border-b border-gray-800 last:border-0">
      <div className="flex-1">
        <p className="text-xs text-gray-400 font-mono">{ts}</p>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
        <FileDown size={13} /> Download
      </a>
      <button onClick={reUpload} disabled={uploading || uploaded}
        className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
        {uploading ? <Loader2 size={12} className="animate-spin" /> : uploaded ? <CheckCircle size={12} className="text-green-400" /> : <Send size={12} />}
        {uploaded ? 'Uploaded' : 'Re-upload'}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}

// ─── Main wizard page ─────────────────────────────────────────────────────────
export default function ReportWizardPage() {
  const params = useParams();
  const jobId = params.jobId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData>(EMPTY_REPORT);
  const [sectionStatuses, setSectionStatuses] = useState<Record<string, SectionStatus>>({});
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfResult, setPdfResult] = useState<{ blobUrl: string; pdfBase64: string } | null>(null);
  const [uploadResult, setUploadResult] = useState<{ attachmentId: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [primeUrl, setPrimeUrl] = useState('');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load job from Prime ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    (async () => {
      try {
        // Try loading saved draft first
        const draftRes = await fetch(`/api/report-assist/load-report?jobNumber=${jobId}`);
        const draftData = await draftRes.json();

        if (draftData.reportData) {
          setReport(draftData.reportData);
          setLoading(false);
          loadHistory(jobId);
          return;
        }

        // Otherwise load from Prime via report-assist/job endpoint
        const res = await fetch(`/api/report-assist/job?jobNumber=${encodeURIComponent(jobId)}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `Job not found: ${res.status}`);
        }
        const jobData = await res.json();

        setReport(prev => ({
          ...prev,
          jobNumber: jobData.jobNumber || jobId,
          jobUuid: jobData.jobUuid || '',
          claimNumber: jobData.claimNumber || '',
          insurer: jobData.insurer || '',
          insuredName: jobData.insuredName || '',
          propertyAddress: jobData.propertyAddress || '',
          eventType: jobData.eventType || '',
          incidentDate: jobData.incidentDate || '',
          propertyNotes: jobData.propertyNotes || '',
          inspectedBy: jobData.inspectedBy || '',
        }));
        setPrimeUrl(jobData.primeUrl || '');
        setLoading(false);
        loadHistory(jobId);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
  }, [jobId]);

  const loadHistory = async (jobNumber: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/report-assist/history?jobNumber=${jobNumber}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.urls || []);
      }
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  };

  // ── Field change + debounced save ────────────────────────────────────────────
  const handleFieldChange = useCallback((key: string, val: string) => {
    setReport(prev => ({ ...prev, [key]: val }));
    // Debounced auto-save (skip for photo fields — too large for frequent saves)
    if (!key.includes('Photo') && key !== 'photos') {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaving(true);
        fetch('/api/report-assist/save-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobNumber: jobId, reportData: report }),
        }).finally(() => setSaving(false));
      }, 2000);
    }
  }, [jobId, report]);

  const handleSectionStatus = useCallback((key: string, status: SectionStatus) => {
    setSectionStatuses(prev => ({ ...prev, [key]: status }));
  }, []);

  // Photo helpers
  const setFrontPhoto = (p: PhotoEntry) => setReport(prev => ({ ...prev, frontElevationPhoto: p }));
  const clearFrontPhoto = () => setReport(prev => ({ ...prev, frontElevationPhoto: null }));
  const setFrontCaption = (caption: string) =>
    setReport(prev => prev.frontElevationPhoto ? { ...prev, frontElevationPhoto: { ...prev.frontElevationPhoto, caption } } : prev);
  const addPhoto = (p: PhotoEntry) => setReport(prev => ({ ...prev, photos: [...prev.photos, p] }));
  const removePhoto = (id: string) => setReport(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
  const updatePhotoCaption = (id: string, caption: string) =>
    setReport(prev => ({ ...prev, photos: prev.photos.map(p => p.id === id ? { ...p, caption } : p) }));

  // ── Generate PDF ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setPdfResult(null);
    setUploadResult(null);
    try {
      // Serialize photos with only necessary fields
      const payload = {
        ...report,
        frontElevationPhoto: report.frontElevationPhoto
          ? { base64: report.frontElevationPhoto.base64, caption: report.frontElevationPhoto.caption, mimeType: report.frontElevationPhoto.mimeType }
          : null,
        photos: report.photos.map(p => ({ base64: p.base64, caption: p.caption, mimeType: p.mimeType })),
      };
      const res = await fetch('/api/report-assist/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'PDF generation failed');
      setPdfResult(data);
      // Refresh history
      loadHistory(jobId);
    } catch (e) {
      alert(`PDF generation failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── Upload to Prime ───────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!pdfResult) return;
    setUploading(true);
    try {
      const res = await fetch('/api/report-assist/upload-to-prime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobUuid: report.jobUuid,
          pdfBase64: pdfResult.pdfBase64,
          jobNumber: report.jobNumber,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      setUploadResult(data);
    } catch (e) {
      alert(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const sectionProps = (key: string, textField?: string) => ({
    sectionKey: key,
    status: sectionStatuses[key] || 'draft' as SectionStatus,
    onStatusChange: handleSectionStatus,
    reportData: report,
    onFieldChange: handleFieldChange,
    textField,
  });

  if (loading) return <LoadingSpinner message="Loading job data from Prime…" />;
  if (error) return (
    <div>
      <div className="mb-4">
        <Link href="/report-assist" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Report Assist
        </Link>
      </div>
      <ErrorMessage message={error} />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back + header */}
      <div className="mb-4">
        <Link href="/report-assist" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors w-fit">
          <ArrowLeft size={16} /> Back to Report Assist
        </Link>
      </div>

      <PageHeader
        title={`Report Wizard — ${jobId}`}
        subtitle="Fill in each section, use AI to enhance narratives, then generate and upload the PDF to Prime."
        actions={
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-gray-500 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />Saving…</span>}
            {primeUrl && (
              <a href={primeUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg transition-colors">
                <ExternalLink size={13} /> View in Prime
              </a>
            )}
          </div>
        }
      />

      <div className="space-y-4">

        {/* ── 1. Claim Details (read-only) ─────────────────────────────────── */}
        <Section title="1. Claim Details" {...sectionProps('claimDetails')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {[
              ['Job Number', report.jobNumber],
              ['Claim Number', report.claimNumber],
              ['Insurer', report.insurer],
              ['Insured Name', report.insuredName],
              ['Property Address', report.propertyAddress],
              ['Event Type', report.eventType],
              ['Date of Loss', report.incidentDate],
              ['Inspected By', report.inspectedBy],
            ].map(([l, v]) => (
              <div key={l} className="py-2 border-b border-gray-800">
                <p className="text-xs text-gray-500 font-medium">{l}</p>
                <p className="text-sm text-white mt-0.5">{v || '—'}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1.5">Report Ref #</label>
              <InputField fieldKey="reportRef" value={report.reportRef} onChange={handleFieldChange} placeholder="1" className="w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1.5">Inspection Date</label>
              <InputField fieldKey="inspectionDate" value={report.inspectionDate} onChange={handleFieldChange} type="date" className="w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1.5">Inspection Time</label>
              <InputField fieldKey="inspectionTime" value={report.inspectionTime} onChange={handleFieldChange} type="time" className="w-full" />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs text-gray-500 font-medium block mb-1.5">Met on Site</label>
            <InputField fieldKey="metOnSite" value={report.metOnSite} onChange={handleFieldChange} placeholder="e.g. Insured, Loss Adjuster" className="w-full" />
          </div>
        </Section>

        {/* ── 1b. Front elevation photo ────────────────────────────────────── */}
        <Section title="Front Elevation Photo" {...sectionProps('frontPhoto')}>
          <PhotoUploader
            label="Front elevation photo"
            photo={report.frontElevationPhoto}
            onAdd={setFrontPhoto}
            onRemove={clearFrontPhoto}
            onCaptionChange={setFrontCaption}
          />
        </Section>

        {/* ── 2. Property Details ──────────────────────────────────────────── */}
        <Section title="2. Property Details" {...sectionProps('propertyDetails')}>
          <div className="space-y-0.5 divide-y divide-gray-800/50">
            <FormRow label="Building Type">
              <InputField fieldKey="buildingType" value={report.buildingType} onChange={handleFieldChange} placeholder="e.g. Single storey brick veneer" className="w-full" />
            </FormRow>
            <FormRow label="Description">
              <InputField fieldKey="buildingDescription" value={report.buildingDescription} onChange={handleFieldChange} placeholder="Brief description" className="w-full" />
            </FormRow>
            <FormRow label="Wall Cladding">
              <InputField fieldKey="wallCladding" value={report.wallCladding} onChange={handleFieldChange} placeholder="e.g. Brick veneer" className="w-full" />
            </FormRow>
            <FormRow label="Roof Cladding">
              <InputField fieldKey="roofCladding" value={report.roofCladding} onChange={handleFieldChange} placeholder="e.g. Concrete tiles" className="w-full" />
            </FormRow>
            <FormRow label="Internal Linings">
              <InputField fieldKey="internalLinings" value={report.internalLinings} onChange={handleFieldChange} placeholder="e.g. Plasterboard" className="w-full" />
            </FormRow>
            <FormRow label="Foundation">
              <InputField fieldKey="foundation" value={report.foundation} onChange={handleFieldChange} placeholder="e.g. Concrete slab" className="w-full" />
            </FormRow>
            <FormRow label="Outbuildings">
              <InputField fieldKey="outbuildings" value={report.outbuildings} onChange={handleFieldChange} placeholder="e.g. Nil / Garage / Shed" className="w-full" />
            </FormRow>
            <FormRow label="Construction Age">
              <InputField fieldKey="constructionAge" value={report.constructionAge} onChange={handleFieldChange} placeholder="e.g. Approx. 1985" className="w-full" />
            </FormRow>
          </div>
        </Section>

        {/* ── 3. Inspection Details ────────────────────────────────────────── */}
        <Section title="3. Inspection Details" {...sectionProps('inspectionDetails')}>
          <div className="space-y-0.5 divide-y divide-gray-800/50">
            <FormRow label="Event Type">
              <InputField fieldKey="eventType" value={report.eventType} onChange={handleFieldChange} placeholder="e.g. Storm" className="w-full" />
            </FormRow>
            <FormRow label="Date of Loss">
              <InputField fieldKey="incidentDate" value={report.incidentDate} onChange={handleFieldChange} type="date" className="w-full" />
            </FormRow>
            <FormRow label="Property Category">
              <SelectField fieldKey="propertyCategory" value={report.propertyCategory} onChange={handleFieldChange}>{CAT_OPTS}</SelectField>
            </FormRow>
            <FormRow label="Alt. Accommodation">
              <SelectField fieldKey="altAccommodation" value={report.altAccommodation} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
            <FormRow label="Hazmat Present">
              <SelectField fieldKey="hazmat" value={report.hazmat} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
            <FormRow label="Make Safe Required">
              <SelectField fieldKey="makeSafeRequired" value={report.makeSafeRequired} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
            <FormRow label="Make Safe Completed">
              <SelectField fieldKey="makeSafeCompleted" value={report.makeSafeCompleted} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
            <FormRow label="Hail Damage">
              <SelectField fieldKey="hailDamage" value={report.hailDamage} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
          </div>
        </Section>

        {/* ── 4. Circumstances of Loss ─────────────────────────────────────── */}
        <Section title="4. Circumstances of Loss" {...sectionProps('circumstances', 'circumstancesOfLoss')}>
          <TextArea
            fieldKey="circumstancesOfLoss"
            value={report.circumstancesOfLoss}
            onChange={handleFieldChange}
            placeholder="Describe the insured's version of events and your inspection observations. Include the date the event was confirmed and any relevant details noted during inspection."
            rows={6}
          />
        </Section>

        {/* ── 5. Damage Assessment ─────────────────────────────────────────── */}
        <Section title="5. Damage Assessment" {...sectionProps('damage', 'damageAssessment')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <FormRow label="Damage Consistent">
              <SelectField fieldKey="damageConsistent" value={report.damageConsistent} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
            <FormRow label="Contents Damaged">
              <SelectField fieldKey="contentsDamaged" value={report.contentsDamaged} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
          </div>
          <TextArea
            fieldKey="damageAssessment"
            value={report.damageAssessment}
            onChange={handleFieldChange}
            placeholder="List all damage observed that is consistent (and any that is not consistent) with the claimed event. Include specific rooms, components, and extent of damage."
            rows={6}
          />
        </Section>

        {/* ── 6. Cause of Damage ───────────────────────────────────────────── */}
        <Section title="6. Cause of Damage" {...sectionProps('cause', 'causeOfDamage')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mb-4 divide-y divide-gray-800/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3">
              <FormRow label="Cause Stopped">
                <SelectField fieldKey="causeStoppedY" value={report.causeStoppedY} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
              </FormRow>
              <FormRow label="Specialist Required">
                <SelectField fieldKey="specialistRequired" value={report.specialistRequired} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
              </FormRow>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
              <FormRow label="Specialist Type">
                <InputField fieldKey="specialistType" value={report.specialistType} onChange={handleFieldChange} placeholder="e.g. Plumber" className="w-full" />
              </FormRow>
              <FormRow label="Sudden / Gradual">
                <SelectField fieldKey="suddenGradual" value={report.suddenGradual} onChange={handleFieldChange}>
                  <option value="">— select —</option>
                  <option value="Sudden">Sudden</option>
                  <option value="Gradual">Gradual</option>
                  <option value="N/A">N/A</option>
                </SelectField>
              </FormRow>
            </div>
          </div>
          <TextArea
            fieldKey="causeOfDamage"
            value={report.causeOfDamage}
            onChange={handleFieldChange}
            placeholder="Describe the causation findings. Explain what caused the damage, whether it was sudden or gradual, any storm opening, defects or pre-existing conditions, and weather conditions at time of event."
            rows={6}
          />
        </Section>

        {/* ── 7. Maintenance / Repairs by Owner ───────────────────────────── */}
        <Section title="7. Maintenance / Repairs by Owner" {...sectionProps('maintenance', 'maintenanceRepairs')}>
          <TextArea
            fieldKey="maintenanceRepairs"
            value={report.maintenanceRepairs}
            onChange={handleFieldChange}
            placeholder="Detail any maintenance issues or repairs carried out by the owner that are relevant to the claim. Note whether maintenance contributed to or caused the damage."
            rows={4}
          />
        </Section>

        {/* ── 8. Conclusion ────────────────────────────────────────────────── */}
        <Section title="8. Conclusion" {...sectionProps('conclusion', 'conclusion')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mb-4">
            <FormRow label="Can Warrant">
              <SelectField fieldKey="canWarrant" value={report.canWarrant} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
            <FormRow label="Allocation Type">
              <SelectField fieldKey="allocationType" value={report.allocationType} onChange={handleFieldChange}>{ALLOC_OPTS}</SelectField>
            </FormRow>
            <FormRow label="Insured Aware">
              <SelectField fieldKey="insuredAware" value={report.insuredAware} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
            <FormRow label="All External Inspected">
              <SelectField fieldKey="allExternalInspected" value={report.allExternalInspected} onChange={handleFieldChange}>{YESNO_OPTS}</SelectField>
            </FormRow>
            <FormRow label="Repair Lead Time">
              <InputField fieldKey="repairLeadTime" value={report.repairLeadTime} onChange={handleFieldChange} placeholder="e.g. 2 weeks" className="w-full" />
            </FormRow>
            <FormRow label="Repair Timeframe">
              <InputField fieldKey="repairTimeframe" value={report.repairTimeframe} onChange={handleFieldChange} placeholder="e.g. 4–6 weeks" className="w-full" />
            </FormRow>
          </div>
          <TextArea
            fieldKey="conclusion"
            value={report.conclusion}
            onChange={handleFieldChange}
            placeholder="Summarise your recommendation and findings. Include any additional information, whether the insured has been made aware of the outcome, and the recommended scope of works."
            rows={6}
          />
        </Section>

        {/* ── Photograph Schedule ──────────────────────────────────────────── */}
        <Section title="Photograph Schedule" {...sectionProps('photos')}>
          <p className="text-xs text-gray-500 mb-3">Photos are embedded in the PDF Photograph Schedule. Add captions to describe each photo.</p>
          <PhotoUploader
            multiple
            label="Add photographs"
            photos={report.photos}
            onAddMultiple={addPhoto}
            onRemoveMultiple={removePhoto}
            onCaptionChangeMultiple={updatePhotoCaption}
          />
        </Section>

        {/* ── Generate & Upload ────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-base font-semibold text-white mb-4">Finalise Report</h3>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {generating ? <><Loader2 size={16} className="animate-spin" />Generating PDF…</> : <><FileDown size={16} />Generate Final PDF</>}
            </button>

            {pdfResult && (
              <>
                <a
                  href={pdfResult.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  <FileDown size={16} /> Download PDF
                </a>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !!uploadResult}
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : uploadResult ? <CheckCircle size={16} className="text-green-300" /> : <Send size={16} />}
                  {uploading ? 'Uploading to Prime…' : uploadResult ? 'Uploaded to Prime ✓' : 'Upload to Prime'}
                </button>
              </>
            )}
          </div>

          {pdfResult && (
            <div className="mt-4 p-3 rounded-lg bg-green-950/30 border border-green-700/40">
              <p className="text-sm text-green-300 font-medium flex items-center gap-2">
                <CheckCircle size={15} /> PDF generated successfully
              </p>
              <p className="text-xs text-green-400/70 mt-1 break-all">{pdfResult.blobUrl}</p>
            </div>
          )}
          {uploadResult && (
            <div className="mt-3 p-3 rounded-lg bg-blue-950/30 border border-blue-700/40">
              <p className="text-sm text-blue-300 font-medium flex items-center gap-2">
                <CheckCircle size={15} /> Uploaded to Prime (Attachment ID: {uploadResult.attachmentId})
              </p>
              {primeUrl && (
                <a href={primeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
                  <ExternalLink size={11} /> View job in Prime
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Report History ───────────────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Report History</h3>
          </div>
          {loadingHistory ? (
            <div className="py-6 text-center text-gray-500 text-sm">Loading history…</div>
          ) : history.length === 0 ? (
            <div className="py-6 text-center text-gray-600 text-sm">No saved reports yet</div>
          ) : (
            <div>
              {history.map(url => (
                <ReportHistoryItem
                  key={url}
                  url={url}
                  jobUuid={report.jobUuid}
                  jobNumber={report.jobNumber}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
