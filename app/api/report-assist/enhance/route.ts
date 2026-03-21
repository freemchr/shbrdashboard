import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

// ── #5 FIX: Input size limits ─────────────────────────────────────────────────
const MAX_TEXT_LENGTH    = 20_000; // characters
const MAX_CONTEXT_LENGTH = 500;    // per context field

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { section, currentText, jobContext } = await req.json();

    if (!currentText || currentText.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided to enhance' }, { status: 400 });
    }

    // ── #5 FIX: Reject oversized text before sending to OpenAI ────────────────
    if (currentText.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text too long. Maximum ${MAX_TEXT_LENGTH.toLocaleString()} characters.` },
        { status: 400 }
      );
    }

    // Truncate context fields to prevent prompt injection via oversized context
    const safeTrim = (s: unknown) =>
      typeof s === 'string' ? s.slice(0, MAX_CONTEXT_LENGTH) : String(s ?? 'N/A').slice(0, MAX_CONTEXT_LENGTH);

    const contextSummary = jobContext
      ? `Job Context:
- Job Number: ${safeTrim(jobContext.jobNumber)}
- Insurer: ${safeTrim(jobContext.insurer)}
- Address: ${safeTrim(jobContext.address)}
- Event Type: ${safeTrim(jobContext.eventType)}
- Date of Loss: ${safeTrim(jobContext.incidentDate)}
- Claim Number: ${safeTrim(jobContext.claimNumber)}`
      : '';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a professional insurance building assessor writing formal reports for an Australian insurance builder (SHBR Group). 
Enhance the provided text to be formal, precise, complete, and professional. 
Fix grammar, spelling, capitalisation. 
Expand terse notes into proper professional paragraphs. 
Do not invent facts not present in the original. 
Use third person, past tense for observations. 
Section being enhanced: "${typeof section === 'string' ? section.slice(0, 100) : 'General'}"
${contextSummary}
Return JSON: { "enhanced": string, "changes": string[] }`,
        },
        {
          role: 'user',
          content: currentText,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    return NextResponse.json({
      enhanced: parsed.enhanced || currentText,
      changes: parsed.changes || [],
    });
  } catch (err: unknown) {
    console.error('[enhance] Error:', err);
    // ── #7 FIX: Generic error to client ─────────────────────────────────────
    return NextResponse.json({ error: 'Enhancement failed' }, { status: 500 });
  }
}
