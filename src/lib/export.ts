import jsPDF from 'jspdf';
import type { PaperSpec } from '@/engines/types';

/**
 * SVG → PNG → download.
 * Renders the source SVG onto a canvas at high DPI, exports as PNG.
 */
export async function exportSvgAsPng(
  svg: SVGSVGElement,
  filename: string,
  paper: PaperSpec,
  dpi = 200
): Promise<void> {
  const widthPx = mmToPx(paper.widthMm, dpi);
  const heightPx = mmToPx(paper.heightMm, dpi);

  const blob = await rasterizeSvg(svg, widthPx, heightPx);
  triggerDownload(blob, `${filename}.png`);
}

/**
 * SVG → PNG → PDF page sized to paper.
 */
export async function exportSvgAsPdf(
  svg: SVGSVGElement,
  filename: string,
  paper: PaperSpec
): Promise<void> {
  const dpi = 200;
  const widthPx = mmToPx(paper.widthMm, dpi);
  const heightPx = mmToPx(paper.heightMm, dpi);
  const blob = await rasterizeSvg(svg, widthPx, heightPx);
  const dataUrl = await blobToDataUrl(blob);

  // jsPDF supports a custom format in mm
  const pdf = new jsPDF({
    orientation: paper.widthMm > paper.heightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [paper.widthMm, paper.heightMm],
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, paper.widthMm, paper.heightMm);
  pdf.save(`${filename}.pdf`);
}

function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

async function rasterizeSvg(
  svg: SVGSVGElement,
  widthPx: number,
  heightPx: number
): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Ensure explicit width/height + xmlns
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(widthPx));
  clone.setAttribute('height', String(heightPx));
  if (!clone.getAttribute('viewBox')) {
    const w = svg.getAttribute('width') ?? '0';
    const h = svg.getAttribute('height') ?? '0';
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.drawImage(img, 0, 0, widthPx, heightPx);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('canvas.toBlob returned null'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
