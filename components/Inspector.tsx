"use client";

import { useState, useEffect } from "react";
import { MdDeleteOutline, MdOutlineNearMe } from "react-icons/md";
import { useMapStore, MapElement } from "../store/useMapStore";

// Mini-componente de UX
const LiveNumberInput = ({ value, onChange, min = 1, className, onKeyDown, placeholder }: any) => {
  const [localVal, setLocalVal] = useState<string | number>(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  return (
    <input
      type="number" value={localVal} min={min} placeholder={placeholder} className={className} onKeyDown={onKeyDown}
      onChange={(e) => {
        const val = e.target.value;
        setLocalVal(val); 
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed >= min) onChange(parsed);
      }}
      onBlur={() => {
        if (localVal === '' || isNaN(parseInt(localVal as string, 10)) || parseInt(localVal as string, 10) < min) {
          setLocalVal(value);
        }
      }}
    />
  );
};

const getRowCenter = (row: any) => {
  if (!row.seats || row.seats.length === 0) return { x: row.x, y: row.y };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const angleRad = (row.rotation || 0) * Math.PI / 180;
  const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
  row.seats.forEach((seat: any) => {
      const gx = row.x + seat.x * cos - seat.y * sin;
      const gy = row.y + seat.x * sin + seat.y * cos;
      if (gx < minX) minX = gx; if (gx > maxX) maxX = gx;
      if (gy < minY) minY = gy; if (gy > maxY) maxY = gy;
  });
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
};

