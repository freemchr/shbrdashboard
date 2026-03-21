import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { sanitizeJobNumber } from '@/lib/sanitize';

export const runtime = 'nodejs';

// ── #5 FIX: Input size limits ─────────────────────────────────────────────────
const MAX_BODY_BYTES   = 20 * 1024 * 1024; // 20 MB absolute ceiling
const MAX_PHOTOS       = 30;               // prevents memory exhaustion
const MAX_TEXT_LENGTH  = 50_000;           // characters per narrative field

// ─── Colours ──────────────────────────────────────────────────────────────────
const C_RED    = rgb(0.831, 0.125, 0.153); // #D42027
const C_DGRAY  = rgb(0.2,   0.2,   0.2);   // #333333
const C_LGRAY  = rgb(0.933, 0.933, 0.933); // #EEEEEE
const C_BORDER = rgb(0.867, 0.867, 0.867); // #DDDDDD
const C_LINE   = rgb(0.8,   0.8,   0.8);   // #CCCCCC
const C_BLACK  = rgb(0,     0,     0);
// C_WHITE removed (unused)
const C_MID    = rgb(0.5,   0.5,   0.5);

// ─── Page geometry ─────────────────────────────────────────────────────────────
const PW = 595;
const PH = 842;
const ML = 50;
const MR = 50;
const CW = PW - ML - MR;
const CONTENT_TOP    = PH - 140;
const FOOTER_TOP     = 82;
const FOOTER_BOTTOM  = 5;

// ─── Column widths for 4-col claim table ──────────────────────────────────────
const C1W = 109; const C2W = 139; const C3W = 109; const C4W = 139;
const C1X = ML;
const C2X = ML + C1W;
const C3X = ML + C1W + C2W;
const C4X = ML + C1W + C2W + C3W;

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

// ─── Image loading ────────────────────────────────────────────────────────────
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

// ─── Header ──────────────────────────────────────────────────────────────────
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

// ─── Footer ───────────────────────────────────────────────────────────────────
function drawFooter(
  page: PDFPage,
  imgs: PageImages,
  fonts: { bold: PDFFont; reg: PDFFont },
  pageNum: number,
) {
  const { bold, reg } = fonts;

  for (const dy of [0, 2]) {
    page.drawLine({
      start: { x: ML, y: FOOTER_TOP + dy },
      end:   { x: PW - MR, y: FOOTER_TOP + dy },
      thickness: 0.5,
      color: C_LINE,
    });
  }

  const mbY = FOOTER_BOTTOM + 4;
  page.drawImage(imgs.mbLogo, { x: ML, y: mbY, width: 60, height: 55 });

  const cm3Y = FOOTER_BOTTOM + 14;
  page.drawImage(imgs.cm3Logo, { x: PW - MR - 55, y: cm3Y, width: 55, height: 35 });

  const textLeftEdge  = ML + 60 + 8;
  const textRightEdge = PW - MR - 55 - 8;
  const textW = textRightEdge - textLeftEdge;
  const textCentreX = textLeftEdge + textW / 2;

  const line1 = "AUSTRALIA'S TRUSTED INSURANCE BUILDING & RESTORATION PROVIDER";
  const line2 = 'SHBR Group Pty Ltd  |  NSW Lic 107756C  |  Qld Lic 1156078  |  ACT Lic 2014359  |  ACN 085 591 699  |  ABN 76 085 591 699';

  const l1w = sw(bold, line1, 7.5);
  // l2w unused - removed

  page.drawText(line1, { x: textCentreX - l1w / 2, y: FOOTER_BOTTOM + 42, size: 7.5, font: bold, color: C_RED });
  const line2Wrapped = wrap(line2, reg, 6.5, textW);
  line2Wrapped.forEach((l, i) => {
    const lw = sw(reg, l, 6.5);
    page.drawText(l, { x: textCentreX - lw / 2, y: FOOTER_BOTTOM + 28 - i * 9, size: 6.5, font: reg, color: C_DGRAY });
  });

  const pn = `Page ${pageNum}`;
  const pnW = sw(reg, pn, 7);
  page.drawText(pn, { x: PW - MR - pnW, y: FOOTER_TOP + 4, size: 7, font: reg, color: C_MID });
}

