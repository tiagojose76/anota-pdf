// Ida e volta: modelo -> savePdf -> pdf.js lê -> loadPdf recupera o modelo -> salvar de novo não duplica.
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from '@pdfme/pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { loadPdf, savePdf } from '../src/pdf.js';

const src = await PDFDocument.create();
const helv = await src.embedFont(StandardFonts.Helvetica);
for (const t of ['Pagina um', 'Pagina dois', 'Pagina tres']) src.addPage([595, 842]).drawText(t, { x: 50, y: 780, size: 14, font: helv });
const original = await src.save();

const blue = [0, 0, 1];
const model = [
  { type: 'highlight', color: [1, 1, 0], width: 1, opacity: 1, text: '', quads: [[50, 776, 120, 794]] },
  { type: 'underline', color: [1, 0, 0], width: 1, opacity: 1, text: '', quads: [[50, 700, 120, 714]] },
  { type: 'strikeout', color: [1, 0, 0], width: 1, opacity: 1, text: '', quads: [[50, 650, 120, 664]] },
  { type: 'ink', color: blue, width: 3, opacity: 1, text: '', strokes: [[[100, 500, 0.5], [120, 520, 0.7], [140, 500, 0.5]]] },
  { type: 'ink', color: [1, 1, 0], width: 12, opacity: 0.4, text: '', strokes: [[[100, 450, 0.5], [200, 450, 0.5]]] },
  { type: 'square', color: blue, width: 2, opacity: 1, text: '', rect: [300, 500, 400, 560] },
  { type: 'circle', color: blue, width: 2, opacity: 1, text: '', rect: [300, 400, 400, 460] },
  { type: 'line', color: blue, width: 2, opacity: 1, text: '', line: [300, 300, 400, 350], arrow: true },
  { type: 'freetext', color: blue, width: 1, opacity: 1, text: 'Olá, ação!\nlinha 2', fontSize: 14, rect: [50, 200, 200, 240] },
  { type: 'note', color: [1, 0.85, 0], width: 1, opacity: 1, text: 'comentário ✓', rect: [500, 760, 520, 780] },
];
const types = model.map((a) => a.type);

const { base, pages } = await loadPdf(original);
assert.equal(pages.length, 3);
pages[0].annots = structuredClone(model);
pages[1].rot = 90;
pages.splice(2, 1); // exclui a página 3
const saved = await savePdf(base, pages);

// 1) pdf.js lê o resultado
const pdf = await pdfjs.getDocument({ data: saved.slice(), verbosity: 0 }).promise;
assert.equal(pdf.numPages, 2, 'página 3 deveria ter sido excluída');
const p1 = await pdf.getPage(1);
const got = (await p1.getAnnotations()).map((a) => a.subtype);
assert.deepEqual(got, ['Highlight', 'Underline', 'StrikeOut', 'Ink', 'Ink', 'Square', 'Circle', 'Line', 'FreeText', 'Text', 'Popup']);
assert.equal((await pdf.getPage(2)).rotate, 90);
const ft = (await p1.getAnnotations()).find((a) => a.subtype === 'FreeText');
assert.equal(ft.contentsObj.str, 'Olá, ação!\nlinha 2');

// 2) loadPdf recupera o modelo e tira as anotações dos bytes-base
const again = await loadPdf(saved);
const back = again.pages[0].annots;
assert.deepEqual(back.map((a) => a.type), types);
assert.equal(back.find((a) => a.type === 'note').text, 'comentário ✓');
assert.deepEqual(back.find((a) => a.type === 'line').line, [300, 300, 400, 350]);
assert.equal(back.find((a) => a.type === 'line').arrow, true);
assert.deepEqual(back.find((a) => a.type === 'square').rect, [300, 500, 400, 560]);
assert.deepEqual(back.find((a) => a.type === 'freetext').color, blue);
assert.equal(back.filter((a) => a.type === 'ink')[1].opacity, 0.4);
const basePdf = await pdfjs.getDocument({ data: again.base.slice(), verbosity: 0 }).promise;
assert.equal((await (await basePdf.getPage(1)).getAnnotations()).length, 0, 'base deveria ficar sem anotações suportadas');

// 3) salvar de novo não duplica nada
const twice = await savePdf(again.base, again.pages);
const third = await loadPdf(twice);
assert.deepEqual(third.pages[0].annots.map((a) => a.type), types);
assert.equal(third.pages[1].rot, 90);

console.log(`PASS: ${types.length} tipos de anotação, rotação e exclusão de página, ida e volta sem duplicar (${saved.length} bytes)`);
