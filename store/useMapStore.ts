import { create } from 'zustand';

export interface Seat {
  id: string;
  label: string;
  x: number;
  y: number;
  status: string;
  categoryId?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface BaseMapElement {
  id: string;
  type: 'row' | 'table' | 'area' | 'text';
  label: string;
  x: number;
  y: number;
  rotation?: number;
  categoryId?: string;
}

export interface Row extends BaseMapElement {
  type: 'row';
  seats: Seat[];
}

export interface Table extends BaseMapElement {
  type: 'table';
  seats: Seat[];
}

export interface Area extends BaseMapElement {
  type: 'area';
  width: number;
  height: number;
}

export interface TextElement extends BaseMapElement {
  type: 'text';
  fontSize?: number;
  color?: string;
}

export type MapElement = Row | Table | Area | TextElement;

interface MapState {
  elements: MapElement[];
  mapName: string; // <-- NUEVO ESTADO PARA EL NOMBRE DEL MAPA
  selectedIds: string[];
  clipboard: MapElement[];
  categories: Category[];
  drawingMode: 'select' | 'select-seat' | 'row' | 'multi-row' | 'area' | 'table' | 'pan' | 'text';
  
  // Custom Confirmation Modal
  confirmModal: { isOpen: boolean; message: string; onConfirm: () => void } | null;
  
  past: MapElement[][];
  future: MapElement[][];
  undo: () => void;
  redo: () => void;

  setMapName: (name: string) => void; // <-- NUEVA FUNCIÓN AÑADIDA AQUÍ
  setDrawingMode: (mode: 'select' | 'select-seat' | 'row' | 'multi-row' | 'area' | 'table' | 'pan' | 'text') => void;
  addCategory: (cat: Category) => void;
  addElement: (element: MapElement) => void;
  updateElement: (id: string, updates: Partial<MapElement>) => void;
  updateMultipleElements: (bulkUpdates: {id: string, updates: Partial<MapElement>}[]) => void;
  setSelection: (ids: string[]) => void;
  resetMap: () => void;
  removeElement: (id: string) => void;
  removeElements: (ids: string[]) => void;
  updateSeat: (rowId: string, seatId: string, updates: Partial<Seat>) => void;
  importMap: (newElements: MapElement[]) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  flipSelection: (direction: 'horizontal' | 'vertical') => void;

  openConfirmModal: (message: string, onConfirm: () => void) => void;
  closeConfirmModal: () => void;
}


const MAX_HISTORY = 50;

export const useMapStore = create<MapState>((set, get) => ({
  elements: [],
  mapName: 'Plano sin título', // <-- VALOR INICIAL
  selectedIds: [],
  clipboard: [],
  categories: [
    { id: 'cat-1', name: 'VIP', color: '#F59E0B' },
    { id: 'cat-2', name: 'Platea Baja', color: '#26BB8F' },
    { id: 'cat-3', name: 'General', color: '#9A60FF' },
  ],
  drawingMode: 'select',
  confirmModal: null,
  
  past: [],
  future: [],

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    return {
      past: newPast,
      future: [state.elements, ...state.future],
      elements: previous,
      selectedIds: []
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    return {
      past: [...state.past, state.elements],
      future: newFuture,
      elements: next,
      selectedIds: []
    };
  }),

  setMapName: (name) => set({ mapName: name }), // IMPLEMENTACIÓN DE LA FUNCIÓN

  setDrawingMode: (mode) => set({ drawingMode: mode }),
  
  addCategory: (cat) => set((state) => ({ categories: [...state.categories, cat] })),
  
  addElement: (element) => set((state) => ({
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: [...state.elements, element]
  })),

  updateElement: (id, updates) => set((state) => ({
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: state.elements.map((el) =>
      el.id === id ? ({ ...el, ...updates } as MapElement) : el
    ),
  })),

  updateMultipleElements: (bulkUpdates) => set((state) => {
    const newElements = state.elements.map(el => {
      const update = bulkUpdates.find(u => u.id === el.id);
      return update ? ({ ...el, ...update.updates } as MapElement) : el;
    });
    return {
      past: [...state.past, state.elements].slice(-MAX_HISTORY),
      future: [],
      elements: newElements
    };
  }),

  setSelection: (ids) => set({ selectedIds: ids }),
  
  resetMap: () => set((state) => ({ 
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: [], 
    mapName: 'Nuevo Plano', // Al resetear, reinicia el nombre
    selectedIds: [] 
  })),

  removeElement: (id) => set((state) => ({
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: state.elements.filter((el) => el.id !== id),
    selectedIds: [],
  })),

  removeElements: (ids) => set((state) => ({
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: state.elements.filter((el) => !ids.includes(el.id)),
    selectedIds: [],
  })),

  updateSeat: (rowId, seatId, updates) => set((state) => ({
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: state.elements.map((el) => {
      if (el.id === rowId && (el.type === 'row' || el.type === 'table')) {
        return {
          ...el,
          seats: el.seats.map((seat) =>
            seat.id === seatId ? { ...seat, ...updates } : seat
          ),
        };
      }
      return el;
    }),
  })),

  importMap: (newElements) => set((state) => ({ 
    past: [...state.past, state.elements].slice(-MAX_HISTORY),
    future: [],
    elements: newElements, 
    selectedIds: [] 
  })),

  copySelection: () => {
    const { elements, selectedIds } = get();
    if (selectedIds.length === 0) return;
    const selectedElements = elements.filter(el => selectedIds.includes(el.id));
    set({ clipboard: JSON.parse(JSON.stringify(selectedElements)) });
  },

  pasteClipboard: () => {
    const { clipboard, elements, past } = get();
    if (clipboard.length === 0) return;

    const pastedElements: MapElement[] = clipboard.map(el => {
      const newEl = { ...el, id: crypto.randomUUID(), x: el.x + 30, y: el.y + 30 };
      if (newEl.type === 'row' || newEl.type === 'table') {
        newEl.seats = newEl.seats.map(seat => ({ ...seat, id: crypto.randomUUID() }));
      }
      return newEl;
    });

    set({
      past: [...past, elements].slice(-MAX_HISTORY),
      future: [],
      elements: [...elements, ...pastedElements],
      selectedIds: pastedElements.map(el => el.id)
    });
  },

  flipSelection: (direction) => {
    const { elements, selectedIds, past } = get();
    if (selectedIds.length === 0) return;

    const selectedEls = elements.filter(el => selectedIds.includes(el.id));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedEls.forEach(el => {
      minX = Math.min(minX, el.x); minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x); maxY = Math.max(maxY, el.y);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    set((state) => ({
      past: [...past, state.elements].slice(-MAX_HISTORY),
      future: [],
      elements: state.elements.map(el => {
        if (!selectedIds.includes(el.id)) return el;
        let newX = el.x, newY = el.y, newRot = el.rotation || 0;
        if (direction === 'horizontal') {
          newX = centerX - (el.x - centerX);
          newRot = 180 - newRot;
        } else if (direction === 'vertical') {
          newY = centerY - (el.y - centerY);
          newRot = -newRot;
        }
        return { ...el, x: newX, y: newY, rotation: newRot } as MapElement;
      })
    }));
  },

  openConfirmModal: (message: string, onConfirm: () => void) => set({ confirmModal: { isOpen: true, message, onConfirm } }),
  closeConfirmModal: () => set({ confirmModal: null })
}));