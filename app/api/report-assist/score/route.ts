import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a senior quality assurance officer for SHBR Group, an Australian insurance builder.
Review this assessment report and score it against the 11 criteria.
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
11. Can't Warrant — If report uses "can't warrant", "cannot warrant", "unable to warrant", or "not able to warrant", is there a full explanation of WHY repairs cannot be warranted AND evidence that alternatives were explored? Simply stating "can't warrant" without justification is a critical failure.

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

// Phrases that trigger the "Can't Warrant" flag
const CANT_WARRANT_PHRASES = [
  "can't warrant",
  "cannot warrant",
  "unable to warrant",
  "not able to warrant",
  "cant warrant",
];

// Phrases indicating adequate explanation (reduces false positives)
const ADEQUATE_EXPLANATION_PHRASES = [
  "because",
  "due to",
  "as a result",
  "given that",
  "alternative",
  "replacement",
  "recommend replacement",
  "beyond repair",
  "structurally unsound",
  "safety risk",
  "building code",
  "australian standard",
];

function detectCantWarrant(text: string): { detected: boolean; hasAdequateExplanation: boolean } {
  const lower = text.toLowerCase();
  const detected = CANT_WARRANT_PHRASES.some(p => lower.includes(p));
  if (!detected) return { detected: false, hasAdequateExplanation: false };

  // Check if explanation is nearby (within 500 chars of the phrase)
  let hasAdequateExplanation = false;
  for (const phrase of CANT_WARRANT_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx === -1) continue;
    const context = lower.substring(Math.max(0, idx - 100), Math.min(lower.length, idx + 500));
    if (ADEQUATE_EXPLANATION_PHRASES.some(ep => context.includes(ep))) {
      hasAdequateExplanation = true;
      break;
    }
  }

  return { detected, hasAdequateExplanation };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportText } = body as { reportText: string };

    if (!reportText || reportText.trim().length < 20) {
      return NextResponse.json({ error: 'reportText is required' }, { status: 400 });
    }

    // Pre-check for "Can't Warrant" before sending to AI
    const cantWarrantCheck = detectCantWarrant(reportText);

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
      cantWarrantFlag?: boolean;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    // Apply "Can't Warrant" override — regardless of AI assessment
    if (cantWarrantCheck.detected && !cantWarrantCheck.hasAdequateExplanation) {
      parsed.cantWarrantFlag = true;

      // Deduct 25 points and clamp to 0
      parsed.score = Math.max(0, parsed.score - 25);

      // Recalculate grade after deduction
      if (parsed.score >= 90) parsed.grade = 'A';
      else if (parsed.score >= 75) parsed.grade = 'B';
      else if (parsed.score >= 60) parsed.grade = 'C';
      else if (parsed.score >= 45) parsed.grade = 'D';
      else parsed.grade = 'F';

      // Add the critical flag message to fixes (prepend — highest priority)
      const flagMessage = "Report contains 'Can't Warrant Repairs' — Suncorp requires a full explanation of why repairs cannot be warranted AND evidence that alternatives were explored. This will be rejected without adequate justification.";
      parsed.fixes = [flagMessage, ...parsed.fixes.filter(f => !f.toLowerCase().includes("can't warrant"))];

      // Ensure criterion 11 is marked as failed
      const cantWarrantCriterion = parsed.criteria?.find(
        c => c.name?.toLowerCase().includes("warrant") || c.name?.includes("11")
      );
      if (cantWarrantCriterion) {
        cantWarrantCriterion.passed = false;
        cantWarrantCriterion.comment = "Report uses 'can't warrant' language without a full explanation of why and evidence alternatives were explored.";
      } else {
        parsed.criteria = [...(parsed.criteria ?? []), {
          name: "Can't Warrant Explanation",
          passed: false,
          comment: "Report uses 'can't warrant' language without a full explanation of why and evidence alternatives were explored.",
        }];
      }
    } else if (cantWarrantCheck.detected && cantWarrantCheck.hasAdequateExplanation) {
      // Detected but with adequate explanation — flag but don't penalise
      parsed.cantWarrantFlag = false;
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error('Score API error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
