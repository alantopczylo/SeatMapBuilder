"use client";

import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import { useMapStore } from '../store/useMapStore';

const AreaNode = React.memo(({ el, canvasProps }: any) => {
  const isSelected = useMapStore(state => state.selectedIds.includes(el.id));
  const isMultiSelect = useMapStore(state => state.selectedIds.length > 1);
  const drawingMode = useMapStore(state => state.drawingMode);
  const categories = useMapStore(state => state.categories);
  const selectedIds = useMapStore(state => state.selectedIds);
  const updateElement = useMapStore(state => state.updateElement);
  const setSelection = useMapStore(state => state.setSelection);

  const { nodesRef, applyDragSnapping, isDraggingRef, handleDragMove, setMousePos, setActiveTransformAngle } = canvasProps;
  
  const category = categories.find((c: any) => c.id === el.categoryId);
  const elementColor = category ? category.color : '#2B2D3C'; 
  const isDraggable = drawingMode === 'select' && !(isMultiSelect && isSelected);

  return (
    <Group
      ref={(node) => { if (node) nodesRef.current[el.id] = node; }}
      x={el.x} y={el.y} width={el.width} height={el.height} rotation={el.rotation || 0} draggable={isDraggable}
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
        setActiveTransformAngle({ x: e.target.x(), y: e.target.y(), angle: e.target.rotation() }); 
      }}
      onTransformEnd={(e: any) => {
        if (e.target !== nodesRef.current[el.id]) return;
        setActiveTransformAngle(null); const node = e.target;
        const scaleX = node.scaleX(), scaleY = node.scaleY(); node.scaleX(1); node.scaleY(1);
        updateElement(el.id, { x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(5, el.width * scaleX), height: Math.max(5, el.height * scaleY) });
      }}
      onClick={(e: any) => { if (drawingMode !== 'select') return; e.cancelBubble = true; setSelection([el.id]); }}
    >
      <Rect width={el.width} height={el.height} fill={category ? `${elementColor}1A` : "rgba(255, 255, 255, 0.05)"} stroke={isSelected ? '#FFFFFF' : (category ? elementColor : '#41445A')} strokeWidth={1.5} cornerRadius={8} />
      <Text text={el.label} width={el.width} height={el.height} align="center" verticalAlign="middle" fill={category ? elementColor : "#8B8FA3"} fontSize={20} fontStyle="bold" fontFamily="'Satoshi', sans-serif" listening={false} />
    </Group>
  );
});

AreaNode.displayName = 'AreaNode';
export default AreaNode;