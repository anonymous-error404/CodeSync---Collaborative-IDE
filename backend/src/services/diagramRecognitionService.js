/**
 * Deterministic diagram recognition and layout service.
 *
 * All operations are purely algorithmic — no LLMs, no AI APIs.
 *
 * Exports:
 *   recognizeStroke(points)   — geometric shape recognition
 *   autoAlignLayout(elements) — grid-snap alignment
 *   generateStepDiagram(text) — step diagram from bullet list (preserved for compatibility)
 */

/**
 * Recognizes a freehand stroke and returns a candidate shape if matched.
 * @param {Array<{x: number, y: number}>} points
 * @returns {object|null}
 */
export function recognizeStroke(points) {
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

    // 1. Radial deviation for circle check
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

    const spanX = (pts) => {
      if (pts.length < 2) return 0;
      return Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x));
    };
    const spanY = (pts) => {
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

/**
 * Snaps elements to a 20px grid (clean layout).
 * @param {Array<object>} elements
 * @returns {Array<object>}
 */
export function autoAlignLayout(elements) {
  if (!Array.isArray(elements) || elements.length === 0) return elements;
  const GRID_SIZE = 20;

  return elements.map(el => {
    if (['rectangle', 'circle', 'diamond', 'sticky', 'text', 'code_cell', 'frame'].includes(el.type)) {
      const snappedX = Math.round((el.x || 0) / GRID_SIZE) * GRID_SIZE;
      const snappedY = Math.round((el.y || 0) / GRID_SIZE) * GRID_SIZE;
      const snappedW = el.width ? Math.round(el.width / GRID_SIZE) * GRID_SIZE : el.width;
      const snappedH = el.height ? Math.round(el.height / GRID_SIZE) * GRID_SIZE : el.height;
      return {
        ...el,
        x: snappedX,
        y: snappedY,
        width: Math.max(GRID_SIZE, snappedW || 0),
        height: Math.max(GRID_SIZE, snappedH || 0),
      };
    }
    return el;
  });
}

/**
 * Converts a bullet list or newline-separated text into sequential step nodes.
 * Preserved for API compatibility.
 * @param {string} rawText
 * @returns {Array<object>}
 */
export function generateStepDiagram(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split('\n').filter(l => l.trim().length > 0);
  const startX = 100, startY = 100, stepWidth = 180, stepHeight = 80, gap = 60;
  const nodes = [];

  lines.forEach((line, index) => {
    const cleanLabel = line.replace(/^[-*•\d+.\s]+/, '').trim();
    const nodeX = startX + index * (stepWidth + gap);
    const stepId = `step-${index}-${Date.now()}`;

    nodes.push({
      id: stepId,
      type: 'rectangle',
      x: nodeX,
      y: startY,
      width: stepWidth,
      height: stepHeight,
      text: `Step ${index + 1}: ${cleanLabel}`,
      fillColor: '#161b22',
      strokeColor: '#2f81f7',
      strokeWidth: 2,
    });

    if (index > 0) {
      const prevX = startX + (index - 1) * (stepWidth + gap) + stepWidth;
      const prevY = startY + stepHeight / 2;
      nodes.push({
        id: `connector-${index}-${Date.now()}`,
        type: 'arrow',
        x: prevX,
        y: prevY,
        points: [{ x: prevX, y: prevY }, { x: nodeX, y: prevY }],
        strokeColor: '#7d8590',
        strokeWidth: 2,
      });
    }
  });

  return nodes;
}

export default { recognizeStroke, autoAlignLayout, generateStepDiagram };
