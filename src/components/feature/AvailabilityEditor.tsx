import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Eraser, Video, MapPin, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface AvailabilityEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: number[][], disabledDays: number[]) => void;
  initialData?: number[][];
  initialDisabledDays?: number[];
}

// 0: None, 1: Online, 2: In-Person, 3: Both
type SlotMode = 0 | 1 | 2 | 3;

export function AvailabilityEditor({ isOpen, onClose, onSave, initialData, initialDisabledDays }: AvailabilityEditorProps) {
  // Grid is 13 rows (8 AM to 8 PM) x 7 cols (Sun to Sat)
  const [timeGrid, setTimeGrid] = useState<SlotMode[][]>(() => {
    if (initialData && initialData.length === 13) return initialData as SlotMode[][];
    return Array(13).fill(null).map(() => Array(7).fill(0));
  });

  const [toolMode, setToolMode] = useState<SlotMode>(1); // default to Online paint
  const [isDragging, setIsDragging] = useState(false);
  const [disabledDays, setDisabledDays] = useState<number[]>(initialDisabledDays || []);

  const lastCell = useRef<{ r: number; c: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Seed from what is already saved every time it opens.
  //
  // The initial state is a lazy initialiser, so it ran once on mount, when the
  // availability was usually still loading and initialData was undefined. The
  // component never unmounts, so it never re-seeded: the editor opened blank
  // and saving replaced a tutor's whole week with whatever they had just
  // drawn, which read as the change not applying.
  useEffect(() => {
    if (!isOpen) return;
    if (initialData && initialData.length === 13) setTimeGrid(initialData as SlotMode[][]);
    setDisabledDays(initialDisabledDays || []);
  }, [isOpen, initialData, initialDisabledDays]);

  if (!isOpen) return null;

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const timeSlots = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 8;
    return `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
  });

  const toggleDisabledDay = (dayIndex: number) => {
    setDisabledDays(prev =>
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]
    );
  };

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
    if (disabledDays.includes(c)) return;
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
      case 1: return 'bg-sky-100 dark:bg-sky-900/40 border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400';
      case 2: return 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400';
      case 3: return 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400';
      default: return 'bg-neutral-50 dark:bg-[#202c33]/20 border-[#e9edef] dark:border-[#2a3942]';
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

        <div className="p-2.5 px-4 border-b border-[#e9edef] dark:border-[#2a3942] flex justify-between items-center bg-[#f8f9fa] dark:bg-[#202c33]">
          <div>
            <h2 className="text-lg font-medium dark:text-white">Set Availability</h2>
            <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">Click and drag on the calendar to mark your available time slots.</p>
          </div>
          <button onClick={onClose} className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            <X size={24} />
          </button>
        </div>

        <div className="p-3 px-6 flex-1 my-auto overflow-y-auto">
          {/* Grid Container */}
          <div className="overflow-x-auto pb-4 select-none">
            <div className="min-w-[700px] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden touch-none" onPointerMove={handlePointerMove}>
              {/* Header Row */}
              <div className="flex bg-[#f8f9fa] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#2a3942]">
                <div className="w-20 shrink-0 border-r border-[#e9edef] dark:border-[#2a3942]"></div>
                {weekdays.map((day, c) => (
                  <div
                    key={day}
                    onClick={() => toggleDisabledDay(c)}
                    className={cn(
                      "flex-1 py-3 text-center text-sm font-semibold cursor-pointer transition-colors border-r border-[#e9edef] dark:border-[#2a3942] last:border-r-0",
                      disabledDays.includes(c) ? "text-[#aebac1] dark:text-[#54656f] bg-[#f0f2f5] dark:bg-[#111b21]" : "text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9edef]/50 dark:hover:bg-white/5"
                    )}
                    title={disabledDays.includes(c) ? "Click to enable this day" : "Click to mark as off-day"}
                  >
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
                    const isDisabled = disabledDays.includes(c);
                    const mode = timeGrid[r][c];
                    return (
                      <div
                        key={c}
                        data-r={r}
                        data-c={c}
                        onPointerDown={(e) => {
                          if (!isDisabled) handlePointerDown(r, c, e);
                        }}
                        className={cn(
                          "flex-1 h-12 py-0.5 border-r border-[#e9edef] dark:border-[#2a3942] transition-colors flex items-center justify-center border-b",
                          isDisabled ? "opacity-40 grayscale cursor-not-allowed" : (isDragging ? "cursor-grabbing" : "cursor-grab"),
                          getSlotColor(mode),
                          mode !== 0 ? 'border border-current scale-[0.99] rounded-xs' : (!isDisabled ? 'hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]' : 'bg-[#f0f2f5] dark:bg-[#111b21]/50')
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

        <div className="p-4 px-4 border-t border-[#e9edef] dark:border-[#2a3942] flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 bg-[#f8f9fa] dark:bg-[#202c33]">

          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <div className="flex flex-wrap gap-1 p-1 bg-[#e9edef]/50 dark:bg-[#111b21]/50 rounded-lg w-fit">
              <button
                onClick={() => setToolMode(1)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-sm transition-colors", toolMode === 1 ? "bg-white dark:bg-[#2a3942] text-sky-600 dark:text-sky-400" : "text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5")}
              >
                <Video size={14} /> <span className="hidden sm:inline">Online</span>
              </button>
              <button
                onClick={() => setToolMode(2)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-sm transition-colors", toolMode === 2 ? "bg-white dark:bg-[#2a3942] text-emerald-600 dark:text-emerald-400" : "text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5")}
              >
                <MapPin size={14} /> <span className="hidden sm:inline">In-Person</span>
              </button>
              <button
                onClick={() => setToolMode(3)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-sm transition-colors", toolMode === 3 ? "bg-white dark:bg-[#2a3942] text-secondary" : "text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5")}
              >
                <Layers size={14} /> <span className="hidden sm:inline">Both</span>
              </button>
              <div className="w-px bg-[#d1d7db] dark:bg-[#2a3942] mx-1 my-1"></div>
              <button
                onClick={() => setToolMode(0)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-sm transition-colors", toolMode === 0 ? "bg-white dark:bg-[#2a3942] text-neutral-600 dark:text-neutral-400" : "text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/5")}
              >
                <Eraser size={14} /> <span className="hidden sm:inline">Eraser</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button variant="outline" className='border border-muted' onClick={onClose}>Cancel</Button>
            <Button className="flex items-center gap-3" onClick={() => {
              onSave(timeGrid, disabledDays);
              onClose();
            }}>
              <Save size={14} /> Save
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
