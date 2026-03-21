/**
 * POST /api/report-assist/validate-scope
 * Uses GPT-4o to compare a report narrative against Prime scope line items.
 */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a senior estimator and QA officer for SHBR Group, an Australian insurance builder.
Compare the assessment report narrative against the scope line items provided.

Check for:
1. MISSING IN SCOPE: Damage described in the report that has no corresponding line item in the scope
2. MISSING IN REPORT: Line items in the scope that are not mentioned or justified in the report narrative
3. PC SUMS: Flag any line items described as "PC Sum", "Prime Cost", "Provisional" or similar without clear justification
4. POOR DESCRIPTIONS: Line items with vague descriptions like "Miscellaneous", "Allow for", "Sundries" without context
5. CONSISTENCY: Does the overall scope total seem consistent with the damage described?

Be specific — name the actual damage type or line item when flagging issues.
Australian insurance builders must justify every line item in their report narrative.

Return JSON with this exact schema:
{
  "score": <number 0-100>,
  "grade": <"A"|"B"|"C"|"D"|"F">,
  "summary": <string>,
  "issues": [
    {
      "type": <"missing_in_scope"|"missing_in_report"|"pc_sum_flag"|"rate_concern"|"description_poor">,
      "severity": <"critical"|"warning"|"info">,
      "description": <string>,
      "lineItem": <string or null>
    }
  ],
  "suggestions": [<string>]
}`;

interface LineItemInput {
  description: string;
  total: number;
  category: string;
}

interface JobContext {
  jobNumber: string;
  insurer: string;
  eventType: string;
  authorisedTotal: number;
}

interface ReportSections {
  damageAssessment?: string;
  circumstancesOfLoss?: string;
  causeOfDamage?: string;
  conclusion?: string;
  scopeRecommendation?: string;
  [key: string]: string | undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      reportSections: ReportSections;
      lineItems: LineItemInput[];
      jobContext: JobContext;
    };

    const { reportSections, lineItems, jobContext } = body;

    if (!reportSections || !lineItems) {
      return NextResponse.json({ error: 'reportSections and lineItems are required' }, { status: 400 });
    }

    // Format the report narrative
    const narrativeText = Object.entries(reportSections)
      .filter(([, v]) => v && v.trim())
      .map(([k, v]) => `## ${k}\n${v}`)
      .join('\n\n');

    if (!narrativeText.trim()) {
      return NextResponse.json({ error: 'Report sections are empty' }, { status: 400 });
    }

    // Format the scope line items
    const scopeText = lineItems.length === 0
      ? 'No line items in scope.'
      : lineItems
          .map((li, i) => {
            const parts = [`${i + 1}. ${li.description || '(no description)'}`];
            if (li.category) parts.push(`[${li.category}]`);
            if (li.total) parts.push(`$${li.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            return parts.join(' — ');
          })
          .join('\n');

    const scopeTotal = lineItems.reduce((s, li) => s + (li.total || 0), 0);

    const userMessage = `
JOB CONTEXT:
- Job Number: ${jobContext?.jobNumber || 'Unknown'}
- Insurer: ${jobContext?.insurer || 'Unknown'}
- Event Type: ${jobContext?.eventType || 'Unknown'}
- Authorised Total: ${jobContext?.authorisedTotal ? `$${jobContext.authorisedTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : 'Not specified'}

SCOPE LINE ITEMS (${lineItems.length} items, Total: $${scopeTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}):
${scopeText}

REPORT NARRATIVE:
${narrativeText}

Please validate the report narrative against the scope line items and return JSON.`.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 2500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let parsed: {
      score: number;
      grade: string;
      summary: string;
      issues: Array<{
        type: string;
        severity: string;
        description: string;
        lineItem?: string | null;
      }>;
      suggestions: string[];
    };

    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error('Validate-scope API error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
