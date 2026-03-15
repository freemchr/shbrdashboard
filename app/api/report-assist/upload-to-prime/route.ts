import { NextRequest, NextResponse } from 'next/server';
import { getPrimeToken } from '@/lib/prime-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { jobUuid, pdfBase64, jobNumber } = await req.json();

    if (!jobUuid || !pdfBase64) {
      return NextResponse.json({ error: 'jobUuid and pdfBase64 are required' }, { status: 400 });
    }

    const token = await getPrimeToken();
    const baseUrl = process.env.PRIME_BASE_URL!;

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Build multipart form data
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
      const text = await res.text();
      return NextResponse.json({ error: `Prime upload failed: ${res.status} ${text}` }, { status: 500 });
    }

    const data = await res.json();
    const attachmentId = data?.data?.id || data?.id || 'unknown';

    return NextResponse.json({ attachmentId, success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
