"use client";

import React, { useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { useMapStore } from '../store/useMapStore';

const RowNode = React.memo(({ el, canvasProps }: any) => {
  const isSelected = useMapStore(state => state.selectedIds.includes(el.id));
  const isMultiSelect = useMapStore(state => state.selectedIds.length > 1);
  const drawingMode = useMapStore(state => state.drawingMode);
  const categories = useMapStore(state => state.categories);
  const selectedIds = useMapStore(state => state.selectedIds);
  const updateElement = useMapStore(state => state.updateElement);
  const setSelection = useMapStore(state => state.setSelection);

  const { nodesRef, applyDragSnapping, isDraggingRef, handleDragMove, setMousePos, setActiveTransformAngle, trRef } = canvasProps;
  
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);

  const category = categories.find((c: any) => c.id === el.categoryId);
  const elementColor = category ? category.color : '#2B2D3C'; 
  const isDraggable = drawingMode === 'select' && !(isMultiSelect && isSelected);

  // La etiqueta principal de la fila ("Fila A") la mantenemos siempre derecha para que se lea bien.
  const normalizedAngle = ((el.rotation || 0) % 360 + 360) % 360;
  const isFacingLeft = normalizedAngle > 90 && normalizedAngle < 270;
  const labelWidth = 150;
  const labelOffsetX = isFacingLeft ? 0 : labelWidth;
  const labelAlign = isFacingLeft ? 'left' : 'right';

  return (
    <Group
      ref={(node) => { 
        if (node) {
          nodesRef.current[el.id] = node;
          // Sobrescribimos getClientRect para ignorar el texto (Fila A) en el Transformer
          const originalGetClientRect = node.getClientRect.bind(node);
          node.getClientRect = (config) => {
             const labelNode = node.findOne('.row-label');
             if (labelNode) {
                 const wasVisible = labelNode.visible();
                 labelNode.visible(false);
                 const rect = originalGetClientRect(config);
                 labelNode.visible(wasVisible);
                 return rect;
             }
             return originalGetClientRect(config);
          };
        }
      }}
      x={el.x} y={el.y} rotation={el.rotation || 0} draggable={isDraggable}
      dragBoundFunc={(pos: any) => applyDragSnapping(pos, el)}
      onDragStart={(e: any) => { if (e.target !== nodesRef.current[el.id]) return; isDraggingRef.current = true; }}
      onDragMove={(e: any) => { 
        if (e.target !== nodesRef.current[el.id]) return; 
        handleDragMove(e, el); 
      }}
      onDragEnd={(e: any) => {
        if (e.target !== nodesRef.current[el.id]) return;
        isDraggingRef.current = false; setMousePos(null);
        updateElement(el.id, { x: e.target.x(), y: e.target.y(), rotation: e.target.rotation() });
      }}
      onTransform={(e: any) => {
        if (e.target !== nodesRef.current[el.id]) return;
        const node = e.target;
        const activeAnchor = trRef.current?.getActiveAnchor();
        
        if (activeAnchor !== 'rotater') {
          const isDraggingLeft = activeAnchor === 'middle-left' || activeAnchor === 'top-left' || activeAnchor === 'bottom-left';
          const scaleX = node.scaleX();
          const hitBoxWidth = el.seats.length * 30; 
          const newSeatCount = Math.max(1, Math.round((hitBoxWidth * scaleX) / 30));

          const angleRad = (el.rotation || 0) * Math.PI / 180;
          let finalX = el.x, finalY = el.y;

          if (isDraggingLeft) {
            const currentRightLocalX = Math.max(0, el.seats.length - 1) * 30;
            const rightWorldX = el.x + currentRightLocalX * Math.cos(angleRad);
            const rightWorldY = el.y + currentRightLocalX * Math.sin(angleRad);
            const newRightLocalX = Math.max(0, newSeatCount - 1) * 30;
            finalX = rightWorldX - newRightLocalX * Math.cos(angleRad);
            finalY = rightWorldY - newRightLocalX * Math.sin(angleRad);
          }

          node.scaleX(1); node.scaleY(1); node.position({ x: finalX, y: finalY });
          setActiveTransformAngle({ x: finalX, y: finalY, angle: node.rotation() });

          if (newSeatCount !== el.seats.length) {
            const diff = newSeatCount - el.seats.length;
            let newSeatsArray = [...el.seats];
            if (diff > 0) {
              const newSeats = Array.from({ length: diff }).map(() => ({ id: crypto.randomUUID(), status: 'available', label: '', x: 0, y: 0 }));
              newSeatsArray = isDraggingLeft ? [...newSeats, ...newSeatsArray] : [...newSeatsArray, ...newSeats];
            } else if (diff < 0) {
              newSeatsArray = isDraggingLeft ? newSeatsArray.slice(Math.abs(diff)) : newSeatsArray.slice(0, newSeatCount);
            }
            const firstLabel = el.seats[0]?.label || '1';
            const prefixMatch = firstLabel.match(/^(.*?)(\d+)$/);
            const basePrefix = prefixMatch ? prefixMatch[1] : '';
            const baseStartNum = prefixMatch ? parseInt(prefixMatch[2], 10) : (parseInt(firstLabel, 10) || 1);
            const finalSeats = newSeatsArray.map((seat, i) => ({ ...seat, label: `${basePrefix}${baseStartNum + i}`, x: i * 30, y: 0 }));
            updateElement(el.id, { x: finalX, y: finalY, rotation: el.rotation, seats: finalSeats as any });
          }
        } else {
          setActiveTransformAngle({ x: node.x(), y: node.y(), angle: node.rotation() });
          // Rotación manejada puramente por Konva hasta que se suelte el clic para fluidez extrema
        }
      }}
      onTransformEnd={(e: any) => {
        if (e.target !== nodesRef.current[el.id]) return;
        setActiveTransformAngle(null);
        updateElement(el.id, { x: e.target.x(), y: e.target.y(), rotation: e.target.rotation() });
      }}
      onClick={(e: any) => { if (drawingMode !== 'select') return; e.cancelBubble = true; setSelection([el.id]); }}
    >
      <Text
        name="row-label label"
        x={-35} y={0} offsetX={labelOffsetX} offsetY={15} width={labelWidth} height={30}
        text={el.label} fontSize={22} fontStyle="bold" fontFamily="'Satoshi', sans-serif" fill={category ? elementColor : '#8B8FA3'}
        align={labelAlign} verticalAlign="middle" listening={false} rotation={-(el.rotation || 0)}
      />
      <Rect x={-15} y={-15} width={el.seats.length * 30} height={30} fill="transparent" listening={false} />
      
      {el.seats.map((seat: any) => {
        const isSeatSelected = selectedIds.includes(seat.id);
        const isHoverableMode = drawingMode === 'select-seat';
        const isSeatHovered = isHoverableMode && hoveredSeatId === seat.id;

        const seatCategory = seat.categoryId ? categories.find((c: any) => c.id === seat.categoryId) : category;
        const seatColor = seatCategory ? seatCategory.color : '#2B2D3C';
        const fill = isSeatSelected ? 'rgba(255, 255, 255, 0.4)' : isSeatHovered ? 'rgba(255, 255, 255, 0.2)' : seatColor;
        const stroke = isSeatSelected || isSeatHovered ? '#FFFFFF' : (seatCategory ? seatColor : '#41445A');

        return (
          <Group 
            key={seat.id} 
            x={seat.x} 
            y={seat.y}
            onClick={(e: any) => {
              if (drawingMode === 'select-seat') {
                e.cancelBubble = true;
                if (e.evt.shiftKey) {
                  const seatIds = el.seats.map((s: any) => s.id);
                  const clickedIdx = seatIds.indexOf(seat.id);
                  let anchorIdx = -1;
                  for (const id of selectedIds) {
                    const idx = seatIds.indexOf(id);
                    if (idx >= 0) { anchorIdx = idx; break; }
                  }
                  if (anchorIdx >= 0) {
                    const from = Math.min(anchorIdx, clickedIdx);
                    const to = Math.max(anchorIdx, clickedIdx);
                    const rangeIds = seatIds.slice(from, to + 1);
                    const otherIds = selectedIds.filter((id: string) => !seatIds.includes(id));
                    setSelection([...otherIds, ...rangeIds]);
                  } else {
                    setSelection([...selectedIds, seat.id]);
                  }
                } else if (e.evt.ctrlKey || e.evt.metaKey) {
                  if (selectedIds.includes(seat.id)) {
                    setSelection(selectedIds.filter((id: string) => id !== seat.id));
                  } else {
                    setSelection([...selectedIds, seat.id]);
                  }
                } else {
                  setSelection([seat.id]);
                }
              }
            }}
            onMouseEnter={() => setHoveredSeatId(seat.id)}
            onMouseLeave={() => setHoveredSeatId(null)}
          >
            {/* Counter-rotate seats so they always appear upright regardless of row angle */}
            <Group rotation={-(el.rotation || 0)}>
              <Rect x={-11} y={-12} width={22} height={16} cornerRadius={4} fill={fill} stroke={stroke} strokeWidth={1.5} />
              <Rect x={-7} y={6} width={14} height={6} cornerRadius={3} fill={fill} stroke={stroke} strokeWidth={1.5} />
              <Text
                text={seat.label} fontSize={8.5} fill={'#FFFFFF'} fontFamily="'Satoshi', sans-serif" fontStyle="bold" 
                align={'center'} verticalAlign={'middle'} width={22} height={16} offsetX={11} offsetY={8} y={-4}
                listening={false}
              />
            </Group>
          </Group>
        );
      })}
    </Group>
  );
});

RowNode.displayName = 'RowNode';
export default RowNode;