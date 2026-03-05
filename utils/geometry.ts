import Konva from 'konva';

export const getRelativePointerPosition = (stage: Konva.Stage | null | undefined) => {
  if (!stage) return null;
  const pointerPosition = stage.getPointerPosition();
  if (!pointerPosition) return null;
  return { x: (pointerPosition.x - stage.x()) / stage.scaleX(), y: (pointerPosition.y - stage.y()) / stage.scaleX() };
};

export const getElementSnapPoints = (el: any, originX: number, originY: number, nodesRef?: React.MutableRefObject<{ [id: string]: Konva.Node }>) => {
  const pts: {x: number, y: number}[] = [];
  const angleRad = (el.rotation || 0) * Math.PI / 180;
  const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
  const transform = (lx: number, ly: number) => ({ x: originX + lx * cos - ly * sin, y: originY + lx * sin + ly * cos });

  if (el.type === 'area') {
      const w = el.width || 0, h = el.height || 0;
      pts.push(transform(w/2, h/2), transform(0,0), transform(w/2,0), transform(w,0), transform(0,h/2), transform(w,h/2), transform(0,h), transform(w/2,h), transform(w,h)); 
  } else if (el.type === 'row' && el.seats && el.seats.length > 0) {
      pts.push(transform((el.seats[0].x + el.seats[el.seats.length - 1].x)/2, (el.seats[0].y + el.seats[el.seats.length - 1].y)/2), transform(el.seats[0].x, el.seats[0].y), transform(el.seats[el.seats.length - 1].x, el.seats[el.seats.length - 1].y));
  } else if (el.type === 'table') { pts.push(transform(0,0)); } 
  else if (el.type === 'text' && nodesRef) {
      const node = nodesRef.current[el.id] as import('konva').default.Group;
      let w = 0, h = 0;
      if (node && typeof node.findOne === 'function') { const textNode = node.findOne('.text-element'); if (textNode) { w = textNode.width(); h = textNode.height(); } }
      if (w > 0 && h > 0) pts.push(transform(w/2, h/2), transform(0, 0), transform(w, 0), transform(0, h), transform(w, h), transform(w/2, 0), transform(w/2, h), transform(0, h/2), transform(w, h/2)); 
      else pts.push(transform(0,0));
  }
  return pts;
};

export const getTargetPoints = (allElements: any[], skipIds: string[] = [], nodesRef?: React.MutableRefObject<{ [id: string]: Konva.Node }>) => {
    const targetPoints: {x: number, y: number}[] = [], centers: {x: number, y: number}[] = [];
    allElements.forEach(el => {
        if (skipIds.includes(el.id)) return;
        const pts = getElementSnapPoints(el, el.x, el.y, nodesRef);
        targetPoints.push(...pts); centers.push(pts[0]);
    });
    for(let i = 0; i < centers.length; i++) {
        for(let j = i + 1; j < centers.length; j++) {
          const p1 = centers[i], p2 = centers[j];
          targetPoints.push({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
          const dx = p2.x - p1.x, dy = p2.y - p1.y;
          targetPoints.push({ x: p2.x + dx, y: p2.y + dy }, { x: p1.x - dx, y: p1.y - dy });
        }
    }
    return targetPoints;
};

export const getSnapGuides = (pos: {x: number, y: number}, elements: any[], skipIds: string[] = [], nodesRef?: React.MutableRefObject<{ [id: string]: Konva.Node }>) => {
    let snappedX = pos.x, snappedY = pos.y, guidesX: number[] = [], guidesY: number[] = [];
    const targetPoints = getTargetPoints(elements, skipIds, nodesRef);
    let bestDX = 15, bestDY = 15;
    targetPoints.forEach(tp => {
        const dx = Math.abs(tp.x - pos.x); if (dx < bestDX) { bestDX = dx; snappedX = tp.x; }
        const dy = Math.abs(tp.y - pos.y); if (dy < bestDY) { bestDY = dy; snappedY = tp.y; }
    });
    targetPoints.forEach(tp => {
        if (Math.abs(tp.x - snappedX) < 1 && !guidesX.includes(tp.x)) guidesX.push(tp.x);
        if (Math.abs(tp.y - snappedY) < 1 && !guidesY.includes(tp.y)) guidesY.push(tp.y);
    });
    return { snappedX, snappedY, guidesX, guidesY };
};

export const getRowCenter = (row: any) => {
  if (!row.seats || row.seats.length === 0) return { x: row.x, y: row.y };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const angleRad = (row.rotation || 0) * Math.PI / 180;
  const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
  row.seats.forEach((seat: any) => {
      const gx = row.x + seat.x * cos - seat.y * sin;
      const gy = row.y + seat.x * sin + seat.y * cos;
      if (gx < minX) minX = gx; if (gx > maxX) maxX = gx;
      if (gy < minY) minY = gy; if (gy > maxY) maxY = gy;
  });
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
};
