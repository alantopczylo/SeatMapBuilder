"use client";

import React from 'react';
import { Group, Text } from 'react-konva';
import { useMapStore } from '../store/useMapStore';

const TextNode = React.memo(({ el, canvasProps }: any) => {
  const isSelected = useMapStore(state => state.selectedIds.includes(el.id));
  const isMultiSelect = useMapStore(state => state.selectedIds.length > 1);
  const drawingMode = useMapStore(state => state.drawingMode);
  const updateElement = useMapStore(state => state.updateElement);
  const setSelection = useMapStore(state => state.setSelection);

  const { nodesRef, applyDragSnapping, isDraggingRef, handleDragMove, setMousePos, setActiveTransformAngle, scale, setEditingText } = canvasProps;
  
  const isDraggable = drawingMode === 'select' && !(isMultiSelect && isSelected);

  return (
    <Group
      ref={(node) => { if (node) nodesRef.current[el.id] = node; }}
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
        setActiveTransformAngle({ x: e.target.x(), y: e.target.y(), angle: e.target.rotation() }); 
      }}
      onTransformEnd={(e: any) => {
        if (e.target !== nodesRef.current[el.id]) return;
        setActiveTransformAngle(null); const node = e.target;
        updateElement(el.id, { x: node.x(), y: node.y(), rotation: node.rotation() });
      }}
      onClick={(e: any) => { if (drawingMode !== 'select') return; e.cancelBubble = true; setSelection([el.id]); }}
      onDblClick={(e: any) => {
        if (drawingMode !== 'select' && drawingMode !== 'text') return;
        e.cancelBubble = true;
        const textNode = nodesRef.current[el.id]?.findOne('.text-element') as import('konva').default.Text;
        if (textNode) {
           const absPos = textNode.getAbsolutePosition();
           setEditingText({ id: el.id, x: absPos.x, y: absPos.y, text: el.label, fontSize: (el.fontSize || 32) * scale, color: el.color || '#ffffff', rotation: textNode.getAbsoluteRotation() });
        }
      }}
    >
      <Text name="text-element" text={el.label} fontSize={el.fontSize || 32} fill={el.color || '#ffffff'} fontFamily="'Satoshi', sans-serif" fontStyle="bold" opacity={canvasProps.editingTextId === el.id ? 0 : 1} />
    </Group>
  );
});

TextNode.displayName = 'TextNode';
export default TextNode;