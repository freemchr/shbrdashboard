import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';

const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY!;
const AGENTMAIL_INBOX   = process.env.AGENTMAIL_INBOX!;
const CC_EMAIL          = process.env.ADMIN_EMAIL || 'chris.freeman@techgurus.com.au';

function escHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function field(label: string, value: string | undefined) {
  if (!value?.trim()) return '';
  return `
    <tr>
      <td style="padding:6px 14px 6px 0; vertical-align:top; white-space:nowrap; color:#555; font-size:13px; font-weight:600; width:200px;">${escHtml(label)}</td>
      <td style="padding:6px 0; color:#111; font-size:13px;">${escHtml(value)}</td>
    </tr>`;
}

function section(title: string) {
  return `
    <tr>
      <td colspan="2" style="padding:16px 0 6px; font-size:11px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.08em; border-top:1px solid #eee;">${escHtml(title)}</td>
    </tr>`;
}

function buildHtml(data: Record<string, string>, submitterName: string, submitterEmail: string) {
  const typeEmoji: Record<string, string> = { bug: '🐛', feature: '✨', automation: '🤖' };
  const typeLabel: Record<string, string> = { bug: 'Bug / Issue', feature: 'Feature Request', automation: 'Automation / Report Request' };
  const emoji  = typeEmoji[data.type]  ?? '📋';
  const label  = typeLabel[data.type]  ?? data.type;
  const now    = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });

  // Friendly label for trigger type
  const triggerTypeLabel: Record<string, string> = {
    schedule: 'On a schedule',
    event:    'Event-based',
    manual:   'On demand (manual)',
  };

  const bugFields = data.type === 'bug' ? `
    ${section('Bug Report')}
    ${field('Section / Page',     data.pageUrl)}
    ${field("What's not working", data.bugDescription)}
    ${field('What should happen', data.bugExpected)}
    ${field('Trying to achieve',  data.bugGoal)}
    ${field('How often',          data.bugFrequency)}
    ${field('Severity',           data.bugSeverity)}
    ${field('Extra context',      data.bugNotes)}
  ` : '';

  const featureFields = data.type === 'feature' ? `
    ${section('Feature Request')}
    ${field('Summary',            data.featureSummary)}
    ${field('Trying to achieve',  data.featureGoal)}
    ${field('Where',              data.featureLocation)}
    ${field('Visual / layout',    data.featureVisual)}
    ${field('Data needed',        data.featureData)}
    ${field('Who uses it',        data.featureWho)}
    ${field('Priority',           data.featurePriority)}
  ` : '';

  const triggerDisplay = data.autoTriggerType
    ? `${triggerTypeLabel[data.autoTriggerType] ?? data.autoTriggerType}${data.autoTriggerDetail ? ` — ${data.autoTriggerDetail}` : ''}`
    : data.autoTriggerDetail || '';

  const autoFields = data.type === 'automation' ? `
    ${section('Automation / Report Request')}
    ${field('What to automate',   data.autoDescription)}
    ${field('Trigger',            triggerDisplay)}
    ${field('Data source',        data.autoDataSource)}
    ${field('Output',             data.autoOutput)}
    ${field('Recipients',         data.autoRecipients)}
    ${field('Frequency',          data.autoFrequency)}
    ${field('Format / visual',    data.autoFormat)}
    ${field('Additional notes',   data.autoNotes)}
  ` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif; color:#222; background:#fff; margin:0; padding:20px;">
  <h2 style="color:#1a3a6b; margin-bottom:4px;">${emoji} ${label}</h2>
  <p style="color:#666; font-size:13px; margin-top:0;">Submitted via SHBR Insights · ${now} AEST</p>
  <hr style="border:none; border-top:1px solid #ddd; margin:16px 0;">

  <table style="border-collapse:collapse; width:100%; max-width:640px;">
    ${field('Submitted by', `${submitterName} (${submitterEmail})`)}
    ${bugFields}
    ${featureFields}
    ${autoFields}
  </table>

  <hr style="border:none; border-top:1px solid #ddd; margin:24px 0 12px;">
  <p style="font-size:11px; color:#999;">SHBR Insights Support · Internal use only</p>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const submitterName  = session.userName  || 'Unknown User';
    const submitterEmail = session.userEmail || 'unknown@shbr.com.au';

    const data: Record<string, string> = await req.json();

    if (!data.type || !['bug', 'feature', 'automation'].includes(data.type)) {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }

    const typeLabel: Record<string, string> = {
      bug:        '🐛 Bug Report',
      feature:    '✨ Feature Request',
      automation: '🤖 Automation Request',
    };
    const subject = `[SHBR Insights] ${typeLabel[data.type]} — from ${submitterName}`;
    const html    = buildHtml(data, submitterName, submitterEmail);

    const payload = {
      to:      [AGENTMAIL_INBOX],
      cc:      [CC_EMAIL],
      subject,
      html,
    };

    const res = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(AGENTMAIL_INBOX)}/messages/send`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${AGENTMAIL_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      console.error('AgentMail error:', txt);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Support submit error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
