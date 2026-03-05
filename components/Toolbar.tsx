"use client";

import { 
  MdOutlineNearMe, MdPanTool, MdMoreHoriz, 
  MdOutlineAddBox, MdTableRestaurant, MdTitle, MdEventSeat, MdViewModule
} from "react-icons/md";
import { useMapStore } from "../store/useMapStore";

export default function Toolbar() {
  const { drawingMode, setDrawingMode } = useMapStore();

  const tools = [
    { mode: 'select', icon: <MdOutlineNearMe size={22} />, title: 'Seleccionar Grupo' },
    { mode: 'select-seat', icon: <MdEventSeat size={20} />, title: 'Seleccionar Asiento Individual' },
    { mode: 'pan', icon: <MdPanTool size={22} />, title: 'Desplazar Lienzo' },
    { mode: 'row', icon: <MdMoreHoriz size={24} />, title: 'Fila de Asientos', isGroup: true },
    { mode: 'area', icon: <MdOutlineAddBox size={22} />, title: 'Área General' },
    { mode: 'table', icon: <MdTableRestaurant size={22} />, title: 'Mesa Redonda' },
    { mode: 'text', icon: <MdTitle size={22} />, title: 'Texto Libre' },
  ];

  return (
    <aside className="absolute left-0 top-[60px] bottom-0 w-[64px] bg-[#2B2D3C] border-r border-[#41445A] flex flex-col items-center py-4 gap-3 z-20">
      {tools.map((tool) => (
        <div key={tool.mode} className="relative group flex flex-col items-center w-full">
          <button 
            onClick={() => tool.isGroup ? setDrawingMode('row') : setDrawingMode(tool.mode as any)} 
            className={`p-3 rounded-lg transition-all duration-200 ${
              drawingMode === tool.mode || (tool.isGroup && drawingMode === 'multi-row') ? 'bg-[#6B7CFF] text-white shadow-[0_2px_10px_rgba(107,124,255,0.3)]' : 'text-[#8B8FA3] hover:text-white hover:bg-[#41445A]'
            }`}
          >
            {tool.icon}
          </button>
          
          {tool.isGroup ? (
            <div className="absolute left-full ml-2 bg-[#1F212E] p-1.5 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-[#41445A] shadow-xl z-50 flex flex-col gap-1 w-max">
              <button 
                onClick={(e) => { e.stopPropagation(); setDrawingMode('row'); }} 
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors ${drawingMode === 'row' ? 'bg-[#6B7CFF] text-white' : 'text-[#8B8FA3] hover:text-white hover:bg-[#41445A]'}`}
              >
                <MdMoreHoriz size={16}/> Fila Individual
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setDrawingMode('multi-row'); }} 
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors ${drawingMode === 'multi-row' ? 'bg-[#6B7CFF] text-white' : 'text-[#8B8FA3] hover:text-white hover:bg-[#41445A]'}`}
              >
                <MdViewModule size={16}/> Múltiples Filas
              </button>
            </div>
          ) : (
            <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#1F212E] text-white text-xs font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap border border-[#41445A] shadow-xl z-50">
              {tool.title}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}