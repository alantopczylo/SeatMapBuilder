"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { useMapStore } from "../store/useMapStore";
import Header from "../components/Header";
import Toolbar from "../components/Toolbar";
import Inspector from "../components/Inspector";

// Disable SSR para Konva (solo se renderiza en el cliente)
const MapCanvas = dynamic(() => import("../components/MapCanvas"), { ssr: false });

export default function EditorLayout() {
  const [isClient, setIsClient] = useState(false);
  
  // Extraemos las funciones del store necesarias para los atajos de teclado
  const { 
    categories, 
    addCategory,
    selectedIds,
    removeElements,
    copySelection,
    pasteClipboard,
    undo,
    redo
  } = useMapStore();
  
  useEffect(() => { 
    setIsClient(true); 
  }, []);

  // ==========================================
  // ATAJOS DE TECLADO GLOBALES CON CONFIRMACIÓN
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Evitamos que los atajos se activen si el usuario está escribiendo un texto o un número
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      // Eliminar (Suprimir o Backspace) CON CONFIRMACIÓN REQUERIDA
      if (e.key === 'Delete' || e.key === 'Backspace') { 
        if (selectedIds.length > 0) { 
          e.preventDefault(); 
          const msg = selectedIds.length === 1 
            ? "¿Estás seguro de eliminar este elemento?" 
            : `¿Estás seguro de eliminar estos ${selectedIds.length} elementos?`;
            
          useMapStore.getState().openConfirmModal(msg, () => removeElements(selectedIds));
        } 
      }
      
      // Copiar (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { 
        e.preventDefault(); 
        copySelection(); 
      }
      
      // Pegar (Ctrl+V / Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { 
        e.preventDefault(); 
        pasteClipboard(); 
      }
      
      // Deshacer (Ctrl+Z / Cmd+Z)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { 
        e.preventDefault(); 
        undo(); 
      }
      
      // Rehacer (Ctrl+Y / Cmd+Y o Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { 
        e.preventDefault(); 
        redo(); 
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, removeElements, copySelection, pasteClipboard, undo, redo]);

  if (!isClient) return null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1F212E] text-[#FFFFFF] selection:bg-[#6B7CFF]/30 font-sans">
      
      {/* CAPA DEL CANVAS */}
      <section className="absolute inset-0 z-0">
        <MapCanvas />
      </section>

      {/* COMPONENTES DE UI ORQUESTADOS */}
      <Header />
      <Toolbar />
      <Inspector />

    </div>
  );
}