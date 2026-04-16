/**
 * AgenteVistoria — wrapper sobre OperadorFormularioVistoria.
 *
 * ?modo=sem-acesso → abre SemAcessoWrapper diretamente (sem percorrer o stepper).
 * Padrão           → exibe ReincidenteBanner + OperadorFormularioVistoria.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OperadorFormularioVistoria from '@/pages/operador/OperadorFormularioVistoria';
import { VistoriaSemAcesso } from '@/components/vistoria/VistoriaSemAcesso';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { STALE } from '@/lib/queryConfig';
import { getCurrentCiclo } from '@/lib/ciclo';
import { supabase } from '@/lib/supabase';
import type { Etapa1Data } from '@/components/vistoria/VistoriaEtapa1Responsavel';
import type { TipoAtividade } from '@/types/database';

// ─── Banner de reincidência ───────────────────────────────────────────────────

function ReincidenteBanner({ imovelId, clienteId }: { imovelId: string; clienteId: string }) {
  const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: focos = [] } = useQuery({
    queryKey: ['focos-risco-imovel-reincidente', imovelId, clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('focos_risco')
        .select('id, status, created_at, foco_anterior_id')
        .eq('cliente_id', clienteId)
        .eq('imovel_id', imovelId)
        .in('status', ['confirmado', 'em_tratamento', 'resolvido'])
        .is('deleted_at', null)
        .gte('created_at', since60d)
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!imovelId && !!clienteId,
    staleTime: STALE.MEDIUM,
  });

  if (focos.length === 0) return null;

  const reincidentes = focos.filter((f) => f.foco_anterior_id !== null).length;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40 mx-4 mt-4">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800 dark:text-amber-300 font-medium leading-snug">
        <span className="font-bold">{focos.length}</span>{' '}
        {focos.length === 1 ? 'foco confirmado' : 'focos confirmados'} nos últimos 60 dias
        {reincidentes > 0 && (
          <> · <span className="font-bold">{reincidentes}</span> reincidente{reincidentes !== 1 ? 's' : ''}</>
        )}
        . Inspecionar com atenção redobrada.
      </p>
    </div>
  );
}

// ─── Wrapper sem acesso ───────────────────────────────────────────────────────

function SemAcessoWrapper({
  imovelId,
  clienteId,
  agenteId,
  ciclo,
  onDone,
}: {
  imovelId: string;
  clienteId: string;
  agenteId: string;
  ciclo: number;
  onDone: () => void;
}) {
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });

  // Coleta GPS em background — best-effort, não bloqueia o formulário
  useEffect(() => {
    if (!navigator.geolocation) return;
    // enableHighAccuracy:false reduz chamadas ao “network location” do Chrome (403 em googleapis em VPN/rede restrita).
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // sem GPS → prossegue sem coordenadas
      { timeout: 8000, enableHighAccuracy: false, maximumAge: 60000 },
    );
  }, []);

  const checkinEm = useMemo(() => new Date().toISOString(), []);

  const etapa1: Etapa1Data = {
    moradores_qtd: 0,
    gravidas: false,
    idosos: false,
    criancas_7anos: false,
    lat_chegada: coords.lat,
    lng_chegada: coords.lng,
    checkin_em: checkinEm,
  };

  const atividade: TipoAtividade = 'tratamento';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onDone} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-semibold text-base leading-tight">Registrar Sem Acesso</h1>
          <p className="text-xs text-muted-foreground">Imóvel inacessível — registre o motivo</p>
        </div>
      </div>

      {/* Formulário */}
      <div className="p-4 pb-24">
        <VistoriaSemAcesso
          clienteId={clienteId}
          imovelId={imovelId}
          agenteId={agenteId}
          atividade={atividade}
          ciclo={ciclo}
          etapa1={etapa1}
          onRegistered={onDone}
          onCancel={onDone}
        />
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AgenteVistoria() {
  const { imovelId } = useParams<{ imovelId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clienteId } = useClienteAtivo();
  const { usuario } = useAuth();

  const modo = searchParams.get('modo');
  const focoId = searchParams.get('focoId');
  const ciclo = getCurrentCiclo();

  // Permite acesso sem imovelId quando há focoId (foco sem imóvel cadastrado)
  if (!imovelId && !focoId) {
    navigate('/agente/hoje');
    return null;
  }

  // Fluxo direto de sem acesso (a partir da Ficha do Imóvel)
  if (modo === 'sem-acesso' && clienteId && usuario?.id) {
    return (
      <SemAcessoWrapper
        imovelId={imovelId}
        clienteId={clienteId}
        agenteId={usuario.id}
        ciclo={ciclo}
        onDone={() => navigate('/agente/hoje')}
      />
    );
  }

  return (
    <div>
      {focoId && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-xs font-semibold">
          <UserCheck className="w-4 h-4 shrink-0" />
          Inspeção de foco atribuído — classifique o resultado ao finalizar
        </div>
      )}
      {clienteId && <ReincidenteBanner imovelId={imovelId} clienteId={clienteId} />}
      <OperadorFormularioVistoria />
    </div>
  );
}
