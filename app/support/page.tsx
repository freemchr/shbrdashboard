'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  LayoutDashboard,
  GitBranch,
  AlertTriangle,
  Users,
  Clock,
  DollarSign,
  Search,
  Map,
  FileText,
  FileEdit,
  Sparkles,
  Cloud,
  ShieldCheck,
  HardHat,
  Activity,
  Tv2,
  Mail,
  Info,
  AlertCircle,
  Database,
} from 'lucide-react';

const LAST_UPDATED = '18 March 2026';
const CONTACT_EMAIL = 'chris.freeman@techgurus.com.au';

const sections = [
  {
    icon: LayoutDashboard,
    name: 'Overview',
    href: '/',
    description: 'The main dashboard home. Shows a live summary of all open jobs — total count, authorised value, regional breakdown, and a scrollable bar chart of jobs by status. Click any status bar to drill into the jobs in that state. Toggle between tile and list view for the drilldown.',
  },
  {
    icon: Tv2,
    name: 'Command Centre',
    href: '/command-centre',
    description: 'A high-level operational view designed for monitoring at a glance. Surfaces the most critical metrics in one place — open job counts, pipeline health, bottlenecks, and recent activity.',
  },
  {
    icon: Cloud,
    name: 'Weather',
    href: '/weather',
    description: 'Current conditions and 7-day forecasts for 8 key Australian cities. Displays storm alerts and severity banners — useful for anticipating claim volume spikes from weather events. Data is cached hourly from Open-Meteo (no API key required).',
  },
  {
    icon: ShieldCheck,
    name: 'WHS',
    href: '/whs',
    description: 'Work Health & Safety compliance dashboard. Tracks SWMS/TMP site forms pulled from Prime — completion rate, SWMS coverage across open jobs, forms awaiting approval, not-started forms, average approval turnaround, and open jobs with no SWMS on file. Data is a weekly snapshot rebuilt every Monday morning due to the volume of records (2,000+ forms).',
  },
  {
    icon: GitBranch,
    name: 'Pipeline',
    href: '/pipeline',
    description: 'Shows the flow of jobs through the pipeline over time — jobs created vs. completed by week, and current distribution across pipeline stages. Useful for spotting intake surges or completion slowdowns.',
  },
  {
    icon: AlertTriangle,
    name: 'Bottlenecks',
    href: '/bottlenecks',
    description: 'Identifies open jobs that have not had any activity for a set number of days (7, 14, 30, 60, or 90). Groups stuck jobs by their current status so you can see where work is stalling. Sortable and filterable by type, region, and status.',
  },
  {
    icon: Users,
    name: 'Team',
    href: '/team',
    description: 'Shows all active team members (users in Prime) and their current workload — number of open jobs assigned, authorised value, and role. Sortable by any column. Useful for identifying who is overloaded or has capacity.',
  },
  {
    icon: Clock,
    name: 'Aging',
    href: '/aging',
    description: 'Breaks down open jobs by age — how long since they were created. Highlights jobs in the 90+ day and 180+ day buckets that may need escalation. Filterable by region and job type.',
  },
  {
    icon: DollarSign,
    name: 'Financial',
    href: '/financial',
    description: 'A financial health summary of open jobs — total authorised value, invoice status (draft, submitted, paid), and outstanding amounts. Pulls from Prime invoices and job authorisation data.',
  },
  {
    icon: Search,
    name: 'Job Search',
    href: '/search',
    description: 'Full-text search across all open jobs. Search by job number, address, client reference, or description. Results link directly to the job in Prime.',
  },
  {
    icon: Map,
    name: 'Jobs Map',
    href: '/map',
    description: 'Plots all open jobs on an interactive map of Australia. Jobs are geocoded from their Prime address (93%+ coverage). Click any pin for job details. Useful for spotting regional concentration and gaps.',
  },
  {
    icon: FileText,
    name: 'Reports — Overview',
    href: '/reports',
    description: 'Shows which open jobs have an assessment report and which do not. Jobs are grouped into No Report, In Progress, Submitted, and Post-Report stages. Red dot indicators flag jobs that need attention. Filterable and exportable to CSV.',
  },
  {
    icon: FileEdit,
    name: 'Reports — Report Assist',
    href: '/report-assist',
    description: 'AI-powered report writing tool. Lists jobs without a report and provides a one-click wizard pre-filled with job data from Prime. The wizard guides through 8 sections and generates a branded PDF ready to upload directly to Prime.',
  },
  {
    icon: Sparkles,
    name: 'Reports — Report Polisher',
    href: '/report-assist/polish',
    description: 'Upload any existing assessment report PDF and the AI will polish and improve the language, structure, and clarity while preserving all the original content. Useful for older reports or those needing a professional touch before submission.',
  },
  {
    icon: HardHat,
    name: 'Estimators — Workload',
    href: '/estimators',
    description: 'Breaks down open jobs by assigned estimator. Shows each estimator\'s active job count, total authorised value, and average job age. Helps with workload balancing and identifying estimators who may need support.',
  },
  {
    icon: Activity,
    name: 'Estimators — Timeline Tracking',
    href: '/timeline',
    description: 'Tracks key milestone dates across jobs — when they were created, when reports were submitted, when invoices were raised. Useful for identifying delays in the workflow and holding the timeline accountable.',
  },
];

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
              <a
                href="https://www.primeeco.tech/login?redirectTo=%2F"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 underline underline-offset-2 transition-colors"
              >
                Prime
              </a>.
              {' '}The accuracy of everything displayed here is dependent on the accuracy of data entered and maintained in Prime.
              If something looks incorrect, please verify the information in Prime first.
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
              <Link key={s.href} href={s.href} className="group bg-[#111111] rounded-xl border border-gray-800 hover:border-gray-600 p-4 flex gap-4 transition-colors">
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

        {/* Feedback / contact */}
        <div className="bg-[#111111] rounded-xl border border-gray-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Issues, Feedback & Improvements</h2>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            If you encounter a bug, notice incorrect data, have a suggestion for a new feature, or want to
            report a concern about how the platform is working — please send all feedback to:
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
          >
            <Mail size={14} />
            {CONTACT_EMAIL}
          </a>
          <p className="text-xs text-gray-600 leading-relaxed pt-1">
            Please include the page name, what you expected to see, and what you actually saw.
            Screenshots are helpful. This platform is actively being developed — all feedback is reviewed and acted on.
          </p>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-700 text-center pb-4 space-y-1">
          <p>SHBR Insights · Internal use only</p>
          <p>Platform guide last updated: <strong className="text-gray-600">{LAST_UPDATED}</strong> · Updated as new sections are added</p>
          <p>Built by <a href="https://www.techgurus.com.au" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-red-400 underline underline-offset-2 transition-colors">TechGurus</a></p>
        </div>

      </div>
    </div>
  );
}
