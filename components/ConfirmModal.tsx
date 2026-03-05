"use client";

import { useMapStore } from "../store/useMapStore";

export default function ConfirmModal() {
  const { confirmModal, closeConfirmModal } = useMapStore();

  if (!confirmModal || !confirmModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1F212E]/80 backdrop-blur-sm px-4">
      <div className="bg-[#2B2D3C] border border-[#41445A] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-lg font-bold text-white mb-2">Confirmar acción</h3>
          <p className="text-sm text-[#8B8FA3]">{confirmModal.message}</p>
        </div>
        
        <div className="px-6 py-4 border-t border-[#41445A] flex justify-end gap-3 bg-[#1F212E]/50">
          <button 
            onClick={closeConfirmModal}
            className="px-4 py-2 text-sm font-semibold text-[#8B8FA3] hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={() => {
              confirmModal.onConfirm();
              closeConfirmModal();
            }}
            className="px-5 py-2 text-sm font-bold bg-[#6B7CFF] text-white hover:bg-[#5A6AE6] rounded-md shadow-md transition-all active:scale-95"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
