/**
 * Authenticated download proxy for private Vercel Blob files (PDFs + drafts).
 *
 * Why this exists:
 * All report PDFs and draft JSON are stored as private Vercel Blobs.
 * Private blobs cannot be fetched directly by the browser — they require
 * a server-side token. This endpoint validates the user's session,
 * then fetches the blob server-side and streams it to the client.
 *
 * Usage:
 *   GET /api/report-assist/download?path=reports/JOB-123/2026-01-01T00-00-00-assessment-report.pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { sanitizeJobNumber } from '@/lib/sanitize';

export const runtime = 'nodejs';

// Allowed path prefixes — prevents this proxy from fetching arbitrary blobs
const ALLOWED_PREFIXES = ['reports/'];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const blobPath = searchParams.get('path');

    if (!blobPath) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    // ── Security: only allow paths under approved prefixes ────────────────────
    const isAllowed = ALLOWED_PREFIXES.some(prefix => blobPath.startsWith(prefix));
    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Security: validate job number segment inside the path ─────────────────
    // Path format: reports/<jobNumber>/<filename>
    const segments = blobPath.split('/');
    if (segments.length < 3) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    const jobSegment = sanitizeJobNumber(segments[1]);
    if (!jobSegment || segments[1] !== jobSegment) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // ── Security: filename must be alphanumeric + safe chars only ─────────────
    const filename = segments[segments.length - 1];
    if (!/^[a-zA-Z0-9\-_. ]+$/.test(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // ── Resolve the blob's download URL via listing ───────────────────────────
    const { blobs } = await list({ prefix: blobPath, limit: 1 });
    if (!blobs.length || blobs[0].pathname !== blobPath) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // ── Fetch using the signed download URL (works for private blobs) ─────────
    const blob = blobs[0];
    const upstream = await fetch(blob.downloadUrl, {
      headers: process.env.BLOB_READ_WRITE_TOKEN
        ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        : {},
      cache: 'no-store',
    });

    if (!upstream.ok) {
      console.error('[download] Upstream blob fetch failed:', upstream.status);
      return NextResponse.json({ error: 'File not available' }, { status: 502 });
    }

    const isPdf = filename.endsWith('.pdf');
    const contentType = isPdf ? 'application/pdf' : 'application/octet-stream';
    const disposition = isPdf
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[download] Error:', err);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
