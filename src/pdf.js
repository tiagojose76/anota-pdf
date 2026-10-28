// Núcleo de PDF: lê/remove as anotações suportadas (viram o modelo editável) e grava o modelo de volta com /AP.
// Roda no navegador e no Node (testes). Coordenadas do modelo = espaço do usuário da página PDF.
import { PDFDocument, PDFName, PDFArray, PDFHexString, PDFString, StandardFonts, degrees } from '@pdfme/pdf-lib';
import { getStroke } from 'perfect-freehand';

const SUBTYPES = {
  Highlight: 'highlight', Underline: 'underline', StrikeOut: 'strikeout', Ink: 'ink',
  Square: 'square', Circle: 'circle', Line: 'line', FreeText: 'freetext', Text: 'note',
};
const TO_SUBTYPE = Object.fromEntries(Object.entries(SUBTYPES).map(([k, v]) => [v, k]));
const N = (k) => PDFName.of(k);
const f = (n) => +n.toFixed(2);
const KAPPA = 0.5523;
export const NOTE_SIZE = 20;

export function inkOutline(stroke, width) {
  return getStroke(stroke, { size: width, thinning: 0.5, simulatePressure: false });
}

export function arrowHead([x1, y1, x2, y2], w) {
  const a = Math.atan2(y2 - y1, x2 - x1), len = 4 + w * 3;
  return [-1, 1].map((s) => [x2 - len * Math.cos(a + s * 0.45), y2 - len * Math.sin(a + s * 0.45)]);
}

// Retângulo [x1,y1,x2,y2] que contém o desenho, já com a espessura do traço.
export function bounds(a) {
  let pts;
  if (a.quads) pts = a.quads.flatMap(([x1, y1, x2, y2]) => [[x1, y1], [x2, y2]]);
  else if (a.strokes) pts = a.strokes.flat();
  else if (a.line) pts = [[a.line[0], a.line[1]], [a.line[2], a.line[3]], ...(a.arrow ? arrowHead(a.line, a.width) : [])];
  else pts = [[a.rect[0], a.rect[1]], [a.rect[2], a.rect[3]]];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const pad = a.quads || a.type === 'freetext' || a.type === 'note' ? 0 : a.width / 2 + 1;
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad].map(f);
}

const nums = (d, k) => {
  const v = d.lookup(N(k));
  return v instanceof PDFArray ? v.asArray().map((o) => o.asNumber?.() ?? 0) : null;
};
const text = (d, k) => d.lookup(N(k))?.decodeText?.() ?? '';

function readAnnot(d) {
  const type = SUBTYPES[d.lookup(N('Subtype'))?.asString().slice(1)];
  const rect = nums(d, 'Rect');
  if (!type || !rect) return null;
  const c = nums(d, 'C');
  const width = d.lookup(N('BS'))?.lookup?.(N('W'))?.asNumber() ?? 1;
  const a = { type, color: c?.length === 3 ? c : [0, 0, 0], width, opacity: d.lookup(N('CA'))?.asNumber() ?? 1, text: text(d, 'Contents') };
  const r = [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])];
  if (['highlight', 'underline', 'strikeout'].includes(type)) {
    const q = nums(d, 'QuadPoints') ?? [r[0], r[3], r[2], r[3], r[0], r[1], r[2], r[1]];
    a.quads = [];
    for (let i = 0; i + 7 < q.length; i += 8) {
      const xs = [q[i], q[i + 2], q[i + 4], q[i + 6]], ys = [q[i + 1], q[i + 3], q[i + 5], q[i + 7]];
      a.quads.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
    }
  } else if (type === 'ink') {
    const list = d.lookup(N('InkList'));
    a.strokes = (list instanceof PDFArray ? list.asArray() : []).map((s) => {
      const v = d.context.lookup(s).asArray().map((o) => o.asNumber());
      const pts = [];
      for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1], 0.5]);
      return pts;
    }).filter((s) => s.length);
    if (!a.strokes.length) return null;
  } else if (type === 'line') {
    a.line = nums(d, 'L');
    if (a.line?.length !== 4) return null;
    a.arrow = /Arrow/.test(d.lookup(N('LE'))?.asArray?.()[1]?.asString() ?? '');
  } else if (type === 'freetext') {
    const da = text(d, 'DA') || d.lookup(N('DA'))?.asString?.() || '';
    const rg = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);
    if (rg) a.color = rg.slice(1, 4).map(Number);
    a.fontSize = +(da.match(/([\d.]+)\s+Tf/)?.[1] ?? 12) || 12;
    a.rect = r;
  } else if (type === 'square' || type === 'circle') {
    const p = width / 2 + 1;
    a.rect = [r[0] + p, r[1] + p, r[2] - p, r[3] - p];
  } else a.rect = r;
  return a;
}

