import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Colours ──────────────────────────────────────────────────────────────────
const C_RED    = rgb(0.831, 0.125, 0.153);
const C_DGRAY  = rgb(0.2,   0.2,   0.2);
const C_LGRAY  = rgb(0.933, 0.933, 0.933);
const C_BORDER = rgb(0.867, 0.867, 0.867);
const C_LINE   = rgb(0.8,   0.8,   0.8);
const C_BLACK  = rgb(0,     0,     0);
const C_MID    = rgb(0.5,   0.5,   0.5);
const C_WHITE  = rgb(1,     1,     1);

// ─── Page geometry ─────────────────────────────────────────────────────────────
const PW = 595;
const PH = 842;
const ML = 50;
const MR = 50;
const CW = PW - ML - MR;
const CONTENT_TOP = PH - 140;
const FOOTER_TOP  = 82;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sw(font: PDFFont, text: string, size: number): number {
  try { return font.widthOfTextAtSize(text || '', size); }
  catch { return (text || '').length * size * 0.5; }
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const paras = text.replace(/\r\n/g, '\n').split('\n');
  for (const para of paras) {
    if (!para.trim()) { lines.push(''); continue; }
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (sw(font, test, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface PageImages {
  shbrLogo: PDFImage;
  mbLogo:   PDFImage;
  cm3Logo:  PDFImage;
}

async function loadImages(pdfDoc: PDFDocument): Promise<PageImages> {
  const pubDir = path.join(process.cwd(), 'public');
  const shbrBytes = fs.readFileSync(path.join(pubDir, 'shbr-logo-pdf.jpg'));
  const mbBytes   = fs.readFileSync(path.join(pubDir, 'master-builders-logo.jpg'));
  const cm3Bytes  = fs.readFileSync(path.join(pubDir, 'cm3-logo.jpg'));
  return {
    shbrLogo: await pdfDoc.embedJpg(shbrBytes),
    mbLogo:   await pdfDoc.embedJpg(mbBytes),
    cm3Logo:  await pdfDoc.embedJpg(cm3Bytes),
  };
}

function drawHeader(page: PDFPage, imgs: PageImages, fonts: { bold: PDFFont; reg: PDFFont }) {
  const { bold } = fonts;
  const logoY = PH - 20 - 100;
  page.drawImage(imgs.shbrLogo, { x: 30, y: logoY, width: 190, height: 100 });

  const contactLines = [
    'Level 2, 24 Hickson Road',
    'MILLERS POINT NSW 2000',
    '1300 313 509',
    'claims@shbr.com.au',
  ];
  const rightX = PW - MR;
  contactLines.forEach((line, i) => {
    const lw = sw(bold, line, 9);
    page.drawText(line, { x: rightX - lw, y: PH - 40 - i * 14, size: 9, font: bold, color: C_DGRAY });
  });

  page.drawLine({
    start: { x: ML, y: PH - 130 },
    end:   { x: PW - MR, y: PH - 130 },
    thickness: 0.5,
    color: C_LINE,
  });
}

function drawFooter(page: PDFPage, imgs: PageImages, fonts: { bold: PDFFont; reg: PDFFont }, pageNum: number) {
  const { bold, reg } = fonts;
  for (const dy of [0, 2]) {
    page.drawLine({
      start: { x: ML, y: FOOTER_TOP + dy },
      end:   { x: PW - MR, y: FOOTER_TOP + dy },
      thickness: 0.5,
      color: C_LINE,
    });
  }
  page.drawImage(imgs.mbLogo, { x: ML, y: 9, width: 60, height: 55 });
  page.drawImage(imgs.cm3Logo, { x: PW - MR - 55, y: 19, width: 55, height: 35 });

  const textLeftEdge  = ML + 60 + 8;
  const textRightEdge = PW - MR - 55 - 8;
  const textW = textRightEdge - textLeftEdge;
  const textCentreX = textLeftEdge + textW / 2;

  const line1 = "AUSTRALIA'S TRUSTED INSURANCE BUILDING & RESTORATION PROVIDER";
  const line2 = 'SHBR Group Pty Ltd  |  NSW Lic 107756C  |  Qld Lic 1156078  |  ACT Lic 2014359  |  ACN 085 591 699  |  ABN 76 085 591 699';

  const l1w = sw(bold, line1, 7.5);
  page.drawText(line1, { x: textCentreX - l1w / 2, y: 47, size: 7.5, font: bold, color: C_RED });

  const line2Wrapped = wrap(line2, reg, 6.5, textW);
  line2Wrapped.forEach((l, i) => {
    const lw = sw(reg, l, 6.5);
    page.drawText(l, { x: textCentreX - lw / 2, y: 33 - i * 9, size: 6.5, font: reg, color: C_DGRAY });
  });

  const pn = `Page ${pageNum}`;
  const pnW = sw(reg, pn, 7);
  page.drawText(pn, { x: PW - MR - pnW, y: FOOTER_TOP + 4, size: 7, font: reg, color: C_MID });
}

function addPage(pdfDoc: PDFDocument, imgs: PageImages, fonts: { bold: PDFFont; reg: PDFFont }, pnRef: { n: number }) {
  pnRef.n++;
  const page = pdfDoc.addPage([PW, PH]);
  drawHeader(page, imgs, fonts);
  drawFooter(page, imgs, fonts, pnRef.n);
  return { page, y: CONTENT_TOP };
}

function textBlock(page: PDFPage, text: string, y: number, font: PDFFont, maxY: number): { y: number; overflow: string } {
  if (!text?.trim()) return { y, overflow: '' };
  const lines = wrap(text, font, 9, CW - 8);
  const lh = 13;
  for (let i = 0; i < lines.length; i++) {
    if (y - lh < maxY) {
      return { y, overflow: lines.slice(i).join('\n') };
    }
    if (lines[i]) {
      page.drawText(lines[i], { x: ML + 4, y: y - lh, size: 9, font, color: C_BLACK });
    }
    y -= lh;
  }
  return { y, overflow: '' };
}

interface PolishedSection {
  title: string;
  text: string;
}

export async function POST(req: NextRequest) {
  try {
    const { sections, summary, fileName } = await req.json() as {
      sections: PolishedSection[];
      summary: string;
      fileName: string;
    };

    const pdfDoc = await PDFDocument.create();
    const boldF  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regF   = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fonts  = { bold: boldF, reg: regF };
    const imgs   = await loadImages(pdfDoc);
    const pnRef  = { n: 0 };

    let { page, y } = addPage(pdfDoc, imgs, fonts, pnRef);
    const newPage = () => {
      const p = addPage(pdfDoc, imgs, fonts, pnRef);
      page = p.page;
      y = p.y;
    };
    const ensureSpace = (needed: number) => { if (y - needed < FOOTER_TOP + 6) newPage(); };

    // ── Banner ────────────────────────────────────────────────────────────────
    const bannerH = 35;
    page.drawRectangle({ x: ML, y: y - bannerH, width: CW, height: bannerH, color: C_LGRAY });
    const bannerTitle = 'Building Assessment Report';
    const btW = sw(boldF, bannerTitle, 16);
    page.drawText(bannerTitle, {
      x: ML + (CW - btW) / 2,
      y: y - bannerH + (bannerH - 16) / 2 + 2,
      size: 16, font: boldF, color: C_DGRAY,
    });
    y -= bannerH + 10;

    // ── AI polish notice ──────────────────────────────────────────────────────
    const noticeText = `AI Polished Report  ·  Generated ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}  ·  Source: ${fileName}`;
    const nW = sw(regF, noticeText, 8);
    page.drawText(noticeText, { x: ML + (CW - nW) / 2, y, size: 8, font: regF, color: C_MID });
    y -= 20;

    // ── Summary ───────────────────────────────────────────────────────────────
    if (summary) {
      ensureSpace(36);
      const summaryH = 28;
      page.drawRectangle({ x: ML, y: y - summaryH, width: CW, height: summaryH, color: C_LGRAY, borderColor: C_BORDER, borderWidth: 0.5 });
      page.drawText('AI Changes Summary:', { x: ML + 8, y: y - 10, size: 8, font: boldF, color: C_DGRAY });
      const summaryLines = wrap(summary, regF, 8, CW - 20);
      summaryLines.slice(0, 1).forEach(l => {
        page.drawText(l, { x: ML + 8, y: y - 21, size: 8, font: regF, color: C_DGRAY });
      });
      y -= summaryH + 14;
    }

    // ── Sections ──────────────────────────────────────────────────────────────
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const isGeneral = section.title === 'General' && sections.length === 1;

      // Section header bar
      ensureSpace(26);
      const secH = 26;
      page.drawRectangle({ x: ML, y: y - secH, width: CW, height: secH, color: C_LGRAY });

      // Red left accent
      page.drawRectangle({ x: ML, y: y - secH, width: 4, height: secH, color: C_RED });

      const secLabel = isGeneral ? 'Report Content' : section.title;
      page.drawText(secLabel, { x: ML + 12, y: y - secH + 8, size: 10, font: boldF, color: C_DGRAY });
      y -= secH + 6;

      // Section text
      if (section.text?.trim()) {
        let r = textBlock(page, section.text, y, regF, FOOTER_TOP + 6);
        y = r.y;
        while (r.overflow) {
          newPage();
          r = textBlock(page, r.overflow, y, regF, FOOTER_TOP + 6);
          y = r.y;
        }
      } else {
        page.drawText('No content provided.', { x: ML + 4, y: y - 13, size: 9, font: regF, color: C_MID });
        y -= 13;
      }

      y -= 16;
    }

    // ── Signature block ───────────────────────────────────────────────────────
    y -= 10;
    ensureSpace(55);
    page.drawLine({ start: { x: ML, y }, end: { x: ML + 160, y }, thickness: 0.5, color: C_DGRAY });
    page.drawText('Authorised Signatory', { x: ML, y: y - 12, size: 9, font: regF, color: C_MID });
    page.drawText('SHBR Group Pty Ltd',   { x: ML, y: y - 24, size: 9, font: boldF, color: C_DGRAY });
    page.drawText(`Date: ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      { x: ML, y: y - 36, size: 9, font: regF, color: C_MID });

    // ── Disclaimer ────────────────────────────────────────────────────────────
    y -= 60;
    ensureSpace(30);
    const disclaimer = 'This report was AI-polished from the original source document. All factual content has been preserved. SHBR Group Pty Ltd.';
    const discLines = wrap(disclaimer, regF, 7.5, CW);
    discLines.forEach(l => {
      const lw = sw(regF, l, 7.5);
      page.drawText(l, { x: ML + (CW - lw) / 2, y, size: 7.5, font: regF, color: C_MID });
      y -= 11;
    });

    const pdfBytes  = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    return NextResponse.json({ pdfBase64, success: true });
  } catch (err: unknown) {
    console.error('Polish PDF generation error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
