'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Upload,
  Sparkles,
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  RotateCcw,
  Info,
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  XCircle,
  ShieldCheck,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Section {
  title: string;
  original: string;
  polished: string;
  accepted?: boolean;
}

interface PolishResult {
  sections: Section[];
  summary: string;
  pageCount: number;
  wordCount: number;
}

interface ScoreCriterion {
  name: string;
  passed: boolean;
  comment: string;
}

interface ScoreResult {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  criteria: ScoreCriterion[];
  fixes: string[];
  summary: string;
}

interface ScopeLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitRate: number;
  total: number;
  category: string;
  notes: string;
}

interface ScopeResult {
  jobNumber: string;
  jobUuid: string;
  lineItems: ScopeLineItem[];
  scopeTotal: number;
  source: 'work-orders' | 'scopes' | 'estimates' | 'none';
}

interface ValidationIssue {
  type: 'missing_in_scope' | 'missing_in_report' | 'pc_sum_flag' | 'rate_concern' | 'description_poor';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  lineItem?: string | null;
}

interface ValidationResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  issues: ValidationIssue[];
  suggestions: string[];
}

type Step = 'upload' | 'polishing' | 'review' | 'generate';

// ─── AI credit disclaimer ─────────────────────────────────────────────────────
const AIDisclaimer = () => (
  <p className="text-xs text-gray-500 mt-1">⚡ This feature uses AI API credits.</p>
);

// ─── Issue type label map ─────────────────────────────────────────────────────
const ISSUE_TYPE_LABELS: Record<string, string> = {
  missing_in_scope: 'Missing in Scope',
  missing_in_report: 'Missing in Report',
  pc_sum_flag: 'PC Sum Flag',
  rate_concern: 'Rate Concern',
  description_poor: 'Poor Description',
};

