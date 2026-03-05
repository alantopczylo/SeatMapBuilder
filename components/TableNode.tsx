"use client";

import React, { useState } from 'react';
import { Group, Circle, Rect, Text } from 'react-konva';
import { useMapStore } from '../store/useMapStore';

const TableNode = React.memo(({ el, canvasProps }: any) => {
  const isSelected = useMapStore(state => state.selectedIds.includes(el.id));
  const isMultiSelect = useMapStore(state => state.selectedIds.length > 1);
  const drawingMode = useMapStore(state => state.drawingMode);
  const categories = useMapStore(state => state.categories);
  const selectedIds = useMapStore(state => state.selectedIds);
  const updateElement = useMapStore(state => state.updateElement);
  const setSelection = useMapStore(state => state.setSelection);

  const { nodesRef, applyDragSnapping, isDraggingRef, handleDragMove, setMousePos, setActiveTransformAngle } = canvasProps;
  
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);

  const category = categories.find(c => c.id === el.categoryId);

  const isDraggable = drawingMode === 'select' && !(isMultiSelect && isSelected);

  let tableRadius = 30;
  if (el.seats && el.seats.length > 0) {
     const distToSeat = Math.sqrt(el.seats[0].x * el.seats[0].x + el.seats[0].y * el.seats[0].y);
     tableRadius = Math.max(15, distToSeat - 15);
  }

  return (
    <Group
      ref={(node) => { if (node) nodesRef.current[el.id] = node; }}
      x={el.x} y={el.y} rotation={el.rotation || 0} draggable={isDraggable}
      dragBoundFunc={(pos) => applyDragSnapping(pos, el)}
      onDragStart={(e) => { if (e.target !== nodesRef.current[el.id]) return; isDraggingRef.current = true; }}
      onDragMove={(e) => { 
        if (e.target !== nodesRef.current[el.id]) return; 
        handleDragMove(e, el); 
      }}
      onDragEnd={(e) => {
        if (e.target !== nodesRef.current[el.id]) return;
        isDraggingRef.current = false; setMousePos(null);
        updateElement(el.id, { x: e.target.x(), y: e.target.y(), rotation: e.target.rotation() });
      }}
      onTransform={(e) => { 
        if (e.target !== nodesRef.current[el.id]) return; 
        setActiveTransformAngle({ x: e.target.x(), y: e.target.y(), angle: e.target.rotation() }); 
      }}
      onTransformEnd={(e) => {
        if (e.target !== nodesRef.current[el.id]) return;
        setActiveTransformAngle(null);
        updateElement(el.id, { x: e.target.x(), y: e.target.y(), rotation: e.target.rotation() });
      }}
      onClick={(e) => { if (drawingMode !== 'select') return; e.cancelBubble = true; setSelection([el.id]); }}
    >
      <Circle radius={tableRadius} fill={isSelected ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255,255,255,0.05)'} stroke={isSelected ? '#FFFFFF' : '#41445A'} strokeWidth={1} />
      <Text text={el.label} fontSize={18} fill={isSelected ? '#FFFFFF' : '#8B8FA3'} fontFamily="'Satoshi', sans-serif" fontStyle="bold" align="center" verticalAlign="middle" offsetX={tableRadius} offsetY={9} width={tableRadius * 2} listening={false} rotation={-(el.rotation || 0)} />
      
      {el.seats.map((seat: any) => {
        const isSeatSelected = selectedIds.includes(seat.id);
        const isHoverableMode = drawingMode === 'select-seat';
        const isSeatHovered = isHoverableMode && hoveredSeatId === seat.id;

        const seatCategory = seat.categoryId ? categories.find(c => c.id === seat.categoryId) : category;
        const seatColor = seatCategory ? seatCategory.color : '#2B2D3C';
        const fill = isSeatSelected ? 'rgba(255, 255, 255, 0.4)' : isSeatHovered ? 'rgba(255, 255, 255, 0.2)' : seatColor;
        const stroke = isSeatSelected || isSeatHovered ? '#FFFFFF' : (seatCategory ? seatColor : '#41445A');
         const seatShapeRot = Math.atan2(seat.y, seat.x) * (180 / Math.PI) - 90;
        // Flip text 180° when the seat rotation would make it upside-down
        const normalizedRot = ((seatShapeRot % 360) + 360) % 360;
        const textFlip = (normalizedRot > 90 && normalizedRot < 270) ? 180 : 0;

        return (
          <Group 
            key={seat.id} x={seat.x} y={seat.y}
            onClick={(e) => { 
              if (drawingMode === 'select-seat') { 
                e.cancelBubble = true; 
                if (e.evt.shiftKey) {
                  const seatIds = el.seats.map((s: any) => s.id);
                  const clickedIdx = seatIds.indexOf(seat.id);
                  let anchorIdx = -1;
                  for (const id of selectedIds) { const idx = seatIds.indexOf(id); if (idx >= 0) { anchorIdx = idx; break; } }
                  if (anchorIdx >= 0) {
                    const from = Math.min(anchorIdx, clickedIdx), to = Math.max(anchorIdx, clickedIdx);
                    const rangeIds = seatIds.slice(from, to + 1);
                    const otherIds = selectedIds.filter((id: string) => !seatIds.includes(id));
                    setSelection([...otherIds, ...rangeIds]);
                  } else { setSelection([...selectedIds, seat.id]); }
                } else if (e.evt.ctrlKey || e.evt.metaKey) {
                  if (selectedIds.includes(seat.id)) {
                    setSelection(selectedIds.filter((id: string) => id !== seat.id));
                  } else {
                    setSelection([...selectedIds, seat.id]);
                  }
                } else { setSelection([seat.id]); } 
              } 
            }}
            onMouseEnter={() => setHoveredSeatId(seat.id)}
            onMouseLeave={() => setHoveredSeatId(null)}
          >
            <Group rotation={seatShapeRot} scaleX={0.8} scaleY={0.8}>
              <Rect x={-11} y={-12} width={22} height={16} cornerRadius={4} fill={fill} stroke={stroke} strokeWidth={1.5} />
              <Rect x={-7} y={6} width={14} height={6} cornerRadius={3} fill={fill} stroke={stroke} strokeWidth={1.5} />
              <Text 
                text={seat.label} fontSize={8.5} fill={'#FFFFFF'} fontFamily="'Satoshi', sans-serif" fontStyle="bold" 
                align={'center'} verticalAlign={'middle'} width={22} height={16} offsetX={11} offsetY={8} y={-4}
                rotation={textFlip} listening={false} />
            </Group>
          </Group>
        );
      })}
    </Group>
  );
});

TableNode.displayName = 'TableNode';
export default TableNode;