// Separa o PDF em: bytes sem as anotações suportadas (pdf.js renderiza o resto) + modelo editável.
export async function loadPdf(bytes) {
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages().map((page, src) => {
    const annots = [], keep = [], removed = new Set();
    const arr = page.node.Annots();
    const refs = arr ? arr.asArray() : [];
    for (const ref of refs) {
      const d = doc.context.lookup(ref);
      const a = d && readAnnot(d);
      if (a) { annots.push(a); removed.add(ref); }
    }
    for (const ref of refs) {
      const d = doc.context.lookup(ref);
      const parent = d?.get?.(N('Parent'));
      if (!removed.has(ref) && !(d?.lookup(N('Subtype'))?.asString() === '/Popup' && removed.has(parent))) keep.push(ref);
    }
    if (arr) page.node.set(N('Annots'), doc.context.obj(keep));
    return { src, rot: page.getRotation().angle, annots };
  });
  const base = await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
  return { base, pages };
}

const rgb = ([r, g, b]) => `${f(r)} ${f(g)} ${f(b)}`;
const pathOps = (pts) => pts.map(([x, y], i) => `${f(x)} ${f(y)} ${i ? 'l' : 'm'}`).join(' ');

function ellipseOps([x1, y1, x2, y2]) {
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = (x2 - x1) / 2, ry = (y2 - y1) / 2, kx = rx * KAPPA, ky = ry * KAPPA;
  return `${f(cx + rx)} ${f(cy)} m ${f(cx + rx)} ${f(cy + ky)} ${f(cx + kx)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)} c `
    + `${f(cx - kx)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + ky)} ${f(cx - rx)} ${f(cy)} c `
    + `${f(cx - rx)} ${f(cy - ky)} ${f(cx - kx)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)} c `
    + `${f(cx + kx)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - ky)} ${f(cx + rx)} ${f(cy)} c S`;
}

function appearance(a, font) {
  const c = rgb(a.color), w = f(a.width);
  switch (a.type) {
    case 'highlight': return a.quads.map(([x1, y1, x2, y2]) => `${f(x1)} ${f(y1)} ${f(x2 - x1)} ${f(y2 - y1)} re f`).join(' ');
    case 'underline': case 'strikeout': return `${c} RG 1 w ` + a.quads.map(([x1, y1, x2, y2]) => {
      const y = a.type === 'underline' ? y1 + 1 : (y1 + y2) / 2;
      return `${f(x1)} ${f(y)} m ${f(x2)} ${f(y)} l S`;
    }).join(' ');
    case 'ink': return a.strokes.map((s) => `${pathOps(inkOutline(s, a.width))} h f`).join(' ');
    case 'square': return `${w} w ${f(a.rect[0])} ${f(a.rect[1])} ${f(a.rect[2] - a.rect[0])} ${f(a.rect[3] - a.rect[1])} re S`;
    case 'circle': return `${w} w ${ellipseOps(a.rect)}`;
    case 'line': {
      const [x1, y1, x2, y2] = a.line;
      const head = a.arrow ? arrowHead(a.line, a.width).map(([x, y]) => `${f(x)} ${f(y)} m ${f(x2)} ${f(y2)} l S`).join(' ') : '';
      return `${w} w 1 J 1 j ${f(x1)} ${f(y1)} m ${f(x2)} ${f(y2)} l S ${head}`;
    }
    case 'freetext': {
      const [x1, , , y2] = a.rect, fs = a.fontSize;
      // Helvetica padrão só cobre WinAnsi: caracteres fora dela viram '?' na aparência (o /Contents guarda o texto original).
      const safe = (l) => [...l].map((ch) => { try { font.encodeText(ch); return ch; } catch { return '?'; } }).join('');
      const lines = a.text.split('\n').map((l, i) => `1 0 0 1 ${f(x1 + 4)} ${f(y2 - 4 - fs - i * fs * 1.2)} Tm ${font.encodeText(safe(l))} Tj`);
      return `BT /Helv ${fs} Tf ${c} rg ${lines.join(' ')} ET`;
    }
    case 'note': {
      const [x, y] = a.rect;
      return `${c} rg 0 0 0 RG 0.5 w ${f(x + 0.5)} ${f(y + 0.5)} 19 19 re B ${f(x + 3)} ${f(y + 14)} m ${f(x + 17)} ${f(y + 14)} l `
        + `${f(x + 3)} ${f(y + 9)} m ${f(x + 17)} ${f(y + 9)} l ${f(x + 3)} ${f(y + 4)} m ${f(x + 13)} ${f(y + 4)} l S`;
    }
  }
  return '';
}

