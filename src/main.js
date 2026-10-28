import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { loadPdf, savePdf, inkOutline, arrowHead, bounds, NOTE_SIZE } from './pdf.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const $ = (s) => document.querySelector(s);
const viewer = $('#viewer');
const state = { pdf: null, base: null, pages: [], name: '', handle: null, zoom: 1.25, tool: 'hand', current: 0, dirty: false };
let views = [], history = [], future = [], gen = 0;
const textCache = new Map();

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const css = ([r, g, b]) => `rgb(${r * 255},${g * 255},${b * 255})`;
const norm = (x1, y1, x2, y2) => [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];

function updateUI() {
  const has = !!state.pdf;
  $('#save').disabled = !has;
  for (const id of ['#rotate', '#delete', '#zoomIn', '#zoomOut']) $(id).disabled = !has;
  $('#delete').disabled = !has || state.pages.length < 2;
  $('#undo').disabled = !history.length;
  $('#redo').disabled = !future.length;
  $('#status').textContent = has ? `${state.dirty ? '● ' : ''}${state.name} — pág. ${state.current + 1}/${state.pages.length} — ${Math.round(state.zoom * 100)}%` : '';
  document.title = has ? `${state.dirty ? '● ' : ''}${state.name} — Anota PDF` : 'Anota PDF';
}

function setCurrent(i) {
  state.current = i;
  views.forEach((v, j) => v.el.classList.toggle('current', j === i));
  updateUI();
}

// ---------- renderização ----------

// shortcut: renderiza todas as páginas de uma vez; para PDFs de centenas de páginas, renderizar só as visíveis.
async function renderAll() {
  const my = ++gen;
  viewer.replaceChildren();
  viewer.classList.remove('empty');
  views = [];
  for (const [i, entry] of state.pages.entries()) {
    const page = await state.pdf.getPage(entry.src + 1);
    if (my !== gen) return;
    const vp = page.getViewport({ scale: state.zoom, rotation: entry.rot });
    const dpr = window.devicePixelRatio || 1;
    const el = document.createElement('div');
    el.className = 'page';
    el.style.width = `${vp.width}px`;
    el.style.height = `${vp.height}px`;
    const [canvas, overlay] = ['base', 'overlay'].map((cls) => {
      const c = document.createElement('canvas');
      c.className = cls;
      c.width = Math.floor(vp.width * dpr);
      c.height = Math.floor(vp.height * dpr);
      c.style.width = `${vp.width}px`;
      c.style.height = `${vp.height}px`;
      el.append(c);
      return c;
    });
    const view = { i, el, overlay, vp, dpr, page };
    views.push(view);
    viewer.append(el);
    bindPointer(view);
    drawOverlay(view);
    await page.render({ canvas, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined }).promise;
  }
  setCurrent(Math.min(state.current, state.pages.length - 1));
}

function drawOverlay(view, draft) {
  const ctx = view.overlay.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, view.overlay.width, view.overlay.height);
  ctx.setTransform(...view.vp.transform.map((n) => n * view.dpr));
  for (const a of state.pages[view.i].annots) drawAnnot(ctx, a);
  if (draft) drawAnnot(ctx, draft);
}

