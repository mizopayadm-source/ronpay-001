import React from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { BawmCategory } from '../types';
import { BAWM_CONFIG } from '../data/initialData';

interface MismatchModalProps {
  isOpen: boolean;
  intendedCategory: BawmCategory;
  actualCategory: BawmCategory;
  onRedirect: () => void;
  onClose: () => void;
}

export const MismatchModal: React.FC<MismatchModalProps> = ({
  isOpen,
  intendedCategory,
  actualCategory,
  onRedirect,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-xs rounded-3xl p-5 text-center space-y-3.5 shadow-2xl border border-rose-200 text-slate-800">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl border border-rose-200 shadow-xs">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-sm font-black text-slate-900">
            I bawm thlang tha rawh!
          </h3>
          <p className="text-[11.5px] text-slate-600 mt-1.5 font-medium leading-relaxed">
            <b className="text-slate-900">{BAWM_CONFIG[intendedCategory].name}</b> luh i tum a, mahse <b className="text-rose-700">{BAWM_CONFIG[actualCategory].name}</b> QR i scan daih a ni.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <button
            onClick={onRedirect}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>{BAWM_CONFIG[actualCategory].name}-ah lut rawh</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
          >
            Thulh / Rescan
          </button>
        </div>
      </div>
    </div>
  );
};
