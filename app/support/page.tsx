'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  LayoutDashboard, GitBranch, AlertTriangle, Users, Clock,
  DollarSign, Search, Map, FileText, FileEdit, Sparkles, Cloud,
  ShieldCheck, HardHat, Activity, Tv2, Mail, Info, Database,
  Bug, Lightbulb, Bot, CheckCircle, ChevronDown, Loader2,
} from 'lucide-react';

const LAST_UPDATED = '19 March 2026';

const sections = [
  { icon: LayoutDashboard, name: 'Overview',                    href: '/',                   description: 'The main dashboard home. Shows a live summary of all open jobs — total count, authorised value, regional breakdown, and a scrollable bar chart of jobs by status. Click any status bar to drill into the jobs in that state. Toggle between tile and list view for the drilldown.' },
  { icon: Tv2,             name: 'Command Centre',              href: '/command-centre',     description: 'A high-level operational view designed for monitoring at a glance. Surfaces the most critical metrics in one place — open job counts, pipeline health, bottlenecks, and recent activity.' },
  { icon: Cloud,           name: 'Weather',                     href: '/weather',            description: 'Current conditions and 7-day forecasts for 8 key Australian cities. Displays storm alerts and severity banners — useful for anticipating claim volume spikes from weather events. Data is cached hourly from Open-Meteo (no API key required).' },
  { icon: ShieldCheck,     name: 'WHS',                         href: '/whs',                description: 'Work Health & Safety compliance dashboard. Tracks SWMS/TMP site forms pulled from Prime — completion rate, SWMS coverage across open jobs, forms awaiting approval, not-started forms, average approval turnaround, and open jobs with no SWMS on file.' },
  { icon: GitBranch,       name: 'Pipeline',                    href: '/pipeline',           description: 'Shows the flow of jobs through the pipeline over time — jobs created vs. completed by week, and current distribution across pipeline stages.' },
  { icon: AlertTriangle,   name: 'Bottlenecks',                 href: '/bottlenecks',        description: 'Identifies open jobs that have not had any activity for a set number of days (7, 14, 30, 60, or 90). Groups stuck jobs by their current status so you can see where work is stalling.' },
  { icon: Users,           name: 'Team',                        href: '/team',               description: 'Shows all active team members and their current workload — number of open jobs assigned, authorised value, and role.' },
  { icon: Clock,           name: 'Aging',                       href: '/aging',              description: 'Breaks down open jobs by age — how long since they were created. Highlights jobs in the 90+ day and 180+ day buckets that may need escalation.' },
  { icon: DollarSign,      name: 'Financial',                   href: '/financial',          description: 'A financial health summary of open jobs — total authorised value, invoice status (draft, submitted, paid), and outstanding amounts.' },
  { icon: Search,          name: 'Job Search',                  href: '/search',             description: 'Full-text search across all open jobs. Search by job number, address, client reference, or description. Results link directly to the job in Prime.' },
  { icon: Map,             name: 'Jobs Map',                    href: '/map',                description: 'Plots all open jobs on an interactive map of Australia. Click any pin for job details.' },
  { icon: FileText,        name: 'Reports — Overview',          href: '/reports',            description: 'Shows which open jobs have an assessment report and which do not. Grouped into No Report, In Progress, Submitted, and Post-Report stages.' },
  { icon: FileEdit,        name: 'Reports — Report Assist',     href: '/report-assist',      description: 'AI-powered report writing tool. Lists jobs without a report and provides a one-click wizard pre-filled with job data from Prime.' },
  { icon: Sparkles,        name: 'Reports — Report Polisher',   href: '/report-assist/polish', description: 'Upload any existing assessment report PDF and the AI will polish and improve the language, structure, and clarity.' },
  { icon: HardHat,         name: 'Estimators — Workload',       href: '/estimators',         description: 'Breaks down open jobs by assigned estimator. Shows each estimator\'s active job count, total authorised value, and average job age.' },
  { icon: Activity,        name: 'Estimators — Timeline',       href: '/timeline',           description: 'Tracks key milestone dates across jobs — when they were created, when reports were submitted, when invoices were raised.' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type TicketType = 'bug' | 'feature' | 'automation';
type Status = 'idle' | 'submitting' | 'success' | 'error';

// ── Input components ──────────────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-400 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, required }: {
  value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3, required }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; required?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      required={required}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors resize-vertical"
    />
  );
}

