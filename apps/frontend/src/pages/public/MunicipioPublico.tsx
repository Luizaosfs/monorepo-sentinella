import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { Logo } from '@/components/Logo';
import { Loader2, MapPin, Megaphone, QrCode, Search, RefreshCw } from 'lucide-react';

export default function MunicipioPublico() {
  const { slug } = useParams<{ slug: string }>();

  const { data: cliente, isLoading: clienteLoading } = useQuery({
    queryKey: ['municipio-publico-cliente', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, slug')
        .eq('slug', slug!)
        .single();
      if (error) throw error;
      return data as { id: string; nome: string; slug: string };
    },
    enabled: !!slug,
    staleTime: STALE.STATIC,
  });

  const { data: contagemStatus } = useQuery({
    queryKey: ['municipio-publico-focos', cliente?.id],
    queryFn: () => api.focosRisco.contagemPorStatus(cliente!.id),
    enabled: !!cliente?.id,
    staleTime: STALE.SHORT,
  });

  const { data: denunciasResult } = useQuery({
    queryKey: ['municipio-publico-denuncias', cliente?.id],
    queryFn: () =>
      api.focosRisco.list(cliente!.id, {
        origem_tipo: 'cidadao',
        pageSize: 1000,
      }),
    enabled: !!cliente?.id,
    staleTime: STALE.SHORT,
  });

  // Count focos ativos (suspeita + em_triagem + aguarda_inspecao + em_inspecao + confirmado + em_tratamento)
  const focosAtivos = contagemStatus
    ? Object.entries(contagemStatus)
        .filter(([status]) =>
          ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento'].includes(status)
        )
        .reduce((acc, [, count]) => acc + (count as number), 0)
    : null;

  // Count denuncias cidadão últimos 7 dias
  const sete_dias_atras = new Date();
  sete_dias_atras.setDate(sete_dias_atras.getDate() - 7);
  const denunciasCount = denunciasResult?.data?.filter((f) => {
    const created = new Date(f.created_at);
    return created >= sete_dias_atras;
  }).length ?? null;

  if (clienteLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
        <MapPin className="w-12 h-12 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Município não encontrado</h1>
        <p className="text-gray-500 text-sm">Verifique o endereço e tente novamente.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Logo className="text-xl text-green-600" />
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Sentinella</p>
            <h1 className="text-base font-bold text-gray-900 leading-tight">{cliente.nome}</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        {/* KPI Cards */}
        <section className="grid grid-cols-2 gap-3">
          {/* Focos ativos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center mb-1">
              <MapPin className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-black text-gray-900">
              {focosAtivos !== null ? focosAtivos : <span className="text-gray-300">—</span>}
            </p>
            <p className="text-xs font-medium text-gray-500 leading-snug">Focos ativos esta semana</p>
          </div>

          {/* Denúncias cidadão */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center mb-1">
              <Megaphone className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-gray-900">
              {denunciasCount !== null ? denunciasCount : <span className="text-gray-300">—</span>}
            </p>
            <p className="text-xs font-medium text-gray-500 leading-snug">Denúncias recebidas (7 dias)</p>
          </div>
        </section>

        {/* Call-to-action: reportar ocorrência */}
        <section className="bg-green-600 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold mb-1">Reportar ocorrência</h2>
              <p className="text-sm text-green-100 mb-4">
                Encontrou um foco de dengue? Use o QR Code do seu bairro para registrar uma denúncia.
              </p>
              <p className="text-xs font-medium text-green-200">
                Solicite o QR Code do seu bairro à prefeitura ou agente de saúde.
              </p>
            </div>
          </div>
        </section>

        {/* Link para consultar protocolo */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Consultar protocolo de denúncia</p>
              <p className="text-xs text-gray-500 mt-0.5">Acompanhe o status da sua ocorrência</p>
            </div>
            <Link
              to="/denuncia/consultar"
              className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Consultar
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-lg mx-auto w-full px-4 pb-8 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <RefreshCw className="w-3 h-3" />
          <span>Dados atualizados em tempo real</span>
        </div>
        <p className="text-[10px] text-gray-300 mt-1">Sentinella — Monitoramento de endemias</p>
      </footer>
    </div>
  );
}
