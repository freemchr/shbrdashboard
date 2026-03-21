import { NextRequest, NextResponse } from 'next/server';
import { getPrimeToken } from '@/lib/prime-auth';

export const runtime = 'nodejs';

// ── #5 FIX: Enforce a PDF size ceiling ────────────────────────────────────────
// Base64 inflates size by ~33%, so 30 MB base64 ≈ ~22 MB decoded PDF
const MAX_PDF_BASE64_CHARS = 30 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PDF_BASE64_CHARS) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    const { jobUuid, pdfBase64, jobNumber } = await req.json();

    if (!jobUuid || !pdfBase64) {
      return NextResponse.json({ error: 'jobUuid and pdfBase64 are required' }, { status: 400 });
    }

    // ── #5 FIX: Validate pdfBase64 length ─────────────────────────────────────
    if (typeof pdfBase64 !== 'string' || pdfBase64.length > MAX_PDF_BASE64_CHARS) {
      return NextResponse.json({ error: 'PDF data too large' }, { status: 413 });
    }

    const token = await getPrimeToken();
    const baseUrl = process.env.PRIME_BASE_URL!;

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('objectId', jobUuid);
    form.append('objectType', 'Job');
    form.append('attachmentTypeId', '2543687b-9846-47f8-8978-b347c8786922');
    form.append('fileName', `${jobNumber || 'Job'} Assessment Report.pdf`);
    form.append('mimeType', 'application/pdf');
    form.append('file', pdfBuffer, {
      filename: `${jobNumber || 'Job'} Assessment Report.pdf`,
      contentType: 'application/pdf',
    });

    const formBuffer = form.getBuffer();
    const formHeaders = form.getHeaders() as Record<string, string>;

    const res = await fetch(`${baseUrl}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.api.v2+json',
        ...formHeaders,
      },
      body: formBuffer as unknown as BodyInit,
    });

    if (!res.ok) {
      // ── #7 FIX: Log internally, return generic error to client ────────────
      const text = await res.text();
      console.error('[upload-to-prime] Prime upload failed:', res.status, text);
      return NextResponse.json({ error: 'Upload to Prime failed' }, { status: 500 });
    }

    const data = await res.json();
    const attachmentId = data?.data?.id || data?.id || 'unknown';

    return NextResponse.json({ attachmentId, success: true });
  } catch (err: unknown) {
    console.error('[upload-to-prime] Error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
