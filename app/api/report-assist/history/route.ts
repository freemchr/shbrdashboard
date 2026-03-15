import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobNumber = searchParams.get('jobNumber');

    if (!jobNumber) {
      return NextResponse.json({ error: 'jobNumber is required' }, { status: 400 });
    }

    const { blobs } = await list({ prefix: `reports/${jobNumber}/` });

    // Return only PDF files, sorted newest first
    const pdfUrls = blobs
      .filter(b => b.pathname.endsWith('.pdf'))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map(b => b.url);

    return NextResponse.json({ urls: pdfUrls });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
