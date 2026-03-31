'use client';

import { useState, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Download,
  Mail,
  RefreshCw,
  TrendingDown,
  DollarSign,
  Home,
  Wrench,
  BarChart2,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Inputs {
  insurerName: string;
  portfolioSize: number;
  hosesPerProperty: number;
  hosePriceExGst: number;
  rolloutYears: number;
  avgClaimCost: number;
  claimsPerYear: number;
  analysisYears: number;
  avgAnnualPremium: number;
  renewalRate: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: Inputs = {
  insurerName: '',
  portfolioSize: 20000,
  hosesPerProperty: 12,
  hosePriceExGst: 135,
  rolloutYears: 2,
  avgClaimCost: 30000,
  claimsPerYear: 320,
  analysisYears: 5,
  avgAnnualPremium: 7500,
  renewalRate: 90,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

function fmtNum(n: number) {
  return new Intl.NumberFormat('en-AU').format(Math.round(n));
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

// ─── Input field ──────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  type = 'number',
  placeholder,
  hint,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
      <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg overflow-hidden focus-within:border-blue-500 transition-colors">
        {prefix && <span className="px-3 text-gray-500 text-sm select-none">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder-gray-600 min-w-0"
        />
        {suffix && <span className="px-3 text-gray-500 text-sm select-none">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  );
}

// ─── KPI result card ──────────────────────────────────────────────────────────

function ResultCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
  large,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  colour: string;
  large?: boolean;
}) {
  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-xl p-3 flex flex-col gap-1.5 min-w-0 ${large ? 'md:col-span-2' : ''}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <div className={`p-1 rounded-md shrink-0 ${colour}`}>
          <Icon className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs text-gray-400 uppercase tracking-wide truncate">{label}</span>
      </div>
      <p className={`font-bold text-white truncate ${large ? 'text-2xl' : 'text-lg'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 truncate">{sub}</p>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-3">
      <div className="h-px flex-1 bg-gray-700" />
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="h-px flex-1 bg-gray-700" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FlexiCalcPage() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  const set = useCallback((key: keyof Inputs, raw: string) => {
    setInputs(prev => ({
      ...prev,
      [key]: key === 'insurerName' ? raw : (parseFloat(raw) || 0),
    }));
  }, []);

  const reset = () => setInputs(DEFAULTS);

  // ── Calculations ────────────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const {
      portfolioSize,
      hosesPerProperty,
      hosePriceExGst,
      rolloutYears,
      avgClaimCost,
      claimsPerYear,
      analysisYears,
      avgAnnualPremium,
      renewalRate,
    } = inputs;

    const gstRate = 0.10;
    const totalHoses = portfolioSize * hosesPerProperty;
    const installExGst = totalHoses * hosePriceExGst;
    const installGst = installExGst * gstRate;
    const installIncGst = installExGst + installGst;
    const installPerYear = rolloutYears > 0 ? installIncGst / rolloutYears : installIncGst;

    const totalClaimCost = claimsPerYear * avgClaimCost * analysisYears;
    const netBenefit = totalClaimCost - installIncGst;
    const roi = installIncGst > 0 ? (netBenefit / installIncGst) * 100 : 0;
    const savingsPerDollar = installIncGst > 0 ? totalClaimCost / installIncGst : 0;

    const renewingPolicies = portfolioSize * (renewalRate / 100);
    const renewalRevenueY1 = renewingPolicies * avgAnnualPremium;
    const renewalRevenueY2 = renewingPolicies * avgAnnualPremium;
    const totalRenewalRevenue = renewalRevenueY1 + renewalRevenueY2;
    const revenueVsInstall = totalRenewalRevenue - installIncGst;

    return {
      totalHoses,
      installExGst,
      installGst,
      installIncGst,
      installPerYear,
      totalClaimCost,
      netBenefit,
      roi,
      savingsPerDollar,
      renewingPolicies,
      renewalRevenueY1,
      renewalRevenueY2,
      totalRenewalRevenue,
      revenueVsInstall,
    };
  }, [inputs]);

  // ── CSV export ───────────────────────────────────────────────────────────────

  const downloadCsv = () => {
    const name = inputs.insurerName || 'Insurer';
    const rows = [
      ['No Burst Flexi — Insurer ROI Calculator'],
      ['Prepared by', 'SHBR Group / Australian Plumbing Products'],
      ['Insurer', name],
      [],
      ['INPUTS', ''],
      ['Portfolio size (properties)', inputs.portfolioSize],
      ['Hoses per property', inputs.hosesPerProperty],
      ['Hose price (ex GST)', `$${inputs.hosePriceExGst}`],
      ['Rollout period (years)', inputs.rolloutYears],
      ['Avg claim cost (flexi hose)', `$${inputs.avgClaimCost}`],
      ['Estimated claims per year', inputs.claimsPerYear],
      ['Analysis period (years)', inputs.analysisYears],
      ['Avg annual premium', `$${inputs.avgAnnualPremium}`],
      ['Renewal rate (%)', `${inputs.renewalRate}%`],
      [],
      ['INSTALL COST', ''],
      ['Total hoses to replace', fmtNum(calc.totalHoses)],
      ['Install cost (ex GST)', fmt(calc.installExGst)],
      ['GST', fmt(calc.installGst)],
      ['Total install cost (inc GST)', fmt(calc.installIncGst)],
      [`Cost per year (over ${inputs.rolloutYears} yrs)`, fmt(calc.installPerYear)],
      [],
      ['CLAIMS SAVINGS', ''],
      [`Total claim costs avoided (${inputs.analysisYears} yrs)`, fmt(calc.totalClaimCost)],
      ['Net benefit (savings minus install)', fmt(calc.netBenefit)],
      ['ROI', `${pct(calc.roi)}`],
      ['Claims avoided per $1 invested', `$${calc.savingsPerDollar.toFixed(2)}`],
      [],
      ['RENEWAL REVENUE', ''],
      ['Renewing policies (Yr 1)', fmtNum(calc.renewingPolicies)],
      ['Revenue Year 1', fmt(calc.renewalRevenueY1)],
      ['Revenue Year 2', fmt(calc.renewalRevenueY2)],
      ['Total renewal revenue (Yr 1 + Yr 2)', fmt(calc.totalRenewalRevenue)],
      ['Revenue retained vs install cost', fmt(calc.revenueVsInstall)],
      [],
      ['THE CASE IN ONE LINE', `Replacing ${fmtNum(calc.totalHoses)} flexi hoses across ${fmtNum(inputs.portfolioSize)} properties costs ${fmt(calc.installIncGst)} (inc GST). Estimated claims avoided over ${inputs.analysisYears} years: ${fmt(calc.totalClaimCost)}. Net benefit: ${fmt(calc.netBenefit)} — a ${pct(calc.roi)} return on prevention spend.`],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NoBurstFlexi_ROI_${(inputs.insurerName || 'Insurer').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Email text ───────────────────────────────────────────────────────────────

  const emailText = useMemo(() => {
    const name = inputs.insurerName || 'your portfolio';
    return `Hi,

Following our conversation about the No Burst Flexi program, here is a summary of the numbers based on ${name}.

INVESTMENT
• Total properties: ${fmtNum(inputs.portfolioSize)}
• Hoses replaced: ${fmtNum(calc.totalHoses)} (${inputs.hosesPerProperty} per property)
• Total install cost (inc GST): ${fmt(calc.installIncGst)}
• Cost per year over ${inputs.rolloutYears} year${inputs.rolloutYears > 1 ? 's' : ''}: ${fmt(calc.installPerYear)}

CLAIMS REDUCTION (${inputs.analysisYears}-year view)
• Estimated flexi hose claims: ${fmtNum(inputs.claimsPerYear)} per year @ ${fmt(inputs.avgClaimCost)} avg
• Total claim costs avoided: ${fmt(calc.totalClaimCost)}
• Net benefit: ${fmt(calc.netBenefit)}
• Return on investment: ${pct(calc.roi)}
• Claims avoided per $1 invested: $${calc.savingsPerDollar.toFixed(2)}

PREMIUM RETENTION (Yr 1 + Yr 2)
• Renewing policies: ${fmtNum(calc.renewingPolicies)} (${inputs.renewalRate}% renewal rate)
• Total premium revenue: ${fmt(calc.totalRenewalRevenue)}
• Revenue retained vs install cost: ${fmt(calc.revenueVsInstall)}

THE BOTTOM LINE
Replacing ${fmtNum(calc.totalHoses)} flexi hoses across ${fmtNum(inputs.portfolioSize)} properties costs ${fmt(calc.installIncGst)} (inc GST). Estimated claims avoided over ${inputs.analysisYears} years: ${fmt(calc.totalClaimCost)}. Net benefit: ${fmt(calc.netBenefit)} — a ${pct(calc.roi)} return on prevention spend, before factoring in reduced claims handling costs and customer loyalty uplift.

Please let us know if you'd like to adjust any assumptions or discuss the program further.

Kind regards,
SHBR Group / Australian Plumbing Products`;
  }, [inputs, calc]);

  const copyEmail = async () => {
    await navigator.clipboard.writeText(emailText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PageHeader
          title="No Burst Flexi — ROI Calculator"
          subtitle="Input an insurer's portfolio details to model the full cost, claims savings, and renewal revenue case"
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">

          {/* ── Left: Inputs ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Inputs</h2>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
              </div>

              <Field
                label="Insurer / Company Name"
                value={inputs.insurerName}
                onChange={v => set('insurerName', v)}
                type="text"
                placeholder="e.g. Chubb"
                hint="Used in email output and CSV filename"
              />

              <SectionHeader label="Portfolio" />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Properties"
                  value={inputs.portfolioSize}
                  onChange={v => set('portfolioSize', v)}
                  hint="Total insured properties"
                />
                <Field
                  label="Hoses / property"
                  value={inputs.hosesPerProperty}
                  onChange={v => set('hosesPerProperty', v)}
                  hint="Avg no. of flexi hoses"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field
                  label="Hose price (ex GST)"
                  value={inputs.hosePriceExGst}
                  onChange={v => set('hosePriceExGst', v)}
                  prefix="$"
                />
                <Field
                  label="Rollout period"
                  value={inputs.rolloutYears}
                  onChange={v => set('rolloutYears', v)}
                  suffix="yrs"
                />
              </div>

              <SectionHeader label="Claims" />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Avg claim cost"
                  value={inputs.avgClaimCost}
                  onChange={v => set('avgClaimCost', v)}
                  prefix="$"
                  hint="Per flexi hose burst"
                />
                <Field
                  label="Claims / year"
                  value={inputs.claimsPerYear}
                  onChange={v => set('claimsPerYear', v)}
                  hint="Est. flexi hose claims p.a."
                />
              </div>

              <div className="mt-3">
                <Field
                  label="Analysis period"
                  value={inputs.analysisYears}
                  onChange={v => set('analysisYears', v)}
                  suffix="years"
                  hint="How many years of claims to model"
                />
              </div>

              <SectionHeader label="Premium Retention" />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Avg annual premium"
                  value={inputs.avgAnnualPremium}
                  onChange={v => set('avgAnnualPremium', v)}
                  prefix="$"
                  hint="Per policy"
                />
                <Field
                  label="Renewal rate"
                  value={inputs.renewalRate}
                  onChange={v => set('renewalRate', v)}
                  suffix="%"
                  hint="Expected renewal rate"
                />
              </div>
            </div>
          </div>

          {/* ── Right: Results ────────────────────────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col gap-4">

            {/* Install cost */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-400" /> Installation Cost
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <ResultCard label="Total hoses" value={fmtNum(calc.totalHoses)} icon={Wrench} colour="bg-blue-600" />
                <ResultCard label="Ex GST" value={fmt(calc.installExGst)} icon={DollarSign} colour="bg-blue-600" />
                <ResultCard label="Inc GST" value={fmt(calc.installIncGst)} icon={DollarSign} colour="bg-blue-700" />
                <ResultCard label={`Per year (÷${inputs.rolloutYears})`} value={fmt(calc.installPerYear)} icon={BarChart2} colour="bg-blue-800" />
              </div>
            </div>

            {/* Claims savings */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-emerald-400" /> Claims Savings ({inputs.analysisYears}-Year View)
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <ResultCard label={`${inputs.analysisYears}-yr claims avoided`} value={fmt(calc.totalClaimCost)} icon={TrendingDown} colour="bg-emerald-600" />
                <ResultCard label="Net benefit" value={fmt(calc.netBenefit)} icon={CheckCircle} colour={calc.netBenefit >= 0 ? 'bg-emerald-700' : 'bg-red-700'} />
                <ResultCard label="ROI" value={pct(calc.roi)} icon={BarChart2} colour={calc.roi >= 0 ? 'bg-emerald-600' : 'bg-red-600'} />
                <ResultCard label="Per $1 invested" value={`$${calc.savingsPerDollar.toFixed(2)}`} icon={DollarSign} colour="bg-emerald-800" />
              </div>
            </div>

            {/* Renewal revenue */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Home className="w-4 h-4 text-purple-400" /> Renewal Revenue (Yr 1 + Yr 2)
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <ResultCard label="Renewing policies" value={fmtNum(calc.renewingPolicies)} icon={Home} colour="bg-purple-700" />
                <ResultCard label="Total revenue" value={fmt(calc.totalRenewalRevenue)} icon={DollarSign} colour="bg-purple-600" />
                <ResultCard label="Revenue vs install" value={fmt(calc.revenueVsInstall)} icon={CheckCircle} colour={calc.revenueVsInstall >= 0 ? 'bg-purple-700' : 'bg-red-700'} />
              </div>
            </div>

            {/* Bottom line */}
            <div className="bg-gradient-to-br from-blue-900/40 to-emerald-900/30 border border-blue-700/40 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-200 mb-1">The case in one line</p>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Replacing <strong className="text-white">{fmtNum(calc.totalHoses)}</strong> flexi hoses
                    across <strong className="text-white">{fmtNum(inputs.portfolioSize)}</strong> properties costs{' '}
                    <strong className="text-white">{fmt(calc.installIncGst)}</strong> (inc GST).
                    Estimated claims avoided over {inputs.analysisYears} years:{' '}
                    <strong className="text-emerald-400">{fmt(calc.totalClaimCost)}</strong>.
                    Net benefit: <strong className="text-emerald-400">{fmt(calc.netBenefit)}</strong> — a{' '}
                    <strong className="text-emerald-400">{pct(calc.roi)}</strong> return on prevention spend.
                  </p>
                </div>
              </div>
            </div>

            {/* Export actions */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Download className="w-4 h-4 text-gray-400" /> Export
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={downloadCsv}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" /> Download CSV
                </button>
                <button
                  onClick={copyEmail}
                  className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy email text'}
                </button>
              </div>

              {/* Email preview */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Email preview (ready to paste)
                </p>
                <pre className="text-xs text-gray-400 bg-gray-800/60 border border-gray-700 rounded-lg p-3 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-mono">
                  {emailText}
                </pre>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
