# Graph Report - anota-pdf  (2026-11-01)

## Corpus Check
- Corpus is ~5,200 words - fits in a single context window. You may not need a graph.

## Summary
- 99 nodes · 179 edges · 13 communities
- Extraction: 88% EXTRACTED · 12% INFERRED · 1% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.85)
- Token cost: 69,713 input · 0 output

## Community Hubs (Navigation)
- Produto e UI do Editor
- Leitura e Escrita de PDF
- Estado do Editor (main.js)
- Manifesto do Pacote
- Testes de PDF
- Texto e Limites Conhecidos
- Interação com Ponteiro
- Navegação e Modo Livro
- Dependências de Runtime
- Scripts npm
- Estilo e Rascunho de Anotação
- Lançadores Mac/Windows
- Renderização e Salvamento

## God Nodes (most connected - your core abstractions)
1. `bindPointer()` - 11 edges
2. `savePdf()` - 9 edges
3. `renderAll()` - 8 edges
4. `appearance()` - 8 edges
5. `f()` - 7 edges
6. `bounds()` - 7 edges
7. `updateUI()` - 6 edges
8. `setCurrent()` - 6 edges
9. `drawAnnot()` - 6 edges
10. `commit()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `data-tool buttons` --implements--> `Text markup (highlight, underline, strikeout)`  [INFERRED]
  index.html → README.md
- `Book mode (2 pages side by side)` --conceptually_related_to--> `All pages rendered at once`  [AMBIGUOUS]
  index.html → README.md
- `data-tool buttons` --implements--> `Pressure-sensitive pen and free marker`  [INFERRED]
  index.html → README.md
- `data-tool buttons` --implements--> `Shapes (rectangle, ellipse, line, arrow)`  [INFERRED]
  index.html → README.md
- `drawAnnot()` --calls--> `arrowHead()`  [EXTRACTED]
  src/main.js → src/pdf.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Annotation toolset exposed in toolbar** — index_tool_buttons, readme_text_markup_annotations, readme_freehand_ink, readme_shape_annotations, readme_freetext_and_note [INFERRED 0.85]
- **Permissively licensed PDF library stack** — src_pdf, readme_pdfme_pdf_lib, readme_perfect_freehand, readme_permissive_licensing [EXTRACTED 1.00]
- **Saved annotation fidelity (/AP, multiply preview, round-trip)** — readme_standard_pdf_annotations_ap, index_overlay_multiply_blend, readme_annotation_roundtrip [INFERRED 0.85]

## Communities (13 total, 0 thin omitted)

### Community 0 - "Produto e UI do Editor"
Cohesion: 0.13
Nodes (15): Book mode (2 pages side by side), #file hidden PDF input, index.html (editor shell), data-tool buttons, #bar toolbar, #viewer container, Reopened PDF restores annotations as editable, Anota PDF (+7 more)

### Community 1 - "Leitura e Escrita de PDF"
Cohesion: 0.29
Nodes (16): appearance(), arrowHead(), bounds(), ellipseOps(), f(), inkOutline(), loadPdf(), N() (+8 more)

### Community 2 - "Estado do Editor (main.js)"
Cohesion: 0.22
Nodes (9): future, history, openBytes(), openFile(), state, textCache, viewer, views (+1 more)

### Community 3 - "Manifesto do Pacote"
Cohesion: 0.22
Nodes (8): devDependencies, vite, name, private, type, version, perfect-freehand, vite

### Community 4 - "Testes de PDF"
Cohesion: 0.22
Nodes (7): pdfjs-dist, @pdfme/pdf-lib, blue, ft, got, model, types

### Community 5 - "Texto e Limites Conhecidos"
Cohesion: 0.40
Nodes (4): Page textarea (Helvetica text input), Text box and note (editable on click), Known limits, Text markup (highlight, underline, strikeout)

### Community 6 - "Interação com Ponteiro"
Cohesion: 0.47
Nodes (6): bindPointer(), commit(), drawOverlay(), hit(), openTextEditor(), textQuads()

### Community 7 - "Navegação e Modo Livro"
Cohesion: 0.60
Nodes (6): flip(), pairStart(), renderAll(), setCurrent(), undoRedo(), updateUI()

### Community 8 - "Dependências de Runtime"
Cohesion: 0.50
Nodes (4): dependencies, pdfjs-dist, @pdfme/pdf-lib, perfect-freehand

### Community 9 - "Scripts npm"
Cohesion: 0.50
Nodes (4): scripts, build, dev, test

### Community 10 - "Estilo e Rascunho de Anotação"
Cohesion: 0.50
Nodes (4): hexToRgb(), makeDraft(), norm(), style()

### Community 11 - "Lançadores Mac/Windows"
Cohesion: 1.00
Nodes (3): Abrir Anota PDF.command, npm run dev / npm test, Abrir Anota PDF.bat

### Community 12 - "Renderização e Salvamento"
Cohesion: 0.67
Nodes (3): css(), drawAnnot(), save()

## Ambiguous Edges - Review These
- `All pages rendered at once` → `Book mode (2 pages side by side)`  [AMBIGUOUS]
  index.html · relation: conceptually_related_to

## Knowledge Gaps
- **5 isolated node(s):** `vite`, `Node.js`, `Shapes (rectangle, ellipse, line, arrow)`, `Undo/redo`, `Rotate and delete page`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 32 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Anota PDF` connect `Produto e UI do Editor` to `Leitura e Escrita de PDF`?**
  _High betweenness centrality (0.327) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `f()` (e.g. with `bounds()` and `savePdf()`) actually correct?**
  _`f()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `vite`, `Node.js`, `Shapes (rectangle, ellipse, line, arrow)` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Produto e UI do Editor` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._
- **Why does `pdfjs-dist` connect `Testes de PDF` to `Estado do Editor (main.js)`, `Manifesto do Pacote`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `All pages rendered at once` and `Book mode (2 pages side by side)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._