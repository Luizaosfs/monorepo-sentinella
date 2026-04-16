import { useState, useRef, useCallback, type ReactNode } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

const THRESHOLD = 80;

const PullToRefresh = ({ onRefresh, children, className }: PullToRefreshProps) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = containerRef.current?.closest('[data-pull-scroll]')?.scrollTop
      ?? containerRef.current?.closest('main')?.scrollTop
      ?? window.scrollY;
    if (scrollTop <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, THRESHOLD * 1.5));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn('relative', className)}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200 ease-out"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : '0px' }}
      >
        <div className={cn(
          'flex items-center gap-2 text-xs font-medium text-muted-foreground transition-opacity',
          pullDistance > 10 ? 'opacity-100' : 'opacity-0'
        )}>
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <ArrowDown
              className={cn(
                'w-4 h-4 transition-transform duration-200',
                pullDistance >= THRESHOLD && 'rotate-180 text-primary'
              )}
            />
          )}
          <span>{refreshing ? 'Atualizando...' : pullDistance >= THRESHOLD ? 'Solte para atualizar' : 'Puxe para atualizar'}</span>
        </div>
      </div>

      {children}
    </div>
  );
};

export default PullToRefresh;
