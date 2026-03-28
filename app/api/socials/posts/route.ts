import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocialPost {
  id: string;
  brand: 'SHBR' | 'APP';
  platform: 'linkedin';
  date: string;        // YYYY-MM-DD
  title: string;
  body: string;
  hashtags: string;
  imagePrompt?: string;
  status: 'draft' | 'posted';
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
  weekOf: string;      // YYYY-MM-DD — Monday of the week
}

export interface SocialsData {
  posts: SocialPost[];
  updatedAt: string;
}

// ─── Cache key & Blob filename ────────────────────────────────────────────────

const CACHE_KEY = 'socials-posts-v1';
const BLOB_FILENAME = 'shbr-cache/socials_posts_v1.json';
const TTL = 24 * 60 * 60 * 1000; // 24h

// ─── Seed data ────────────────────────────────────────────────────────────────

function getSeedData(): SocialsData {
  const now = new Date().toISOString();
  const posts: SocialPost[] = [
    // ── SHBR posts ─────────────────────────────────────────────────────────
    {
      id: 'seed-shbr-1',
      brand: 'SHBR',
      platform: 'linkedin',
      date: '2026-03-23',
      weekOf: '2026-03-23',
      title: 'The 2am Call',
      body: `It was 2am when the phone rang.

An elderly homeowner in Parramatta. Water pouring through the ceiling. A flexi hose under the bathroom vanity had failed — quietly, while everyone slept.

By the time we arrived, three rooms were affected. Ceilings buckled. Flooring saturated. Personal belongings ruined.

She'd lived in that home for 40 years.

This is why we do what we do. Not the paperwork, not the KPIs — the moment you walk in and someone looks at you like you're the answer to a very long night.

We had the property dry and secure within 72 hours. The restoration took three weeks. She sent us a card.

If you're an insurer, loss adjuster, or strata manager who wants a team that treats every claim like it matters — that's us.

📍 Greater Sydney | Insurance Restoration | Water Damage`,
      hashtags: '#WaterDamage #InsuranceRestoration #SHBR #BuildersYouCanTrust #PropertyRestoration',
      imagePrompt: 'Warm, empathetic photo — restoration team member speaking with an elderly homeowner in a damaged living room, natural light, not staged',
      status: 'posted',
      postedAt: '2026-03-23T09:00:00.000Z',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-shbr-2',
      brand: 'SHBR',
      platform: 'linkedin',
      date: '2026-03-25',
      weekOf: '2026-03-23',
      title: 'Why Autumn Is Peak Flexi Hose Season',
      body: `Most people think flexi hose failures happen in summer.

They don't. They happen in autumn.

Here's why: Summer heat expands the metal braiding. Autumn cooling contracts it. Repeat that cycle enough times and the outer sheath develops micro-fractures.

Add a home that's been closed up all summer — higher humidity, slightly elevated water pressure — and you have the conditions for a failure.

The average flexi hose lasts 8–10 years. Most homeowners have no idea how old theirs are. Many were installed with the tap and never thought about again.

The fix costs $80. The average water damage claim it prevents costs $45,000.

If you manage strata, own an investment property, or work in insurance — this is worth sharing.

When did you last check yours?`,
      hashtags: '#FlexiHose #WaterDamage #PropertyMaintenance #Strata #InsuranceTips #NoBurst',
      imagePrompt: 'Close-up of a corroded or damaged flexi hose under a bathroom vanity, showing visible wear — clear, well-lit, slightly dramatic',
      status: 'posted',
      postedAt: '2026-03-25T09:00:00.000Z',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-shbr-3',
      brand: 'SHBR',
      platform: 'linkedin',
      date: '2026-03-27',
      weekOf: '2026-03-23',
      title: 'The End-of-Summer Damage Wave',
      body: `Every year, without fail, March brings a wave.

Not a dramatic CAT event. Not a headline flood. Just the quiet accumulation of a long, hot, wet summer settling into the building stock.

Roof membranes stressed by heat expansion. Gutters full of summer debris. Seals around windows and skylights that have been slowly failing since January.

The first autumn rain finds every one of them.

We're seeing it now — storm ingress claims, ceiling collapses from pooled water, internal moisture damage that started months ago and nobody noticed.

The properties that fare best are the ones that were checked before this started.

If you're in insurance, strata, or property management and you want a partner who understands the seasonal rhythm of the Australian building stock — we'd like to talk.

🔗 shbr.com.au`,
      hashtags: '#InsuranceRestoration #StormDamage #PropertyManagement #SHBR #WaterDamage #Strata',
      imagePrompt: 'Wide shot of a residential street after autumn rain — one property visibly affected, gutters overflowing, subtle not dramatic',
      status: 'posted',
      postedAt: '2026-03-27T09:00:00.000Z',
      createdAt: now,
      updatedAt: now,
    },
    // ── APP posts ───────────────────────────────────────────────────────────
    {
      id: 'seed-app-1',
      brand: 'APP',
      platform: 'linkedin',
      date: '2026-03-23',
      weekOf: '2026-03-23',
      title: 'Did You Know? The Flexi Hose Failure Stat',
      body: `Did you know flexi hoses are involved in over 20% of all Australian home water damage insurance claims?

That's not a small number.

The average claim costs over $40,000. The replacement hose costs $80.

The problem isn't awareness — it's that most homeowners don't know how old their hoses are, and most installers replace them only when they fail.

No Burst Flexi from Australian Plumbing Products was designed specifically to address this. Tested to 10x working pressure. Endorsed by Australia's leading insurance restorers.

The $80 fix that prevents the $40,000 claim.

📍 Australian made. Insurer endorsed. Built to last.`,
      hashtags: '#FlexiHose #NoBurst #WaterDamage #PlumbingProducts #AustralianMade #InsuranceRestoration',
      imagePrompt: 'Clean product shot of No Burst Flexi hose against white background, with a subtle split-screen showing a damaged property claim on the right',
      status: 'posted',
      postedAt: '2026-03-23T09:00:00.000Z',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-app-2',
      brand: 'APP',
      platform: 'linkedin',
      date: '2026-03-25',
      weekOf: '2026-03-23',
      title: 'Why Plumbers Choose No Burst Flexi',
      body: `We hear it all the time from plumbers: 'I can't afford a callback.'

Neither can your clients.

No Burst Flexi is built for the trades professional who takes their reputation seriously. Because when a hose fails 18 months after installation, it's not the manufacturer who gets the call — it's you.

What sets No Burst apart:
✅ Tested to 10x working pressure
✅ UV and corrosion resistant outer sheath
✅ Endorsed by Australia's leading insurance restoration companies
✅ Backed by Australian Plumbing Products' warranty and support

We're not the cheapest option. We're the one that doesn't let you down.

Used by the trades. Trusted by insurers. Made here.

🔗 appaust.com.au`,
      hashtags: '#NoBurst #PlumbingProducts #Plumber #TradesQuality #FlexiHose #AustralianMade',
      imagePrompt: 'Plumber installing No Burst Flexi under a kitchen sink — professional, confident, branded uniform, natural light',
      status: 'posted',
      postedAt: '2026-03-25T09:00:00.000Z',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'seed-app-3',
      brand: 'APP',
      platform: 'linkedin',
      date: '2026-03-26',
      weekOf: '2026-03-23',
      title: 'Australian Plumbing Products — Our Story',
      body: `Australian Plumbing Products started with a simple observation.

The most common cause of home water damage in Australia is a product that costs less than $100 and takes five minutes to replace.

Flexi hoses — the braided connections under your sinks, toilets, and vanities — were failing. And they were failing in ways that were entirely preventable.

So we built something better.

No Burst Flexi is the result of years of engineering, testing, and real-world validation with Australia's leading insurance restoration companies. It's been through conditions that standard hoses don't survive.

We're a proudly Australian business. Our products are designed here, tested here, and built to handle the Australian climate — the UV, the heat cycles, the water pressure variations that come with our conditions.

If you're a plumber, property manager, insurer, or strata professional who's tired of preventable water damage — we'd love to hear from you.

🔗 appaust.com.au | info@appaust.com.au`,
      hashtags: '#AustralianPlumbingProducts #NoBurst #AustralianMade #FlexiHose #WaterDamage #Plumbing',
      imagePrompt: 'Founder or team shot in a workshop or warehouse setting — authentic, Australian, behind-the-scenes feel',
      status: 'posted',
      postedAt: '2026-03-26T09:00:00.000Z',
      createdAt: now,
      updatedAt: now,
    },
  ];

  return { posts, updatedAt: now };
}

