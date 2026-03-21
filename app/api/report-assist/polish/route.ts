import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a professional insurance building assessor writing formal reports for SHBR Group Australia.
You are polishing an existing assessment report to make it professional, clear and complete for submission to Australian insurance companies (Suncorp, Youi, Hollard, QBE).

Rules:
- Fix all grammar, spelling, punctuation and capitalisation
- Expand terse notes into professional full sentences and paragraphs
- Use formal third-person language throughout ("The inspector observed...", "Damage was noted...")
- Use past tense for all observations
- Do not add or invent any facts not present in the original
- Maintain all original factual content (dates, addresses, measurements, costs, claim numbers)
- Where photo captions are vague (e.g. "Photo 1", "Image taken"), rewrite them descriptively based on surrounding context
- Where cause of damage is unclear, flag it with [REQUIRES CLARIFICATION] rather than inventing
- Where measurements are missing but damage is described, add [MEASUREMENT REQUIRED] as a placeholder
- Identify report sections and preserve their structure
- Ensure circumstance of loss, cause of damage, damage assessment, and conclusion are all clearly present

Return a JSON response with:
{
  "sections": [
    { "title": "Section Name or 'General'", "original": "...", "polished": "..." }
  ],
  "summary": "Brief summary of key changes made",
  "pageCount": number,
  "wordCount": number
}`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });
    }

    // Extract text from PDF using pdf-parse
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Dynamic import to avoid issues with Next.js bundler
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    const extractedText = pdfData.text?.trim();

    if (!extractedText || extractedText.length < 10) {
      return NextResponse.json({ error: 'Could not extract text from PDF. The file may be scanned or image-based.' }, { status: 400 });
    }

    // Call OpenAI to polish the text
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Please polish the following report:\n\n${extractedText}` },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let parsed: { sections: Array<{ title: string; original: string; polished: string }>; summary: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON response' }, { status: 500 });
    }

    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      // Fallback: treat entire text as one section
      parsed = {
        sections: [{ title: 'General', original: extractedText, polished: content }],
        summary: 'Report polished',
      };
    }

    return NextResponse.json({
      sections: parsed.sections,
      summary: parsed.summary || 'Report polished successfully',
      pageCount: pdfData.numpages,
      wordCount: extractedText.split(/\s+/).length,
    });
  } catch (err: unknown) {
    console.error('Polish API error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
