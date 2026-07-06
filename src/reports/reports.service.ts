import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { ProductsService } from '../products/products.service';
import { Product } from '../products/schemas/product.schema';
import { TemplatesService } from '../templates/templates.service';
import { compileTemplateToHtml } from '../templates/template-compiler';
import { PreviewTemplateDto } from '../templates/dto/preview-template.dto';

const DEFAULT_PAGE_WIDTH = 794;
const DEFAULT_PAGE_HEIGHT = 1123;
const MIN_PREVIEW_WIDTH = 40; // guards against a degenerate/zero-size screenshot request

export interface ReportProductRow {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: string;
  value: string;
  isLowStock: boolean;
}

export interface ReportContext {
  generatedAt: string;
  products: ReportProductRow[];
  totalValue: string;
  totalSkus: number;
  unitsInStock: number;
  needsRestocking: number;
}

// The template editor's field/column pickers read this instead of a hand-maintained list —
// see ReportsService.getFieldSchema, which derives both arrays from the real context-building
// code below rather than a parallel declaration that could silently drift out of sync (the
// bug that motivated this in the first place).
export interface ReportFieldSchema {
  scalarFields: string[];
  productFields: string[];
}

// Only used to materialize a ReportProductRow's keys when no real products exist yet (see
// getFieldSchema) — values are never shown to a user, only the resulting object's keys matter.
const EMPTY_PRODUCT_SOURCE = { sku: '', name: '', category: '', quantity: 0, unitPrice: 0, lowStockThreshold: 0 };

