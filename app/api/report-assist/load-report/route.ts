import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { sanitizeJobNumber } from '@/lib/sanitize';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobNumber = searchParams.get('jobNumber');

    if (!jobNumber) {
      return NextResponse.json({ error: 'jobNumber is required' }, { status: 400 });
    }

    // ── #2 FIX: Sanitise jobNumber to prevent path traversal ─────────────────
    const safeJobNumber = sanitizeJobNumber(jobNumber);
    if (!safeJobNumber) {
      return NextResponse.json({ error: 'Invalid job number' }, { status: 400 });
    }

    const { blobs } = await list({ prefix: `reports/${safeJobNumber}/draft.json` });

    if (blobs.length === 0) {
      return NextResponse.json({ reportData: null });
    }

    // Get the latest draft — fetch using the download URL (works for private blobs)
    const draftBlob = blobs[0];
    const res = await fetch(draftBlob.downloadUrl, {
      headers: process.env.BLOB_READ_WRITE_TOKEN
        ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        : {},
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ reportData: null });
    }

    const reportData = await res.json();
    // ── #1 FIX: Never return the raw blob URL to the client — serve data directly
    return NextResponse.json({ reportData });
  } catch (err: unknown) {
    console.error('[load-report] Error:', err);
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 });
  }
}
