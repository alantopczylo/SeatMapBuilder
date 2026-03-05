"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Group, Circle, Text, Line, Label, Tag, Transformer } from 'react-konva';
import Konva from 'konva';
import { useMapStore } from '../store/useMapStore';
import { MdAdd, MdRemove, MdFilterCenterFocus } from 'react-icons/md';
import TextNode from './TextNode';
import AreaNode from './AreaNode';
import TableNode from './TableNode';
import RowNode from './RowNode';

export default function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodesRef = useRef<{ [id: string]: Konva.Node }>({});
  const multiGroupRef = useRef<Konva.Group>(null);
  const isDraggingRef = useRef(false);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const { elements, selectedIds, updateElement, updateMultipleElements, setSelection, addElement, drawingMode, setDrawingMode } = useMapStore();
  // Refs so memoized closures always read the latest elements/selectedIds
  const elementsRef = useRef(elements);
  const selectedIdsRef = useRef(selectedIds);
  elementsRef.current = elements;
  selectedIdsRef.current = selectedIds;
  
  const [stageConfig, setStageConfig] = useState({ x: 0, y: 0, scale: 1 });
  const [multiOrigin, setMultiOrigin] = useState({ x: 0, y: 0 });
  const [selectionRect, setSelectionRect] = useState({ startX: 0, startY: 0, width: 0, height: 0, visible: false });
  const [draftRow, setDraftRow] = useState({ startX: 0, startY: 0, currentX: 0, currentY: 0, isDrawing: false });
  const [draftMultiRow, setDraftMultiRow] = useState({ step: 0, startX: 0, startY: 0, endX: 0, endY: 0, currentX: 0, currentY: 0 });
  const [draftArea, setDraftArea] = useState({ startX: 0, startY: 0, currentX: 0, currentY: 0, isDrawing: false });
  const [draftTable, setDraftTable] = useState({ startX: 0, startY: 0, currentX: 0, currentY: 0, isDrawing: false });
  const [mousePos, setMousePos] = useState<{x: number, y: number, guidesX?: number[], guidesY?: number[]} | null>(null);
  const [activeTransformAngle, setActiveTransformAngle] = useState<{x: number, y: number, angle: number} | null>(null);
  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number; text: string; fontSize: number; color: string; rotation: number; } | null>(null);

  useEffect(() => {
    if (stageRef.current) {
      const container = stageRef.current.container();
      if (drawingMode === 'pan') {
        container.style.cursor = isPanning ? 'grabbing' : 'grab';
      } else if (drawingMode === 'select-seat') {
        container.style.cursor = 'crosshair';
      } else if (drawingMode === 'text') {
        container.style.cursor = 'text';
      } else {
        container.style.cursor = 'default';
      }
    }
  }, [drawingMode, isPanning]);

  const handleZoom = (direction: 'in' | 'out') => {
    const scaleBy = 1.2;
    const oldScale = stageConfig.scale;
    const newScale = direction === 'in' ? Math.min(oldScale * scaleBy, 5) : Math.max(oldScale / scaleBy, 0.1);
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const mousePointTo = { x: (centerX - stageConfig.x) / oldScale, y: (centerY - stageConfig.y) / oldScale };
    const newPos = { x: centerX - mousePointTo.x * newScale, y: centerY - mousePointTo.y * newScale };
    setStageConfig({ x: newPos.x, y: newPos.y, scale: newScale });
  };

  const handleResetView = () => {
    if (elements.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      elements.forEach(el => {
        if (el.x < minX) minX = el.x; if (el.y < minY) minY = el.y;
        if (el.x > maxX) maxX = el.x; if (el.y > maxY) maxY = el.y;
      });
      const mapWidth = maxX - minX, mapHeight = maxY - minY;
      const centerX = minX + mapWidth / 2, centerY = minY + mapHeight / 2;
      setStageConfig({ x: dimensions.width / 2 - centerX, y: dimensions.height / 2 - centerY, scale: 1 });
    } else {
      setStageConfig({ x: 0, y: 0, scale: 1 });
    }
  };

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

  const getRelativePointerPosition = (stage: Konva.Stage | null | undefined) => {
    if (!stage) return null;
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return null;
    return { x: (pointerPosition.x - stage.x()) / stage.scaleX(), y: (pointerPosition.y - stage.y()) / stage.scaleX() };
  };

  const getElementSnapPoints = (el: any, originX: number, originY: number) => {
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
    else if (el.type === 'text') {
        const node = nodesRef.current[el.id] as import('konva').default.Group;
        let w = 0, h = 0;
        if (node && typeof node.findOne === 'function') { const textNode = node.findOne('.text-element'); if (textNode) { w = textNode.width(); h = textNode.height(); } }
        if (w > 0 && h > 0) pts.push(transform(w/2, h/2), transform(0, 0), transform(w, 0), transform(0, h), transform(w, h), transform(w/2, 0), transform(w/2, h), transform(0, h/2), transform(w, h/2)); 
        else pts.push(transform(0,0));
    }
    return pts;
  };

  const getTargetPoints = (allElements: any[], skipIds: string[] = []) => {
      const targetPoints: {x: number, y: number}[] = [], centers: {x: number, y: number}[] = [];
      allElements.forEach(el => {
          if (skipIds.includes(el.id)) return;
          const pts = getElementSnapPoints(el, el.x, el.y);
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

  const getSnapGuides = (pos: {x: number, y: number}, skipIds: string[] = []) => {
      let snappedX = pos.x, snappedY = pos.y, guidesX: number[] = [], guidesY: number[] = [];
      const targetPoints = getTargetPoints(elements, skipIds);
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

  const applyDragSnapping = (pos: {x: number, y: number}, draggingEl: any) => {
    const localPos = { x: (pos.x - stageConfig.x) / stageConfig.scale, y: (pos.y - stageConfig.y) / stageConfig.scale };
    const skipIds = selectedIds.length > 1 && selectedIds.includes(draggingEl.id) ? selectedIds : [draggingEl.id];
    const targetPoints = getTargetPoints(elements, skipIds);
    const sourcePoints = getElementSnapPoints(draggingEl, localPos.x, localPos.y);
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
     const sourcePoints = getElementSnapPoints(el, localPos.x, localPos.y);
     const currentSelectedIds = selectedIdsRef.current;
     const skipIds = currentSelectedIds.length > 1 && currentSelectedIds.includes(el.id) ? currentSelectedIds : [el.id];
     const targetPoints = getTargetPoints(elementsRef.current, skipIds);
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
    const targetPoints = getTargetPoints(elements, selectedIds);
    const groupRot = multiGroupRef.current?.rotation() || 0, angleRad = groupRot * Math.PI / 180, cos = Math.cos(angleRad), sin = Math.sin(angleRad);
    const sourcePoints: {x: number, y: number}[] = [{ x: localPos.x, y: localPos.y }];
    elements.forEach(el => {
      if (selectedIds.includes(el.id)) {
         getElementSnapPoints(el, el.x, el.y).forEach(p => {
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
     const targetPoints = getTargetPoints(elements, selectedIds);
     const groupRot = node.rotation() || 0, angleRad = groupRot * Math.PI / 180, cos = Math.cos(angleRad), sin = Math.sin(angleRad);
     const sourcePoints: {x: number, y: number}[] = [{ x: localPos.x, y: localPos.y }];
     elements.forEach(el => {
       if (selectedIds.includes(el.id)) {
          getElementSnapPoints(el, el.x, el.y).forEach(p => {
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

  useEffect(() => {
    const checkSize = () => { if (containerRef.current) setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight }); };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const canvasProps = useMemo(() => ({
    nodesRef, applyDragSnapping, isDraggingRef, handleDragMove, setMousePos, setActiveTransformAngle, scale: stageConfig.scale, setEditingText, trRef, editingTextId: editingText?.id 
  }), [stageConfig.scale, editingText?.id]);

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 w-full h-full overflow-hidden ${drawingMode === 'select-seat' ? 'mode-select-seat-active' : ''}`}
    >
      <Stage 
        ref={stageRef}
        width={dimensions.width} height={dimensions.height} draggable={drawingMode === 'pan'} x={stageConfig.x} y={stageConfig.y} scaleX={stageConfig.scale} scaleY={stageConfig.scale}
        onDragEnd={(e) => { 
          if (e.target === e.target.getStage()) {
            setStageConfig(prev => ({ ...prev, x: e.target.x(), y: e.target.y() }));
            setIsPanning(false);
          }
        }}
        onMouseLeave={() => setIsPanning(false)}
        onWheel={(e) => {
          e.evt.preventDefault(); const stage = e.target.getStage(); if (!stage) return;
          const oldScale = stageConfig.scale, pointer = stage.getPointerPosition(); if (!pointer) return;
          const scaleBy = 1.1, newScale = e.evt.deltaY > 0 ? Math.max(oldScale / scaleBy, 0.1) : Math.min(oldScale * scaleBy, 5);
          const mousePointTo = { x: (pointer.x - stageConfig.x) / oldScale, y: (pointer.y - stageConfig.y) / oldScale };
          setStageConfig({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale, scale: newScale });
        }}
        onMouseDown={(e) => {
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
                const dx = draftRow.currentX - draftRow.startX, dy = draftRow.currentY - draftRow.startY, distance = Math.sqrt(dx * dx + dy * dy), count = Math.max(1, Math.floor(distance / 30) + 1), angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
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
                   setDraftMultiRow({ step: 0, startX: 0, startY: 0, endX: 0, endY: 0, currentX: 0, currentY: 0 }); // cancel if too short
                }
              } else if (draftMultiRow.step === 2) {
                const dx = draftMultiRow.endX - draftMultiRow.startX, dy = draftMultiRow.endY - draftMultiRow.startY;
                const baseLen = Math.sqrt(dx * dx + dy * dy);
                if (baseLen > 5) {
                    const angle = Math.atan2(dy, dx);
                    const angleDeg = angle * (180 / Math.PI);
                    const cols = Math.max(1, Math.floor(baseLen / 30) + 1);
                    const perpNx = -dy / baseLen;
                    const perpNy = dx / baseLen;
                    const mx = draftMultiRow.currentX - draftMultiRow.startX;
                    const my = draftMultiRow.currentY - draftMultiRow.startY;
                    const perpDist = mx * perpNx + my * perpNy;
                    
                    const rowDir = perpDist >= 0 ? 1 : -1;
                    const rowSpacing = 40;
                    const rowsCount = Math.max(1, Math.floor(Math.abs(perpDist) / rowSpacing) + 1);
                    
                    const newIds: string[] = [];
                    for (let r = 0; r < rowsCount; r++) {
                        const perpOffsetX = perpNx * rowDir * r * rowSpacing;
                        const perpOffsetY = perpNy * rowDir * r * rowSpacing;
                        const seats = Array.from({ length: cols }).map((_, i) => ({ id: crypto.randomUUID(), label: (i + 1).toString(), x: i * 30, y: 0, status: 'available' }));
                        const rowId = crypto.randomUUID();
                        newIds.push(rowId);
                        addElement({ id: rowId, type: "row", label: "Fila", x: draftMultiRow.startX + perpOffsetX, y: draftMultiRow.startY + perpOffsetY, rotation: angleDeg, seats } as any);
                    }
                    if (newIds.length > 0) Object.assign(window, { _lastAddedMultiRows: newIds }); // We'll select them later if needed
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
                const dx = draftTable.currentX - draftTable.startX, dy = draftTable.currentY - draftTable.startY, radius = Math.max(Math.sqrt(dx * dx + dy * dy), 30), seatCount = Math.max(2, Math.floor((2 * Math.PI * radius) / 30)); 
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
        }}
        onMouseMove={(e) => {
          if (drawingMode === 'pan') return;
          if (isDraggingRef.current) return; // guides are set by handleDragMove, don't stomp them
          const rawPos = getRelativePointerPosition(e.target.getStage()); if (!rawPos) return;
          let snappedX = rawPos.x, snappedY = rawPos.y, guidesX: number[] = [], guidesY: number[] = [];

          if (['row', 'multi-row', 'area', 'table'].includes(drawingMode)) {
            const snap = getSnapGuides(rawPos); snappedX = snap.snappedX; snappedY = snap.snappedY; guidesX = snap.guidesX; guidesY = snap.guidesY;
          }
          setMousePos({ x: snappedX, y: snappedY, guidesX, guidesY });

          if ((drawingMode === 'select' || drawingMode === 'select-seat') && selectionRect.visible) {
            setSelectionRect((prev) => ({ ...prev, width: rawPos.x - prev.startX, height: rawPos.y - prev.startY }));
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
        }}
        onMouseUp={(e) => {
          setIsPanning(false);
          if (drawingMode === 'select' || drawingMode === 'select-seat') {
            if (!selectionRect.visible) return;
            setSelectionRect((prev) => ({ ...prev, visible: false }));
            const boxX = Math.min(selectionRect.startX, selectionRect.startX + selectionRect.width), boxY = Math.min(selectionRect.startY, selectionRect.startY + selectionRect.height);
            const boxMaxX = Math.max(selectionRect.startX, selectionRect.startX + selectionRect.width), boxMaxY = Math.max(selectionRect.startY, selectionRect.startY + selectionRect.height);
            const newSelectedIds: string[] = [...(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey ? selectedIds : [])];
            
            elements.forEach((el) => {
              const cos = Math.cos((el.rotation || 0) * Math.PI / 180), sin = Math.sin((el.rotation || 0) * Math.PI / 180);
              
              if (drawingMode === 'select-seat' && (el.type === 'row' || el.type === 'table')) {
                for (const seat of el.seats) {
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
                  for (const seat of el.seats) {
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
          } else if (drawingMode === 'area' && draftArea.isDrawing) {
            setDraftArea((prev) => ({ ...prev, isDrawing: false }));
            const w = Math.abs(draftArea.currentX - draftArea.startX), h = Math.abs(draftArea.currentY - draftArea.startY);
            if (w > 10 && h > 10) addElement({ id: crypto.randomUUID(), type: "area", label: "Nueva Área", x: Math.min(draftArea.startX, draftArea.currentX), y: Math.min(draftArea.startY, draftArea.currentY), width: w, height: h });
          }
        }}
      >
        <Layer>
          {elements.filter(el => !selectedIds.includes(el.id) || selectedIds.length <= 1).map(el => {
            if (el.type === 'text') return <TextNode key={el.id} el={el} canvasProps={canvasProps} />;
            if (el.type === 'area') return <AreaNode key={el.id} el={el} canvasProps={canvasProps} />;
            if (el.type === 'row') return <RowNode key={el.id} el={el} canvasProps={canvasProps} />;
            if (el.type === 'table') return <TableNode key={el.id} el={el} canvasProps={canvasProps} />;
            return null;
          })}

          {selectedIds.length > 1 && (
            <Group
              ref={multiGroupRef} x={multiOrigin.x} y={multiOrigin.y} offsetX={multiOrigin.x} offsetY={multiOrigin.y} draggable={drawingMode === 'select'}
              dragBoundFunc={(pos) => applyGroupDragSnapping(pos)}
              onDragStart={(e) => { if (e.target === multiGroupRef.current) isDraggingRef.current = true; }}
              onDragMove={(e) => { if (e.target === multiGroupRef.current) handleGroupDragMove(e); }}
              onDragEnd={(e) => { if (e.target === multiGroupRef.current) { isDraggingRef.current = false; setMousePos(null); applyMultiGroupTransform(); } }}
              onTransform={(e) => { if (e.target === multiGroupRef.current) setActiveTransformAngle({ x: e.target.x(), y: e.target.y(), angle: multiGroupRef.current?.rotation() || 0 }); }}
              onTransformEnd={(e) => { if (e.target === multiGroupRef.current) { setActiveTransformAngle(null); applyMultiGroupTransform(); } }}
              onClick={(e) => { e.cancelBubble = true; }}
            >
              {elements.filter(el => selectedIds.includes(el.id)).map(el => {
                if (el.type === 'text') return <TextNode key={el.id} el={el} canvasProps={canvasProps} />;
                if (el.type === 'area') return <AreaNode key={el.id} el={el} canvasProps={canvasProps} />;
                if (el.type === 'row') return <RowNode key={el.id} el={el} canvasProps={canvasProps} />;
                if (el.type === 'table') return <TableNode key={el.id} el={el} canvasProps={canvasProps} />;
                return null;
              })}
            </Group>
          )}

          {selectionRect.visible && (
            <Rect x={selectionRect.width < 0 ? selectionRect.startX + selectionRect.width : selectionRect.startX} y={selectionRect.height < 0 ? selectionRect.startY + selectionRect.height : selectionRect.startY} width={Math.abs(selectionRect.width)} height={Math.abs(selectionRect.height)} fill="rgba(107, 124, 255, 0.15)" stroke="#6B7CFF" strokeWidth={1} />
          )}

          {mousePos && (
            <>
              {mousePos.guidesY?.map((gy, i) => <Line key={`gy-${i}`} points={[-10000, gy, 10000, gy]} stroke="#6B7CFF" strokeWidth={1} dash={[5,5]} opacity={0.5} listening={false} /> )}
              {mousePos.guidesX?.map((gx, i) => <Line key={`gx-${i}`} points={[gx, -10000, gx, 10000]} stroke="#6B7CFF" strokeWidth={1} dash={[5,5]} opacity={0.5} listening={false} /> )}
              {!isDraggingRef.current && drawingMode !== 'select' && drawingMode !== 'area' && drawingMode !== 'text' && drawingMode !== 'select-seat' && ((drawingMode === 'row' && !draftRow.isDrawing) || (drawingMode === 'table' && !draftTable.isDrawing) || (drawingMode === 'multi-row' && draftMultiRow.step === 0)) && (
                <Circle x={mousePos.x} y={mousePos.y} radius={12} fill={'#1F212E'} stroke={(mousePos.guidesX && mousePos.guidesX.length > 0) || (mousePos.guidesY && mousePos.guidesY.length > 0) ? '#6B7CFF' : '#41445A'} strokeWidth={1.5} opacity={0.6} listening={false} />
              )}
            </>
          )}

          {/* DRAFT ROW PREVIEW (SIN AUTO FLIP NI ROTACIÓN RARA) */}
          {drawingMode === 'row' && draftRow.isDrawing && (() => {
            const dx = draftRow.currentX - draftRow.startX, dy = draftRow.currentY - draftRow.startY, distance = Math.sqrt(dx * dx + dy * dy);
            const count = Math.max(1, Math.floor(distance / 30) + 1), angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
            let isOrthogonalSnap = false, isMirroredSnap = false, isParallelSnap = false, matchedEl: any = null, snapType: 'parallel' | 'mirror' | null = null;
            
            [0, 90, 180, -90, 270, -180, 360].forEach(t => { if (Math.abs((angleDeg - t) % 360) < 1 || 360 - Math.abs((angleDeg - t) % 360) < 1) isOrthogonalSnap = true; });
            elements.forEach(el => {
              if (el.type === 'row' && typeof el.rotation === 'number') {
                const r = el.rotation;
                [{ t: r, type: 'parallel' }, { t: r + 180, type: 'parallel' }, { t: r - 180, type: 'parallel' }, { t: -r, type: 'mirror' }, { t: 180 - r, type: 'mirror' }, { t: -180 - r, type: 'mirror' }].forEach(c => {
                  if (Math.abs((angleDeg - c.t) % 360) < 1 || 360 - Math.abs((angleDeg - c.t) % 360) < 1) {
                    if (c.type === 'mirror') isMirroredSnap = true; if (c.type === 'parallel') isParallelSnap = true;
                    matchedEl = el; snapType = c.type as any;
                  }
                });
              }
            });
            const lineColor = isMirroredSnap || isParallelSnap ? '#6B7CFF' : (isOrthogonalSnap ? '#10b981' : '#ef4444');
            const extendX = dx * 100, extendY = dy * 100, midX = draftRow.startX + dx / 2, midY = draftRow.startY + dy / 2;

            return (
              <>
                {matchedEl && (
                  <Group x={matchedEl.x} y={matchedEl.y} rotation={matchedEl.rotation} opacity={0.8} listening={false}>
                    <Rect x={-15} y={-15} width={(matchedEl.seats.length * 30)} height={30} fill="rgba(107, 124, 255, 0.15)" stroke="#6B7CFF" strokeWidth={1} dash={[5, 5]} cornerRadius={6} />
                    <Text text={snapType === 'mirror' ? "Simetría Espejo" : "Fila Paralela"} y={-35} fill="#6B7CFF" fontSize={14} fontStyle="bold" fontFamily="'Satoshi', sans-serif" />
                  </Group>
                )}
                <Line points={[ draftRow.startX - extendX, draftRow.startY - extendY, draftRow.startX + extendX, draftRow.startY + extendY ]} stroke={lineColor} strokeWidth={isMirroredSnap || isParallelSnap ? 1.5 : 1} dash={isMirroredSnap || isParallelSnap ? [10, 5] : undefined} />
                <Group x={draftRow.startX} y={draftRow.startY} rotation={angleDeg} opacity={0.5}>
                  {Array.from({ length: count }).map((_, i) => (
                    <Group key={`draft-${i}`} x={i * 30} y={0}>
                      <Group rotation={Math.abs((angleDeg % 360 + 360) % 360) > 90 && Math.abs((angleDeg % 360 + 360) % 360) < 270 ? 180 : 0}>
                        <Rect x={-11} y={-12} width={22} height={16} cornerRadius={4} fill={'#2B2D3C'} stroke={'#41445A'} strokeWidth={1.5} />
                        <Rect x={-7} y={6} width={14} height={6} cornerRadius={3} fill={'#2B2D3C'} stroke={'#41445A'} strokeWidth={1.5} />
                      </Group>
                      <Text text={(i + 1).toString()} fontSize={8.5} fill={'#ffffff'} fontFamily="'Satoshi', sans-serif" fontStyle="bold" align={'center'} verticalAlign={'middle'} width={22} height={16} offsetX={11} offsetY={8} y={-4} rotation={-angleDeg} />
                    </Group>
                  ))}
                </Group>
                <Label x={midX} y={midY}>
                  <Tag fill={isMirroredSnap || isParallelSnap ? '#6B7CFF' : '#1F212E'} cornerRadius={6} shadowColor="rgba(0,0,0,0.5)" shadowBlur={5} shadowOffsetY={2} />
                  <Text text={count.toString()} fill="white" padding={6} fontSize={12} fontStyle="bold" fontFamily="'Satoshi', sans-serif" />
                </Label>
              </>
             );
          })()}

          {/* DRAFT MULTI-ROW PREVIEW */}
          {drawingMode === 'multi-row' && draftMultiRow.step > 0 && (() => {
            const dx = draftMultiRow.step === 1 ? (draftMultiRow.currentX - draftMultiRow.startX) : (draftMultiRow.endX - draftMultiRow.startX);
            const dy = draftMultiRow.step === 1 ? (draftMultiRow.currentY - draftMultiRow.startY) : (draftMultiRow.endY - draftMultiRow.startY);
            const baseLen = Math.sqrt(dx * dx + dy * dy);
            const cols = Math.max(1, Math.floor(baseLen / 30) + 1);
            const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
            
            // Re-calc snap for the ghost line coloring
            let isOrthogonalSnap = false, isMirroredSnap = false, isParallelSnap = false, matchedEl: any = null, snapType: 'parallel' | 'mirror' | null = null;
            [0, 90, 180, -90, 270, -180, 360].forEach(t => { if (Math.abs((angleDeg - t) % 360) < 1 || 360 - Math.abs((angleDeg - t) % 360) < 1) isOrthogonalSnap = true; });
            elements.forEach(el => {
              if (el.type === 'row' && typeof el.rotation === 'number') {
                const r = el.rotation;
                [{ t: r, type: 'parallel' }, { t: r + 180, type: 'parallel' }, { t: r - 180, type: 'parallel' }, { t: -r, type: 'mirror' }, { t: 180 - r, type: 'mirror' }, { t: -180 - r, type: 'mirror' }].forEach(c => {
                  if (Math.abs((angleDeg - c.t) % 360) < 1 || 360 - Math.abs((angleDeg - c.t) % 360) < 1) {
                    if (c.type === 'mirror') isMirroredSnap = true; if (c.type === 'parallel') isParallelSnap = true;
                    matchedEl = el; snapType = c.type as any;
                  }
                });
              }
            });
            const lineColor = isMirroredSnap || isParallelSnap ? '#6B7CFF' : (isOrthogonalSnap ? '#10b981' : '#ef4444');
            const extendX = dx * 100, extendY = dy * 100;
            
            let rowsCount = 1;
            let rowDir = 1;
            let perpNx = 0, perpNy = 0;
            
            if (draftMultiRow.step === 2 && baseLen > 5) {
                perpNx = -dy / baseLen;
                perpNy = dx / baseLen;
                const mx = draftMultiRow.currentX - draftMultiRow.startX;
                const my = draftMultiRow.currentY - draftMultiRow.startY;
                const perpDist = mx * perpNx + my * perpNy;
                rowDir = perpDist >= 0 ? 1 : -1;
                rowsCount = Math.max(1, Math.floor(Math.abs(perpDist) / 40) + 1);
            }

            const midX = draftMultiRow.startX + dx / 2 + (perpNx * rowDir * (rowsCount - 1) * 40) / 2;
            const midY = draftMultiRow.startY + dy / 2 + (perpNy * rowDir * (rowsCount - 1) * 40) / 2;

            return (
              <>
                {matchedEl && draftMultiRow.step === 1 && (
                  <Group x={matchedEl.x} y={matchedEl.y} rotation={matchedEl.rotation} opacity={0.8} listening={false}>
                    <Rect x={-15} y={-15} width={(matchedEl.seats.length * 30)} height={30} fill="rgba(107, 124, 255, 0.15)" stroke="#6B7CFF" strokeWidth={1} dash={[5, 5]} cornerRadius={6} />
                    <Text text={snapType === 'mirror' ? "Simetría Espejo" : "Fila Paralela"} y={-35} fill="#6B7CFF" fontSize={14} fontStyle="bold" fontFamily="'Satoshi', sans-serif" />
                  </Group>
                )}
                <Line points={[ draftMultiRow.startX - extendX, draftMultiRow.startY - extendY, draftMultiRow.startX + extendX, draftMultiRow.startY + extendY ]} stroke={lineColor} strokeWidth={isMirroredSnap || isParallelSnap ? 1.5 : 1} dash={isMirroredSnap || isParallelSnap ? [10, 5] : undefined} />
                
                {Array.from({ length: rowsCount }).map((_, rowIdx) => {
                  const perpOffsetX = perpNx * rowDir * rowIdx * 40;
                  const perpOffsetY = perpNy * rowDir * rowIdx * 40;
                  return (
                    <Group key={`draft-mrow-${rowIdx}`} x={draftMultiRow.startX + perpOffsetX} y={draftMultiRow.startY + perpOffsetY} rotation={angleDeg} opacity={rowIdx === 0 ? 0.8 : 0.4}>
                      {Array.from({ length: cols }).map((_, i) => (
                        <Group key={`draft-m-${rowIdx}-${i}`} x={i * 30} y={0}>
                          <Group rotation={Math.abs((angleDeg % 360 + 360) % 360) > 90 && Math.abs((angleDeg % 360 + 360) % 360) < 270 ? 180 : 0}>
                            <Rect x={-11} y={-12} width={22} height={16} cornerRadius={4} fill={'#2B2D3C'} stroke={'#41445A'} strokeWidth={1.5} />
                            <Rect x={-7} y={6} width={14} height={6} cornerRadius={3} fill={'#2B2D3C'} stroke={'#41445A'} strokeWidth={1.5} />
                          </Group>
                          <Text text={(i + 1).toString()} fontSize={8.5} fill={'#ffffff'} fontFamily="'Satoshi', sans-serif" fontStyle="bold" align={'center'} verticalAlign={'middle'} width={22} height={16} offsetX={11} offsetY={8} y={-4} rotation={-angleDeg} />
                        </Group>
                      ))}
                    </Group>
                  );
                })}
                <Label x={midX} y={midY}>
                  <Tag fill="#6B7CFF" cornerRadius={6} shadowColor="rgba(0,0,0,0.5)" shadowBlur={5} shadowOffsetY={2} />
                  <Text text={draftMultiRow.step === 2 && rowsCount > 1 ? `${cols} × ${rowsCount}` : cols.toString()} fill="white" padding={6} fontSize={12} fontStyle="bold" fontFamily="'Satoshi', sans-serif" />
                </Label>
              </>
            );
          })()}

          {drawingMode === 'area' && draftArea.isDrawing && ( <Rect x={Math.min(draftArea.startX, draftArea.currentX)} y={Math.min(draftArea.startY, draftArea.currentY)} width={Math.abs(draftArea.currentX - draftArea.startX)} height={Math.abs(draftArea.currentY - draftArea.startY)} fill="rgba(107, 124, 255, 0.1)" stroke="#6B7CFF" strokeWidth={1.5} cornerRadius={6} dash={[5, 5]} listening={false} /> )}

          {drawingMode === 'table' && draftTable.isDrawing && (() => {
            const dx = draftTable.currentX - draftTable.startX, dy = draftTable.currentY - draftTable.startY, dragDist = Math.max(Math.sqrt(dx * dx + dy * dy), 30), seatCount = Math.max(2, Math.floor((2 * Math.PI * dragDist) / 30)), tableRadius = Math.max(15, dragDist - 25);
            return (
              <Group x={draftTable.startX} y={draftTable.startY} opacity={0.5} listening={false}>
                 <Circle radius={tableRadius} fill="#1F212E" stroke="#41445A" strokeWidth={1.5} />
                {Array.from({ length: seatCount }).map((_, i) => {
                  let seatAngle = -Math.PI / 2 + (i * ((Math.PI * 2) / seatCount)); if (seatCount % 2 !== 0) seatAngle += ((Math.PI * 2) / seatCount) / 2;
                  const seatOffset = Math.max(25, dragDist - 10), seatX = seatOffset * Math.cos(seatAngle), seatY = seatOffset * Math.sin(seatAngle), seatRot = Math.atan2(seatY, seatX) * (180 / Math.PI) - 90;
                  return (
                    <Group key={`draft-tb-${i}`} x={seatX} y={seatY}>
                      <Group rotation={seatRot} scaleX={0.8} scaleY={0.8}>
                        <Rect x={-11} y={-12} width={22} height={16} cornerRadius={4} fill={'#2B2D3C'} stroke={'#41445A'} strokeWidth={1.5} />
                        <Rect x={-7} y={6} width={14} height={6} cornerRadius={3} fill={'#2B2D3C'} stroke={'#41445A'} strokeWidth={1.5} />
                        <Text text={(i + 1).toString()} fontSize={8.5} fill={'#ffffff'} fontFamily="'Satoshi', sans-serif" fontStyle="bold" align={'center'} verticalAlign={'middle'} width={22} height={16} offsetX={11} offsetY={8} y={-4} rotation={0} />
                      </Group>
                    </Group>
                  );
                })}
              </Group>
            );
          })()}

          {(() => {
            const selectedEl = elements.find(el => selectedIds.includes(el.id)), isMultiSelect = selectedIds.length > 1;
            let dynamicAnchors: string[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
            if (selectedEl?.type === 'row') { dynamicAnchors = (selectedEl.seats && selectedEl.seats.length > 1 && Math.abs(selectedEl.seats[selectedEl.seats.length - 1].y - selectedEl.seats[0].y) > Math.abs(selectedEl.seats[selectedEl.seats.length - 1].x - selectedEl.seats[0].x)) ? ['top-center', 'bottom-center'] : ['middle-left', 'middle-right']; } 
            else if (selectedEl?.type === 'table') dynamicAnchors = [];
            let dynamicRotationSnaps: number[] = [0, 90, 180, 270]; elements.forEach(el => { if (el.type === 'row' && typeof el.rotation === 'number' && !selectedIds.includes(el.id)) { const r = el.rotation; dynamicRotationSnaps.push(r, -r, 180 - r, r + 180, r - 180); } });

            if (drawingMode !== 'select') return null;

            return (
              <Transformer 
                ref={trRef} 
                borderStroke="#FFFFFF" 
                borderStrokeWidth={1} 
                anchorStroke="#FFFFFF" 
                anchorStrokeWidth={1} 
                anchorFill="#1F212E" 
                anchorSize={6} 
                anchorCornerRadius={1} 
                rotationSnaps={dynamicRotationSnaps} 
                rotateAnchorOffset={35} 
                resizeEnabled={!isMultiSelect && selectedEl?.type !== 'table'} 
                rotateEnabled={true} 
                enabledAnchors={isMultiSelect ? [] : (dynamicAnchors as any)}
                shouldOverdrawWholeArea={true}
                ignoreStroke={true}
                ignoreFunc={(node: any) => node.name() === 'label'}
                boundBoxFunc={(oldBox, newBox) => newBox}
                onDblClick={(e) => {
                  if (drawingMode !== 'select' && drawingMode !== 'text') return;
                  if (selectedEl?.type === 'text') {
                    // Triggers the text editing for the currently selected text node
                    const trNode = trRef.current?.nodes()[0];
                    if (trNode) {
                      setEditingText({
                         id: selectedEl.id,
                         x: trNode.absolutePosition().x,
                         y: trNode.absolutePosition().y,
                         text: selectedEl.label,
                         fontSize: (selectedEl.fontSize || 32) * stageConfig.scale,
                         color: selectedEl.color || '#ffffff',
                         rotation: selectedEl.rotation || 0
                      });
                    }
                  }
                }}
              />
            );
          })()}

          {activeTransformAngle && (() => {
            const currentAngle = activeTransformAngle.angle; let isOrthogonalSnap = false, isMirroredSnap = false, isParallelSnap = false, matchedEl: any = null, snapType: 'parallel' | 'mirror' | null = null;
            [0, 90, 180, -90, 270, -180, 360].forEach(t => { if (Math.abs((currentAngle - t) % 360) < 1 || 360 - Math.abs((currentAngle - t) % 360) < 1) isOrthogonalSnap = true; });
            elements.forEach(el => {
              if (el.type === 'row' && typeof el.rotation === 'number' && !selectedIds.includes(el.id)) {
                [{ t: el.rotation, type: 'parallel' }, { t: el.rotation + 180, type: 'parallel' }, { t: el.rotation - 180, type: 'parallel' }, { t: -el.rotation, type: 'mirror' }, { t: 180 - el.rotation, type: 'mirror' }, { t: -180 - el.rotation, type: 'mirror' }].forEach(c => {
                  if (Math.abs((currentAngle - c.t) % 360) < 1 || 360 - Math.abs((currentAngle - c.t) % 360) < 1) { if (c.type === 'mirror') isMirroredSnap = true; if (c.type === 'parallel') isParallelSnap = true; matchedEl = el; snapType = c.type as any; }
                });
              }
            });
            const extendX = Math.cos(currentAngle * Math.PI / 180) * 3000, extendY = Math.sin(currentAngle * Math.PI / 180) * 3000, lineColor = isMirroredSnap || isParallelSnap ? '#6B7CFF' : (isOrthogonalSnap ? '#10b981' : '#ef4444');

            return (
              <>
                {matchedEl && (
                  <Group x={matchedEl.x} y={matchedEl.y} rotation={matchedEl.rotation} opacity={0.8} listening={false}>
                    <Rect x={-15} y={-15} width={(matchedEl.seats.length * 30)} height={30} fill="rgba(107, 124, 255, 0.15)" stroke="#6B7CFF" strokeWidth={1} dash={[5, 5]} cornerRadius={6} />
                    <Text text={snapType === 'mirror' ? "Simetría Espejo" : "Fila Paralela"} y={-35} fill="#6B7CFF" fontSize={14} fontStyle="bold" fontFamily="'Satoshi', sans-serif" />
                  </Group>
                )}
                <Line points={[ activeTransformAngle.x - extendX, activeTransformAngle.y - extendY, activeTransformAngle.x + extendX, activeTransformAngle.y + extendY ]} stroke={lineColor} strokeWidth={isMirroredSnap || isParallelSnap ? 1.5 : 1} dash={isMirroredSnap || isParallelSnap ? [10, 5] : [5, 5]} listening={false} opacity={0.6} />
              </>
            );
          })()}
        </Layer>
      </Stage>

      {editingText && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1000}}>
          <textarea
            autoFocus defaultValue={editingText.text}
            style={{ position: 'absolute', top: editingText.y, left: editingText.x, pointerEvents: 'auto', transform: `rotate(${editingText.rotation}deg)`, transformOrigin: 'top left', fontSize: `${editingText.fontSize}px`, color: editingText.color, fontFamily: "'Satoshi', sans-serif", fontWeight: 'bold', background: '#1F212E', border: '2px solid #6B7CFF', borderRadius: '8px', outline: 'none', minWidth: '200px', minHeight: `${editingText.fontSize * 1.5}px`, padding: '4px', lineHeight: 1, resize: 'both', overflow: 'hidden', whiteSpace: 'pre', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
            onBlur={(e) => { updateElement(editingText.id, { label: e.target.value }); setEditingText(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); updateElement(editingText.id, { label: e.currentTarget.value }); setEditingText(null); } }}
            onFocus={(e) => { const val = e.target.value; e.target.value = ''; e.target.value = val; }}
          />
        </div>
      )}

      {/* WIDGET DE CONTROLES DE ZOOM INFERIOR IZQUIERDO */}
      <div className="absolute bottom-0 left-[64px] flex items-center gap-1 bg-[#2B2D3C] border-t border-r border-[#41445A] px-3 py-1.5 z-20">
        <button onClick={() => handleZoom('out')} className="p-2 text-[#8B8FA3] hover:text-white hover:bg-[#41445A] rounded-md transition-all" title="Alejar"><MdRemove size={18} /></button>
        <span className="text-xs font-bold text-[#FFFFFF] w-12 text-center select-none cursor-default font-mono">{Math.round(stageConfig.scale * 100)}%</span>
        <button onClick={() => handleZoom('in')} className="p-2 text-[#8B8FA3] hover:text-white hover:bg-[#41445A] rounded-md transition-all" title="Acercar"><MdAdd size={18} /></button>
        <div className="w-px h-4 bg-[#41445A] mx-1"></div>
        <button onClick={handleResetView} className="p-2 text-[#8B8FA3] hover:text-[#6B7CFF] hover:bg-[#6B7CFF]/10 rounded-md transition-all" title="Centrar"><MdFilterCenterFocus size={18} /></button>
      </div>
    </div>
  );
}