@Injectable()
export class ReportsService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly templatesService: TemplatesService
  ) {}

  // Data-independent field/column list for the editor's pickers, derived from the actual
  // context-building code rather than a hand-maintained mirror of it — adding a field to
  // buildReportContext's return value or to mapProductToRow shows up here automatically,
  // with no second place to remember to update.
  async getFieldSchema(): Promise<ReportFieldSchema> {
    const context = await this.buildReportContext();
    const sampleRow = context.products[0] ?? this.mapProductToRow(EMPTY_PRODUCT_SOURCE);
    return {
      scalarFields: Object.keys(context).filter((key) => key !== 'products'),
      productFields: Object.keys(sampleRow),
    };
  }

  // Exposed so the template editor can show/measure real field values (e.g. "generatedAt")
  // instead of the raw {{ fieldPath }} placeholder, which is a different length and was
  // causing auto-fit boxes to clip the real value once rendered into the actual PDF.
  async getReportContext(): Promise<ReportContext> {
    return this.buildReportContext();
  }

  private mapProductToRow(product: Pick<Product, 'sku' | 'name' | 'category' | 'quantity' | 'unitPrice' | 'lowStockThreshold'>): ReportProductRow {
    return {
      sku: product.sku,
      name: product.name,
      category: product.category ?? '-',
      quantity: product.quantity,
      unitPrice: product.unitPrice.toFixed(2),
      value: (product.quantity * product.unitPrice).toFixed(2),
      isLowStock: product.quantity <= product.lowStockThreshold,
    };
  }

  private async buildReportContext(): Promise<ReportContext> {
    const products = await this.productsService.findAll();
    const rows = products.map((product) => this.mapProductToRow(product));

    const totalValue = rows.reduce((sum, row) => sum + Number(row.value), 0).toFixed(2);
    const totalSkus = rows.length;
    const unitsInStock = rows.reduce((sum, row) => sum + row.quantity, 0);
    const needsRestocking = rows.filter((row) => row.isLowStock).length;

    const generatedAt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

    return { generatedAt, products: rows, totalValue, totalSkus, unitsInStock, needsRestocking };
  }

  private async renderHtmlToPdf(html: string, margin = { top: '20px', bottom: '20px' }): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // Screenshots just the first .page box (clip, not the full scrollable document) — a
  // template can have multiple pages, but a picker thumbnail only ever needs the first.
  //
  // targetWidth is optional — omitted, this renders at the page's true resolution; passed,
  // it renders proportionally smaller (never larger — upscaling a screenshot request past
  // the real page size would just waste bandwidth for no extra detail). The .page box is
  // shrunk via a CSS transform (not a smaller viewport alone), the same technique the
  // frontend's own thumbnail rail uses, so every absolutely-positioned element scales down
  // together with it instead of overflowing/clipping against a viewport that no longer
  // matches the coordinate system they were positioned in.
  private async renderHtmlToImage(html: string, pageWidth: number, pageHeight: number, targetWidth?: number): Promise<Buffer> {
    const clampedWidth = targetWidth ? Math.min(Math.max(targetWidth, MIN_PREVIEW_WIDTH), pageWidth) : pageWidth;
    const scale = clampedWidth / pageWidth;
    const clampedHeight = Math.round(pageHeight * scale);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: clampedWidth, height: clampedHeight });
      await page.setContent(html, { waitUntil: 'load' });
      if (scale !== 1) {
        await page.evaluate((s) => {
          const pageEl = document.querySelector<HTMLElement>('.page');
          if (pageEl) {
            pageEl.style.transform = `scale(${s})`;
            pageEl.style.transformOrigin = 'top left';
          }
        }, scale);
      }
      const screenshot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: clampedWidth, height: clampedHeight } });
      return Buffer.from(screenshot);
    } finally {
      await browser.close();
    }
  }

  async renderStockReportHtml(): Promise<string> {
    const context = await this.buildReportContext();
    const templateSource = await readFile(join(__dirname, 'templates', 'stock-report.hbs'), 'utf-8');
    return handlebars.compile(templateSource)(context);
  }

  async renderStockReportPdf(): Promise<Buffer> {
    return this.renderHtmlToPdf(await this.renderStockReportHtml());
  }

  async renderCustomTemplateHtml(templateId: string): Promise<string> {
    const template = await this.templatesService.findOne(templateId);
    const context = await this.buildReportContext();
    return handlebars.compile(template.compiledTemplate)(context);
  }

  async renderCustomTemplatePdf(templateId: string): Promise<Buffer> {
    // Custom templates render an absolutely-positioned page box sized to the exact
    // A4 pixel dimensions, so no extra Puppeteer margin should eat into that box
    // (otherwise the tail of the page overflows onto a blank second page).
    return this.renderHtmlToPdf(await this.renderCustomTemplateHtml(templateId), { top: '0px', bottom: '0px' });
  }

  // Renders a saved template's first page as a PNG thumbnail, for a not-yet-built template
  // picker UI. Unlike renderCustomTemplateHtml/Pdf (public, ownership-agnostic — those exist
  // so a shared "download PDF" link works for anyone), this checks ownership: a picker
  // showing thumbnails of "my templates" shouldn't render someone else's template on request.
  async renderTemplatePreviewImage(templateId: string, ownerId: string, width?: number): Promise<Buffer> {
    const template = await this.templatesService.findOwned(templateId, ownerId);
    const context = await this.buildReportContext();
    const html = handlebars.compile(template.compiledTemplate)(context);
    return this.renderHtmlToImage(html, template.pageWidth, template.pageHeight, width);
  }

  // Compiles + renders an in-progress (unsaved) template layout directly, so the editor
  // can show a live preview without writing every keystroke to the database.
  async renderPreviewPdf(dto: PreviewTemplateDto): Promise<Buffer> {
    const compiled = compileTemplateToHtml({
      pageWidth: dto.pageWidth ?? DEFAULT_PAGE_WIDTH,
      pageHeight: dto.pageHeight ?? DEFAULT_PAGE_HEIGHT,
      pageCount: dto.pageCount ?? 1,
      elements: dto.elements as any,
    });
    const context = await this.buildReportContext();
    const html = handlebars.compile(compiled)(context);
    return this.renderHtmlToPdf(html, { top: '0px', bottom: '0px' });
  }
}
