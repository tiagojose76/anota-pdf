# Anota PDF

Editor de anotações de PDF próprio (pdf.js + @pdfme/pdf-lib + perfect-freehand, todas com licença MIT/Apache-2.0).

## Usar

Precisa do [Node.js](https://nodejs.org) instalado. O navegador abre o editor; arraste um PDF para a janela ou clique em **Abrir**.

- Windows: dois cliques em `Abrir Anota PDF.bat`.
- Mac: dois cliques em `Abrir Anota PDF.command`. Na primeira vez, se o Mac bloquear, clique com o botão direito → **Abrir**; se disser que falta permissão, rode uma vez no Terminal, dentro da pasta: `chmod +x "Abrir Anota PDF.command"`.
- Linux: no terminal, dentro da pasta, `sh "Abrir Anota PDF.command"`.

Linha de comando: `npm run dev`. Teste do núcleo: `npm test`. No Mac, os atalhos usam ⌘ no lugar de Ctrl.

## O que faz

- Realce, sublinhado e riscado de texto (arrastar sobre a linha), caneta com pressão, marca-texto livre
- Retângulo, elipse, linha e seta; caixa de texto e nota (clique numa existente para editar); borracha
- Cor e espessura, desfazer/refazer (Ctrl/⌘+Z; Ctrl/⌘+Y ou Ctrl/⌘+Shift+Z), zoom
- Girar e excluir página
- Salvar (Ctrl/⌘+S) como anotações PDF padrão com aparência (/AP): abrem no Acrobat, no Edge, no Chrome etc.
- Reabrir um PDF salvo traz as anotações de volta como editáveis

## Limites conhecidos

- Formulários, links e outras anotações do PDF aparecem, mas não são editáveis
- O realce recorta por trecho de texto, não por caractere; texto girado não é detectado
- Caixa de texto usa Helvetica: caracteres fora do Latin-1 aparecem como `?` no PDF salvo
- Sem inserir, mesclar ou reordenar páginas; sem calibração, OCR, camadas ou assinatura certificada
- Todas as páginas são renderizadas de uma vez (PDFs muito grandes ficam lentos)