export default function Inspector() {
  const { 
    selectedIds, elements, updateElement, updateMultipleElements, updateSeat, removeElements, categories, addCategory, flipSelection
  } = useMapStore();

  const [batchRowLetter, setBatchRowLetter] = useState('');
  const [batchStartNum, setBatchStartNum] = useState(1);
  const [numberingDirection, setNumberingDirection] = useState<'ltr' | 'rtl' | 'center'>('ltr');
  const [isContinuous, setIsContinuous] = useState(true);
  const [seatPrefix, setSeatPrefix] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6B7CFF');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    setNumberingDirection('ltr');
    setIsContinuous(true);
    
    if (selectedIds.length > 0) {
      const allElements = useMapStore.getState().elements;
      
      const selectedElementsWithSeats = allElements.filter(e => selectedIds.includes(e.id) && (e.type === 'row' || e.type === 'table'));

      if (selectedElementsWithSeats.length > 1) {
        const sortedEls = [...selectedElementsWithSeats].sort((a, b) => {
          const ca = getRowCenter(a), cb = getRowCenter(b);
          if (Math.abs(ca.y - cb.y) < 15) return ca.x - cb.x;
          return ca.y - cb.y;
        });
        const topLabel = sortedEls[0].label || '';
        if (topLabel.length === 1 && /^[A-Za-z]$/.test(topLabel)) {
          setBatchRowLetter(topLabel.toUpperCase());
        } else {
          setBatchRowLetter('');
        }
      } else {
        setBatchRowLetter('');
      }
      
      if (selectedElementsWithSeats.length > 0) {
        const sortedEls = [...selectedElementsWithSeats].sort((a, b) => {
          const ca = getRowCenter(a), cb = getRowCenter(b);
          if (Math.abs(ca.y - cb.y) < 15) return ca.x - cb.x;
          return ca.y - cb.y;
        });
        const el = sortedEls[0] as any;
        if (el.seats && el.seats.length > 0) {
          const firstLabel = el.seats[0].label || '';
          const match = firstLabel.match(/^(.*?)(\d+)$/);
          if (match) {
            setSeatPrefix(match[1]);
            setBatchStartNum(parseInt(match[2], 10));
          } else {
            const numMatch = firstLabel.match(/\d+/);
            if (numMatch && numMatch.index !== undefined) {
              setSeatPrefix(firstLabel.substring(0, numMatch.index));
              setBatchStartNum(parseInt(numMatch[0], 10));
            } else {
              setSeatPrefix('');
              setBatchStartNum(1);
            }
          }
        } else {
          setSeatPrefix('');
          setBatchStartNum(1);
        }
      } else {
        setSeatPrefix('');
        setBatchStartNum(1);
      }
    } else {
      setSeatPrefix('');
      setBatchStartNum(1);
    }
  }, [selectedIds]);

  const handleCreateCategory = () => {
    if (newCategoryName.trim() === '') return;
    addCategory({ id: crypto.randomUUID(), name: newCategoryName.trim(), color: newCategoryColor });
    setNewCategoryName('');
  };

  const handleBatchRowLetters = (startLetter = batchRowLetter) => {
    if (!startLetter) return;
    let charCode = startLetter.charCodeAt(0);
    const els = elements.filter(el => selectedIds.includes(el.id) && (el.type === 'row' || el.type === 'table')).sort((a, b) => {
      // Ordenamiento estándar de arriba hacia abajo y de izquierda a derecha.
      const ca = getRowCenter(a), cb = getRowCenter(b);
      if (Math.abs(ca.y - cb.y) < 15) return ca.x - cb.x; 
      return ca.y - cb.y;
    });
    
    const bulkUpdates = els.map(el => {
      const update = { label: String.fromCharCode(charCode) };
      charCode++;
      return { id: el.id, updates: update };
    });
    updateMultipleElements(bulkUpdates);
  };

  const handleRenumberSeats = (pfx = seatPrefix, start = batchStartNum, dir = numberingDirection, cont = isContinuous) => {
    if (selectedIds.length === 0) return;
    const selectedElementsWithSeats = elements.filter(e => selectedIds.includes(e.id) && (e.type === 'row' || e.type === 'table'));
    if (selectedElementsWithSeats.length === 0) return;
    const selectedRows = selectedElementsWithSeats.filter(e => e.type === 'row');
    const selectedTables = selectedElementsWithSeats.filter(e => e.type === 'table');
    let globalCounter = start;
    const bulkUpdates: {id: string, updates: Partial<MapElement>}[] = [];

    selectedTables.sort((a, b) => a.y - b.y).forEach(table => {
      bulkUpdates.push({ id: table.id, updates: { seats: table.seats.map(seat => ({ ...seat, label: `${pfx}${globalCounter++}` })) } });
      if (!cont) globalCounter = start;
    });

    if (selectedRows.length > 0) {
      // Ordenamos las filas seleccionadas de arriba hacia abajo y de izquierda a derecha
      const sortedSelectedRows = [...selectedRows].sort((a, b) => {
        const ca = getRowCenter(a), cb = getRowCenter(b);
        if (Math.abs(ca.y - cb.y) < 15) return ca.x - cb.x;
        return ca.y - cb.y;
      });

      const visualRows: { elements: typeof sortedSelectedRows }[] = [];
      sortedSelectedRows.forEach(el => {
        if (!cont || visualRows.length === 0) {
          visualRows.push({ elements: [el] });
        } else {
          const lastRowCenterY = getRowCenter(visualRows[visualRows.length - 1].elements[0]).y;
          const currentCenterY = getRowCenter(el).y;
          if (Math.abs(lastRowCenterY - currentCenterY) < 15) visualRows[visualRows.length - 1].elements.push(el); 
          else visualRows.push({ elements: [el] }); 
        }
      });

      visualRows.forEach(vRow => {
        let allSeatsInVisualRow: any[] = [];
        
        // Ordenamos las filas (secciones) en base a su origen X (de izquierda a derecha visual)
        const sortedSections = [...vRow.elements].sort((a, b) => getRowCenter(a).x - getRowCenter(b).x);

        sortedSections.forEach(row => {
          // Confiamos 100% en el orden estructural interno 0..N del dibujante.
          // Esto garantiza que filas en diagonal siempre numeren desde el Handle (Top) hacia abajo,
          // evitando que el X-axis estricto invierta la fila derecha de una V.
          const seatsWithAbsolutePos = row.seats.map((s, idx) => {
            return { ...s, parentRowId: row.id, structuralIdx: idx };
          });
          allSeatsInVisualRow = [...allSeatsInVisualRow, ...seatsWithAbsolutePos];
        });

        if (dir === 'rtl') {
          allSeatsInVisualRow.reverse();
        } else if (dir === 'center') {
          // Lógica de pares/impares desde el pasillo central, respeta el centro estructural
          const midIdx = Math.floor(allSeatsInVisualRow.length / 2);
          let currentLeftNum = start + 2;
          let currentRightNum = start + 1;
          
          allSeatsInVisualRow[midIdx].newLabel = `${pfx}${start}`;
          
          let i = midIdx - 1;
          while (i >= 0) { 
            allSeatsInVisualRow[i].newLabel = `${pfx}${currentLeftNum}`; 
            currentLeftNum += 2; 
            i--; 
          }
          
          let j = midIdx + 1;
          while (j < allSeatsInVisualRow.length) { 
            allSeatsInVisualRow[j].newLabel = `${pfx}${currentRightNum}`; 
            currentRightNum += 2; 
            j++; 
          }
          
          globalCounter = Math.max(currentLeftNum, currentRightNum);
          if ((globalCounter % 2) !== (start % 2)) globalCounter++;
        }

        if (dir !== 'center') {
          allSeatsInVisualRow.forEach(s => { s.newLabel = `${pfx}${globalCounter++}`; });
        }
        
        vRow.elements.forEach(row => {
          const updatedSeats = row.seats.map(s => {
            const sortedSeat = allSeatsInVisualRow.find(sorted => sorted.id === s.id && sorted.parentRowId === row.id);
            return { ...s, label: sortedSeat ? sortedSeat.newLabel : s.label };
          });
          bulkUpdates.push({ id: row.id, updates: { seats: updatedSeats } });
        });
        
        if (!cont) globalCounter = start;
      });
    }
    updateMultipleElements(bulkUpdates);
  };

  const handleSeatCountChange = (newCount: number) => {
    if (newCount < 1 || !selectedItem || !selectedItem.seats) return;
    if (selectedItem.type === 'row') {
        let newS = [...selectedItem.seats];
        if (newCount > selectedItem.seats.length) {
            const lastL = selectedItem.seats[selectedItem.seats.length - 1]?.label || '1';
            const basePrefix = lastL.match(/^(.*?)(\d+)$/)?.[1] || '';
            const nextNum = parseInt(lastL.match(/\d+$/)?.[0] || '0') + 1;
            const added = Array.from({ length: newCount - selectedItem.seats.length }).map((_, i) => ({
                id: crypto.randomUUID(), status: 'available', label: `${basePrefix}${nextNum + i}`, x: (selectedItem.seats.length + i) * 30, y: 0 
            }));
            newS = [...newS, ...added];
        } else newS = newS.slice(0, newCount);
        updateElement(selectedItem.id, { seats: newS as any });
    } else if (selectedItem.type === 'table') {
        const dragDist = Math.max(newCount * 30, 2 * Math.PI * 30) / (2 * Math.PI);
        const reS = Array.from({ length: newCount }).map((_, i) => {
            const angle = -Math.PI / 2 + (i * (Math.PI * 2 / newCount)) + (newCount % 2 !== 0 ? (Math.PI / newCount) : 0);
            const dist = Math.max(25, dragDist - 10);
            return { id: selectedItem.seats[i]?.id || crypto.randomUUID(), label: selectedItem.seats[i]?.label || (i + 1).toString(), x: dist * Math.cos(angle), y: dist * Math.sin(angle), status: 'available' };
        });
        updateElement(selectedItem.id, { seats: reS as any });
    }
  };

  let selectedItem: any = null, parentRowId: string | null = null;
  
  // Detect if selected IDs are individual seats (not top-level elements)
  const resolveSelectedSeats = () => {
    const seatInfos: { seat: any, parentEl: any, seatIndex: number }[] = [];
    for (const id of selectedIds) {
      // Skip if it's a top-level element
      if (elements.find(el => el.id === id)) continue;
      for (const el of elements) {
        if (el.type === 'row' || el.type === 'table') {
          const seatIdx = el.seats.findIndex(s => s.id === id);
          if (seatIdx >= 0) {
            seatInfos.push({ seat: el.seats[seatIdx], parentEl: el, seatIndex: seatIdx });
            break;
          }
        }
      }
    }
    return seatInfos;
  };

  const selectedSeatInfos = resolveSelectedSeats();
  const isMultiSeatSelection = selectedSeatInfos.length > 1;
  const multiSeatParentIds = [...new Set(selectedSeatInfos.map(s => s.parentEl.id))];
  const multiSeatParentEls = multiSeatParentIds.map(id => elements.find(el => el.id === id)!).filter(Boolean);

  if (selectedIds.length === 1) {
    const id = selectedIds[0];
    for (const el of elements) {
      if (el.id === id) { selectedItem = el; break; }
      if (el.type === 'row' || el.type === 'table') {
        const seat = el.seats.find((s) => s.id === id);
        if (seat) { selectedItem = { ...seat, isSeat: true }; parentRowId = el.id; break; }
      }
    }
  }

  const selectedElements = elements.filter(el => selectedIds.includes(el.id));
  const commonCategoryId = selectedElements.length > 0 && selectedElements.every(el => el.categoryId === selectedElements[0].categoryId) ? selectedElements[0].categoryId : null;
  const selectedRowsCount = selectedElements.filter(el => el.type === 'row').length;
  const selectedWithSeatsCount = selectedElements.filter(el => el.type === 'row' || el.type === 'table').length;
  
  // For multi-seat: common category of parent elements
  const multiSeatCommonCategoryId = multiSeatParentEls.length > 0 && multiSeatParentEls.every(el => el.categoryId === multiSeatParentEls[0].categoryId) ? multiSeatParentEls[0].categoryId : null;

  const handleRenumberSelectedSeats = (pfx: string, start: number) => {
    if (selectedSeatInfos.length === 0) return;
    
    const sorted = [...selectedSeatInfos].map(info => {
      const el = info.parentEl;
      const angleRad = (el.rotation || 0) * Math.PI / 180;
      const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
      
      // Ejes proyectados
      const globalX = el.x * cos + el.y * sin + info.seat.x; // Paralelo (izq a der)
      const globalY = -el.x * sin + el.y * cos + info.seat.y; // Perpendicular (arriba a abajo)
      
      return { ...info, globalX, globalY };
    }).sort((a, b) => {
      if (Math.abs(a.globalY - b.globalY) < 15) return a.globalX - b.globalX;
      return a.globalY - b.globalY;
    });

    const updatesByParent: Record<string, { parentEl: any, seatUpdates: { seatIndex: number, newLabel: string }[] }> = {};
    sorted.forEach((info, i) => {
      if (!updatesByParent[info.parentEl.id]) {
        updatesByParent[info.parentEl.id] = { parentEl: info.parentEl, seatUpdates: [] };
      }
      updatesByParent[info.parentEl.id].seatUpdates.push({ seatIndex: info.seatIndex, newLabel: `${pfx}${start + i}` });
    });

    const bulkUpdates = Object.entries(updatesByParent).map(([parentId, { parentEl, seatUpdates }]) => {
      const newSeats = [...parentEl.seats];
      seatUpdates.forEach(su => { newSeats[su.seatIndex] = { ...newSeats[su.seatIndex], label: su.newLabel }; });
      return { id: parentId, updates: { seats: newSeats } };
    });
    updateMultipleElements(bulkUpdates);
  };

  return (
    <aside className="absolute right-0 top-[60px] bottom-0 w-[320px] bg-[#2B2D3C] border-l border-[#41445A] flex flex-col z-20 overflow-hidden">
      
      <div className="px-6 py-4 border-b border-[#41445A] bg-[#2B2D3C] flex justify-between items-center shrink-0">
        <h2 className="text-[11px] font-bold text-[#8B8FA3] uppercase tracking-widest">Propiedades</h2>
        {selectedIds.length > 0 && (
          <button 
            // NUEVO: Al presionar el tachito también pedimos confirmación
            onClick={() => {
              const msg = selectedIds.length === 1 
                ? "¿Estás seguro de eliminar este elemento?" 
                : `¿Estás seguro de eliminar estos ${selectedIds.length} elementos?`;
              
              useMapStore.getState().openConfirmModal(msg, () => removeElements(selectedIds));
            }} 
            className="text-[#8B8FA3] hover:text-red-400 transition-colors bg-[#1F212E] p-1.5 rounded border border-[#41445A]" 
            title="Eliminar selección"
          >
            <MdDeleteOutline size={16}/>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide flex flex-col gap-6">
        {selectedIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full opacity-60">
            <div className="w-12 h-12 bg-[#1F212E] rounded-lg flex items-center justify-center mb-3 border border-[#41445A]">
              <MdOutlineNearMe size={20} className="text-[#8B8FA3]" />
            </div>
            <p className="text-[#8B8FA3] text-sm font-medium">Selecciona un elemento<br/>para editarlo</p>
          </div>
        ) : selectedItem ? (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            <div className="inline-flex items-center self-start px-2 py-1 bg-[#1F212E] text-[#FFFFFF] rounded border border-[#41445A] text-[10px] font-bold uppercase tracking-wider">
              {selectedItem.isSeat ? 'Asiento' : selectedItem.type === 'row' ? 'Fila' : selectedItem.type}
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">{selectedItem.type === 'text' ? 'Texto' : 'Etiqueta'}</label>
              <input type="text" value={selectedItem.label} onChange={(e) => selectedItem.isSeat && parentRowId ? updateSeat(parentRowId, selectedItem.id, { label: e.target.value }) : updateElement(selectedItem.id, { label: e.target.value })} className="w-full px-3 py-2 bg-[#1F212E] border border-[#41445A] rounded-md text-sm text-[#FFFFFF] transition-all outline-none focus:border-[#6B7CFF] focus:ring-1 focus:ring-[#6B7CFF]" />
            </div>

            {selectedItem.type === 'text' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">Tamaño</label>
                  <LiveNumberInput value={selectedItem.fontSize || 32} onChange={(val: number) => updateElement(selectedItem.id, { fontSize: val })} min={10} className="w-full px-3 py-2 bg-[#1F212E] border border-[#41445A] rounded-md text-sm text-[#FFFFFF] outline-none focus:border-[#6B7CFF]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">Color</label>
                  <input type="color" value={selectedItem.color || '#ffffff'} onChange={(e) => updateElement(selectedItem.id, { color: e.target.value })} className="w-full h-[38px] rounded-md cursor-pointer bg-[#1F212E] border border-[#41445A] p-0.5" />
                </div>
              </div>
            )}

            {selectedItem.type !== 'text' && (
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">Categoría</label>
                <div className="w-full px-3 py-2 bg-[#1F212E] border border-[#41445A] rounded-md text-sm cursor-pointer flex items-center justify-between hover:border-[#6B7CFF] transition-colors" onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}>
                  {(() => {
                    const cat = categories.find(c => c.id === selectedItem.categoryId);
                    return cat ? (
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span className="text-[#FFFFFF]">{cat.name}</span></div>
                    ) : <span className="text-[#8B8FA3]">Sin asignar</span>;
                  })()}
                  <span className="text-[#8B8FA3] text-[10px]">▼</span>
                </div>
                {isCategoryDropdownOpen && (
                  <div className="absolute top-[60px] left-0 w-full bg-[#2B2D3C] border border-[#41445A] rounded-lg shadow-xl z-50 py-1">
                    <div className="px-3 py-2 hover:bg-[#41445A] cursor-pointer text-xs text-[#8B8FA3]" onClick={() => { 
                      if (selectedItem.isSeat && parentRowId) updateSeat(parentRowId, selectedItem.id, { categoryId: undefined });
                      else updateElement(selectedItem.id, { categoryId: undefined }); 
                      setIsCategoryDropdownOpen(false); 
                    }}>Quitar categoría</div>
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#41445A] cursor-pointer text-xs text-[#FFFFFF]" onClick={() => { 
                        if (selectedItem.isSeat && parentRowId) updateSeat(parentRowId, selectedItem.id, { categoryId: cat.id });
                        else updateElement(selectedItem.id, { categoryId: cat.id }); 
                        setIsCategoryDropdownOpen(false); 
                      }}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span>{cat.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!selectedItem.isSeat && (selectedItem.type === 'row' || selectedItem.type === 'table') && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">Cantidad de Butacas</label>
                <div className="flex items-center justify-center gap-2 bg-[#1F212E] border border-[#41445A] p-1 rounded-md">
                    <button onClick={() => handleSeatCountChange(selectedItem.seats.length - 1)} className="w-8 h-8 flex items-center justify-center bg-[#1F212E] border border-[#41445A] text-[#8B8FA3] rounded hover:bg-[#41445A] hover:text-white transition-all font-medium text-lg">-</button>
                    <LiveNumberInput value={selectedItem.seats.length} onChange={(val: number) => handleSeatCountChange(val)} min={1} className="flex-1 text-center px-1 py-1 bg-transparent text-sm font-bold text-[#FFFFFF] outline-none" />
                    <button onClick={() => handleSeatCountChange(selectedItem.seats.length + 1)} className="w-8 h-8 flex items-center justify-center bg-[#1F212E] border border-[#41445A] text-[#8B8FA3] rounded hover:bg-[#41445A] hover:text-white transition-all font-medium text-lg">+</button>
                </div>
              </div>
            )}

            {!selectedItem.isSeat && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">Simetría</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => flipSelection('horizontal')} className="py-2 bg-[#1F212E] border border-[#41445A] text-[#FFFFFF] rounded-md text-xs hover:bg-[#41445A] transition-all">↔ Horizontal</button>
                  <button onClick={() => flipSelection('vertical')} className="py-2 bg-[#1F212E] border border-[#41445A] text-[#FFFFFF] rounded-md text-xs hover:bg-[#41445A] transition-all">↕ Vertical</button>
                </div>
              </div>
            )}

            {!selectedItem.isSeat && (selectedItem.type === 'row' || selectedItem.type === 'table') && (
              <div className="flex flex-col gap-3 mt-2 p-4 bg-[#1F212E] border border-[#41445A] rounded-lg">
                <h3 className="text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wide">Numeración</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-[#8B8FA3] uppercase">Prefijo</label>
                        <input type="text" value={seatPrefix} onChange={(e) => { setSeatPrefix(e.target.value); handleRenumberSeats(e.target.value, batchStartNum, numberingDirection, isContinuous); }} className="w-full px-2 py-1.5 bg-[#2B2D3C] border border-[#41445A] rounded-md text-xs text-[#FFFFFF] outline-none focus:border-[#6B7CFF]" placeholder="Ej: A" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-[#8B8FA3] uppercase">Inicio</label>
                        <LiveNumberInput value={batchStartNum} onChange={(val: number) => { setBatchStartNum(val); handleRenumberSeats(seatPrefix, val, numberingDirection, isContinuous); }} min={1} className="w-full px-2 py-1.5 bg-[#2B2D3C] border border-[#41445A] rounded-md text-xs text-[#FFFFFF] outline-none focus:border-[#6B7CFF]" />
                    </div>
                </div>
                {selectedItem.type === 'row' && (
                  <div className="flex flex-col gap-1.5 mt-1">
                      <label className="text-[9px] font-bold text-[#8B8FA3] uppercase">Dirección</label>
                      <select value={numberingDirection} onChange={(e) => { const val = e.target.value as any; setNumberingDirection(val); handleRenumberSeats(seatPrefix, batchStartNum, val, isContinuous); }} className="w-full px-2 py-1.5 bg-[#2B2D3C] border border-[#41445A] rounded-md text-xs text-[#FFFFFF] outline-none focus:border-[#6B7CFF] cursor-pointer">
                          <option value="ltr">Izquierda ➔ Derecha</option>
                          <option value="rtl">Derecha ➔ Izquierda</option>
                          <option value="center">Centro (Pares/Impares)</option>
                      </select>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isMultiSeatSelection ? (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            <div className="inline-flex items-center self-start px-2 py-1 bg-[#6B7CFF]/20 text-[#D0B3FF] rounded border border-[#6B7CFF] text-[9px] font-bold uppercase tracking-wider">
              {selectedSeatInfos.length} Asientos Seleccionados
            </div>

            {/* Category assignment per individual seat */}
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">Categoría</label>
              <div className="w-full px-3 py-2 bg-[#1F212E] border border-[#41445A] rounded-md text-sm cursor-pointer flex items-center justify-between hover:border-[#6B7CFF] transition-colors" onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}>
                {(() => {
                  const allSame = selectedSeatInfos.every(s => s.seat.categoryId === selectedSeatInfos[0].seat.categoryId);
                  const catId = allSame ? selectedSeatInfos[0].seat.categoryId : null;
                  if (catId) {
                    const cat = categories.find(c => c.id === catId);
                    return cat ? (
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span className="text-[#FFFFFF]">{cat.name}</span></div>
                    ) : <span className="text-[#8B8FA3]">Sin asignar</span>;
                  }
                  return <span className="text-[#8B8FA3] italic text-xs">{allSame ? 'Sin asignar' : 'Varias'}</span>;
                })()}
                <span className="text-[#8B8FA3] text-[10px]">▼</span>
              </div>
              {isCategoryDropdownOpen && (
                <div className="absolute top-[60px] left-0 w-full bg-[#2B2D3C] border border-[#41445A] rounded-lg shadow-xl z-50 py-1">
                  <div className="px-3 py-2 hover:bg-[#41445A] cursor-pointer text-xs text-[#8B8FA3]" onClick={() => { selectedSeatInfos.forEach(s => updateSeat(s.parentEl.id, s.seat.id, { categoryId: undefined })); setIsCategoryDropdownOpen(false); }}>Quitar categoría</div>
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#41445A] cursor-pointer text-xs font-medium text-[#FFFFFF]" onClick={() => { selectedSeatInfos.forEach(s => updateSeat(s.parentEl.id, s.seat.id, { categoryId: cat.id })); setIsCategoryDropdownOpen(false); }}>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span>{cat.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Renumber selected seats */}
            <div className="flex flex-col gap-3 p-4 bg-[#1F212E] border border-[#41445A] rounded-lg">
              <h3 className="text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wide">Numeración</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-[#8B8FA3] uppercase">Prefijo</label>
                  <input type="text" value={seatPrefix} onChange={(e) => { setSeatPrefix(e.target.value); handleRenumberSelectedSeats(e.target.value, batchStartNum); }} className="w-full px-2 py-1.5 bg-[#2B2D3C] border border-[#41445A] rounded-md text-xs text-[#FFFFFF] outline-none focus:border-[#6B7CFF]" placeholder="Ej: A" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-[#8B8FA3] uppercase">Inicio</label>
                  <LiveNumberInput value={batchStartNum} onChange={(val: number) => { setBatchStartNum(val); handleRenumberSelectedSeats(seatPrefix, val); }} min={1} className="w-full px-2 py-1.5 bg-[#2B2D3C] border border-[#41445A] rounded-md text-xs text-[#FFFFFF] outline-none focus:border-[#6B7CFF]" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            <div className="inline-flex items-center self-start px-2 py-1 bg-[#6B7CFF]/20 text-[#D0B3FF] rounded border border-[#6B7CFF] text-[9px] font-bold uppercase tracking-wider">
              Selección Múltiple ({selectedIds.length})
            </div>

            <div className="flex flex-col gap-1.5 relative">
              <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">Asignación Masiva</label>
              <div className="w-full px-3 py-2 bg-[#1F212E] border border-[#41445A] rounded-md text-sm cursor-pointer flex items-center justify-between hover:border-[#6B7CFF] transition-colors" onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}>
                {commonCategoryId ? (
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: categories.find(c => c.id === commonCategoryId)?.color }}></div><span className="text-[#FFFFFF]">{categories.find(c => c.id === commonCategoryId)?.name}</span></div>
                ) : <span className="text-[#8B8FA3] italic text-xs">Varias / Ninguna</span>}
                <span className="text-[#8B8FA3] text-[10px]">▼</span>
                
                {isCategoryDropdownOpen && (
                  <div className="absolute top-[60px] left-0 w-full bg-[#2B2D3C] border border-[#41445A] rounded-lg shadow-xl z-50 py-1">
                    <div className="px-3 py-2 hover:bg-[#41445A] cursor-pointer text-xs text-[#8B8FA3]" onClick={() => { selectedElements.forEach(el => updateElement(el.id, { categoryId: undefined })); setIsCategoryDropdownOpen(false); }}>Quitar categoría</div>
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#41445A] cursor-pointer text-xs font-medium text-[#FFFFFF]" onClick={() => { selectedElements.forEach(el => updateElement(el.id, { categoryId: cat.id })); setIsCategoryDropdownOpen(false); }}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div><span>{cat.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">Espejar Grupo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => flipSelection('horizontal')} className="py-2 bg-[#1F212E] border border-[#41445A] text-[#FFFFFF] rounded-md text-xs hover:bg-[#41445A] transition-all">↔ Horizontal</button>
                  <button onClick={() => flipSelection('vertical')} className="py-2 bg-[#1F212E] border border-[#41445A] text-[#FFFFFF] rounded-md text-xs hover:bg-[#41445A] transition-all">↕ Vertical</button>
                </div>
            </div>

            {selectedWithSeatsCount > 1 && (
              <div className="flex flex-col gap-2 p-4 bg-[#1F212E] border border-[#41445A] rounded-lg mt-1">
                <label className="text-[10px] font-bold text-[#8B8FA3] uppercase tracking-wide">Etiquetar en Lote (A-Z)</label>
                <input type="text" maxLength={1} value={batchRowLetter} onChange={(e) => { const val = e.target.value.toUpperCase(); setBatchRowLetter(val); if(val) handleBatchRowLetters(val); }} onKeyDown={(e) => { if (e.key === 'Enter' && batchRowLetter) handleBatchRowLetters(batchRowLetter); }} className="w-12 px-2 py-1.5 border border-[#41445A] bg-[#2B2D3C] text-[#FFFFFF] rounded-md text-sm font-bold text-center outline-none focus:border-[#6B7CFF]" placeholder="A" />
              </div>
            )}

            {selectedWithSeatsCount > 1 && (
              <div className="flex flex-col gap-3 p-4 bg-[#1F212E] border border-[#41445A] rounded-lg mt-1">
                <h3 className="text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wide">Numeración Lote</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-[#8B8FA3] uppercase">Prefijo</label>
                        <input type="text" value={seatPrefix} onChange={(e) => { setSeatPrefix(e.target.value); handleRenumberSeats(e.target.value, batchStartNum, numberingDirection, isContinuous); }} onKeyDown={(e) => { if (e.key === 'Enter') handleRenumberSeats(seatPrefix, batchStartNum, numberingDirection, isContinuous); }} className="w-full px-2 py-1.5 border border-[#41445A] bg-[#2B2D3C] text-[#FFFFFF] rounded-md text-xs outline-none focus:border-[#6B7CFF]" placeholder="Ej: A" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-[#8B8FA3] uppercase">Inicio</label>
                        <LiveNumberInput value={batchStartNum} onChange={(val: number) => { setBatchStartNum(val); handleRenumberSeats(seatPrefix, val, numberingDirection, isContinuous); }} min={1} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleRenumberSeats(seatPrefix, batchStartNum, numberingDirection, isContinuous); }} className="w-full px-2 py-1.5 border border-[#41445A] bg-[#2B2D3C] text-[#FFFFFF] rounded-md text-xs outline-none focus:border-[#6B7CFF]" />
                    </div>
                </div>
                {selectedRowsCount > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                      <label className="text-[9px] font-bold text-[#8B8FA3] uppercase">Dirección</label>
                      <select value={numberingDirection} onChange={(e) => { const val = e.target.value as any; setNumberingDirection(val); handleRenumberSeats(seatPrefix, batchStartNum, val, isContinuous); }} className="w-full px-2 py-1.5 border border-[#41445A] bg-[#2B2D3C] text-[#FFFFFF] rounded-md text-xs outline-none focus:border-[#6B7CFF] cursor-pointer">
                          <option value="ltr">Izquierda ➔ Derecha</option>
                          <option value="rtl">Derecha ➔ Izquierda</option>
                          <option value="center">Centro (Pares/Impares)</option>
                      </select>
                  </div>
                )}
                <label className="flex items-center gap-2 mt-2 text-xs text-[#8B8FA3] cursor-pointer">
                  <input type="checkbox" checked={isContinuous} onChange={(e) => { setIsContinuous(e.target.checked); handleRenumberSeats(seatPrefix, batchStartNum, numberingDirection, e.target.checked); }} className="rounded border-[#41445A] bg-[#1F212E] text-[#6B7CFF] focus:ring-[#6B7CFF]" />
                  <span>Continuar cuenta entre filas</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedIds.length === 0 && (
        <div className="p-6 bg-[#2B2D3C] border-t border-[#41445A] flex flex-col gap-4 shrink-0">
          <h3 className="text-[11px] font-bold text-[#8B8FA3] uppercase tracking-widest">Categorías</h3>
          <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 bg-[#1F212E] px-3 py-2 border border-[#41445A] rounded-md">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                <span className="text-xs text-[#FFFFFF] font-medium">{cat.name}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 mt-1">
            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nueva categoría..." className="w-full px-3 py-2 border border-[#41445A] bg-[#1F212E] text-[#FFFFFF] rounded-md text-xs outline-none focus:border-[#6B7CFF]" />
            <div className="flex gap-2">
              <input type="color" value={newCategoryColor} onChange={(e) => setNewCategoryColor(e.target.value)} className="w-9 h-9 rounded-md cursor-pointer bg-[#1F212E] border border-[#41445A] p-0.5 shrink-0" />
              <button onClick={handleCreateCategory} className="flex-1 bg-[#41445A] text-[#FFFFFF] rounded-md text-xs font-bold hover:bg-[#5A5F80] transition-colors">Añadir</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}