// ─── Page factory ─────────────────────────────────────────────────────────────
function addPage(
  pdfDoc: PDFDocument,
  imgs: PageImages,
  fonts: { bold: PDFFont; reg: PDFFont },
  pageNumRef: { n: number },
): { page: PDFPage; y: number } {
  pageNumRef.n++;
  const page = pdfDoc.addPage([PW, PH]);
  drawHeader(page, imgs, fonts);
  drawFooter(page, imgs, fonts, pageNumRef.n);
  return { page, y: CONTENT_TOP };
}

// ─── Drawing primitives ───────────────────────────────────────────────────────
function sectionHeader(page: PDFPage, title: string, y: number, fonts: { bold: PDFFont; reg: PDFFont }): number {
  const h = 26;
  page.drawRectangle({ x: ML, y: y - h, width: CW, height: h, color: C_LGRAY });
  page.drawText(title, { x: ML + 8, y: y - h + 8, size: 10, font: fonts.reg, color: C_DGRAY });
  return y - h;
}

function twoColRow(
  page: PDFPage,
  label: string,
  value: string,
  y: number,
  rowH: number,
  fonts: { bold: PDFFont; reg: PDFFont },
  opts: { altBg?: boolean; valueLines?: string[] } = {},
): number {
  const lColW = Math.round(CW * 0.3);
  // vColW unused - removed
  if (opts.altBg) {
    page.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, color: C_LGRAY });
  }
  page.drawRectangle({ x: ML, y: y - rowH, width: CW, height: rowH, borderColor: C_BORDER, borderWidth: 0.5, color: undefined });
  page.drawLine({ start: { x: ML + lColW, y: y - rowH }, end: { x: ML + lColW, y }, thickness: 0.5, color: C_BORDER });

  page.drawText(label, { x: ML + 4, y: y - rowH + (rowH - 9) / 2, size: 9, font: fonts.bold, color: C_DGRAY });

  if (opts.valueLines) {
    opts.valueLines.forEach((l, i) => {
      page.drawText(l, { x: ML + lColW + 4, y: y - 12 - i * 11, size: 9, font: fonts.reg, color: C_BLACK });
    });
  } else {
    const displayVal = (value || '—').substring(0, 100);
    page.drawText(displayVal, { x: ML + lColW + 4, y: y - rowH + (rowH - 9) / 2, size: 9, font: fonts.reg, color: C_BLACK });
  }
  return y - rowH;
}

function textBlock(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  maxY: number,
): { y: number; overflow: string } {
  if (!text?.trim()) return { y, overflow: '' };
  const lines = wrap(text, font, 9, CW - 8);
  const lh = 13;
  for (let i = 0; i < lines.length; i++) {
    if (y - lh < maxY) {
      return { y, overflow: lines.slice(i).join('\n') };
    }
    page.drawText(lines[i], { x: ML + 4, y: y - lh, size: 9, font, color: C_BLACK });
    y -= lh;
  }
  return { y, overflow: '' };
}

// ─── Report data types ────────────────────────────────────────────────────────
export interface ReportPhoto {
  base64: string;
  caption: string;
  mimeType?: string;
}

