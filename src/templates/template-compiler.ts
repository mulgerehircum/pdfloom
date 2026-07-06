import { TableColumn, TemplateElement } from './schemas/template.schema';

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

// imageData comes from an authenticated upload endpoint, but validate the shape anyway
// before splicing it into an HTML attribute — base64 can't contain quotes/angle-brackets,
// so this is defense in depth against a hand-crafted API request, not the normal path.
function sanitizeImageData(imageData?: string): string {
  return imageData && DATA_URI_PATTERN.test(imageData) ? imageData : '';
}

function compileTableCell(c: TableColumn): string {
  const path = sanitizeFieldPath(c.fieldPath);
  if (!c.badge) {
    return `<td>{{ this.${path} }}</td>`;
  }

  const trueLabel = escapeHtml(c.badgeTrueLabel ?? 'True');
  const falseLabel = escapeHtml(c.badgeFalseLabel ?? 'False');
  const trueStyle = `background:${sanitizeColor(c.badgeTrueBg) || '#eee'};color:${sanitizeColor(c.badgeTrueColor) || '#333'}`;
  const falseStyle = `background:${sanitizeColor(c.badgeFalseBg) || '#eee'};color:${sanitizeColor(c.badgeFalseColor) || '#333'}`;
  return (
    `<td>{{#if this.${path}}}<span class="badge" style="${trueStyle}">${trueLabel}</span>` +
    `{{else}}<span class="badge" style="${falseStyle}">${falseLabel}</span>{{/if}}</td>`
  );
}

function compileElement(el: TemplateElement): string {
  const color = sanitizeColor(el.color);
  const backgroundColor = sanitizeColor(el.backgroundColor);
  const style =
    `left:${el.x}px; top:${el.y}px; width:${el.width}px; height:${el.height}px; font-size:${el.fontSize ?? 12}px;` +
    (color ? ` color:${color};` : '') +
    (backgroundColor ? ` background-color:${backgroundColor};` : '') +
    (typeof el.borderRadius === 'number' ? ` border-radius:${el.borderRadius}px;` : '');

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
      const headerCells = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
      const bodyCells = columns.map(compileTableCell).join('');
      return `<div class="el" style="${style}"><table><thead><tr>${headerCells}</tr></thead><tbody>{{#each ${itemsPath}}}<tr>${bodyCells}</tr>{{/each}}</tbody></table></div>`;
    }

    case 'image': {
      const src = sanitizeImageData(el.imageData);
      if (!src) return `<div class="el" style="${style}"></div>`;
      return `<div class="el image-el" style="${style}"><img src="${src}" alt="" /></div>`;
    }

    default:
      return '';
  }
}

export function compileTemplateToHtml(template: {
  pageWidth: number;
  pageHeight: number;
  pageCount?: number;
  elements: TemplateElement[];
}): string {
  const pageCount = template.pageCount ?? 1;

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

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; background: #fff; }
  /* Explicit white — without it, Puppeteer's screenshot() (preview-image) renders the
     unset background as black, unlike pdf() which happens to default to white paper. */
  .page { position: relative; width: ${template.pageWidth}px; height: ${template.pageHeight}px; overflow: hidden; page-break-after: always; background: #fff; }
  .page:last-child { page-break-after: auto; }
  .el { position: absolute; box-sizing: border-box; overflow: hidden; padding: 2px 4px; white-space: nowrap; }
  .el table { white-space: normal; }
  .el.image-el { padding: 0; }
  .el.image-el img { display: block; width: 100%; height: 100%; object-fit: contain; }
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
