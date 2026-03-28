import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getCached, setCached } from '@/lib/blob-cache';
import type { SocialPost, SocialsData } from '@/app/api/socials/posts/route';

export const runtime = 'nodejs';

const CACHE_KEY = 'socials-posts-v1';
const BLOB_FILENAME = 'shbr-cache/socials_posts_v1.json';
const TTL = 24 * 60 * 60 * 1000;

async function loadData(): Promise<SocialsData> {
  const cached = await getCached<SocialsData>(CACHE_KEY);
  if (cached) return cached;

  try {
    const base = (process.env.BLOB_CACHE_BASE_URL || '').replace(/\/$/, '');
    if (base) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const res = await fetch(`${base}/${BLOB_FILENAME}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const raw: SocialsData = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unwrapped = (raw as any).data ? (raw as any).data as SocialsData : raw;
        if (unwrapped.posts) return unwrapped;
      }
    }
  } catch { /* fall through */ }

  return { posts: [], updatedAt: new Date().toISOString() };
}

async function persistData(data: SocialsData): Promise<void> {
  await setCached(CACHE_KEY, data, TTL);
  try {
    await put(BLOB_FILENAME, JSON.stringify(data), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.warn('[socials] Direct blob write failed:', e);
  }
}

// ─── PATCH /api/socials/posts/[id] ───────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await req.json() as Partial<SocialPost>;
    const now = new Date().toISOString();

    const data = await loadData();
    const idx = data.posts.findIndex(p => p.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    data.posts[idx] = {
      ...data.posts[idx],
      ...updates,
      id,                        // never overwrite id
      updatedAt: now,
    };
    data.updatedAt = now;
    await persistData(data);

    return NextResponse.json(data.posts[idx]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE /api/socials/posts/[id] ──────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await loadData();
    const before = data.posts.length;
    data.posts = data.posts.filter(p => p.id !== id);

    if (data.posts.length === before) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    data.updatedAt = new Date().toISOString();
    await persistData(data);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
