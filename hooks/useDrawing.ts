import { useState, useRef, useEffect } from 'react';
import Konva from 'konva';
import { MapElement } from '../types';
import { getRelativePointerPosition, getElementSnapPoints, getTargetPoints, getSnapGuides } from '../utils/geometry';

interface UseDrawingProps {
  elements: MapElement[];
  selectedIds: string[];
  drawingMode: "select" | "select-seat" | "row" | "multi-row" | "area" | "table" | "pan" | "text";
  setDrawingMode: (mode: "select" | "select-seat" | "row" | "multi-row" | "area" | "table" | "pan" | "text") => void;
  addElement: (el: MapElement) => void;
  setSelection: (ids: string[]) => void;
  selectionRect: any;
  setSelectionRect: any;
  setIsPanning: (val: boolean) => void;
  stageConfig: { x: number, y: number, scale: number };
  nodesRef: React.MutableRefObject<{ [id: string]: Konva.Node }>;
  isDraggingRef: React.MutableRefObject<boolean>;
  multiOrigin: { x: number, y: number };
  handleSelectionIntersect: (shift: boolean, ctrl: boolean, meta: boolean) => void;
}

export function useDrawing({
  elements, selectedIds, drawingMode, setDrawingMode, addElement,
  setSelection, selectionRect, setSelectionRect, setIsPanning,
  stageConfig, nodesRef, isDraggingRef, multiOrigin, handleSelectionIntersect
}: UseDrawingProps) {
  
  const [draftRow, setDraftRow] = useState({ startX: 0, startY: 0, currentX: 0, currentY: 0, isDrawing: false });
  const [draftMultiRow, setDraftMultiRow] = useState({ step: 0, startX: 0, startY: 0, endX: 0, endY: 0, currentX: 0, currentY: 0 });
  const [draftArea, setDraftArea] = useState({ startX: 0, startY: 0, currentX: 0, currentY: 0, isDrawing: false });
  const [draftTable, setDraftTable] = useState({ startX: 0, startY: 0, currentX: 0, currentY: 0, isDrawing: false });
  const [mousePos, setMousePos] = useState<{x: number, y: number, guidesX?: number[], guidesY?: number[]} | null>(null);

  const elementsRef = useRef(elements);
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { elementsRef.current = elements; selectedIdsRef.current = selectedIds; }, [elements, selectedIds]);

  const applyDragSnapping = (pos: {x: number, y: number}, draggingEl: any) => {
    const localPos = { x: (pos.x - stageConfig.x) / stageConfig.scale, y: (pos.y - stageConfig.y) / stageConfig.scale };
    const skipIds = selectedIds.length > 1 && selectedIds.includes(draggingEl.id) ? selectedIds : [draggingEl.id];
    const targetPoints = getTargetPoints(elements, skipIds, nodesRef);
    const sourcePoints = getElementSnapPoints(draggingEl, localPos.x, localPos.y, nodesRef);
    let bestDX = 15, bestDY = 15, offsetX = 0, offsetY = 0;
    sourcePoints.forEach((sp, i) => {
      targetPoints.forEach(tp => {
        const dx = Math.abs(tp.x - sp.x), advantageX = (i === 0) ? -5 : 0; 
        if (dx + advantageX < bestDX) { bestDX = dx + advantageX; offsetX = tp.x - sp.x; }
        const dy = Math.abs(tp.y - sp.y), advantageY = (i === 0) ? -5 : 0;
        if (dy + advantageY < bestDY) { bestDY = dy + advantageY; offsetY = tp.y - sp.y; }
      });
    });
    return { x: (localPos.x + offsetX) * stageConfig.scale + stageConfig.x, y: (localPos.y + offsetY) * stageConfig.scale + stageConfig.y };
  };

  const handleDragMove = (e: any, el: any) => {
     const node = e.target, localPos = { x: node.x(), y: node.y() };
     const sourcePoints = getElementSnapPoints(el, localPos.x, localPos.y, nodesRef);
     const currentSelectedIds = selectedIdsRef.current;
     const skipIds = currentSelectedIds.length > 1 && currentSelectedIds.includes(el.id) ? currentSelectedIds : [el.id];
     const targetPoints = getTargetPoints(elementsRef.current, skipIds, nodesRef);
     let guidesX: number[] = [], guidesY: number[] = [];
     sourcePoints.forEach(sp => {
         targetPoints.forEach(tp => {
             if (Math.abs(tp.x - sp.x) < 1 && !guidesX.includes(tp.x)) guidesX.push(tp.x);
             if (Math.abs(tp.y - sp.y) < 1 && !guidesY.includes(tp.y)) guidesY.push(tp.y);
         });
     });
     setMousePos({ x: node.x(), y: node.y(), guidesX, guidesY });
  };

  const applyGroupDragSnapping = (pos: {x: number, y: number}) => {
    const localPos = { x: (pos.x - stageConfig.x) / stageConfig.scale, y: (pos.y - stageConfig.y) / stageConfig.scale };
    const targetPoints = getTargetPoints(elements, selectedIds, nodesRef);
    const groupRot = 0; // The multiGroupRef rotation is passed internally typically, since it zeroes out on dragEnd we use 0 or need ref. but MapCanvas uses multiGroupRef.current?.rotation()
    // It's safe to assume 0 since rotation happens separately and resets
    const angleRad = groupRot * Math.PI / 180, cos = Math.cos(angleRad), sin = Math.sin(angleRad);
    const sourcePoints: {x: number, y: number}[] = [{ x: localPos.x, y: localPos.y }];
    elements.forEach(el => {
      if (selectedIds.includes(el.id)) {
         getElementSnapPoints(el, el.x, el.y, nodesRef).forEach(p => {
            const relX = p.x - multiOrigin.x, relY = p.y - multiOrigin.y;
            sourcePoints.push({ x: localPos.x + relX * cos - relY * sin, y: localPos.y + relX * sin + relY * cos });
         });
      }
    });
    let bestDX = 15, bestDY = 15, offsetX = 0, offsetY = 0;
    sourcePoints.forEach((sp) => {
      targetPoints.forEach(tp => {
        const dx = Math.abs(tp.x - sp.x); if (dx < bestDX) { bestDX = dx; offsetX = tp.x - sp.x; }
        const dy = Math.abs(tp.y - sp.y); if (dy < bestDY) { bestDY = dy; offsetY = tp.y - sp.y; }
      });
    });
    return { x: (localPos.x + offsetX) * stageConfig.scale + stageConfig.x, y: (localPos.y + offsetY) * stageConfig.scale + stageConfig.y };
  };

  const handleGroupDragMove = (e: any) => {
     const node = e.target, localPos = { x: node.x(), y: node.y() };
     const targetPoints = getTargetPoints(elements, selectedIds, nodesRef);
     const groupRot = node.rotation() || 0, angleRad = groupRot * Math.PI / 180, cos = Math.cos(angleRad), sin = Math.sin(angleRad);
     const sourcePoints: {x: number, y: number}[] = [{ x: localPos.x, y: localPos.y }];
     elements.forEach(el => {
       if (selectedIds.includes(el.id)) {
          getElementSnapPoints(el, el.x, el.y, nodesRef).forEach(p => {
             const relX = p.x - multiOrigin.x, relY = p.y - multiOrigin.y;
             const rotX = relX * cos - relY * sin, rotY = relX * sin + relY * cos;
             sourcePoints.push({ x: localPos.x + rotX, y: localPos.y + rotY });
          });
       }
     });
     let guidesX: number[] = [], guidesY: number[] = [];
     sourcePoints.forEach(sp => {
         targetPoints.forEach(tp => {
             if (Math.abs(tp.x - sp.x) < 1 && !guidesX.includes(tp.x)) guidesX.push(tp.x);
             if (Math.abs(tp.y - sp.y) < 1 && !guidesY.includes(tp.y)) guidesY.push(tp.y);
         });
     });
     setMousePos({ x: node.x(), y: node.y(), guidesX, guidesY });
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (drawingMode === 'pan') {
      setIsPanning(true);
    } else if (drawingMode === 'select' || drawingMode === 'select-seat') {
      if (e.target === e.target.getStage()) {
        const pos = getRelativePointerPosition(e.target.getStage());
        if (pos) setSelectionRect({ startX: pos.x, startY: pos.y, width: 0, height: 0, visible: true });
        if (!e.evt.shiftKey && !e.evt.ctrlKey && !e.evt.metaKey) setSelection([]);
      }
    } else if (drawingMode === 'text') {
      const pos = getRelativePointerPosition(e.target.getStage());
      if (pos) {
        const newId = crypto.randomUUID();
        addElement({ id: newId, type: "text", label: "Escenario", x: pos.x, y: pos.y, fontSize: 32, color: '#ffffff', rotation: 0 } as any);
        setSelection([newId]); setDrawingMode('select'); 
      }
    } else if (drawingMode === 'row') {
      const pos = mousePos || getRelativePointerPosition(e.target.getStage());
      if (pos) {
        if (!draftRow.isDrawing) {
          setDraftRow({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y, isDrawing: true });
        } else {
          setDraftRow((prev) => ({ ...prev, isDrawing: false }));
          const dx = draftRow.currentX - draftRow.startX, dy = draftRow.currentY - draftRow.startY, distance = Math.sqrt(dx * dx + dy * dy), count = Math.min(100, Math.max(1, Math.floor(distance / 30) + 1)), angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
          const seats = Array.from({ length: count }).map((_, i) => ({ id: crypto.randomUUID(), label: (i + 1).toString(), x: i * 30, y: 0, status: 'available' }));
          addElement({ id: crypto.randomUUID(), type: "row", label: "Fila", x: draftRow.startX, y: draftRow.startY, rotation: angleDeg, seats } as any);
        }
      }
    } else if (drawingMode === 'multi-row') {
      const pos = mousePos || getRelativePointerPosition(e.target.getStage());
      if (pos) {
        if (draftMultiRow.step === 0) {
          setDraftMultiRow({ step: 1, startX: pos.x, startY: pos.y, endX: 0, endY: 0, currentX: pos.x, currentY: pos.y });
        } else if (draftMultiRow.step === 1) {
          const dx = draftMultiRow.currentX - draftMultiRow.startX, dy = draftMultiRow.currentY - draftMultiRow.startY;
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
             setDraftMultiRow(prev => ({ ...prev, step: 2, endX: prev.currentX, endY: prev.currentY, currentX: pos.x, currentY: pos.y }));
          } else {
             setDraftMultiRow({ step: 0, startX: 0, startY: 0, endX: 0, endY: 0, currentX: 0, currentY: 0 }); 
          }
        } else if (draftMultiRow.step === 2) {
          const dx = draftMultiRow.endX - draftMultiRow.startX, dy = draftMultiRow.endY - draftMultiRow.startY;
          const baseLen = Math.sqrt(dx * dx + dy * dy);
          if (baseLen > 5) {
              const angle = Math.atan2(dy, dx);
              const angleDeg = angle * (180 / Math.PI);
              const cols = Math.min(50, Math.max(1, Math.floor(baseLen / 30) + 1));
              const perpNx = -dy / baseLen;
              const perpNy = dx / baseLen;
              const mx = draftMultiRow.currentX - draftMultiRow.startX;
              const my = draftMultiRow.currentY - draftMultiRow.startY;
              const perpDist = mx * perpNx + my * perpNy;
              const rowDir = perpDist >= 0 ? 1 : -1;
              const rowSpacing = 40;
              const rowsCount = Math.min(20, Math.max(1, Math.floor(Math.abs(perpDist) / rowSpacing) + 1));
              
              const newIds: string[] = [];
              for (let r = 0; r < rowsCount; r++) {
                  const perpOffsetX = perpNx * rowDir * r * rowSpacing;
                  const perpOffsetY = perpNy * rowDir * r * rowSpacing;
                  const seats = Array.from({ length: cols }).map((_, i) => ({ id: crypto.randomUUID(), label: (i + 1).toString(), x: i * 30, y: 0, status: 'available' }));
                  const rowId = crypto.randomUUID();
                  newIds.push(rowId);
                  addElement({ id: rowId, type: "row", label: "Fila", x: draftMultiRow.startX + perpOffsetX, y: draftMultiRow.startY + perpOffsetY, rotation: angleDeg, seats } as any);
              }
              if (newIds.length > 0) Object.assign(window, { _lastAddedMultiRows: newIds }); 
          }
          setDraftMultiRow({ step: 0, startX: 0, startY: 0, endX: 0, endY: 0, currentX: 0, currentY: 0 });
          setDrawingMode('select');
        }
      }
    } else if (drawingMode === 'area') {
      const pos = mousePos || getRelativePointerPosition(e.target.getStage());
      if (pos) setDraftArea({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y, isDrawing: true });
    } else if (drawingMode === 'table') {
      const pos = mousePos || getRelativePointerPosition(e.target.getStage());
      if (pos) {
        if (!draftTable.isDrawing) setDraftTable({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y, isDrawing: true });
        else {
          setDraftTable((prev) => ({ ...prev, isDrawing: false }));
           const dx = draftTable.currentX - draftTable.startX, dy = draftTable.currentY - draftTable.startY, rawDist = Math.max(Math.sqrt(dx * dx + dy * dy), 30), radius = Math.min(rawDist, 191), seatCount = Math.min(40, Math.max(2, Math.floor((2 * Math.PI * radius) / 30)));
          let maxTableNum = 0; elements.forEach(e => { if (e.type === 'table') { const num = parseInt(e.label); if (!isNaN(num) && num > maxTableNum) maxTableNum = num; } });
          const seats = Array.from({ length: seatCount }).map((_, i) => {
            const slice = (Math.PI * 2) / seatCount; let angle = -Math.PI / 2 + (i * slice); if (seatCount % 2 !== 0) angle += slice / 2;
            const seatOffset = Math.max(25, radius - 10);
            return { id: crypto.randomUUID(), label: (i + 1).toString(), x: seatOffset * Math.cos(angle), y: seatOffset * Math.sin(angle), status: 'available' };
          });
          addElement({ id: crypto.randomUUID(), type: "table", label: (maxTableNum + 1).toString(), x: draftTable.startX, y: draftTable.startY, seats });
        }
      }
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (drawingMode === 'pan') return;
    if (isDraggingRef.current) return; 
    const rawPos = getRelativePointerPosition(e.target.getStage()); if (!rawPos) return;
    let snappedX = rawPos.x, snappedY = rawPos.y, guidesX: number[] = [], guidesY: number[] = [];

    if (['row', 'multi-row', 'area', 'table'].includes(drawingMode)) {
      const snap = getSnapGuides(rawPos, elements, [], nodesRef); snappedX = snap.snappedX; snappedY = snap.snappedY; guidesX = snap.guidesX; guidesY = snap.guidesY;
    }
    setMousePos({ x: snappedX, y: snappedY, guidesX, guidesY });

    if ((drawingMode === 'select' || drawingMode === 'select-seat') && selectionRect.visible) {
      setSelectionRect((prev: any) => ({ ...prev, width: rawPos.x - prev.startX, height: rawPos.y - prev.startY }));
    } else if (drawingMode === 'row' && draftRow.isDrawing) {
      const deltaX = rawPos.x - draftRow.startX, deltaY = rawPos.y - draftRow.startY, distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      let currentAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI), bestSnapDiff = 3, snappedAngle = currentAngle, isSnapped = false;
      const snapTargets = [0, 90, 180, -90, 270, -180, 360];
      elements.forEach(el => { if (el.type === 'row' && typeof el.rotation === 'number') { const r = el.rotation; snapTargets.push(r, -r, 180 - r, r + 180, r - 180); } });
      for (const target of snapTargets) { let diff = Math.abs((currentAngle - target) % 360); if (diff > 180) diff = 360 - diff; if (diff < bestSnapDiff) { bestSnapDiff = diff; snappedAngle = target; isSnapped = true; } }
      let newX = rawPos.x, newY = rawPos.y;
      if (isSnapped) { const snapRad = snappedAngle * (Math.PI / 180); newX = draftRow.startX + distance * Math.cos(snapRad); newY = draftRow.startY + distance * Math.sin(snapRad); }
      setDraftRow((prev) => ({ ...prev, currentX: newX, currentY: newY }));
    } else if (drawingMode === 'multi-row') {
      if (draftMultiRow.step === 1) {
        const deltaX = rawPos.x - draftMultiRow.startX, deltaY = rawPos.y - draftMultiRow.startY, distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        let currentAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI), bestSnapDiff = 3, snappedAngle = currentAngle, isSnapped = false;
        const snapTargets = [0, 90, 180, -90, 270, -180, 360];
        elements.forEach(el => { if (el.type === 'row' && typeof el.rotation === 'number') { const r = el.rotation; snapTargets.push(r, -r, 180 - r, r + 180, r - 180); } });
        for (const target of snapTargets) { let diff = Math.abs((currentAngle - target) % 360); if (diff > 180) diff = 360 - diff; if (diff < bestSnapDiff) { bestSnapDiff = diff; snappedAngle = target; isSnapped = true; } }
        let newX = rawPos.x, newY = rawPos.y;
        if (isSnapped) { const snapRad = snappedAngle * (Math.PI / 180); newX = draftMultiRow.startX + distance * Math.cos(snapRad); newY = draftMultiRow.startY + distance * Math.sin(snapRad); }
        setDraftMultiRow((prev) => ({ ...prev, currentX: newX, currentY: newY }));
      } else if (draftMultiRow.step === 2) {
        setDraftMultiRow((prev) => ({ ...prev, currentX: snappedX, currentY: snappedY }));
      }
    } else if (drawingMode === 'area' && draftArea.isDrawing) setDraftArea((prev) => ({ ...prev, currentX: snappedX, currentY: snappedY }));
    else if (drawingMode === 'table' && draftTable.isDrawing) setDraftTable((prev) => ({ ...prev, currentX: snappedX, currentY: snappedY }));
  };

  const handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    setIsPanning(false);
    if (drawingMode === 'select' || drawingMode === 'select-seat') {
      handleSelectionIntersect(e.evt.shiftKey, e.evt.ctrlKey, e.evt.metaKey);
    } else if (drawingMode === 'area' && draftArea.isDrawing) {
      setDraftArea((prev) => ({ ...prev, isDrawing: false }));
      const w = Math.abs(draftArea.currentX - draftArea.startX), h = Math.abs(draftArea.currentY - draftArea.startY);
      if (w > 10 && h > 10) addElement({ id: crypto.randomUUID(), type: "area", label: "Nueva Área", x: Math.min(draftArea.startX, draftArea.currentX), y: Math.min(draftArea.startY, draftArea.currentY), width: w, height: h });
    }
  };

  return {
    draftRow, setDraftRow,
    draftMultiRow, setDraftMultiRow,
    draftArea, setDraftArea,
    draftTable, setDraftTable,
    mousePos, setMousePos,
    applyDragSnapping, handleDragMove,
    applyGroupDragSnapping, handleGroupDragMove,
    handleMouseDown, handleMouseMove, handleMouseUp
  };
}
