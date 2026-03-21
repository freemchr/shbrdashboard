/**
 * GET /api/report-assist/scope?jobNumber=YOU0009300
 * Fetches scope / work order line items for a job from Prime.
 * Tries: work-orders → scopes → estimates, returns first non-empty result.
 */
import { NextRequest, NextResponse } from 'next/server';
import { primeGet } from '@/lib/prime-auth';

export const runtime = 'nodejs';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitRate: number;
  total: number;
  category: string;
  notes: string;
}

// ─── Normalise a raw line-item from various Prime schemas ──────────────────────
function normalise(raw: Record<string, unknown>, idx: number): LineItem {
  const a = (raw.attributes ?? raw) as Record<string, unknown>;
  const str = (v: unknown) => (v != null ? String(v) : '');
  const num = (v: unknown) => (v != null ? Number(v) : 0);

  return {
    id: str(raw.id ?? idx),
    description: str(a.description ?? a.name ?? a.title ?? a.lineDescription ?? ''),
    quantity: num(a.quantity ?? a.qty ?? 1),
    unit: str(a.unit ?? a.unitOfMeasure ?? ''),
    unitRate: num(a.unitRate ?? a.rate ?? a.unitCost ?? a.unitPrice ?? 0),
    total: num(
      a.total ?? a.lineTotal ?? a.amount ?? a.subtotal ??
      (num(a.quantity ?? 1) * num(a.unitRate ?? a.rate ?? 0))
    ),
    category: str(a.category ?? a.trade ?? a.division ?? ''),
    notes: str(a.notes ?? a.comment ?? a.remarks ?? ''),
  };
}

// ─── Extract line items from a work-order response ────────────────────────────
function extractFromWorkOrders(data: unknown): LineItem[] {
  const woList = (data as { data?: unknown[] })?.data ?? [];
  const items: LineItem[] = [];
  for (const wo of woList) {
    const woAny = wo as Record<string, unknown>;
    // Items may live directly in work order attributes or in a nested lineItems array
    const lineItems =
      (woAny.attributes as Record<string, unknown>)?.lineItems ??
      (woAny.attributes as Record<string, unknown>)?.items ??
      (woAny as Record<string, unknown>).lineItems ??
      [];
    if (Array.isArray(lineItems)) {
      lineItems.forEach((li, i) => items.push(normalise(li as Record<string, unknown>, i)));
    }
  }
  return items;
}

// ─── Extract line items from a flat data array (scopes / estimates) ───────────
function extractFlat(data: unknown): LineItem[] {
  const list = (data as { data?: unknown[] })?.data ?? [];
  if (!Array.isArray(list) || list.length === 0) return [];
  const items: LineItem[] = [];
  for (const entry of list) {
    const entryAny = entry as Record<string, unknown>;
    // Some endpoints return nested lineItems
    const nested =
      (entryAny.attributes as Record<string, unknown>)?.lineItems ??
      (entryAny.attributes as Record<string, unknown>)?.items ??
      null;
    if (Array.isArray(nested)) {
      nested.forEach((li, i) => items.push(normalise(li as Record<string, unknown>, i)));
    } else {
      items.push(normalise(entryAny, items.length));
    }
  }
  return items;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobNumber = searchParams.get('jobNumber');

    if (!jobNumber) {
      return NextResponse.json({ error: 'jobNumber is required' }, { status: 400 });
    }

    // 1. Find the job UUID
    const searchData = await primeGet(
      `/jobs?filter[jobNumber]=${encodeURIComponent(jobNumber)}`
    ) as { data?: Array<{ id: string }> };

    const jobs = searchData?.data ?? [];
    if (jobs.length === 0) {
      return NextResponse.json(
        { error: `Job ${jobNumber} not found in Prime` },
        { status: 404 }
      );
    }

    const jobUuid = jobs[0].id;

    // 2. Try work-orders
    let lineItems: LineItem[] = [];
    let source: 'work-orders' | 'scopes' | 'estimates' | 'none' = 'none';
    let rawData: unknown = null;

    try {
      const woData = await primeGet(`/jobs/${jobUuid}/work-orders`);
      const woItems = extractFromWorkOrders(woData);
      if (woItems.length > 0) {
        lineItems = woItems;
        source = 'work-orders';
        rawData = woData;
      }
    } catch (e) {
      console.warn('[scope] work-orders fetch failed:', e instanceof Error ? e.message : e);
    }

    // 3. Try scopes (if work-orders gave nothing)
    if (lineItems.length === 0) {
      try {
        const scopeData = await primeGet(`/jobs/${jobUuid}/scopes`);
        const scopeItems = extractFlat(scopeData);
        if (scopeItems.length > 0) {
          lineItems = scopeItems;
          source = 'scopes';
          rawData = scopeData;
        }
      } catch (e) {
        console.warn('[scope] scopes fetch failed:', e instanceof Error ? e.message : e);
      }
    }

    // 4. Try estimates (if still nothing)
    if (lineItems.length === 0) {
      try {
        const estData = await primeGet(`/jobs/${jobUuid}/estimates`);
        const estItems = extractFlat(estData);
        if (estItems.length > 0) {
          lineItems = estItems;
          source = 'estimates';
          rawData = estData;
        }
      } catch (e) {
        console.warn('[scope] estimates fetch failed:', e instanceof Error ? e.message : e);
      }
    }

    const scopeTotal = lineItems.reduce((sum, li) => sum + (li.total || 0), 0);

    return NextResponse.json({
      jobNumber,
      jobUuid,
      lineItems,
      scopeTotal,
      source,
      rawData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[scope] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
