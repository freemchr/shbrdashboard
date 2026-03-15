import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobNumber, reportData } = body;

    if (!jobNumber) {
      return NextResponse.json({ error: 'jobNumber is required' }, { status: 400 });
    }

    const blob = await put(
      `reports/${jobNumber}/draft.json`,
      JSON.stringify(reportData, null, 2),
      {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
      }
    );

    return NextResponse.json({ blobUrl: blob.url, success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
