"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Header from "../components/Header";
import Toolbar from "../components/Toolbar";
import Inspector from "../components/Inspector";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

// Disable SSR para Konva (solo se renderiza en el cliente)
const MapCanvas = dynamic(() => import("../components/MapCanvas"), { ssr: false });

export default function EditorLayout() {
  const [isClient, setIsClient] = useState(false);
  
  useKeyboardShortcuts();
  
  useEffect(() => { 
    setIsClient(true); 
  }, []);

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