// ─── Persist helper — writes both to cache layer and directly to Blob ─────────

async function persistData(data: SocialsData): Promise<void> {
  await setCached(CACHE_KEY, data, TTL);
  // Also write directly to Blob so data persists beyond cache TTL
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

// ─── Load helper — tries cache first, then direct Blob read ──────────────────

async function loadData(): Promise<SocialsData> {
  // 1. Try cache layer
  const cached = await getCached<SocialsData>(CACHE_KEY);
  if (cached) return cached;

  // 2. Try reading the direct blob URL (bypasses cache wrapper TTL)
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
        // Could be wrapped in cache meta — handle both
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unwrapped = (raw as any).data ? (raw as any).data as SocialsData : raw;
        if (unwrapped.posts) return unwrapped;
      }
    }
  } catch { /* fall through to seed */ }

  return getSeedData();
}

// ─── GET /api/socials/posts ───────────────────────────────────────────────────

export async function GET() {
  try {
    const data = await loadData();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST /api/socials/posts ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<SocialPost>;
    const now = new Date().toISOString();

    const newPost: SocialPost = {
      id: crypto.randomUUID(),
      brand: body.brand ?? 'SHBR',
      platform: 'linkedin',
      date: body.date ?? now.slice(0, 10),
      title: body.title ?? '',
      body: body.body ?? '',
      hashtags: body.hashtags ?? '',
      imagePrompt: body.imagePrompt,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      weekOf: body.weekOf ?? body.date ?? now.slice(0, 10),
    };

    const data = await loadData();
    data.posts.push(newPost);
    data.updatedAt = now;
    await persistData(data);

    return NextResponse.json(newPost, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
