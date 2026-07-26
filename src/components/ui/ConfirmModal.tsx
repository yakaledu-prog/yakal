import { ReactNode } from "react";
import { Button } from "./Button";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              isDestructive ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500"
            )}>
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 mt-1">
              <h3 className="text-lg font-bold text-[#111] dark:text-white leading-none mb-2">{title}</h3>
              <div className="text-[14px] text-muted-foreground leading-relaxed">
                {message}
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-full text-muted-foreground hover:bg-gray-100 dark:hover:bg-[#182329] transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-[#e9edef] dark:border-[#2a3942] bg-gray-50 dark:bg-[#182329] flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="px-5">
            {cancelText}
          </Button>
          <Button 
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            className={cn("px-5 text-white", isDestructive ? "bg-red-600 hover:bg-red-700" : "bg-[#1099A1] hover:bg-[#0d848b]")}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
