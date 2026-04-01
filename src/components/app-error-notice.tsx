import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorNoticeProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorNotice({ title, message, onRetry }: ErrorNoticeProps) {
  return (
    <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <p className="text-sm font-bold text-rose-700 mb-1">{title}</p>}
        <p className="text-sm text-rose-600 font-medium">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-rose-500 hover:text-rose-600 transition-colors"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}
