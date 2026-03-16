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
} from 'lucide-react';

interface Section {
  title: string;
  original: string;
  polished: string;
  accepted?: boolean; // undefined = pending, true = accepted, false = rejected
}

interface PolishResult {
  sections: Section[];
  summary: string;
  pageCount: number;
  wordCount: number;
}

type Step = 'upload' | 'polishing' | 'review' | 'generate';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
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
      // Build the combined polished text
      const polishedText = result.sections
        .map(s => {
          const usePolished = s.accepted !== false; // use polished unless explicitly rejected
          const text = usePolished ? s.polished : s.original;
          return s.title !== 'General' ? `${s.title}\n\n${text}` : text;
        })
        .join('\n\n---\n\n');

      // Generate a simple formatted PDF using pdf-lib via our own endpoint
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

      // Convert base64 to blob URL for download
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
          {/* Drop zone */}
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
            <button
              onClick={() => setShowConfirm(true)}
              disabled={polishing}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-4 rounded-xl transition-colors text-base"
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

          {/* Accept/reject status */}
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
                {/* Section header */}
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

                {/* Expanded comparison */}
                {expandedSections.has(idx) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-gray-800">
                    {/* Original */}
                    <div className="p-5 bg-gray-950/50 border-b md:border-b-0 md:border-r border-gray-800">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Original</p>
                      <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">{section.original}</p>
                    </div>
                    {/* Polished */}
                    <div className={`p-5 ${section.accepted === false ? 'opacity-50' : 'bg-green-950/10'}`}>
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-3">Polished</p>
                      <p className="text-green-100/90 text-sm leading-relaxed whitespace-pre-wrap">{section.polished}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Generate PDF button */}
          <div className="flex items-center gap-3 pt-2">
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
