'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingSpinner';
import { AlertTriangle, ExternalLink, CheckSquare, Square } from 'lucide-react';

interface VulnerableJob {
  id: string;
  jobNumber: string;
  address: string;
  assignee: string;
  region: string;
  status: string;
  matchedKeyword: string;
  notes: string;
  primeUrl: string;
}

interface VulnerableResponse {
  total: number;
  jobs: VulnerableJob[];
  generatedAt: string;
}

function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!text || !keyword) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-red-500/30 text-red-200 rounded px-0.5">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

export default function VulnerablePage() {
  const [data, setData] = useState<VulnerableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notified, setNotified] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/prime/jobs/vulnerable')
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => Promise.reject(d.error ?? 'Failed')))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const toggleNotified = (id: string) => {
    setNotified(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <LoadingSpinner message="Scanning for vulnerable customers…" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  const notifiedCount = notified.size;

  return (
    <div>
      <PageHeader
        title="Vulnerable Customers"
        subtitle="Jobs flagged as potentially involving a vulnerable customer — Suncorp notification required"
      />

      {/* Banner */}
      <div className={`mb-6 flex items-start gap-3 rounded-xl px-5 py-4 border ${
        data.total === 0
          ? 'bg-emerald-950/20 border-emerald-700/40'
          : 'bg-red-950/40 border-red-700/50'
      }`}>
        <AlertTriangle size={20} className={data.total === 0 ? 'text-emerald-400 flex-shrink-0 mt-0.5' : 'text-red-400 flex-shrink-0 mt-0.5'} />
        <div className="flex-1">
          {data.total === 0 ? (
            <p className="text-emerald-300 font-semibold text-sm">No vulnerable customer flags detected</p>
          ) : (
            <>
              <p className="text-red-300 font-semibold text-sm">
                ⚠️ {data.total} job{data.total !== 1 ? 's' : ''} may involve a vulnerable customer
              </p>
              <p className="text-red-400/70 text-xs mt-0.5">
                Suncorp requires builders to notify them when a vulnerable customer is identified. Please confirm notification for each job below.
                {notifiedCount > 0 && <span className="text-emerald-400 ml-2 font-medium">{notifiedCount} marked as notified (this session only).</span>}
              </p>
            </>
          )}
        </div>
      </div>

      {data.total === 0 ? (
        <div className="py-20 text-center bg-gray-900 rounded-xl border border-gray-800">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-300 font-medium">No vulnerable customer flags</p>
          <p className="text-gray-500 text-sm mt-1">No keywords detected in current open jobs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.jobs.map(job => {
            const isNotified = notified.has(job.id);
            return (
              <div
                key={job.id}
                className={`bg-gray-900 rounded-xl border overflow-hidden transition-all ${
                  isNotified ? 'border-emerald-700/40 opacity-70' : 'border-red-800/50'
                }`}
              >
                <div className="px-5 py-4 flex items-start gap-4">
                  {/* Notified checkbox */}
                  <button
                    onClick={() => toggleNotified(job.id)}
                    className={`flex-shrink-0 mt-0.5 transition-colors ${isNotified ? 'text-emerald-400' : 'text-gray-600 hover:text-red-400'}`}
                    title={isNotified ? 'Mark as not notified' : 'Mark Suncorp as notified'}
                  >
                    {isNotified ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-sm font-bold text-white">
                          {job.primeUrl ? (
                            <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline underline-offset-2">
                              {job.jobNumber}
                            </a>
                          ) : job.jobNumber}
                        </span>
                        <span className="text-xs bg-red-900/40 border border-red-700/40 text-red-300 px-2 py-0.5 rounded-full font-medium">
                          🔍 &ldquo;{job.matchedKeyword}&rdquo;
                        </span>
                        {isNotified && (
                          <span className="text-xs bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                            ✓ Suncorp notified
                          </span>
                        )}
                      </div>
                      {job.primeUrl && (
                        <a href={job.primeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-red-400 flex-shrink-0">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>

                    {/* Address & meta */}
                    <p className="text-gray-300 text-sm mt-1">{job.address}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      <span>Assignee: <span className="text-gray-400">{job.assignee}</span></span>
                      <span>Region: <span className="text-gray-400">{job.region}</span></span>
                      <span>Status: <span className="text-gray-400">{job.status}</span></span>
                    </div>

                    {/* Notes snippet */}
                    {job.notes && (
                      <div className="mt-3 bg-gray-800/60 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Notes excerpt</p>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {highlightKeyword(job.notes, job.matchedKeyword)}
                          {job.notes.length >= 200 && <span className="text-gray-600"> …</span>}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.generatedAt && (
        <p className="text-xs text-gray-600 mt-4">Data generated: {new Date(data.generatedAt).toLocaleString('en-AU')}</p>
      )}
    </div>
  );
}
