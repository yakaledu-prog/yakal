import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Eraser, Video, MapPin, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface AvailabilityEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: number[][]) => void;
  initialData?: number[][];
}

// 0: None, 1: Online, 2: In-Person, 3: Both
type SlotMode = 0 | 1 | 2 | 3;

export function AvailabilityEditor({ isOpen, onClose, onSave, initialData }: AvailabilityEditorProps) {
  // Grid is 12 rows (9 AM to 8 PM) x 7 cols (Sun to Sat)
  const [timeGrid, setTimeGrid] = useState<SlotMode[][]>(() => {
    if (initialData) return initialData;
    return Array(12).fill(null).map(() => Array(7).fill(0));
  });

  const [toolMode, setToolMode] = useState<SlotMode>(1); // default to Online paint
  const [isDragging, setIsDragging] = useState(false);
  
  const lastCell = useRef<{ r: number; c: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeSlots = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 9;
    return `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
  });

  const handlePointerDown = (r: number, c: number, e: React.PointerEvent) => {
    // Left click only
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    e.currentTarget.releasePointerCapture(e.pointerId); // allow drag over other elements
    setIsDragging(true);
    updateCell(r, c);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element) return;

    const r = element.getAttribute('data-r');
    const c = element.getAttribute('data-c');

    if (r !== null && c !== null) {
      updateCell(Number(r), Number(c));
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    lastCell.current = null;
  };

  const updateCell = (r: number, c: number) => {
    if (lastCell.current?.r === r && lastCell.current?.c === c) return;
    
    setTimeGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = toolMode;
      return next;
    });
    
    lastCell.current = { r, c };
  };

  const getSlotColor = (mode: SlotMode) => {
    switch (mode) {
      case 1: return 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400';
      case 2: return 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400';
      case 3: return 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400';
      default: return 'bg-white dark:bg-[#202c33] border-[#e9edef] dark:border-[#2a3942]';
    }
  };

  const getSlotIcon = (mode: SlotMode) => {
    switch (mode) {
      case 1: return <Video size={14} />;
      case 2: return <MapPin size={14} />;
      case 3: return <Layers size={14} />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
         onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <div className="bg-white dark:bg-[#111b21] rounded-2xl shadow-xl w-full max-w-5xl max-h-full flex flex-col overflow-hidden">
        
        <div className="p-4 sm:p-6 border-b border-[#e9edef] dark:border-[#2a3942] flex justify-between items-center bg-[#f8f9fa] dark:bg-[#202c33]">
          <div>
            <h2 className="text-xl font-bold text-[#111] dark:text-white">Set Availability</h2>
            <p className="text-sm text-[#54656f] dark:text-[#aebac1] mt-1">Click and drag on the calendar to mark your available time slots.</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 mb-6 p-2 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl">
            <button 
              onClick={() => setToolMode(1)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors", toolMode === 1 ? "bg-white dark:bg-[#111b21] text-blue-600 dark:text-blue-400 shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5")}
            >
              <Video size={16} /> Online
            </button>
            <button 
              onClick={() => setToolMode(2)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors", toolMode === 2 ? "bg-white dark:bg-[#111b21] text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5")}
            >
              <MapPin size={16} /> In-Person
            </button>
            <button 
              onClick={() => setToolMode(3)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors", toolMode === 3 ? "bg-white dark:bg-[#111b21] text-purple-600 dark:text-purple-400 shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5")}
            >
              <Layers size={16} /> Both
            </button>
            <div className="w-px bg-[#d1d7db] dark:bg-[#2a3942] mx-1 my-1"></div>
            <button 
              onClick={() => setToolMode(0)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors", toolMode === 0 ? "bg-white dark:bg-[#111b21] text-red-600 dark:text-red-400 shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5")}
            >
              <Eraser size={16} /> Eraser
            </button>
          </div>

          {/* Grid Container */}
          <div className="overflow-x-auto pb-4">
            <div className="min-w-[700px] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden touch-none" onPointerMove={handlePointerMove}>
              {/* Header Row */}
              <div className="flex bg-[#f8f9fa] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#2a3942]">
                <div className="w-20 shrink-0 border-r border-[#e9edef] dark:border-[#2a3942]"></div>
                {weekdays.map(day => (
                  <div key={day} className="flex-1 py-3 text-center text-sm font-semibold text-[#54656f] dark:text-[#aebac1] border-r border-[#e9edef] dark:border-[#2a3942] last:border-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Time Rows */}
              {timeSlots.map((time, r) => (
                <div key={time} className="flex border-b border-[#e9edef] dark:border-[#2a3942] last:border-0">
                  <div className="w-20 shrink-0 py-3 pr-2 text-right text-xs font-medium text-[#54656f] dark:text-[#aebac1] border-r border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#202c33]">
                    {time}
                  </div>
                  {weekdays.map((_, c) => {
                    const mode = timeGrid[r][c];
                    return (
                      <div 
                        key={c}
                        data-r={r}
                        data-c={c}
                        onPointerDown={(e) => handlePointerDown(r, c, e)}
                        className={cn(
                          "flex-1 h-12 border-r border-[#e9edef] dark:border-[#2a3942] last:border-0 cursor-crosshair transition-colors flex items-center justify-center border-b border-b-transparent",
                          getSlotColor(mode),
                          mode !== 0 ? 'border border-current scale-[0.98] rounded-md' : 'hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]'
                        )}
                      >
                        {getSlotIcon(mode)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-[#e9edef] dark:border-[#2a3942] flex justify-end gap-3 bg-[#f8f9fa] dark:bg-[#202c33]">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="flex items-center gap-2" onClick={() => {
            onSave(timeGrid);
            onClose();
          }}>
            <Save size={18} /> Save Availability
          </Button>
        </div>

      </div>
    </div>
  );
}