function Select({ value, onChange, options, required }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-colors pr-8"
      >
        <option value="">Select…</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TypeTab({ active, onClick, icon: Icon, label, sublabel, color }: {
  active: boolean; onClick: () => void;
  icon: React.ElementType; label: string; sublabel: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border-2 transition-all text-center ${
        active
          ? `border-current ${color} bg-gray-800/80`
          : 'border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400 bg-gray-900'
      }`}
    >
      <Icon size={20} />
      <span className="text-xs font-bold leading-tight">{label}</span>
      <span className="text-[10px] leading-tight opacity-70 hidden sm:block">{sublabel}</span>
    </button>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

function SupportForm() {
  const [type,   setType]   = useState<TicketType>('bug');
  const [status, setStatus] = useState<Status>('idle');
  const [userName,  setUserName]  = useState('');
  const [userEmail, setUserEmail] = useState('');

  // Bug fields
  const [pageUrl,        setPageUrl]        = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugExpected,    setBugExpected]    = useState('');
  const [bugActual,      setBugActual]      = useState('');
  const [bugSeverity,    setBugSeverity]    = useState('');

  // Feature fields
  const [featureSummary,  setFeatureSummary]  = useState('');
  const [featureDetail,   setFeatureDetail]   = useState('');
  const [featurePage,     setFeaturePage]     = useState('');
  const [featureWho,      setFeatureWho]      = useState('');
  const [featurePriority, setFeaturePriority] = useState('');

  // Automation fields
  const [autoDescription, setAutoDescription] = useState('');
  const [autoTrigger,     setAutoTrigger]     = useState('');
  const [autoEmailTo,     setAutoEmailTo]     = useState('');
  const [autoOutput,      setAutoOutput]      = useState('');
  const [autoFrequency,   setAutoFrequency]   = useState('');
  const [autoNotes,       setAutoNotes]       = useState('');

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.userName)  setUserName(d.userName);
        if (d?.userEmail) setUserEmail(d.userEmail);
      })
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setPageUrl(''); setBugDescription(''); setBugExpected(''); setBugActual(''); setBugSeverity('');
    setFeatureSummary(''); setFeatureDetail(''); setFeaturePage(''); setFeatureWho(''); setFeaturePriority('');
    setAutoDescription(''); setAutoTrigger(''); setAutoEmailTo(''); setAutoOutput(''); setAutoFrequency(''); setAutoNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    const payload: Record<string, string> = {
      type,
      pageUrl, bugDescription, bugExpected, bugActual, bugSeverity,
      featureSummary, featureDetail, featurePage, featureWho, featurePriority,
      autoDescription, autoTrigger, autoEmailTo, autoOutput, autoFrequency, autoNotes,
    };

    try {
      const res = await fetch('/api/support/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Submit failed');
      setStatus('success');
      resetForm();
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center">
          <CheckCircle size={28} className="text-green-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-lg">Request submitted!</p>
          <p className="text-gray-400 text-sm mt-1">
            Your request has been emailed to Gizmo and Chris.<br />
            You&apos;ll hear back shortly.
          </p>
        </div>
        <button
          onClick={() => setStatus('idle')}
          className="mt-2 px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-300 transition-colors"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Submitter info */}
      {(userName || userEmail) && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-800/60 border border-gray-800 text-xs text-gray-400">
          <Mail size={13} className="flex-shrink-0 text-gray-500" />
          <span>Submitting as <strong className="text-gray-300">{userName}</strong> ({userEmail})</span>
        </div>
      )}

      {/* Type selector */}
      <div>
        <Label>What kind of request is this?</Label>
        <div className="flex gap-3 mt-1">
          <TypeTab
            active={type === 'bug'}
            onClick={() => setType('bug')}
            icon={Bug}
            label="Bug / Issue"
            sublabel="Something is broken or wrong"
            color="text-red-400"
          />
          <TypeTab
            active={type === 'feature'}
            onClick={() => setType('feature')}
            icon={Lightbulb}
            label="Feature Request"
            sublabel="I want something new"
            color="text-amber-400"
          />
          <TypeTab
            active={type === 'automation'}
            onClick={() => setType('automation')}
            icon={Bot}
            label="Automation / Report"
            sublabel="Schedule, email, or automate"
            color="text-blue-400"
          />
        </div>
      </div>

      {/* ── Bug fields ── */}
      {type === 'bug' && (
        <div className="space-y-4">
          <div>
            <Label>Page URL or section with the problem</Label>
            <TextInput
              value={pageUrl}
              onChange={setPageUrl}
              placeholder="e.g. https://shbr-dashboard.vercel.app/estimators or 'Estimators page'"
            />
          </div>
          <div>
            <Label required>What is the problem?</Label>
            <TextArea
              value={bugDescription}
              onChange={setBugDescription}
              placeholder="Describe the issue as clearly as you can — what happened, when, and how often."
              rows={4}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>What did you expect to happen?</Label>
              <TextArea
                value={bugExpected}
                onChange={setBugExpected}
                placeholder="What should it have done?"
                rows={3}
              />
            </div>
            <div>
              <Label>What actually happened?</Label>
              <TextArea
                value={bugActual}
                onChange={setBugActual}
                placeholder="What did it do instead?"
                rows={3}
              />
            </div>
          </div>
          <div className="max-w-xs">
            <Label required>Severity</Label>
            <Select
              value={bugSeverity}
              onChange={setBugSeverity}
              required
              options={[
                { value: 'low',      label: '🟢 Low — minor cosmetic issue' },
                { value: 'medium',   label: '🟡 Medium — affects my work but I can continue' },
                { value: 'high',     label: '🔴 High — a key feature is broken' },
                { value: 'blocking', label: '🚨 Blocking — I cannot use the platform' },
              ]}
            />
          </div>
        </div>
      )}

      {/* ── Feature fields ── */}
      {type === 'feature' && (
        <div className="space-y-4">
          <div>
            <Label required>Summarise the feature in one line</Label>
            <TextInput
              value={featureSummary}
              onChange={setFeatureSummary}
              placeholder="e.g. 'Add a filter by insurer on the Bottlenecks page'"
              required
            />
          </div>
          <div>
            <Label required>What should it do? How should it work?</Label>
            <TextArea
              value={featureDetail}
              onChange={setFeatureDetail}
              placeholder="Describe the feature in as much detail as you can — what it shows, how you interact with it, what problem it solves."
              rows={5}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Which page or section is it for?</Label>
              <TextInput
                value={featurePage}
                onChange={setFeaturePage}
                placeholder="e.g. Estimators, Dashboard, Reports…"
              />
            </div>
            <div>
              <Label>Who would use this?</Label>
              <TextInput
                value={featureWho}
                onChange={setFeatureWho}
                placeholder="e.g. Estimators, managers, all staff…"
              />
            </div>
          </div>
          <div className="max-w-xs">
            <Label>Priority</Label>
            <Select
              value={featurePriority}
              onChange={setFeaturePriority}
              options={[
                { value: 'nice-to-have', label: '💡 Nice to have' },
                { value: 'useful',       label: '👍 Useful — would use it regularly' },
                { value: 'important',    label: '⭐ Important — would save significant time' },
                { value: 'critical',     label: '🔥 Critical — needed for business operations' },
              ]}
            />
          </div>
        </div>
      )}

      {/* ── Automation fields ── */}
      {type === 'automation' && (
        <div className="space-y-4">
          <div>
            <Label required>What should be automated?</Label>
            <TextArea
              value={autoDescription}
              onChange={setAutoDescription}
              placeholder="Describe what you want automated — e.g. 'A daily email report showing job counts by status, compared to yesterday'"
              rows={4}
              required
            />
          </div>
          <div>
            <Label>What data or trigger is needed?</Label>
            <TextArea
              value={autoTrigger}
              onChange={setAutoTrigger}
              placeholder="e.g. 'Pulls from Prime every morning', 'Triggers when a job status changes', 'Date range: 1 July 2025 to today'…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Who should it email / notify?</Label>
              <TextArea
                value={autoEmailTo}
                onChange={setAutoEmailTo}
                placeholder="e.g. stella@shbr.com.au, the whole team, just managers…"
                rows={3}
              />
            </div>
            <div>
              <Label>What should the output look like?</Label>
              <TextArea
                value={autoOutput}
                onChange={setAutoOutput}
                placeholder="e.g. HTML email with a table, PDF attachment, Telegram message, dashboard notification…"
                rows={3}
              />
            </div>
          </div>
          <div>
            <Label>How often should it run?</Label>
            <TextInput
              value={autoFrequency}
              onChange={setAutoFrequency}
              placeholder="e.g. Daily at 8am AEST, every Monday morning, once a month…"
            />
          </div>
          <div>
            <Label>Anything else to know?</Label>
            <TextArea
              value={autoNotes}
              onChange={setAutoNotes}
              placeholder="Any other context, examples of what you'd expect to see, or constraints…"
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Error banner */}
      {status === 'error' && (
        <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
          Something went wrong sending your request. Please try again, or email chris.freeman@techgurus.com.au directly.
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {status === 'submitting' ? (
            <><Loader2 size={14} className="animate-spin" /> Sending…</>
          ) : (
            <><Mail size={14} /> Send Request</>
          )}
        </button>
      </div>

    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <PageHeader
            title="Support & Platform Guide"
            subtitle="What each section does, how to get help, and how the platform works"
          />
          <span className="text-xs text-gray-600 pt-1">Last updated: {LAST_UPDATED}</span>
        </div>

        {/* Data source notice */}
        <div className="flex gap-3 px-4 py-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Database size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm text-blue-200 font-medium">Data sourced from Prime</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              This platform pulls all job, team, financial, and compliance data directly from{' '}
              <a href="https://www.primeeco.tech/login?redirectTo=%2F" target="_blank" rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 underline underline-offset-2 transition-colors">
                Prime
              </a>.
              {' '}The accuracy of everything displayed here is dependent on the accuracy of data entered in Prime.
              If something looks incorrect, verify in Prime first.
            </p>
          </div>
        </div>

        {/* Dashboard sections */}
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Info size={14} className="text-gray-500" />
            Dashboard Sections
          </h2>
          <div className="space-y-3">
            {sections.map((s) => (
              <Link key={s.href} href={s.href}
                className="group bg-[#111111] rounded-xl border border-gray-800 hover:border-gray-600 p-4 flex gap-4 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gray-800 group-hover:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors">
                  <s.icon size={15} className="text-gray-400 group-hover:text-white transition-colors" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white group-hover:text-red-400 transition-colors">{s.name}</span>
                    <span className="text-xs text-gray-600 font-mono">{s.href}</span>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Support form */}
        <div className="bg-[#111111] rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Mail size={15} className="text-gray-400" />
              Issues, Requests &amp; Automations
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Your request goes straight to Gizmo (AI) and Chris. Fill in as much detail as you can — the more context, the faster it gets done.
            </p>
          </div>
          <div className="p-5">
            <SupportForm />
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-700 text-center pb-4 space-y-1">
          <p>SHBR Insights · Internal use only</p>
          <p>Platform guide last updated: <strong className="text-gray-600">{LAST_UPDATED}</strong></p>
          <p>Built by <a href="https://www.techgurus.com.au" target="_blank" rel="noopener noreferrer"
            className="text-gray-600 hover:text-red-400 underline underline-offset-2 transition-colors">TechGurus</a></p>
        </div>

      </div>
    </div>
  );
}
