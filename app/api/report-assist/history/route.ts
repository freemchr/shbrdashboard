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

    const { blobs } = await list({ prefix: `reports/${safeJobNumber}/` });

    // ── #1 FIX: Return blob paths only — NOT raw public URLs ──────────────────
    // Client must download PDFs through our authenticated proxy endpoint.
    const pdfs = blobs
      .filter(b => b.pathname.endsWith('.pdf'))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map(b => ({
        path: b.pathname,
        uploadedAt: b.uploadedAt,
      }));

    return NextResponse.json({ pdfs });
  } catch (err: unknown) {
    console.error('[history] Error:', err);
    return NextResponse.json({ error: 'Failed to load report history' }, { status: 500 });
  }
}
