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

    const { blobs } = await list({ prefix: `reports/${jobNumber}/draft.json` });

    if (blobs.length === 0) {
      return NextResponse.json({ reportData: null });
    }

    // Get the latest draft
    const draftBlob = blobs[0];
    const res = await fetch(draftBlob.url);
    if (!res.ok) {
      return NextResponse.json({ reportData: null });
    }

    const reportData = await res.json();
    return NextResponse.json({ reportData, blobUrl: draftBlob.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
