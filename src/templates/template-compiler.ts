import { TemplateElement } from './schemas/template.schema';

// Field/table paths come from a fixed dropdown on the frontend, but sanitize anyway
// so a hand-crafted API request can't break out of the intended {{ }} expression.
function sanitizeFieldPath(path: string): string {
  return path.replace(/[^a-zA-Z0-9_.[\]]/g, '');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DATA_URI_PATTERN = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

// imageData comes from an authenticated upload endpoint, but validate the shape anyway
// before splicing it into an HTML attribute — base64 can't contain quotes/angle-brackets,
// so this is defense in depth against a hand-crafted API request, not the normal path.
function sanitizeImageData(imageData?: string): string {
  return imageData && DATA_URI_PATTERN.test(imageData) ? imageData : '';
}

function compileElement(el: TemplateElement): string {
  const style = `left:${el.x}px; top:${el.y}px; width:${el.width}px; height:${el.height}px; font-size:${el.fontSize ?? 12}px;`;

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
      const bodyCells = columns.map((c) => `<td>{{ this.${sanitizeFieldPath(c.fieldPath)} }}</td>`).join('');
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
  elements: TemplateElement[];
}): string {
  const elementsHtml = template.elements.map(compileElement).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; }
  .page { position: relative; width: ${template.pageWidth}px; height: ${template.pageHeight}px; }
  .el { position: absolute; box-sizing: border-box; overflow: hidden; padding: 2px 4px; white-space: nowrap; }
  .el table { white-space: normal; }
  .el.image-el { padding: 0; }
  .el.image-el img { display: block; width: 100%; height: 100%; object-fit: contain; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; font-size: inherit; text-align: left; }
</style>
</head>
<body>
  <div class="page">
${elementsHtml}
  </div>
</body>
</html>`;
}
