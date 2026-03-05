import { useRef, useState, useEffect } from 'react';
import Konva from 'konva';
import { MapElement } from '../types';

export function useSelection(
  elements: MapElement[],
  selectedIds: string[],
  updateMultipleElements: any,
  setSelection: any,
  drawingMode: string,
  nodesRef: React.MutableRefObject<{ [id: string]: Konva.Node }>
) {
  const trRef = useRef<Konva.Transformer>(null);
  const multiGroupRef = useRef<Konva.Group>(null);
  
  const [multiOrigin, setMultiOrigin] = useState({ x: 0, y: 0 });
  const [selectionRect, setSelectionRect] = useState({ startX: 0, startY: 0, width: 0, height: 0, visible: false });
  const [activeTransformAngle, setActiveTransformAngle] = useState<{x: number, y: number, angle: number} | null>(null);

  useEffect(() => {
    if (selectedIds.length > 1) {
      const selectedEls = elements.filter(e => selectedIds.includes(e.id));
      let sumX = 0, sumY = 0;
      selectedEls.forEach(el => { sumX += el.x; sumY += el.y; });
      setMultiOrigin({ x: sumX / selectedEls.length, y: sumY / selectedEls.length });
    }
  }, [selectedIds.join(',')]);

  useEffect(() => {
    if (drawingMode === 'select' && trRef.current) {
      if (selectedIds.length > 1) {
         if (multiGroupRef.current) trRef.current.nodes([multiGroupRef.current]);
      } else if (selectedIds.length === 1) {
         const node = nodesRef.current[selectedIds[0]];
         if (node) trRef.current.nodes([node]);
      } else { trRef.current.nodes([]); }
      trRef.current.getLayer()?.batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedIds, drawingMode, elements, multiOrigin]);

  const applyMultiGroupTransform = () => {
    const group = multiGroupRef.current;
    if (!group) return;
    const transform = group.getTransform(), groupRotation = group.rotation();
    let sumX = 0, sumY = 0;
    const updates = selectedIds.map(id => {
       const el = elements.find(e => e.id === id);
       if (!el) return null;
       const newPos = transform.point({ x: el.x, y: el.y });
       const newRot = (el.rotation || 0) + groupRotation;
       sumX += newPos.x; sumY += newPos.y;
       return { id: el.id, updates: { x: newPos.x, y: newPos.y, rotation: newRot } };
    }).filter(Boolean);

    const newOrigin = { x: sumX / updates.length, y: sumY / updates.length };
    setMultiOrigin(newOrigin);
    group.x(newOrigin.x); group.y(newOrigin.y); group.offsetX(newOrigin.x); group.offsetY(newOrigin.y);
    group.rotation(0); group.scaleX(1); group.scaleY(1);
    updateMultipleElements(updates as any);
    trRef.current?.forceUpdate();
  };

  const handleSelectionIntersect = (shiftKey: boolean, ctrlKey: boolean, metaKey: boolean) => {
    if (!selectionRect.visible) return;
    setSelectionRect((prev) => ({ ...prev, visible: false }));
    const boxX = Math.min(selectionRect.startX, selectionRect.startX + selectionRect.width), boxY = Math.min(selectionRect.startY, selectionRect.startY + selectionRect.height);
    const boxMaxX = Math.max(selectionRect.startX, selectionRect.startX + selectionRect.width), boxMaxY = Math.max(selectionRect.startY, selectionRect.startY + selectionRect.height);
    const newSelectedIds: string[] = [...(shiftKey || ctrlKey || metaKey ? selectedIds : [])];
    
    elements.forEach((el) => {
      const cos = Math.cos((el.rotation || 0) * Math.PI / 180), sin = Math.sin((el.rotation || 0) * Math.PI / 180);
      
      if (drawingMode === 'select-seat' && (el.type === 'row' || el.type === 'table')) {
        for (const seat of (el as any).seats) {
          const gx = el.x + seat.x * cos - seat.y * sin, gy = el.y + seat.x * sin + seat.y * cos, r = el.type === 'table' ? 12 : 15;
          if (gx - r <= boxMaxX && gx + r >= boxX && gy - r <= boxMaxY && gy + r >= boxY) {
            if (!newSelectedIds.includes(seat.id)) newSelectedIds.push(seat.id);
          }
        }
      } else if (drawingMode === 'select') {
        if (el.type === 'area') {
          const pts = [ {x: 0, y: 0}, {x: el.width, y: 0}, {x: 0, y: el.height}, {x: el.width, y: el.height} ].map(p => ({ x: el.x + p.x * cos - p.y * sin, y: el.y + p.x * sin + p.y * cos }));
          if (Math.min(...pts.map(p => p.x)) <= boxMaxX && Math.max(...pts.map(p => p.x)) >= boxX && Math.min(...pts.map(p => p.y)) <= boxMaxY && Math.max(...pts.map(p => p.y)) >= boxY) {
             if (!newSelectedIds.includes(el.id)) newSelectedIds.push(el.id);
          }
        } else if (el.type === 'row' || el.type === 'table') {
          let isElSelected = false;
          for (const seat of (el as any).seats) {
            const gx = el.x + seat.x * cos - seat.y * sin, gy = el.y + seat.x * sin + seat.y * cos, r = el.type === 'table' ? 12 : 15;
            if (gx - r <= boxMaxX && gx + r >= boxX && gy - r <= boxMaxY && gy + r >= boxY) { isElSelected = true; break; }
          }
          if (isElSelected && !newSelectedIds.includes(el.id)) newSelectedIds.push(el.id);
        } else if (el.type === 'text') { 
          if (el.x <= boxMaxX && el.x >= boxX && el.y <= boxMaxY && el.y >= boxY) {
            if (!newSelectedIds.includes(el.id)) newSelectedIds.push(el.id);
          }
        }
      }
    });
    setSelection(newSelectedIds);
  };

  return {
    trRef,
    multiGroupRef,
    multiOrigin,
    selectionRect,
    setSelectionRect,
    activeTransformAngle,
    setActiveTransformAngle,
    applyMultiGroupTransform,
    handleSelectionIntersect
  };
}
