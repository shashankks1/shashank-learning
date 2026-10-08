import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, tone: Tone = 'neutral') => {
    const id = ++counter.current;
    setToasts(current => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), tone === 'error' ? 7000 : 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