// Grava páginas (ordem/rotação/exclusão) e anotações do modelo sobre os bytes-base devolvidos por loadPdf.
export async function savePdf(base, pages) {
  const doc = await PDFDocument.load(base);
  const ctx = doc.context;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const all = doc.getPages();
  let usesFont = false;

  for (const p of pages) {
    const page = all[p.src];
    page.setRotation(degrees(p.rot));
    for (const a of p.annots) {
      const rect = bounds(a);
      const alpha = a.opacity < 1 || a.type === 'highlight';
      const ops = (alpha ? '/GS0 gs ' : '') + (['ink', 'highlight', 'note'].includes(a.type) ? `${rgb(a.color)} rg ` : `${rgb(a.color)} RG `) + appearance(a, font);
      const res = {};
      if (alpha) res.ExtGState = { GS0: { Type: 'ExtGState', BM: 'Multiply', ca: a.opacity, CA: a.opacity } };
      if (a.type === 'freetext') { res.Font = { Helv: font.ref }; usesFont = true; }
      const ap = ctx.register(ctx.stream(ops, { Type: 'XObject', Subtype: 'Form', BBox: rect, Resources: res }));
      const dict = {
        Type: 'Annot', Subtype: TO_SUBTYPE[a.type], Rect: rect, C: a.color, F: 4, P: page.ref,
        T: PDFString.of('Anota PDF'), Contents: PDFHexString.fromText(a.text ?? ''), AP: { N: ap },
      };
      if (a.opacity < 1) dict.CA = a.opacity;
      if (a.quads) dict.QuadPoints = a.quads.flatMap(([x1, y1, x2, y2]) => [x1, y2, x2, y2, x1, y1, x2, y1].map(f));
      if (a.strokes) dict.InkList = a.strokes.map((s) => s.flatMap(([x, y]) => [f(x), f(y)]));
      if (a.line) { dict.L = a.line.map(f); dict.LE = ['None', a.arrow ? 'OpenArrow' : 'None']; }
      if (!a.quads && a.type !== 'freetext' && a.type !== 'note') dict.BS = { W: a.width };
      if (a.type === 'freetext') dict.DA = PDFString.of(`/Helv ${a.fontSize} Tf ${rgb(a.color)} rg`);
      if (a.type === 'note') { dict.Name = 'Comment'; dict.Open = false; }
      const ref = ctx.register(ctx.obj(dict));
      page.node.addAnnot(ref);
      if (a.type === 'note') {
        const [x, , , y] = rect;
        const popup = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Popup', Rect: [x + 25, y - 80, x + 205, y], Parent: ref, Open: false, F: 4, P: page.ref }));
        ctx.lookup(ref).set(N('Popup'), popup);
        page.node.addAnnot(popup);
      }
    }
  }
  // /DR resolve o /Helv do /DA dos FreeText em leitores que regeneram a aparência.
  if (usesFont) doc.getForm().acroForm.dict.set(N('DR'), ctx.obj({ Font: { Helv: font.ref } }));

  const keep = new Set(pages.map((p) => p.src));
  for (let i = all.length - 1; i >= 0; i--) if (!keep.has(i)) doc.removePage(i);
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
}
