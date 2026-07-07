import { TableColumn, TemplateElement, TextAlign, TEXT_ALIGN_VALUES } from './schemas/template.schema';
import { findGoogleFont } from './google-fonts';

// Field/table paths come from a fixed dropdown on the frontend, but sanitize anyway
// so a hand-crafted API request can't break out of the intended {{ }} expression.
function sanitizeFieldPath(path: string): string {
  return path.replace(/[^a-zA-Z0-9_.[\]]/g, '');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DATA_URI_PATTERN = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

// Field/table colors come from a fixed color picker on the frontend, but sanitize anyway
// so a hand-crafted API request can't break out of the style attribute. Accepts hex,
// rgb()/rgba(), and bare CSS color keywords (e.g. "white").
const COLOR_PATTERN = /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9.,%\s]+\)|[a-zA-Z]+)$/;

function sanitizeColor(value?: string): string {
  return value && COLOR_PATTERN.test(value) ? value : '';
}

// Degrees for a CSS linear-gradient angle — any finite number is valid CSS, so this only
// guards against NaN/Infinity sneaking in from a hand-crafted request, same spirit as the
// other sanitize* helpers here.
function sanitizeGradientAngle(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 135;
}

// Builds a `background: linear-gradient(...)` declaration when both stops are present and
// valid, else falls back to a plain `background-color`/`background` from soloColor — mirrors
// how a solid color and a gradient are mutually exclusive on the same box.
function compileBackground(prop: string, soloColor: string, from?: string, to?: string, angle?: number): string {
  const fromColor = sanitizeColor(from);
  const toColor = sanitizeColor(to);
  if (fromColor && toColor) {
    return `${prop}:linear-gradient(${sanitizeGradientAngle(angle)}deg, ${fromColor}, ${toColor});`;
  }
  return soloColor ? `${prop}:${soloColor};` : '';
}

// fontFamily comes from a fixed dropdown (see GOOGLE_FONTS) — validated here too, both as
// defense in depth against a hand-crafted request and because this is also what decides
// which Google Fonts stylesheet actually gets linked in the compiled page's <head>.
function sanitizeFontFamily(value?: string): string {
  return findGoogleFont(value)?.name ?? '';
}

function sanitizeTextAlign(value?: TextAlign): TextAlign | '' {
  return value && TEXT_ALIGN_VALUES.includes(value) ? value : '';
}

// imageData comes from an authenticated upload endpoint, but validate the shape anyway
// before splicing it into an HTML attribute — base64 can't contain quotes/angle-brackets,
// so this is defense in depth against a hand-crafted API request, not the normal path.
function sanitizeImageData(imageData?: string): string {
  return imageData && DATA_URI_PATTERN.test(imageData) ? imageData : '';
}

// Per-column formatting — independent of whatever bold/textAlign the table *element* itself
// has, so e.g. a Qty column can be right-aligned while a Name column stays left-aligned.
function compileCellStyleAttr(c: TableColumn): string {
  const align = sanitizeTextAlign(c.align);
  const style = (align ? `text-align:${align};` : '') + (c.bold ? 'font-weight:700;' : '');
  return style ? ` style="${style}"` : '';
}

function compileTableCell(c: TableColumn): string {
  const path = sanitizeFieldPath(c.fieldPath);
  const styleAttr = compileCellStyleAttr(c);
  if (!c.badge) {
    return `<td${styleAttr}>{{ this.${path} }}</td>`;
  }

  const trueLabel = escapeHtml(c.badgeTrueLabel ?? 'True');
  const falseLabel = escapeHtml(c.badgeFalseLabel ?? 'False');
  const trueStyle = `background:${sanitizeColor(c.badgeTrueBg) || '#eee'};color:${sanitizeColor(c.badgeTrueColor) || '#333'}`;
  const falseStyle = `background:${sanitizeColor(c.badgeFalseBg) || '#eee'};color:${sanitizeColor(c.badgeFalseColor) || '#333'}`;
  return (
    `<td${styleAttr}>{{#if this.${path}}}<span class="badge" style="${trueStyle}">${trueLabel}</span>` +
    `{{else}}<span class="badge" style="${falseStyle}">${falseLabel}</span>{{/if}}</td>`
  );
}

