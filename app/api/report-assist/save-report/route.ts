import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { sanitizeJobNumber } from '@/lib/sanitize';

export const runtime = 'nodejs';

// ── #5 FIX: Input size limit ──────────────────────────────────────────────────
const MAX_REPORT_BYTES = 500 * 1024; // 500 KB — more than enough for a draft

export async function POST(req: NextRequest) {
  try {
    // Check Content-Length before parsing (quick guard)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_REPORT_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    const body = await req.json();
    const { jobNumber, reportData } = body;

    if (!jobNumber) {
      return NextResponse.json({ error: 'jobNumber is required' }, { status: 400 });
    }

    // ── #2 FIX: Sanitise jobNumber to prevent path traversal ─────────────────
    const safeJobNumber = sanitizeJobNumber(String(jobNumber));
    if (!safeJobNumber) {
      return NextResponse.json({ error: 'Invalid job number' }, { status: 400 });
    }

    const serialised = JSON.stringify(reportData, null, 2);

    // Double-check serialised size
    if (Buffer.byteLength(serialised) > MAX_REPORT_BYTES) {
      return NextResponse.json({ error: 'Report data too large' }, { status: 413 });
    }

    // ── #1 FIX: Store as PRIVATE — report data contains sensitive insurance info
    await put(
      `reports/${safeJobNumber}/draft.json`,
      serialised,
      {
        access: 'private',      // was 'public' — critical fix
        contentType: 'application/json',
        allowOverwrite: true,
      }
    );

    // Return the blob path (not the raw URL) — client downloads via our proxy
    return NextResponse.json({ blobPath: `reports/${safeJobNumber}/draft.json`, success: true });
  } catch (err: unknown) {
    console.error('[save-report] Error:', err);
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
  }
}
