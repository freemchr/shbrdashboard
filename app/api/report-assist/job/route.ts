/**
 * GET /api/report-assist/job?jobNumber=YOU0009300
 * Fetches full job details from Prime by job number, including peril name and contact info.
 * Returns a flattened object suitable for pre-filling the report wizard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';

export const runtime = 'nodejs';

interface PrimeAddress {
  addressLine1?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
}

interface PrimeJobAttributes {
  jobNumber?: string;
  clientReference?: string;
  insurerName?: string;
  clientName?: string;
  insuredName?: string;
  address?: PrimeAddress | string;
  perilId?: string;
  perilName?: string;
  incidentDate?: string;
  notes?: string;
  assignedId?: string;
  assignedTo?: string;
  assignedName?: string;
  primeUrl?: string;
  statusId?: string;
}

interface PrimeJob {
  id: string;
  attributes?: PrimeJobAttributes;
}

interface PrimePeril {
  id: string;
  attributes?: { name?: string };
}

interface PrimeContact {
  id: string;
  attributes?: { firstName?: string; lastName?: string; name?: string };
}

async function getPerilName(perilId: string): Promise<string> {
  try {
    const data = await primeGet(`/perils/${perilId}`) as { data?: PrimePeril };
    return data?.data?.attributes?.name || '';
  } catch {
    return '';
  }
}

async function getContactName(contactId: string): Promise<string> {
  try {
    const data = await primeGet(`/contacts/${contactId}`) as { data?: PrimeContact };
    const a = data?.data?.attributes;
    if (!a) return '';
    if (a.name) return a.name;
    return [a.firstName, a.lastName].filter(Boolean).join(' ');
  } catch {
    return '';
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobNumber = searchParams.get('jobNumber');

    if (!jobNumber) {
      return NextResponse.json({ error: 'jobNumber is required' }, { status: 400 });
    }

    // Find job UUID by job number
    const searchData = await primeGet(`/jobs?filter[jobNumber]=${encodeURIComponent(jobNumber)}`) as {
      data?: PrimeJob[];
    };

    const jobs = searchData?.data || [];
    if (jobs.length === 0) {
      return NextResponse.json({ error: `Job ${jobNumber} not found in Prime` }, { status: 404 });
    }

    const job = jobs[0];
    const attrs = job.attributes || {};

    // Resolve address
    const addr = attrs.address;
    const addressStr = typeof addr === 'object' && addr
      ? [addr.addressLine1, addr.suburb, addr.state, addr.postcode].filter(Boolean).join(', ')
      : String(addr || '');

    // Resolve peril name (async, non-blocking on failure)
    let eventType = attrs.perilName || '';
    if (!eventType && attrs.perilId) {
      eventType = await getPerilName(attrs.perilId);
    }

    // Resolve assigned contact name
    let inspectedBy = attrs.assignedTo || attrs.assignedName || '';
    if (!inspectedBy && attrs.assignedId) {
      inspectedBy = await getContactName(attrs.assignedId);
    }

    // Format incident date (YYYY-MM-DD)
    let incidentDate = '';
    if (attrs.incidentDate) {
      incidentDate = attrs.incidentDate.split('T')[0];
    }

    return NextResponse.json({
      jobUuid: job.id,
      jobNumber: attrs.jobNumber || jobNumber,
      claimNumber: attrs.clientReference || '',
      insurer: attrs.insurerName || attrs.clientName || '',
      insuredName: attrs.insuredName || attrs.clientName || '',
      propertyAddress: addressStr,
      eventType,
      incidentDate,
      inspectedBy,
      propertyNotes: attrs.notes || '',
      primeUrl: attrs.primeUrl || '',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
