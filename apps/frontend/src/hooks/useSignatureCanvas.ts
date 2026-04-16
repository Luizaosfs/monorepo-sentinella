import { useRef, useState, useCallback, useEffect } from 'react';

export interface UseSignatureCanvasReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isEmpty: boolean;
  clear: () => void;
  toDataURL: () => string | null;
}

export function useSignatureCanvas(): UseSignatureCanvasReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }, []);

  const getPoint = useCallback((e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onStart(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      isDrawing.current = true;
      lastPoint.current = getPoint(e, canvas!);
      setIsEmpty(false);
    }

    function onMove(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (!isDrawing.current || !lastPoint.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      const current = getPoint(e, canvas!);
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
      lastPoint.current = current;
    }

    function onEnd(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      isDrawing.current = false;
      lastPoint.current = null;
    }

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('mouseleave', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onStart);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onEnd);
      canvas.removeEventListener('mouseleave', onEnd);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, [getCtx, getPoint]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }, []);

  const toDataURL = useCallback(() => {
    return canvasRef.current?.toDataURL('image/png') ?? null;
  }, []);

  return { canvasRef, isEmpty, clear, toDataURL };
}
