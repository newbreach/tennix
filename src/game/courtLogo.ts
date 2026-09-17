// High-fidelity DONG [动] tennis court ground sponsor logo renderer
// Creates an offscreen rasterization and renders with proper 1:1 proportions and subtle 2.5D ground perspective

let cachedLogoCanvas: HTMLCanvasElement | null = null;

export function getOrCreateLogoCanvas(): HTMLCanvasElement {
  if (cachedLogoCanvas) {
    return cachedLogoCanvas;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Dark Olive Green badge background (#23301b)
  ctx.clearRect(0, 0, 512, 512);
  const badgeRadius = 48;
  ctx.fillStyle = '#23301b';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(16, 16, 480, 480, badgeRadius);
  } else {
    const x = 16, y = 16, w = 480, h = 480, r = badgeRadius;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  }
  ctx.fill();

  // Subtle clean border
  ctx.strokeStyle = '#324227';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Primary accent color (pale matcha lime: #d2eca0)
  const accentColor = '#d2eca0';

  // 2. Draw the Stylized Slanted "D"
  ctx.save();
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  // Outer shape of the italic "D"
  ctx.moveTo(194, 98);
  ctx.lineTo(280, 98);
  ctx.bezierCurveTo(342, 98, 386, 138, 386, 202);
  ctx.bezierCurveTo(386, 266, 342, 306, 276, 306);
  ctx.lineTo(142, 306);
  ctx.closePath();

  // Inner cutout
  ctx.moveTo(218, 146);
  ctx.lineTo(184, 258);
  ctx.lineTo(262, 258);
  ctx.bezierCurveTo(302, 258, 330, 234, 330, 202);
  ctx.bezierCurveTo(330, 170, 302, 146, 262, 146);
  ctx.closePath();

  ctx.fill('evenodd');
  ctx.restore();

  // 3. Draw Tennis Ball Icon at lower-right of the "D"
  ctx.save();
  ctx.translate(366, 304);
  ctx.rotate(-0.32);

  // Ball outline
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4.4;
  ctx.fillStyle = '#23301b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ball curved seams
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.arc(-22, 0, 15, -0.9, 0.9, false);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(22, 0, 15, Math.PI - 0.9, Math.PI + 0.9, false);
  ctx.stroke();

  ctx.restore();

  // 4. Draw Typography: DONG [动]
  ctx.save();
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  ctx.fillText('DONG [动]', 256, 404);
  ctx.restore();

  cachedLogoCanvas = canvas;
  return canvas;
}

/**
 * Render the logo decal onto the tennis court ground with 1:1 true proportions
 * (perspective-compensated so it never gets flattened/squished)
 */
export function renderCourtGroundLogo(
  ctx: CanvasRenderingContext2D,
  projectPoint: (x: number, y: number, z: number, w: number, h: number) => { x: number; y: number; scale: number },
  centerX: number,
  centerY: number,
  canvasW: number,
  canvasH: number,
  sizeScale = 1.0,
  alpha = 0.95
) {
  const logo = getOrCreateLogoCanvas();

  // Center projection of decal on court ground (Z = 0)
  const centerScreen = projectPoint(centerX, centerY, 0, canvasW, canvasH);

  // Size calculation strictly preserving 1:1 aspect ratio
  // Base visual size on screen proportional to canvas width
  const baseSize = Math.max(56, Math.min(canvasW * 0.22, 96)) * (centerScreen.scale / 0.88) * sizeScale;

  // Keep height and width equal on screen for undistorted 1:1 proportions
  const hOnScreen = baseSize * 0.96;
  const bottomW = baseSize * 1.04;
  const topW = baseSize * 0.88;

  const cx = centerScreen.x;
  const cy = centerScreen.y;

  const topY = cy - hOnScreen * 0.5;
  const bottomY = cy + hOnScreen * 0.5;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Draw smooth perspective-mapped horizontal slices
  const SLICES = 16;
  const imgW = logo.width;
  const imgH = logo.height;

  for (let i = 0; i < SLICES; i++) {
    const t0 = i / SLICES;
    const t1 = (i + 1) / SLICES;

    const sliceY0 = topY + t0 * (bottomY - topY);
    const sliceY1 = topY + t1 * (bottomY - topY);
    const sliceH = Math.max(1, sliceY1 - sliceY0 + 0.6);

    const w0 = topW + t0 * (bottomW - topW);
    const w1 = topW + t1 * (bottomW - topW);
    const sliceW = (w0 + w1) * 0.5;

    const sliceX = cx - sliceW * 0.5;

    const srcY = t0 * imgH;
    const srcH = (t1 - t0) * imgH;

    ctx.drawImage(
      logo,
      0,
      srcY,
      imgW,
      srcH,
      sliceX,
      sliceY0,
      sliceW,
      sliceH
    );
  }

  ctx.restore();
}