function drawAnnot(ctx, a) {
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = css(a.color);
  ctx.globalAlpha = a.opacity;
  ctx.lineWidth = a.width;
  ctx.lineCap = ctx.lineJoin = 'round';
  if (a.type === 'highlight' || a.opacity < 1) ctx.globalCompositeOperation = 'multiply';
  switch (a.type) {
    case 'highlight':
      for (const [x1, y1, x2, y2] of a.quads) ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      break;
    case 'underline': case 'strikeout':
      ctx.lineWidth = 1;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of a.quads) {
        const y = a.type === 'underline' ? y1 + 1 : (y1 + y2) / 2;
        ctx.moveTo(x1, y); ctx.lineTo(x2, y);
      }
      ctx.stroke();
      break;
    case 'ink':
      for (const s of a.strokes) {
        const o = inkOutline(s, a.width);
        if (!o.length) continue;
        ctx.beginPath();
        o.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 'square':
      ctx.lineJoin = 'miter';
      ctx.strokeRect(a.rect[0], a.rect[1], a.rect[2] - a.rect[0], a.rect[3] - a.rect[1]);
      break;
    case 'circle': {
      const [x1, y1, x2, y2] = a.rect;
      ctx.beginPath();
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.max((x2 - x1) / 2, 0.1), Math.max((y2 - y1) / 2, 0.1), 0, 0, 2 * Math.PI);
      ctx.stroke();
      break;
    }
    case 'line': {
      const [x1, y1, x2, y2] = a.line;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      if (a.arrow) for (const [x, y] of arrowHead(a.line, a.width)) { ctx.moveTo(x, y); ctx.lineTo(x2, y2); }
      ctx.stroke();
      break;
    }
    case 'freetext': {
      const [x1, , , y2] = a.rect, fs = a.fontSize;
      ctx.font = `${fs}px Helvetica, Arial, sans-serif`;
      a.text.split('\n').forEach((line, k) => {
        ctx.save();
        ctx.translate(x1 + 4, y2 - 4 - fs - k * fs * 1.2);
        ctx.scale(1, -1);
        ctx.fillText(line, 0, 0);
        ctx.restore();
      });
      break;
    }
    case 'note': {
      const [x, y] = a.rect;
      ctx.lineWidth = 0.5;
      ctx.fillRect(x + 0.5, y + 0.5, 19, 19);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(x + 0.5, y + 0.5, 19, 19);
      ctx.beginPath();
      for (const [y0, len] of [[14, 14], [9, 14], [4, 10]]) { ctx.moveTo(x + 3, y + y0); ctx.lineTo(x + 3 + len, y + y0); }
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// ---------- edição ----------

function commit(fn, structural = false) {
  history.push(structuredClone(state.pages));
  future = [];
  fn();
  state.dirty = true;
  if (structural) renderAll(); else views.forEach((v) => drawOverlay(v));
  updateUI();
}

function undoRedo(from, to) {
  if (!from.length) return;
  to.push(structuredClone(state.pages));
  state.pages = from.pop();
  state.dirty = true;
  renderAll();
  updateUI();
}

function hit(view, [x, y], types) {
  const list = state.pages[view.i].annots;
  for (let k = list.length - 1; k >= 0; k--) {
    if (types && !types.includes(list[k].type)) continue;
    const [x1, y1, x2, y2] = bounds(list[k]);
    if (x >= x1 - 3 && x <= x2 + 3 && y >= y1 - 3 && y <= y2 + 3) return k;
  }
  return -1;
}

// Quadriláteros das linhas de texto dentro da área arrastada; sem texto (ex.: digitalizado), usa a própria área.
// shortcut: só texto horizontal e recorte por item, não por caractere; para seleção exata, usar a text layer do pdf.js.
async function textQuads(view, r) {
  const src = state.pages[view.i].src;
  if (!textCache.has(src)) textCache.set(src, (await view.page.getTextContent()).items);
  const quads = [];
  for (const it of textCache.get(src)) {
    const [, b, c, , e, f] = it.transform || [];
    if (!it.str?.trim() || b || c) continue;
    const h = it.height || 10, x1 = e, x2 = e + it.width, y1 = f - h * 0.25, y2 = f + h * 0.85;
    if (x2 < r[0] || x1 > r[2] || y2 < r[1] || y1 > r[3]) continue;
    quads.push([Math.max(x1, r[0]), y1, Math.min(x2, r[2]), y2]);
  }
  return quads.length ? quads : [r];
}

function style() {
  return { color: hexToRgb($('#color').value), width: +$('#width').value, opacity: 1, text: '' };
}

function makeDraft(tool, s, p, pts) {
  const st = style();
  const rect = norm(s[0], s[1], p[0], p[1]);
  switch (tool) {
    case 'highlight': case 'underline': case 'strikeout': return { ...st, type: tool, quads: [rect] };
    case 'pen': return { ...st, type: 'ink', strokes: [pts] };
    case 'marker': return { ...st, type: 'ink', width: st.width * 4, opacity: 0.4, strokes: [pts] };
    case 'square': case 'circle': return { ...st, type: tool, rect };
    case 'line': case 'arrow': return { ...st, type: 'line', line: [...s, ...p], arrow: tool === 'arrow' };
  }
}

function openTextEditor(view, at, existing) {
  const k = existing ?? -1;
  const old = k >= 0 ? state.pages[view.i].annots[k] : null;
  const fs = old?.fontSize ?? 14;
  const [x, y] = old ? [old.rect[0], old.rect[3]] : at;
  const [cx, cy] = view.vp.convertToViewportPoint(x, y);
  const ta = document.createElement('textarea');
  ta.value = old?.text ?? '';
  Object.assign(ta.style, { left: `${cx}px`, top: `${cy}px`, fontSize: `${fs * state.zoom}px`, color: css(old?.color ?? style().color) });
  view.el.append(ta);
  ta.focus();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    ta.remove();
    const text = ta.value.replace(/\s+$/, '');
    if (!save || text === (old?.text ?? '')) return;
    const m = document.createElement('canvas').getContext('2d');
    m.font = `${fs}px Helvetica, Arial, sans-serif`;
    const lines = text.split('\n');
    const w = Math.max(...lines.map((l) => m.measureText(l).width)) + 8, h = lines.length * fs * 1.2 + 8;
    const annot = { ...(old ?? style()), type: 'freetext', fontSize: fs, text, rect: [x, y - h, x + w, y] };
    commit(() => {
      const list = state.pages[view.i].annots;
      if (k >= 0 && !text) list.splice(k, 1);
      else if (k >= 0) list[k] = annot;
      else if (text) list.push(annot);
    });
  };
  ta.addEventListener('blur', () => finish(true));
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') finish(false);
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true);
    e.stopPropagation();
  });
}

