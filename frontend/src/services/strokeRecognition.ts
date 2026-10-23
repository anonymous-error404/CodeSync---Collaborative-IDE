import type { CanvasElement } from '../types/whiteboard';

/**
 * Purely deterministic geometric stroke recognition for the engineering whiteboard.
 * Recognizes circle, triangle, diamond, rectangle, and arrow.
 */
export function recognizeStrokeLocally(
  points: Array<{ x: number; y: number }>,
): Partial<CanvasElement> | null {
  if (!points || points.length < 5) return null;

  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));

  const width = maxX - minX;
  const height = maxY - minY;
  const start = points[0];
  const end = points[points.length - 1];
  const distanceStartEnd = Math.hypot(end.x - start.x, end.y - start.y);

  if (width < 15 && height < 15) return null;

  const isClosed = distanceStartEnd < Math.max(width, height) * 0.45;

  if (isClosed) {
    const aspectRatio = width / height;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;
    const avgRadius = (width + height) / 4;

    // 1. Radial deviation for circle
    let totalRadialDev = 0;
    const sampleStep = Math.max(1, Math.floor(points.length / 24));
    let sampleCount = 0;
    for (let i = 0; i < points.length; i += sampleStep) {
      const r = Math.hypot(points[i].x - centerX, points[i].y - centerY);
      totalRadialDev += Math.abs(r - avgRadius);
      sampleCount++;
    }
    const meanRadialDev = sampleCount > 0 ? (totalRadialDev / sampleCount) / avgRadius : 1;

    // 2. Triangle analysis via slice widths
    const topPoints = points.filter(p => p.y < minY + height * 0.25);
    const botPoints = points.filter(p => p.y > maxY - height * 0.25);
    const midPoints = points.filter(p => p.y >= minY + height * 0.35 && p.y <= maxY - height * 0.35);

    const spanX = (pts: Array<{ x: number; y: number }>) => {
      if (pts.length < 2) return 0;
      return Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x));
    };
    const spanY = (pts: Array<{ x: number; y: number }>) => {
      if (pts.length < 2) return 0;
      return Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y));
    };

    const topSpan = spanX(topPoints);
    const botSpan = spanX(botPoints);
    const midSpan = spanX(midPoints);

    const isUprightTriangle = topPoints.length > 0 && botPoints.length > 0 &&
      topSpan < width * 0.35 && botSpan > width * 0.60;

    const isInvertedTriangle = topPoints.length > 0 && botPoints.length > 0 &&
      botSpan < width * 0.35 && topSpan > width * 0.60;

    const leftPoints = points.filter(p => p.x < minX + width * 0.25);
    const rightPoints = points.filter(p => p.x > maxX - width * 0.25);
    const leftSpan = spanY(leftPoints);
    const rightSpan = spanY(rightPoints);
    const isLeftTriangle = leftPoints.length > 0 && rightPoints.length > 0 && leftSpan < height * 0.35 && rightSpan > height * 0.60;
    const isRightTriangle = leftPoints.length > 0 && rightPoints.length > 0 && rightSpan < height * 0.35 && leftSpan > height * 0.60;

    const isTriangle = isUprightTriangle || isInvertedTriangle || isLeftTriangle || isRightTriangle;

    // 3. Diamond analysis
    const isDiamond = !isTriangle &&
      topSpan < width * 0.40 &&
      botSpan < width * 0.40 &&
      midSpan > width * 0.70 &&
      aspectRatio >= 0.65 && aspectRatio <= 1.5;

    // Match circle
    if (meanRadialDev < 0.20 && aspectRatio >= 0.72 && aspectRatio <= 1.38 && !isTriangle && !isDiamond) {
      const size = Math.max(width, height);
      return {
        type: 'circle',
        x: centerX - size / 2,
        y: centerY - size / 2,
        width: size,
        height: size,
        confidence: 0.92,
      };
    }

    if (isTriangle) {
      return {
        type: 'triangle',
        x: minX,
        y: minY,
        width,
        height,
        confidence: 0.88,
      };
    }

    if (isDiamond) {
      return {
        type: 'diamond',
        x: minX,
        y: minY,
        width,
        height,
        confidence: 0.86,
      };
    }

    return {
      type: 'rectangle',
      x: minX,
      y: minY,
      width,
      height,
      confidence: 0.84,
    };
  }

  // Open shape: line or arrow
  const totalPathLength = points.reduce((acc, p, idx) => {
    if (idx === 0) return 0;
    return acc + Math.hypot(p.x - points[idx - 1].x, p.y - points[idx - 1].y);
  }, 0);

  const straightLength = distanceStartEnd;
  const straightness = straightLength / (totalPathLength || 1);

  if (straightness > 0.80) {
    return {
      type: 'arrow',
      x: start.x,
      y: start.y,
      points: [start, end],
      confidence: 0.90,
    };
  }

  return null;
}
