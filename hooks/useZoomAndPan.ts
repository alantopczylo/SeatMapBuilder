import { useState } from 'react';
import Konva from 'konva';
import { MapElement } from '../types';

interface Dimensions {
  width: number;
  height: number;
}

export function useZoomAndPan(dimensions: Dimensions, elements: MapElement[]) {
  const [stageConfig, setStageConfig] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

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

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault(); 
    const stage = e.target.getStage(); 
    if (!stage) return;
    const oldScale = stageConfig.scale;
    const pointer = stage.getPointerPosition(); 
    if (!pointer) return;
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY > 0 ? Math.max(oldScale / scaleBy, 0.1) : Math.min(oldScale * scaleBy, 5);
    const mousePointTo = { x: (pointer.x - stageConfig.x) / oldScale, y: (pointer.y - stageConfig.y) / oldScale };
    setStageConfig({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale, scale: newScale });
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      setStageConfig(prev => ({ ...prev, x: e.target.x(), y: e.target.y() }));
      setIsPanning(false);
    }
  };

  return {
    stageConfig,
    setStageConfig,
    isPanning,
    setIsPanning,
    handleZoom,
    handleResetView,
    handleWheel,
    handleDragEnd
  };
}
