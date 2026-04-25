import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from './Common';
import { cn } from '../lib/utils';

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmText = 'Konfirmasi', 
  cancelText = 'Batal',
  variant = 'danger' 
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
        >
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                variant === 'danger' ? "bg-rose-50 text-rose-600 shadow-rose-100" : "bg-indigo-50 text-indigo-600 shadow-indigo-100"
              )}>
                <AlertCircle className="w-6 h-6" />
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">
              {title}
            </h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              {description}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Button 
                onClick={onClose}
                variant="ghost" 
                className="flex-1 rounded-2xl border border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-widest"
              >
                {cancelText}
              </Button>
              <Button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={cn(
                  "flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg",
                  variant === 'danger' ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
                )}
              >
                {confirmText}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