function compileElement(el: TemplateElement): string {
  const color = sanitizeColor(el.color);
  const backgroundColor = sanitizeColor(el.backgroundColor);
  const background = compileBackground('background', backgroundColor, el.gradientFrom, el.gradientTo, el.gradientAngle);
  const fontFamily = sanitizeFontFamily(el.fontFamily);
  const style =
    `left:${el.x}px; top:${el.y}px; width:${el.width}px; height:${el.height}px; font-size:${el.fontSize ?? 12}px;` +
    (color ? ` color:${color};` : '') +
    (background ? ` ${background}` : '') +
    (typeof el.borderRadius === 'number' ? ` border-radius:${el.borderRadius}px;` : '') +
    // Quoted (Google Fonts names can contain spaces) with the page's default sans-serif as a
    // fallback, same as an unset fontFamily already gets via the <body> rule.
    (fontFamily ? ` font-family:'${fontFamily}', Helvetica, Arial, sans-serif;` : '') +
    (el.bold ? ' font-weight:700;' : '') +
    (el.italic ? ' font-style:italic;' : '') +
    (el.underline ? ' text-decoration:underline;' : '');

  switch (el.type) {
    case 'text':
      return `<div class="el" style="${style}">${escapeHtml(el.content ?? '')}</div>`;

    case 'field': {
      const path = sanitizeFieldPath(el.fieldPath ?? '');
      return `<div class="el" style="${style}">{{ ${path} }}</div>`;
    }

    case 'table': {
      const itemsPath = sanitizeFieldPath(el.itemsPath ?? '');
      const columns = el.columns ?? [];
      // Header alignment mirrors the column's own align (so a right-aligned Qty column has a
      // right-aligned header too) — bold is left alone since <th> is already bold by default.
      const headerCells = columns
        .map((c) => {
          const align = sanitizeTextAlign(c.align);
          return `<th${align ? ` style="text-align:${align};"` : ''}>${escapeHtml(c.label)}</th>`;
        })
        .join('');
      const bodyCells = columns.map(compileTableCell).join('');
      return `<div class="el" style="${style}"><table><thead><tr>${headerCells}</tr></thead><tbody>{{#each ${itemsPath}}}<tr>${bodyCells}</tr>{{/each}}</tbody></table></div>`;
    }

    case 'image': {
      const src = sanitizeImageData(el.imageData);
      if (!src) return `<div class="el image-el" style="${style}"></div>`;
      return `<div class="el image-el" style="${style}"><img src="${src}" alt="" /></div>`;
    }

    // A pure background/border rect — no content of its own, just the shared color/
    // backgroundColor/borderRadius styling above (e.g. a sidebar panel behind other elements
    // placed on top of it).
    case 'panel':
      return `<div class="el panel-el" style="${style}"></div>`;

    default:
      return '';
  }
}

export function compileTemplateToHtml(template: {
  pageWidth: number;
  pageHeight: number;
  pageBackgroundColor?: string;
  pageGradientFrom?: string;
  pageGradientTo?: string;
  pageGradientAngle?: number;
  pageCount?: number;
  elements: TemplateElement[];
}): string {
  const pageCount = template.pageCount ?? 1;
  const pageBackgroundColor = sanitizeColor(template.pageBackgroundColor) || '#fff';
  const pageBackground =
    compileBackground('background', pageBackgroundColor, template.pageGradientFrom, template.pageGradientTo, template.pageGradientAngle) ||
    `background:${pageBackgroundColor};`;

  // One .page div per page, each holding only the elements placed on it (element.page is
  // 0-indexed). page-break-after forces Puppeteer's print-to-PDF to start a new PDF page at
  // each boundary — :last-child skips the break after the final page so it doesn't leave a
  // trailing blank page.
  const pagesHtml = Array.from({ length: pageCount }, (_, pageIndex) => {
    const elementsHtml = template.elements
      .filter((el) => (el.page ?? 0) === pageIndex)
      .map(compileElement)
      .join('\n');
    return `<div class="page">\n${elementsHtml}\n</div>`;
  }).join('\n');

  // Only the fonts this template actually uses get linked — not the whole curated list —
  // so a template that never picks a custom font makes no external request at all.
  const usedGoogleFamilies = [
    ...new Set(template.elements.map((el) => findGoogleFont(el.fontFamily)?.googleFamily).filter((f): f is string => !!f)),
  ];
  const googleFontsLink =
    usedGoogleFamilies.length > 0
      ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${usedGoogleFamilies.map((f) => `family=${f}`).join('&')}&display=swap" />\n`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
${googleFontsLink}<style>
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; background: #fff; }
  /* Explicit white — without it, Puppeteer's screenshot() (preview-image) renders the
     unset background as black, unlike pdf() which happens to default to white paper. */
  .page { position: relative; width: ${template.pageWidth}px; height: ${template.pageHeight}px; overflow: hidden; page-break-after: always; ${pageBackground} }
  .page:last-child { page-break-after: auto; }
  .el { position: absolute; box-sizing: border-box; overflow: hidden; padding: 2px 4px; white-space: nowrap; }
  .el table { white-space: normal; }
  .el.image-el { padding: 0; }
  .el.image-el img { display: block; width: 100%; height: 100%; object-fit: contain; }
  /* No content of its own, so no padding either — with box-sizing: border-box, the shared
     2px/4px .el padding can't shrink below its own size, which would silently floor a thin
     (e.g. 1px) panel's rendered height/width regardless of what was actually set. */
  .el.panel-el { padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; font-size: inherit; text-align: left; }
  .badge { display: inline-flex; padding: 2px 8px; border-radius: 999px; font-weight: 700; }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}