// ─── Score Panel Component ────────────────────────────────────────────────────
function ScorePanel({ result }: { result: ScoreResult }) {
  const gradeColors: Record<string, string> = {
    A: 'bg-green-600 text-white border-green-500',
    B: 'bg-blue-600 text-white border-blue-500',
    C: 'bg-amber-500 text-white border-amber-400',
    D: 'bg-red-600 text-white border-red-500',
    F: 'bg-red-800 text-white border-red-700',
  };
  const gradeColor = gradeColors[result.grade] || gradeColors.F;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mt-4">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
        <ClipboardCheck size={18} className="text-blue-400" />
        <h3 className="text-white font-semibold text-base">Report Quality Score</h3>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex items-center gap-5">
          <div className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center flex-shrink-0 ${gradeColor}`}>
            <span className="text-4xl font-black leading-none">{result.grade}</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">{result.score}<span className="text-lg text-gray-400 font-normal">/100</span></p>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">{result.summary}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Criteria Checklist</p>
          {result.criteria.map((c, i) => (
            <div key={i} className="flex items-start gap-3 py-1.5 border-b border-gray-800 last:border-0">
              <div className="flex-shrink-0 mt-0.5">
                {c.passed
                  ? <CheckCircle size={15} className="text-green-500" />
                  : <XCircle size={15} className="text-red-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-semibold ${c.passed ? 'text-green-300' : 'text-red-300'}`}>{c.name}</span>
                {c.comment && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{c.comment}</p>}
              </div>
            </div>
          ))}
        </div>

        {result.fixes.length > 0 && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/20 overflow-hidden">
            <div className="px-4 py-2 border-b border-red-800/40 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <span className="text-xs font-semibold text-red-300">Fix This</span>
            </div>
            <ul className="px-4 py-3 space-y-1.5">
              {result.fixes.map((fix, i) => (
                <li key={i} className="text-xs text-red-300/90 flex items-start gap-2">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">→</span>
                  {fix}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Validation Panel Component ───────────────────────────────────────────────
function ValidationPanel({ result }: { result: ValidationResult }) {
  const gradeColors: Record<string, string> = {
    A: 'bg-green-600 text-white border-green-500',
    B: 'bg-blue-600 text-white border-blue-500',
    C: 'bg-amber-500 text-white border-amber-400',
    D: 'bg-red-600 text-white border-red-500',
    F: 'bg-red-800 text-white border-red-700',
  };
  const gradeColor = gradeColors[result.grade] || gradeColors.F;

  const severityConfig = {
    critical: { bar: 'bg-red-500', text: 'text-red-300', bg: 'bg-red-950/30 border-red-800/40', icon: <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" /> },
    warning:  { bar: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-950/30 border-amber-700/40', icon: <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" /> },
    info:     { bar: 'bg-blue-500', text: 'text-blue-300', bg: 'bg-blue-950/30 border-blue-700/40', icon: <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" /> },
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mt-4">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
        <ShieldCheck size={18} className="text-emerald-400" />
        <h3 className="text-white font-semibold text-base">Scope Validation Result</h3>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex items-center gap-5">
          <div className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center flex-shrink-0 ${gradeColor}`}>
            <span className="text-4xl font-black leading-none">{result.grade}</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">{result.score}<span className="text-lg text-gray-400 font-normal">/100</span></p>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">{result.summary}</p>
          </div>
        </div>

        {result.issues.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Issues Found</p>
            {result.issues.map((issue, i) => {
              const cfg = severityConfig[issue.severity] ?? severityConfig.info;
              return (
                <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 ${cfg.bg}`}>
                  <div className={`w-1 rounded-full self-stretch flex-shrink-0 ${cfg.bar}`} />
                  {cfg.icon}
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold ${cfg.text}`}>
                      {ISSUE_TYPE_LABELS[issue.type] ?? issue.type}
                    </span>
                    {issue.lineItem && (
                      <span className="text-xs text-gray-500 ml-1.5">— {issue.lineItem}</span>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{issue.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {result.issues.length === 0 && (
          <div className="flex items-center gap-2 text-green-300 text-sm bg-green-950/30 border border-green-700/40 rounded-lg px-4 py-3">
            <CheckCircle size={15} />
            No issues found — report and scope are well aligned.
          </div>
        )}

        {result.suggestions.length > 0 && (
          <div className="rounded-lg border border-blue-800/40 bg-blue-950/20 overflow-hidden">
            <div className="px-4 py-2 border-b border-blue-800/30 flex items-center gap-2">
              <Info size={13} className="text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">Suggestions</span>
            </div>
            <ul className="px-4 py-3 space-y-1.5">
              {result.suggestions.map((s, i) => (
                <li key={i} className="text-xs text-blue-300/90 flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scope Validator section (polisher) ───────────────────────────────────────
function ScopeValidatorSection({ reportText }: { reportText: string }) {
  const [jobNumber, setJobNumber] = useState('');
  const [fetchingScope, setFetchingScope] = useState(false);
  const [scopeResult, setScopeResult] = useState<ScopeResult | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [scopeExpanded, setScopeExpanded] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchScope = async () => {
    if (!jobNumber.trim()) return;
    setFetchingScope(true);
    setScopeError(null);
    setScopeResult(null);
    setValidationResult(null);
    setValidationError(null);
    try {
      const res = await fetch(`/api/report-assist/scope?jobNumber=${encodeURIComponent(jobNumber.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch scope');
      setScopeResult(data as ScopeResult);
    } catch (e) {
      setScopeError(e instanceof Error ? e.message : 'Failed to fetch scope');
    } finally {
      setFetchingScope(false);
    }
  };

  const handleValidate = async () => {
    if (!scopeResult || !reportText.trim()) return;
    setValidating(true);
    setValidationError(null);
    setValidationResult(null);
    try {
      const lineItems = scopeResult.lineItems.map(li => ({
        description: li.description,
        total: li.total,
        category: li.category,
      }));
      const res = await fetch('/api/report-assist/validate-scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportSections: { reportText },
          lineItems,
          jobContext: {
            jobNumber: jobNumber.trim(),
            insurer: '',
            eventType: '',
            authorisedTotal: 0,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation failed');
      setValidationResult(data as ValidationResult);
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden mt-4">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3">
        <ShieldCheck size={18} className="text-emerald-400" />
        <div>
          <h3 className="text-white font-semibold text-base">Validate Against Scope</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Enter the job number to fetch scope line items from Prime and validate this report against them.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Job number input */}
        <div className="flex items-start gap-3">
          <input
            type="text"
            value={jobNumber}
            onChange={e => setJobNumber(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchScope()}
            placeholder="e.g. YOU0009300"
            className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-gray-600"
          />
          <div className="flex flex-col items-end flex-shrink-0">
            <button
              onClick={fetchScope}
              disabled={fetchingScope || !jobNumber.trim()}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              {fetchingScope
                ? <><Loader2 size={14} className="animate-spin" />Fetching…</>
                : <>Fetch Scope</>
              }
            </button>
          </div>
        </div>

        {scopeError && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
            <AlertCircle size={13} /> {scopeError}
          </div>
        )}

        {/* Line items collapsible */}
        {scopeResult && (
          <div className="rounded-lg border border-gray-700 overflow-hidden">
            <button
              onClick={() => setScopeExpanded(e => !e)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/60 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {scopeResult.lineItems.length === 0
                    ? 'No line items found'
                    : `${scopeResult.lineItems.length} line item${scopeResult.lineItems.length !== 1 ? 's' : ''}`}
                </span>
                {scopeResult.source !== 'none' && (
                  <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">
                    via {scopeResult.source}
                  </span>
                )}
                {scopeResult.scopeTotal > 0 && (
                  <span className="text-xs font-semibold text-emerald-400">
                    ${scopeResult.scopeTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              {scopeResult.lineItems.length > 0 && (
                scopeExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />
              )}
            </button>

            {scopeResult.lineItems.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <p className="text-sm text-gray-400">No scope items found in Prime yet for this job.</p>
                <p className="text-xs text-gray-600 mt-1">Add line items to Prime first, then validate.</p>
              </div>
            ) : scopeExpanded ? (
              <div className="divide-y divide-gray-800">
                {scopeResult.lineItems.map((li, i) => (
                  <div key={li.id || i} className="px-4 py-2.5 flex items-start gap-3">
                    <span className="text-xs text-gray-600 w-5 flex-shrink-0 pt-0.5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white leading-relaxed">{li.description || <em className="text-gray-600">No description</em>}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {li.category && <span className="text-xs text-gray-500">{li.category}</span>}
                        {li.quantity > 0 && li.unit && (
                          <span className="text-xs text-gray-500">{li.quantity} {li.unit}</span>
                        )}
                        {li.notes && <span className="text-xs text-gray-600 italic">{li.notes}</span>}
                      </div>
                    </div>
                    {li.total > 0 && (
                      <span className="text-xs font-medium text-gray-300 flex-shrink-0">
                        ${li.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Validate button */}
        {scopeResult && scopeResult.lineItems.length > 0 && (
          <div>
            <button
              onClick={handleValidate}
              disabled={validating || !reportText.trim()}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              {validating
                ? <><Loader2 size={15} className="animate-spin" />Validating with AI…</>
                : <><ShieldCheck size={15} />Validate Against Scope</>
              }
            </button>
            <AIDisclaimer />
          </div>
        )}

        {validationError && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
            <AlertCircle size={13} /> {validationError}
          </div>
        )}

        {validationResult && <ValidationPanel result={validationResult} />}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ReportPolisherPage() {
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [result, setResult] = useState<PolishResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived report text for scope validation (polished or original)
  const polishedReportText = result
    ? result.sections
        .map(s => `## ${s.title}\n${s.accepted !== false ? s.polished : s.original}`)
        .join('\n\n')
    : '';

  const MAX_SIZE = 10 * 1024 * 1024;

  const validateAndSetFile = (f: File) => {
    setFileError(null);
    if (!f.name.endsWith('.pdf') && f.type !== 'application/pdf') {
      setFileError('Only PDF files are accepted.');
      return;
    }
    if (f.size > MAX_SIZE) {
      setFileError('File exceeds the 10MB limit.');
      return;
    }
    setFile(f);
    setResult(null);
    setPdfUrl(null);
    setStep('upload');
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const handlePolish = async () => {
    if (!file) return;
    setPolishing(true);
    setPolishError(null);
    setStep('polishing');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/report-assist/polish', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to polish report');

      const sectionsWithState: Section[] = data.sections.map((s: Section) => ({ ...s, accepted: undefined }));
      setResult({ ...data, sections: sectionsWithState });
      setExpandedSections(new Set([0]));
      setStep('review');
    } catch (err) {
      setPolishError(err instanceof Error ? err.message : 'An error occurred');
      setStep('upload');
    } finally {
      setPolishing(false);
    }
  };

  const handleScore = async (sectionsToScore?: Section[]) => {
    const source = sectionsToScore || result?.sections;
    if (!source && !file) return;

    setScoring(true);
    setScoreError(null);
    setScoreResult(null);

    try {
      let reportText = '';

      if (source) {
        reportText = source
          .map(s => `## ${s.title}\n${s.accepted !== false ? s.polished : s.original}`)
          .join('\n\n');
      } else if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const extractRes = await fetch('/api/report-assist/polish', { method: 'POST', body: formData });
        const extractData = await extractRes.json();
        if (!extractRes.ok) throw new Error(extractData.error || 'Failed to extract PDF text');
        reportText = extractData.sections.map((s: Section) => `## ${s.title}\n${s.original}`).join('\n\n');
      }

      const res = await fetch('/api/report-assist/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scoring failed');
      setScoreResult(data as ScoreResult);
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : 'Scoring failed');
    } finally {
      setScoring(false);
    }
  };

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
      return next;
    });
  };

  const setSectionState = (idx: number, accepted: boolean | undefined) => {
    if (!result) return;
    const sections = result.sections.map((s, i) => i === idx ? { ...s, accepted } : s);
    setResult({ ...result, sections });
  };

  const acceptAll = () => {
    if (!result) return;
    setResult({ ...result, sections: result.sections.map(s => ({ ...s, accepted: true })) });
  };

  const handleGeneratePdf = async () => {
    if (!result) return;
    setGenerating(true);

    try {
      const res = await fetch('/api/report-assist/polish/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: result.sections.map(s => ({
            title: s.title,
            text: s.accepted !== false ? s.polished : s.original,
          })),
          summary: result.summary,
          fileName: file?.name || 'report.pdf',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate PDF');

      const bytes = Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setStep('generate');
    } catch (err) {
      console.error('PDF generation error:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = () => {
    if (!pdfUrl || !file) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = file.name.replace('.pdf', '-polished.pdf');
    a.click();
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setPdfUrl(null);
    setPolishError(null);
    setFileError(null);
    setScoreResult(null);
    setScoreError(null);
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const acceptedCount = result?.sections.filter(s => s.accepted === true).length ?? 0;
  const rejectedCount = result?.sections.filter(s => s.accepted === false).length ?? 0;
  const pendingCount = result?.sections.filter(s => s.accepted === undefined).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Report Polisher"
        subtitle="Upload an existing report PDF to have it professionally polished by AI"
        actions={
          <Link
            href="/report-assist"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Report Assist
          </Link>
        }
      />

      {/* ── API Cost Notice ── */}
      <div className="mb-6 flex items-start gap-3 bg-amber-950/30 border border-amber-700/40 rounded-xl px-5 py-4">
        <Info size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-amber-300 font-semibold text-sm">AI API Usage Notice</p>
          <p className="text-amber-400/80 text-xs leading-relaxed">
            <strong>1.</strong> Each report polish uses OpenAI API credits — costs apply per use. Please only polish reports that are complete and ready for final review.
          </p>
          <p className="text-amber-400/80 text-xs leading-relaxed">
            <strong>2.</strong> A confirmation prompt will appear before processing begins. Please use this tool for final-stage reports only, not drafts or rough notes.
          </p>
        </div>
      </div>

      {/* ── Confirmation dialog ── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-amber-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={22} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-semibold text-base">Confirm AI Polish</h3>
                <p className="text-gray-400 text-sm mt-1">This will use OpenAI API credits to polish <span className="text-white font-medium">{file?.name}</span>.</p>
              </div>
            </div>
            <p className="text-gray-500 text-xs mb-5 leading-relaxed">
              Please confirm this report is complete and ready for final polishing — not a rough draft. Each polish costs API credits.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); handlePolish(); }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                ✨ Yes, Polish It
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { num: 1, label: 'Upload PDF', active: step === 'upload' || step === 'polishing', done: step === 'review' || step === 'generate' },
          { num: 2, label: 'AI Polish', active: step === 'polishing' || step === 'review', done: step === 'generate' },
          { num: 3, label: 'Download', active: step === 'generate', done: false },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-3">
            {i > 0 && <div className={`h-px w-8 ${s.done || s.active ? 'bg-red-500' : 'bg-gray-700'}`} />}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${s.done ? 'bg-green-600 text-white' : s.active ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                {s.done ? '✓' : s.num}
              </div>
              <span className={`text-sm font-medium ${s.active ? 'text-white' : s.done ? 'text-green-400' : 'text-gray-600'}`}>
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      {(step === 'upload' || step === 'polishing') && (
        <div className="space-y-6">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
              ${dragging
                ? 'border-red-500 bg-red-950/20'
                : file
                ? 'border-green-600/50 bg-green-950/10 cursor-default'
                : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'
              }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileInput}
            />
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-600/40 flex items-center justify-center">
                  <FileText size={28} className="text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold">{file.name}</p>
                  <p className="text-gray-400 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors mt-1"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                  <Upload size={28} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">Drop your report PDF here</p>
                  <p className="text-gray-400 text-sm mt-1">or click to browse — PDF only, max 10MB</p>
                </div>
              </div>
            )}
          </div>

          {fileError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              {fileError}
            </div>
          )}

          {polishError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              {polishError}
            </div>
          )}

          {file && (
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              {/* Polish button + disclaimer */}
              <div>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={polishing || scoring}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-base"
                >
                  {polishing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Polishing with AI… this may take up to 30 seconds
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      ✨ Polish Report
                    </>
                  )}
                </button>
                <AIDisclaimer />
              </div>

              {/* Score Only button + disclaimer */}
              <div>
                <button
                  onClick={() => handleScore()}
                  disabled={scoring || polishing}
                  className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-base"
                >
                  {scoring ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Scoring…
                    </>
                  ) : (
                    <>
                      <ClipboardCheck size={18} />
                      Score Only
                    </>
                  )}
                </button>
                <AIDisclaimer />
              </div>
            </div>
          )}

          {scoreResult && step === 'upload' && <ScorePanel result={scoreResult} />}
          {scoreError && step === 'upload' && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              {scoreError}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === 'review' && result && (
        <div className="space-y-6">
          {/* Summary banner */}
          <div className="bg-green-950/30 border border-green-700/40 rounded-xl px-5 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-green-300 font-semibold text-sm">Report polished successfully</p>
                <p className="text-gray-400 text-xs mt-1">{result.summary}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  <span>{result.pageCount} page{result.pageCount !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{result.wordCount.toLocaleString()} words</span>
                  <span>·</span>
                  <span>{result.sections.length} section{result.sections.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <button
                onClick={acceptAll}
                className="flex-shrink-0 text-xs bg-green-700/40 hover:bg-green-600/50 text-green-300 px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                Accept All
              </button>
            </div>
          </div>

          {result.sections.length > 1 && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="text-green-400 font-medium">{acceptedCount} accepted</span>
              <span className="text-red-400 font-medium">{rejectedCount} rejected (will use original)</span>
              <span className="text-gray-500">{pendingCount} pending</span>
            </div>
          )}

          {/* Sections */}
          <div className="space-y-3">
            {result.sections.map((section, idx) => (
              <div
                key={idx}
                className={`bg-gray-900 rounded-xl border overflow-hidden transition-colors
                  ${section.accepted === true
                    ? 'border-green-700/50'
                    : section.accepted === false
                    ? 'border-red-800/50'
                    : 'border-gray-800'
                  }`}
              >
                <div
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-800/40 transition-colors"
                  onClick={() => toggleSection(idx)}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0
                    ${section.accepted === true ? 'bg-green-500' : section.accepted === false ? 'bg-red-500' : 'bg-gray-600'}`}
                  />
                  <span className="text-white font-semibold text-sm flex-1">{section.title}</span>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setSectionState(idx, section.accepted === true ? undefined : true)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors
                        ${section.accepted === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-green-900/40 hover:text-green-400'
                        }`}
                    >
                      ✓ Accept
                    </button>
                    <button
                      onClick={() => setSectionState(idx, section.accepted === false ? undefined : false)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors
                        ${section.accepted === false
                          ? 'bg-red-700 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-red-900/40 hover:text-red-400'
                        }`}
                    >
                      ✗ Keep original
                    </button>
                  </div>
                  {expandedSections.has(idx)
                    ? <ChevronUp size={16} className="text-gray-500 flex-shrink-0" />
                    : <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                  }
                </div>

                {expandedSections.has(idx) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-gray-800">
                    <div className="p-5 bg-gray-950/50 border-b md:border-b-0 md:border-r border-gray-800">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Original</p>
                      <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">{section.original}</p>
                    </div>
                    <div className={`p-5 ${section.accepted === false ? 'opacity-50' : 'bg-green-950/10'}`}>
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-3">Polished</p>
                      <p className="text-green-100/90 text-sm leading-relaxed whitespace-pre-wrap">{section.polished}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quality Score panel */}
          {scoreResult && <ScorePanel result={scoreResult} />}
          {scoreError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              {scoreError}
            </div>
          )}

          {/* Scope Validator */}
          <ScopeValidatorSection reportText={polishedReportText} />

          {/* Action buttons */}
          <div className="flex flex-wrap items-start gap-4 pt-2">
            <div>
              <button
                onClick={handleGeneratePdf}
                disabled={generating}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating PDF…
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    Generate Polished PDF
                  </>
                )}
              </button>
            </div>
            <div>
              <button
                onClick={() => handleScore(result?.sections)}
                disabled={scoring}
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                {scoring ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Scoring…
                  </>
                ) : (
                  <>
                    <ClipboardCheck size={16} />
                    Score Quality
                  </>
                )}
              </button>
              <AIDisclaimer />
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-xl transition-colors"
            >
              <RotateCcw size={16} />
              Start over
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Download ── */}
      {step === 'generate' && pdfUrl && (
        <div className="space-y-6">
          <div className="bg-green-950/30 border border-green-700/40 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-600/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h2 className="text-white font-bold text-xl mb-2">Polished PDF Ready</h2>
            <p className="text-gray-400 text-sm mb-6">
              Your report has been professionally polished and formatted with SHBR branding.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={downloadPdf}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                <Download size={18} />
                Download Polished PDF
              </button>
              <button
                onClick={reset}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-4 py-3 rounded-xl transition-colors"
              >
                <RotateCcw size={16} />
                Polish another report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