export interface ReportData {
  jobNumber?:            string;
  claimNumber?:          string;
  insurer?:              string;
  insuredName?:          string;
  propertyAddress?:      string;
  inspectedBy?:          string;
  eventType?:            string;
  incidentDate?:         string;
  propertyNotes?:        string;
  reportRef?:            string;
  buildingType?:         string;
  buildingDescription?:  string;
  wallCladding?:         string;
  roofCladding?:         string;
  internalLinings?:      string;
  foundation?:           string;
  outbuildings?:         string;
  constructionAge?:      string;
  propertyCategory?:     string;
  altAccommodation?:     string;
  hazmat?:               string;
  makeSafeRequired?:     string;
  makeSafeCompleted?:    string;
  hailDamage?:           string;
  inspectionDate?:       string;
  inspectionTime?:       string;
  metOnSite?:            string;
  circumstancesOfLoss?:  string;
  damageAssessment?:     string;
  damageConsistent?:     string;
  contentsDamaged?:      string;
  causeOfDamage?:        string;
  causeStoppedY?:        string;
  specialistRequired?:   string;
  specialistType?:       string;
  suddenGradual?:        string;
  maintenanceRepairs?:   string;
  conclusion?:           string;
  canWarrant?:           string;
  allocationType?:       string;
  insuredAware?:         string;
  repairLeadTime?:       string;
  repairTimeframe?:      string;
  allExternalInspected?: string;
  frontElevationPhoto?:  ReportPhoto;
  photos?:               ReportPhoto[];
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // ── #5 FIX: Enforce content-length ceiling before parsing body ─────────────
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    const d: ReportData = await req.json();

