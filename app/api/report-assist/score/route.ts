import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a senior quality assurance officer for SHBR Group, an Australian insurance builder.
Review this assessment report and score it against the 10 criteria.
Be strict but fair. Australian insurance reports must meet a high professional standard.

Criteria:
1. Photo captions — descriptive and specific (not "Photo 1")
2. Cause of damage — clearly and specifically stated
3. Circumstances of loss — date, event, how damage occurred
4. Damage assessment — specific location, extent, materials
5. Consistency — damage description matches likely scope
6. Make-safe — addressed if significant damage present
7. Professional language — formal, past tense, third person
8. PDS/standards alignment — references standards where appropriate
9. Measurements — dimensions/areas/quantities provided
10. Conclusion — clear recommendation present

Return JSON:
{
  "grade": "A" | "B" | "C" | "D" | "F",
  "score": number (0-100),
  "criteria": [
    { "name": string, "passed": boolean, "comment": string }
  ],
  "fixes": string[],
  "summary": string
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportText } = body as { reportText: string };

    if (!reportText || reportText.trim().length < 20) {
      return NextResponse.json({ error: 'reportText is required' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Please score the following assessment report:\n\n${reportText}` },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let parsed: {
      grade: string;
      score: number;
      criteria: Array<{ name: string; passed: boolean; comment: string }>;
      fixes: string[];
      summary: string;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error('Score API error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
