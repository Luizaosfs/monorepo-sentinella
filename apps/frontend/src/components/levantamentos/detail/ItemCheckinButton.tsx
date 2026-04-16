import { LocateFixed, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { api } from '@/services/api';
import { enqueue } from '@/lib/offlineQueue';
import { toast } from 'sonner';

interface ItemCheckinButtonProps {
  itemId: string;
  checkinEm: string | null;
  onCheckinRegistered: (isoDate: string) => void;
}

export function ItemCheckinButton({ itemId, checkinEm, onCheckinRegistered }: ItemCheckinButtonProps) {
  const [isRegistrando, setRegistrando] = useState(false);

  const handleRegistrarCheckin = async () => {
    setRegistrando(true);
    let coords: { latitude: number; longitude: number } | undefined;
    try {
      if (navigator.geolocation) {
        coords = await new Promise<{ latitude: number; longitude: number }>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve(undefined as unknown as { latitude: number; longitude: number }),
            { timeout: 6000, maximumAge: 30000, enableHighAccuracy: false }
          );
        }).catch(() => undefined);
      }
      await api.itens.registrarCheckin(itemId, coords);
      const now = new Date().toISOString();
      onCheckinRegistered(now);
      toast.success('Chegada registrada' + (coords ? ' com localização GPS.' : '.'));
    } catch (err) {
      if (!navigator.onLine) {
        await enqueue({ type: 'checkin', itemId, coords, createdAt: Date.now() });
        onCheckinRegistered(new Date().toISOString());
        toast.warning('Sem conexão — chegada será sincronizada ao reconectar.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Erro ao registrar chegada');
      }
    } finally {
      setRegistrando(false);
    }
  };

  if (checkinEm) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
        <LocateFixed className="w-4 h-4 text-emerald-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Chegada registrada</p>
          <p className="text-[10px] text-emerald-600/80">
            {new Date(checkinEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full rounded-xl gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40"
      onClick={handleRegistrarCheckin}
      disabled={isRegistrando}
    >
      {isRegistrando
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <LocateFixed className="w-4 h-4" />}
      {isRegistrando ? 'Obtendo localização...' : 'Registrar chegada ao local'}
    </Button>
  );
}