    // ── #5 FIX: Cap photo count and text field lengths ─────────────────────────
    if (d.photos && d.photos.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Maximum ${MAX_PHOTOS} photos allowed` }, { status: 400 });
    }

    const longTextFields: (keyof ReportData)[] = [
      'circumstancesOfLoss', 'damageAssessment', 'causeOfDamage',
      'maintenanceRepairs', 'conclusion',
    ];
    for (const field of longTextFields) {
      const val = d[field];
      if (typeof val === 'string' && val.length > MAX_TEXT_LENGTH) {
        return NextResponse.json({ error: `Field "${field}" exceeds maximum length` }, { status: 400 });
      }
    }

    // ── #2 FIX: Sanitise jobNumber used in blob path ───────────────────────────
    const rawJobNumber = d.jobNumber || 'unknown';
    const safeJobNumber = sanitizeJobNumber(rawJobNumber) || 'unknown';

    const pdfDoc  = await PDFDocument.create();
    const boldF   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regF    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fonts   = { bold: boldF, reg: regF };
    const imgs    = await loadImages(pdfDoc);
    const pnRef   = { n: 0 };

    let { page, y } = addPage(pdfDoc, imgs, fonts, pnRef);
    const newPage = () => {
      const p = addPage(pdfDoc, imgs, fonts, pnRef);
      page = p.page;
      y = p.y;
    };
    const ensureSpace = (needed: number) => { if (y - needed < FOOTER_TOP + 6) newPage(); };

    // ── 1. Banner ────────────────────────────────────────────────────────────
    const bannerH = 35;
    page.drawRectangle({ x: ML, y: y - bannerH, width: CW, height: bannerH, color: C_LGRAY });
    const bannerTitle = 'Expert Assessment Report';
    const btW = sw(boldF, bannerTitle, 16);
    page.drawText(bannerTitle, { x: ML + (CW - btW) / 2, y: y - bannerH + (bannerH - 16) / 2 + 2, size: 16, font: boldF, color: C_DGRAY });
    y -= bannerH + 20;

    // ── 2. 4-col Claim / Builder table ────────────────────────────────────────
    const tblHeaderH = 28;
    page.drawRectangle({ x: ML, y: y - tblHeaderH, width: CW, height: tblHeaderH, color: C_LGRAY });
    page.drawRectangle({ x: ML, y: y - tblHeaderH, width: CW, height: tblHeaderH, borderColor: C_BORDER, borderWidth: 0.5, color: undefined });
    const mergeW1 = C1W + C2W;
    const mergeW2 = C3W + C4W;
    const h1Text  = 'INSURER / CLIENT DETAILS';
    const h2Text  = 'BUILDER DETAILS';
    const h1W = sw(boldF, h1Text, 9);
    page.drawText(h1Text, { x: C1X + (mergeW1 - h1W) / 2, y: y - 18, size: 9, font: boldF, color: C_DGRAY });
    page.drawLine({ start: { x: C3X, y: y - tblHeaderH }, end: { x: C3X, y }, thickness: 0.5, color: C_BORDER });
    const h2W = sw(boldF, h2Text, 9);
    page.drawText(h2Text, { x: C3X + (mergeW2 - h2W) / 2, y: y - 18, size: 9, font: boldF, color: C_DGRAY });
    y -= tblHeaderH;

    interface TableRow { l1: string; v1: string; l2: string; v2: string; rowH: number }
    const tableRows: TableRow[] = [
      { l1: 'Insurer:',      v1: d.insurer      || '—', l2: 'Builder:',  v2: 'SHBR Group Pty Ltd',   rowH: 22 },
      { l1: 'Claim Number:', v1: d.claimNumber  || '—', l2: 'ABN:',      v2: '76 085 591 699',        rowH: 22 },
      { l1: 'Job Number:',   v1: d.jobNumber    || '—', l2: 'Licences:', v2: 'NSW 107756C  |  ACT 2014359  |  QLD 1156078', rowH: 22 },
      { l1: 'Insured Name:', v1: d.insuredName  || '—', l2: '',          v2: 'NT 264467CU',            rowH: 22 },
      { l1: 'Address:',      v1: (d.propertyAddress || '—'), l2: 'Address:', v2: 'Level 2, 24 Hickson Road\nMILLERS POINT NSW 2000', rowH: 56 },
    ];

    tableRows.forEach((row) => {
      const rH = row.rowH;
      page.drawRectangle({ x: ML, y: y - rH, width: CW, height: rH, borderColor: C_BORDER, borderWidth: 0.5, color: undefined });
      page.drawLine({ start: { x: C2X, y: y - rH }, end: { x: C2X, y }, thickness: 0.5, color: C_BORDER });
      page.drawLine({ start: { x: C3X, y: y - rH }, end: { x: C3X, y }, thickness: 0.5, color: C_BORDER });
      page.drawLine({ start: { x: C4X, y: y - rH }, end: { x: C4X, y }, thickness: 0.5, color: C_BORDER });

      const midY = y - rH + (rH - 9) / 2;
      page.drawText(row.l1, { x: C1X + 4, y: midY, size: 9, font: boldF, color: C_DGRAY });
      const v1Lines = wrap(row.v1, regF, 9, C2W - 8);
      v1Lines.forEach((l, i) => page.drawText(l, { x: C2X + 4, y: y - 14 - i * 12, size: 9, font: regF, color: C_BLACK }));

      if (row.l2) page.drawText(row.l2, { x: C3X + 4, y: midY, size: 9, font: boldF, color: C_DGRAY });
      const v2Lines = wrap(row.v2, regF, 9, C4W - 8);
      v2Lines.forEach((l, i) => page.drawText(l, { x: C4X + 4, y: y - 14 - i * 12, size: 9, font: regF, color: C_BLACK }));

      y -= rH;
    });

    y -= 14;

    // ── 3. Report title ───────────────────────────────────────────────────────
    ensureSpace(20);
    const reportRef = d.reportRef || '1';
    const reportTitle = `${d.jobNumber || ''}-${reportRef} Building Assessment Report (${d.insurer || ''})`;
    page.drawText(reportTitle, { x: ML, y, size: 13, font: boldF, color: C_DGRAY });
    y -= 20;

    // ── 4. Claim Details ──────────────────────────────────────────────────────
    ensureSpace(26 + 4 * 22);
    y = sectionHeader(page, 'Claim Details', y, fonts);
    const claimSubRows: [string, string][] = [
      ['Inspected by:', d.inspectedBy   || '—'],
      ['Date:',         d.inspectionDate || d.incidentDate || '—'],
      ['Time:',         d.inspectionTime || '—'],
      ['Met on site:',  d.metOnSite      || '—'],
    ];
    claimSubRows.forEach(([l, v], i) => {
      ensureSpace(22);
      y = twoColRow(page, l, v, y, 22, fonts, { altBg: i % 2 === 0 });
    });
    y -= 10;

    // ── 5. Front elevation photo ──────────────────────────────────────────────
    if (d.frontElevationPhoto?.base64) {
      ensureSpace(30);
      page.drawText('Front Elevation:', { x: ML, y, size: 9, font: boldF, color: C_DGRAY });
      y -= 8;
      try {
        const imgData = d.frontElevationPhoto.base64.replace(/^data:[^;]+;base64,/, '');
        const imgBytes = Buffer.from(imgData, 'base64');
        const isJpeg = d.frontElevationPhoto.mimeType?.includes('jpeg') || d.frontElevationPhoto.mimeType?.includes('jpg')
          || d.frontElevationPhoto.base64.startsWith('data:image/jpeg') || d.frontElevationPhoto.base64.startsWith('data:image/jpg');
        const pdfImg = isJpeg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
        const maxW = 310; const maxH = 370;
        const scale = Math.min(maxW / pdfImg.width, maxH / pdfImg.height, 1);
        const iw = pdfImg.width * scale; const ih = pdfImg.height * scale;
        ensureSpace(ih + 20);
        page.drawImage(pdfImg, { x: ML + (CW - iw) / 2, y: y - ih, width: iw, height: ih });
        y -= ih + 4;
        if (d.frontElevationPhoto.caption) {
          const capW = sw(regF, d.frontElevationPhoto.caption, 9);
          page.drawText(d.frontElevationPhoto.caption, { x: ML + (CW - capW) / 2, y, size: 9, font: regF, color: C_MID });
          y -= 14;
        }
      } catch { /* skip if image fails */ }
    }

    y -= 10;

    // ── Property Details ──────────────────────────────────────────────────────
    ensureSpace(26 + 8 * 22);
    if (y - (26 + 8 * 22) < FOOTER_TOP + 6) newPage();
    y = sectionHeader(page, '2. Property Details', y, fonts);
    const propRows: [string, string][] = [
      ['Building Type:',    d.buildingType        || '—'],
      ['Description:',      d.buildingDescription || '—'],
      ['Wall Cladding:',    d.wallCladding        || '—'],
      ['Roof Cladding:',    d.roofCladding        || '—'],
      ['Internal Linings:', d.internalLinings     || '—'],
      ['Foundation:',       d.foundation          || '—'],
      ['Outbuildings:',     d.outbuildings        || '—'],
      ['Construction Age:', d.constructionAge     || '—'],
    ];
    propRows.forEach(([l, v], i) => {
      ensureSpace(22);
      if (y - 22 < FOOTER_TOP + 6) newPage();
      y = twoColRow(page, l, v, y, 22, fonts, { altBg: i % 2 === 0 });
    });
    y -= 10;

    // ── Inspection Details ────────────────────────────────────────────────────
    ensureSpace(26 + 8 * 22);
    if (y - (26 + 8 * 22) < FOOTER_TOP + 6) newPage();
    y = sectionHeader(page, '3. Inspection Details', y, fonts);
    const inspRows: [string, string][] = [
      ['Event Type:',          d.eventType          || '—'],
      ['Date of Loss:',        d.incidentDate        || '—'],
      ['Property Category:',   d.propertyCategory   || '—'],
      ['Alt. Accommodation:',  d.altAccommodation    || '—'],
      ['Hazmat Present:',      d.hazmat              || '—'],
      ['Make Safe Required:',  d.makeSafeRequired    || '—'],
      ['Make Safe Completed:', d.makeSafeCompleted   || '—'],
      ['Hail Damage:',         d.hailDamage          || '—'],
    ];
    inspRows.forEach(([l, v], i) => {
      if (y - 22 < FOOTER_TOP + 6) newPage();
      y = twoColRow(page, l, v, y, 22, fonts, { altBg: i % 2 === 0 });
    });
    y -= 10;

    // ── Circumstances of Loss ─────────────────────────────────────────────────
    if (y - 60 < FOOTER_TOP + 6) newPage();
    y = sectionHeader(page, '4. Circumstances of Loss', y, fonts);
    y -= 6;
    if (d.circumstancesOfLoss) {
      let r = textBlock(page, d.circumstancesOfLoss, y, regF, FOOTER_TOP + 6);
      y = r.y;
      while (r.overflow) { newPage(); r = textBlock(page, r.overflow, y, regF, FOOTER_TOP + 6); y = r.y; }
    } else {
      page.drawText('Not provided.', { x: ML + 4, y: y - 13, size: 9, font: regF, color: C_MID });
      y -= 13;
    }
    y -= 10;

    // ── Damage Assessment ─────────────────────────────────────────────────────
    if (y - 60 < FOOTER_TOP + 6) newPage();
    y = sectionHeader(page, '5. Damage Assessment', y, fonts);
    const dmgRows: [string, string][] = [
      ['Damage Consistent:', d.damageConsistent || '—'],
      ['Contents Damaged:',  d.contentsDamaged  || '—'],
    ];
    dmgRows.forEach(([l, v], i) => {
      if (y - 22 < FOOTER_TOP + 6) newPage();
      y = twoColRow(page, l, v, y, 22, fonts, { altBg: i % 2 === 0 });
    });
    y -= 4;
    if (d.damageAssessment) {
      let r = textBlock(page, d.damageAssessment, y, regF, FOOTER_TOP + 6);
      y = r.y;
      while (r.overflow) { newPage(); r = textBlock(page, r.overflow, y, regF, FOOTER_TOP + 6); y = r.y; }
    }
    y -= 10;

    // ── Cause of Damage ───────────────────────────────────────────────────────
    if (y - 60 < FOOTER_TOP + 6) newPage();
    y = sectionHeader(page, '6. Cause of Damage', y, fonts);
    const causeRows: [string, string][] = [
      ['Cause Stopped:',      d.causeStoppedY     || '—'],
      ['Specialist Required:', d.specialistRequired|| '—'],
      ['Specialist Type:',    d.specialistType    || '—'],
      ['Sudden / Gradual:',   d.suddenGradual     || '—'],
    ];
    causeRows.forEach(([l, v], i) => {
      if (y - 22 < FOOTER_TOP + 6) newPage();
      y = twoColRow(page, l, v, y, 22, fonts, { altBg: i % 2 === 0 });
    });
    y -= 4;
    if (d.causeOfDamage) {
      let r = textBlock(page, d.causeOfDamage, y, regF, FOOTER_TOP + 6);
      y = r.y;
      while (r.overflow) { newPage(); r = textBlock(page, r.overflow, y, regF, FOOTER_TOP + 6); y = r.y; }
    }
    y -= 10;

    // ── Maintenance / Repairs ─────────────────────────────────────────────────
    if (y - 60 < FOOTER_TOP + 6) newPage();
    y = sectionHeader(page, '7. Maintenance / Repairs by Owner', y, fonts);
    y -= 6;
    if (d.maintenanceRepairs) {
      let r = textBlock(page, d.maintenanceRepairs, y, regF, FOOTER_TOP + 6);
      y = r.y;
      while (r.overflow) { newPage(); r = textBlock(page, r.overflow, y, regF, FOOTER_TOP + 6); y = r.y; }
    } else {
      page.drawText('No maintenance or repairs by owner identified.', { x: ML + 4, y: y - 13, size: 9, font: regF, color: C_MID });
      y -= 13;
    }
    y -= 10;

    // ── Conclusion ────────────────────────────────────────────────────────────
    if (y - 100 < FOOTER_TOP + 6) newPage();
    y = sectionHeader(page, '8. Conclusion', y, fonts);
    const concRows: [string, string][] = [
      ['Can Warrant:',           d.canWarrant           || '—'],
      ['Allocation Type:',       d.allocationType       || '—'],
      ['Insured Aware:',         d.insuredAware         || '—'],
      ['Repair Lead Time:',      d.repairLeadTime       || '—'],
      ['Repair Timeframe:',      d.repairTimeframe      || '—'],
      ['All External Inspected:', d.allExternalInspected || '—'],
    ];
    concRows.forEach(([l, v], i) => {
      if (y - 22 < FOOTER_TOP + 6) newPage();
      y = twoColRow(page, l, v, y, 22, fonts, { altBg: i % 2 === 0 });
    });
    y -= 4;
    if (d.conclusion) {
      let r = textBlock(page, d.conclusion, y, regF, FOOTER_TOP + 6);
      y = r.y;
      while (r.overflow) { newPage(); r = textBlock(page, r.overflow, y, regF, FOOTER_TOP + 6); y = r.y; }
    }

    // Signature block
    y -= 20;
    if (y - 50 < FOOTER_TOP + 6) newPage();
    page.drawLine({ start: { x: ML, y }, end: { x: ML + 160, y }, thickness: 0.5, color: C_DGRAY });
    page.drawText('Authorised Signatory', { x: ML, y: y - 12, size: 9, font: regF, color: C_MID });
    page.drawText('SHBR Group Pty Ltd', { x: ML, y: y - 24, size: 9, font: boldF, color: C_DGRAY });
    page.drawText(`Date: ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      { x: ML, y: y - 36, size: 9, font: regF, color: C_MID });

