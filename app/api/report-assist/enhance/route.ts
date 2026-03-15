import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { section, currentText, jobContext } = await req.json();

    if (!currentText || currentText.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided to enhance' }, { status: 400 });
    }

    const contextSummary = jobContext
      ? `Job Context:
- Job Number: ${jobContext.jobNumber || 'N/A'}
- Insurer: ${jobContext.insurer || 'N/A'}
- Address: ${jobContext.address || 'N/A'}
- Event Type: ${jobContext.eventType || 'N/A'}
- Date of Loss: ${jobContext.incidentDate || 'N/A'}
- Claim Number: ${jobContext.claimNumber || 'N/A'}`
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
Section being enhanced: "${section}"
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
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
