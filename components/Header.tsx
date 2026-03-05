"use client";

import { useRef, useState, useEffect } from "react";
import { MdUndo, MdRedo, MdRestore, MdFolderOpen, MdSave, MdCloudDone, MdClose, MdDeleteOutline, MdAccessTime } from "react-icons/md";
import { useMapStore } from "../store/useMapStore";

export default function Header() {
  const { elements, mapName, setMapName, resetMap, importMap, undo, redo, past, future } = useMapStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [draftsList, setDraftsList] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-guardado
  useEffect(() => {
    if (elements.length > 0) {
      const timer = setTimeout(() => {
        setIsSaving(true);
        try {
          const existing = JSON.parse(localStorage.getItem('fanz_drafts') || '[]');
          const draftIndex = existing.findIndex((d: any) => d.mapName === mapName);
          const newDraft = { mapName, elements, updatedAt: new Date().toISOString() };
          if (draftIndex >= 0) existing[draftIndex] = newDraft;
          else existing.unshift(newDraft);
          // Limitamos a 5 borradores para no saturar el LocalStorage (5MB max)
          localStorage.setItem('fanz_drafts', JSON.stringify(existing.slice(0, 5)));
        } catch (e) { console.error("Error guardando:", e); }
        setTimeout(() => setIsSaving(false), 800);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [elements, mapName]);

  const openDraftsModal = () => {
    setDraftsList(JSON.parse(localStorage.getItem('fanz_drafts') || '[]'));
    setIsDraftsModalOpen(true);
  };

  const handleLoadDraft = (draft: any) => {
    useMapStore.getState().openConfirmModal(`¿Cargar "${draft.mapName}"? Perderás los cambios actuales sin guardar.`, () => {
      importMap(draft.elements);
      setMapName(draft.mapName);
      setIsDraftsModalOpen(false);
    });
  };

  const handleDeleteDraft = (draftNameToDelete: string) => {
    useMapStore.getState().openConfirmModal(`¿Borrar "${draftNameToDelete}" permanentemente?`, () => {
      const updated = draftsList.filter(d => d.mapName !== draftNameToDelete);
      setDraftsList(updated);
      localStorage.setItem('fanz_drafts', JSON.stringify(updated));
    });
  };

  const handleExportMap = () => {
    const dataStr = JSON.stringify({ version: '1.0', mapName, elements }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
    a.download = `${mapName.replace(/\s+/g, '_')}.json`;
    a.click();
  };

  const handleImportMap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.elements && Array.isArray(json.elements)) {
          importMap(json.elements);
          if (json.mapName) setMapName(json.mapName);
        } else alert('Formato de archivo inválido.');
      } catch (err) { alert('Error al leer el archivo JSON.'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <header className="absolute top-0 left-0 w-full h-[60px] bg-[#2B2D3C] border-b border-[#41445A] flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12H10M4 6H20M4 18H16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-black text-white text-lg tracking-widest mt-0.5">FANZ</span>
          </div>
          <span className="h-6 w-px bg-[#41445A] mx-2"></span>
          
          <div className="flex items-center gap-2 group">
            <input 
              type="text" value={mapName} onChange={(e) => setMapName(e.target.value)}
              className="bg-[#1F212E] font-medium text-[#FFFFFF] text-sm outline-none border border-[#41445A] hover:border-[#6B7CFF] focus:border-[#6B7CFF] px-3 py-1.5 rounded-md transition-all w-64 truncate"
              placeholder="Nombre del plano..."
            />
            {isSaving && <MdCloudDone size={16} className="text-[#8B8FA3] animate-pulse" title="Guardado automático" />}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1F212E] rounded-md p-1 mr-3 border border-[#41445A]">
            <button onClick={undo} disabled={past.length === 0} className="p-1.5 text-[#8B8FA3] hover:text-white hover:bg-[#41445A] rounded-sm disabled:opacity-30 disabled:hover:bg-transparent transition-all"><MdUndo size={16} /></button>
            <button onClick={redo} disabled={future.length === 0} className="p-1.5 text-[#8B8FA3] hover:text-white hover:bg-[#41445A] rounded-sm disabled:opacity-30 disabled:hover:bg-transparent transition-all"><MdRedo size={16} /></button>
          </div>

          <button onClick={() => useMapStore.getState().openConfirmModal('¿Comenzar un mapa en blanco? Se perderá el progreso sin guardar.', resetMap)} className="text-xs font-semibold text-[#8B8FA3] hover:text-white hover:bg-[#41445A] px-3 py-2 rounded-md transition-colors">Nuevo</button>
          <button onClick={openDraftsModal} className="text-xs font-semibold text-[#8B8FA3] hover:text-[#6B7CFF] hover:bg-[#6B7CFF]/10 px-3 py-2 rounded-md transition-colors flex items-center gap-1.5">
            <MdRestore size={16}/> Borradores
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-[#8B8FA3] hover:text-white hover:bg-[#41445A] px-3 py-2 rounded-md transition-colors flex items-center gap-1.5">
            <MdFolderOpen size={16}/> Importar
          </button>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImportMap} />
          
          <button onClick={handleExportMap} className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-[#6B7CFF] text-white hover:bg-[#5A6AE6] rounded-md transition-all ml-2 shadow-[0_2px_10px_rgba(107,124,255,0.2)]">
            <MdSave size={16} /> Exportar
          </button>
        </div>
      </header>

      {isDraftsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1F212E]/90 backdrop-blur-sm p-4">
          <div className="bg-[#2B2D3C] border border-[#41445A] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#41445A] flex items-center justify-between bg-[#2B2D3C]">
              <h2 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-widest">Borradores Locales</h2>
              <button onClick={() => setIsDraftsModalOpen(false)} className="p-1.5 text-[#8B8FA3] hover:text-[#FFFFFF] transition-colors bg-[#1F212E] border border-[#41445A] rounded-md">
                <MdClose size={16} />
              </button>
            </div>
            <div className="p-2 max-h-[50vh] overflow-y-auto scrollbar-thin">
              {draftsList.length === 0 ? (
                <div className="p-8 text-center text-[#8B8FA3] text-sm">No hay guardados automáticos.</div>
              ) : (
                draftsList.map((draft, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 hover:bg-[#1F212E] rounded-lg transition-colors border-b border-[#41445A]/50 last:border-0 group">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-[#FFFFFF]">{draft.mapName}</span>
                      <span className="text-[10px] text-[#8B8FA3] flex items-center gap-1">
                        <MdAccessTime size={10} /> {new Date(draft.updatedAt).toLocaleString()} • {draft.elements.length} ítems
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleLoadDraft(draft)} className="px-3 py-1.5 bg-[#41445A] text-[#FFFFFF] rounded-md text-xs font-medium hover:bg-[#5A5F80] transition-colors">Cargar</button>
                      <button onClick={() => handleDeleteDraft(draft.mapName)} className="p-1.5 text-[#8B8FA3] hover:text-red-400 bg-[#1F212E] border border-[#41445A] rounded-md hover:border-red-400/50 transition-colors" title="Borrar">
                        <MdDeleteOutline size={16}/>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}