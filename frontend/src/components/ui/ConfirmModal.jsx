import React from 'react';
import Button from './Button';

/**
 * Custom Confirmation Modal matching the design of Delete Program modal (Image 2)
 * Pops up with high z-index (z-[100]) directly on top of parent modals (Image 1).
 */
export default function ConfirmModal({
  isOpen,
  title = 'Confirmation',
  message = 'Are you sure you want to proceed?',
  targetName = '',
  note = '',
  noteType = 'danger', // 'danger' (red), 'info' (slate/blue), 'success' (emerald)
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary', // 'primary' (slate-900), 'danger' (red-600), 'success' (emerald-600)
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!isOpen) return null;

  const noteColor = {
    danger: 'text-red-600',
    info: 'text-slate-500',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
  }[noteType] || 'text-red-600';

  const confirmBtnClasses = {
    primary: 'bg-slate-900 hover:bg-slate-800 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  }[confirmVariant] || 'bg-slate-900 hover:bg-slate-800 text-white';

  // Strip trailing "for" or question mark to handle both custom and standard messages
  const cleanMessage = String(message).trim().replace(/\s+for\s*$/i, '').replace(/\?+$/, '');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-700 mb-1.5 leading-relaxed">
          {cleanMessage}
          {targetName ? (
            <>
              {' '}for <strong className="font-bold text-slate-900">{targetName}</strong>?
            </>
          ) : (
            '?'
          )}
        </p>
        {note && (
          <p className={`text-xs mb-5 leading-relaxed font-normal ${noteColor}`}>
            {note}
          </p>
        )}
        <div className="flex justify-end gap-2.5">
          <Button
            variant="secondary"
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50 shadow-sm"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition active:scale-95 ${confirmBtnClasses}`}
            onClick={onConfirm}
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