    // ── Photograph Schedule ───────────────────────────────────────────────────
    const allPhotos = (d.photos || []).filter(p => p.base64);
    if (allPhotos.length > 0) {
      newPage();
      y = sectionHeader(page, 'Photograph Schedule', y, fonts);
      y -= 6;
      page.drawText('General photographs:', { x: ML, y, size: 9, font: boldF, color: C_DGRAY });
      y -= 16;

      for (const photo of allPhotos) {
        try {
          const imgData = photo.base64.replace(/^data:[^;]+;base64,/, '');
          const imgBytes = Buffer.from(imgData, 'base64');
          const isJpeg = photo.mimeType?.includes('jpeg') || photo.mimeType?.includes('jpg')
            || photo.base64.startsWith('data:image/jpeg') || photo.base64.startsWith('data:image/jpg');
          const pdfImg = isJpeg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
          const maxW = 420; const maxH = 370;
          const scale = Math.min(maxW / pdfImg.width, maxH / pdfImg.height, 1);
          const iw = pdfImg.width * scale; const ih = pdfImg.height * scale;
          if (y - ih - 20 < FOOTER_TOP + 6) newPage();
          page.drawImage(pdfImg, { x: ML + (CW - iw) / 2, y: y - ih, width: iw, height: ih });
          y -= ih + 4;
          if (photo.caption) {
            const capW = sw(regF, photo.caption, 9);
            page.drawText(photo.caption, { x: ML + (CW - capW) / 2, y, size: 9, font: regF, color: C_MID });
            y -= 14;
          }
          y -= 10;
        } catch { /* skip broken images */ }
      }
    }

    // ── Serialise & save ──────────────────────────────────────────────────────
    const pdfBytes  = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const pdfBase64 = pdfBuffer.toString('base64');

    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const blobPath = `reports/${safeJobNumber}/${ts}-assessment-report.pdf`;

    // ── #1 FIX: PDFs stored as PRIVATE — they contain sensitive insurance data ─
    await put(blobPath, pdfBuffer, {
      access: 'private',           // was 'public' — critical fix
      contentType: 'application/pdf',
      allowOverwrite: true,
    });

    // Return base64 for immediate client use; do NOT return a public blob URL
    return NextResponse.json({ pdfBase64, blobPath, success: true });
  } catch (err: unknown) {
    console.error('[generate-pdf] Error:', err);
    // ── #7 FIX: Generic error to client ───────────────────────────────────────
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
