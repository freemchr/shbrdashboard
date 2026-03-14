export interface PrimeJob {
  id: string;
  type: string;
  attributes: {
    jobNumber?: string;
    address?: string;
    clientReference?: string;
    description?: string;
    jobType?: string;
    region?: string;
    statusType?: string;
    status?: string;
    statusName?: string;
    authorisedTotalIncludingTax?: number;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    updatedBy?: string;
    assignedId?: string;
    primeUrl?: string;
    [key: string]: unknown;
  };
  relationships?: Record<string, unknown>;
}

export interface PrimeStatus {
  id: string;
  attributes: {
    name?: string;
    type?: string;
    statusType?: string;
    [key: string]: unknown;
  };
}

export interface PrimeInvoice {
  id: string;
  attributes: {
    status?: string;
    total?: number;
    totalAmount?: number;
    [key: string]: unknown;
  };
}

export function isOpenJob(job: PrimeJob): boolean {
  const statusType = job.attributes?.statusType?.toLowerCase() || '';
  return statusType === 'open' || statusType === 'active';
}

export function daysSince(dateStr?: string): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatCurrency(amount?: number): string {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  return startOfWeek.toISOString().split('T')[0];
}
