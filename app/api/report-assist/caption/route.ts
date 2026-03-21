import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 30;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert insurance building assessor for SHBR Group Australia. 
Analyse this photo taken during a building insurance assessment and write a single professional caption.
The caption should:
- Describe exactly what is visible in the photo (damage type, location, materials affected)
- Be specific and factual — no vague terms like "damage shown" or "photo taken"
- Use past tense and third person where appropriate
- Be 1-2 sentences, max 30 words
- Be suitable for inclusion in a formal insurance assessment report

Examples of good captions:
- "Ceiling collapse in main bedroom consistent with water ingress from above. Visible staining and mould growth present across approximately 4m²."
- "Storm damage to terracotta roof tiles on western elevation. Multiple tiles cracked and displaced, exposing underlying sarking."
- "Burst flexi hose beneath kitchen sink. Water damage to particleboard cabinet base and adjacent flooring."

Return JSON: { "caption": "..." }`;

const MAX_BASE64_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType } = body as {
      imageBase64: string;
      mimeType: string;
      jobContext?: object;
    };

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
    }

    // Strip data URL prefix if present
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    if (base64Data.length > MAX_BASE64_SIZE) {
      return NextResponse.json({ error: 'Image exceeds 5MB limit' }, { status: 400 });
    }

    const resolvedMime = mimeType || 'image/jpeg';
    const dataUrl = `data:${resolvedMime};base64,${base64Data}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
            {
              type: 'text',
              text: 'Write a professional caption for this photo.',
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let parsed: { caption: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    if (!parsed.caption) {
      return NextResponse.json({ error: 'AI did not return a caption' }, { status: 500 });
    }

    return NextResponse.json({ caption: parsed.caption });
  } catch (err: unknown) {
    console.error('Caption API error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