function bindPointer(view) {
  const ov = view.overlay;
  let s = null, pts = null, draft = null;
  const toPdf = (e) => view.vp.convertToPdfPoint(e.offsetX, e.offsetY);

  ov.addEventListener('pointerdown', (e) => {
    setCurrent(view.i);
    const tool = state.tool, p = toPdf(e), list = state.pages[view.i].annots;
    if (tool === 'hand' || e.button !== 0) return;
    e.preventDefault();
    if (tool === 'eraser') {
      const k = hit(view, p);
      if (k >= 0) commit(() => list.splice(k, 1));
    } else if (tool === 'note') {
      const k = hit(view, p, ['note']);
      const text = prompt('Comentário da nota:', k >= 0 ? list[k].text : '');
      if (text === null) return;
      if (k >= 0) commit(() => (text ? (list[k] = { ...list[k], text }) : list.splice(k, 1)));
      else if (text) commit(() => list.push({ ...style(), color: [1, 0.85, 0], type: 'note', text, rect: [p[0], p[1] - NOTE_SIZE, p[0] + NOTE_SIZE, p[1]] }));
    } else if (tool === 'freetext') {
      const k = hit(view, p, ['freetext']);
      setTimeout(() => openTextEditor(view, p, k >= 0 ? k : undefined));
    } else {
      s = p;
      pts = [[...p, e.pressure || 0.5]];
      ov.setPointerCapture(e.pointerId);
    }
  });

  ov.addEventListener('pointermove', (e) => {
    if (!s) {
      const k = hit(view, toPdf(e), ['note', 'freetext']);
      ov.title = k >= 0 ? state.pages[view.i].annots[k].text : '';
      return;
    }
    const p = toPdf(e);
    for (const ce of e.getCoalescedEvents?.() ?? [e]) pts.push([...view.vp.convertToPdfPoint(ce.offsetX, ce.offsetY), ce.pressure || 0.5]);
    draft = makeDraft(state.tool, s, p, pts);
    drawOverlay(view, draft);
  });

  ov.addEventListener('pointerup', async () => {
    if (!s) return;
    const d = draft;
    s = pts = draft = null;
    if (!d) return;
    const [x1, y1, x2, y2] = bounds(d);
    if (Math.max(x2 - x1, y2 - y1) < 3 && d.type !== 'ink') return drawOverlay(view);
    if (d.quads) d.quads = await textQuads(view, d.quads[0]);
    commit(() => state.pages[view.i].annots.push(d));
  });
}

// ---------- arquivo ----------

async function openBytes(bytes, name, handle = null) {
  if (state.dirty && !confirm('Descartar as alterações não salvas?')) return;
  let loaded, pdf;
  try {
    loaded = await loadPdf(bytes);
    pdf = await pdfjs.getDocument({ data: loaded.base.slice() }).promise;
  } catch (err) {
    alert(`Não foi possível abrir "${name}": ${err.message}`);
    return;
  }
  await state.pdf?.destroy();
  Object.assign(state, { pdf, base: loaded.base, pages: loaded.pages, name, handle, current: 0, dirty: false });
  history = [];
  future = [];
  textCache.clear();
  viewer.scrollTop = 0;
  await renderAll();
}

async function openFile() {
  if (window.showOpenFilePicker) {
    try {
      const [h] = await showOpenFilePicker({ types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }] });
      const file = await h.getFile();
      return openBytes(new Uint8Array(await file.arrayBuffer()), file.name, h);
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  $('#file').click();
}

async function save() {
  if (!state.pdf) return;
  let bytes;
  try {
    bytes = await savePdf(state.base, state.pages);
  } catch (err) {
    return alert(`Erro ao gerar o PDF: ${err.message}`);
  }
  try {
    if (window.showSaveFilePicker) {
      if (!state.handle || (await state.handle.requestPermission?.({ mode: 'readwrite' })) !== 'granted') {
        state.handle = await showSaveFilePicker({ suggestedName: state.name, types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }] });
        state.name = state.handle.name;
      }
      const w = await state.handle.createWritable();
      await w.write(bytes);
      await w.close();
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), download: state.name });
      a.click();
      URL.revokeObjectURL(a.href);
    }
    state.dirty = false;
    updateUI();
  } catch (err) {
    if (err.name !== 'AbortError') alert(`Erro ao salvar: ${err.message}`);
  }
}

// ---------- eventos ----------

$('#open').onclick = openFile;
$('#save').onclick = save;
$('#file').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) openBytes(new Uint8Array(await file.arrayBuffer()), file.name);
};
for (const b of document.querySelectorAll('#bar [data-tool]')) {
  b.onclick = () => {
    state.tool = b.dataset.tool;
    viewer.dataset.tool = state.tool;
    document.querySelectorAll('#bar [data-tool]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  };
}
$('#undo').onclick = () => undoRedo(history, future);
$('#redo').onclick = () => undoRedo(future, history);
$('#zoomIn').onclick = () => { state.zoom = Math.min(state.zoom * 1.2, 5); renderAll(); };
$('#zoomOut').onclick = () => { state.zoom = Math.max(state.zoom / 1.2, 0.3); renderAll(); };
$('#rotate').onclick = () => commit(() => { const p = state.pages[state.current]; p.rot = (p.rot + 90) % 360; }, true);
$('#delete').onclick = () => {
  if (state.pages.length < 2 || !confirm(`Excluir a página ${state.current + 1}?`)) return;
  commit(() => state.pages.splice(state.current, 1), true);
};

viewer.addEventListener('scroll', () => {
  const mid = viewer.getBoundingClientRect().top + viewer.clientHeight / 2;
  const i = views.findIndex((v) => v.el.getBoundingClientRect().bottom > mid);
  if (i >= 0 && i !== state.current) setCurrent(i);
});
viewer.addEventListener('dragover', (e) => e.preventDefault());
viewer.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = [...e.dataTransfer.files].find((f) => f.name.toLowerCase().endsWith('.pdf'));
  if (file) openBytes(new Uint8Array(await file.arrayBuffer()), file.name);
});
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.target.tagName === 'TEXTAREA') return;
  const k = e.shiftKey && e.key.toLowerCase() === 'z' ? 'y' : e.key.toLowerCase();
  const act = { s: save, o: openFile, z: () => undoRedo(history, future), y: () => undoRedo(future, history) }[k];
  if (act) { e.preventDefault(); act(); }
});
window.addEventListener('beforeunload', (e) => { if (state.dirty) e.preventDefault(); });

updateUI();
