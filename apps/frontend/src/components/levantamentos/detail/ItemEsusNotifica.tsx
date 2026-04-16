import { Stethoscope, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { validarConfiguracaoIntegracao } from '@/lib/sinan';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { AGRAVO_LABELS, type TipoAgravoESUS, type LevantamentoItem } from '@/types/database';

interface ItemEsusNotificaProps {
  item: Pick<LevantamentoItem, 'id' | 'endereco_completo' | 'endereco_curto' | 'latitude' | 'longitude' | 'data_hora'>;
}

export function ItemEsusNotifica({ item }: ItemEsusNotificaProps) {
  const { clienteId } = useClienteAtivo();
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [tipoAgravo, setTipoAgravo] = useState<TipoAgravoESUS>('dengue');

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes_esus_item', item.id],
    queryFn: () => api.notificacoesESUS.listByItem(item.id, clienteId!),
    staleTime: STALE.MEDIUM,
  });

  const { data: integracao } = useQuery({
    queryKey: ['integracao_esus', clienteId],
    queryFn: () => api.integracoes.getByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  const reenviarMutation = useMutation({
    mutationFn: (notifId: string) => {
      if (!integracao) throw new Error('Integração não configurada.');
      return api.notificacoesESUS.reenviar(notifId, integracao);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes_esus_item', item.id] });
      toast.success('Notificação reenviada ao e-SUS Notifica!');
    },
    onError: (err) => toast.error(`Erro ao reenviar: ${err instanceof Error ? err.message : 'Desconhecido'}`),
  });

  const enviarMutation = useMutation({
    mutationFn: () => {
      if (!clienteId || !integracao) throw new Error('Integração não configurada.');
      return api.notificacoesESUS.enviar(
        clienteId,
        item.id,
        tipoAgravo,
        usuario?.id ?? '',
        integracao,
        {
          endereco_completo: item.endereco_completo,
          endereco_curto: item.endereco_curto,
          latitude: item.latitude,
          longitude: item.longitude,
          data_hora: item.data_hora,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes_esus_item', item.id] });
      setShowModal(false);
      toast.success('Notificação enviada ao e-SUS Notifica!');
    },
    onError: (err) => toast.error(`Erro ao notificar: ${err instanceof Error ? err.message : 'Desconhecido'}`),
  });

  const integracaoValida = integracao
    ? validarConfiguracaoIntegracao({
        api_key: integracao.api_key,
        codigo_ibge: integracao.codigo_ibge,
        unidade_saude_cnes: integracao.unidade_saude_cnes,
        ativo: integracao.ativo,
      })
    : { valida: false, erros: [] };

  if (!integracao?.ativo || !integracaoValida.valida) return null;

  return (
    <Card className="rounded-2xl border-2 border-border bg-card shadow-none overflow-hidden">
      <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">e-SUS Notifica</p>
          <div className="flex items-center gap-1.5">
            {integracao?.ambiente !== 'producao' && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] font-bold uppercase tracking-wider px-1.5">
                Homologação
              </Badge>
            )}
            {notificacoes.filter(n => n.status === 'enviado').length > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {notificacoes.filter(n => n.status === 'enviado').length} enviada(s)
              </Badge>
            )}
          </div>
        </div>

        {notificacoes.length > 0 && (
          <div className="space-y-1.5">
            {notificacoes.slice(0, 2).map((n) => (
              <div key={n.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-card text-xs gap-2">
                <span className="font-medium">{AGRAVO_LABELS[n.tipo_agravo]}</span>
                <span className="text-muted-foreground">{new Date(n.created_at).toLocaleDateString('pt-BR')}</span>
                <div className="flex items-center gap-1">
                  <Badge
                    className={`text-[10px] ${n.status === 'enviado' ? 'bg-emerald-100 text-emerald-700' : n.status === 'erro' ? 'bg-rose-100 text-rose-700' : 'bg-muted text-muted-foreground'}`}
                  >
                    {n.status === 'enviado' ? 'Enviado' : n.status === 'erro' ? 'Erro' : n.status}
                  </Badge>
                  {n.status === 'erro' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] gap-1 rounded-lg text-rose-600 hover:bg-rose-50"
                      onClick={() => reenviarMutation.mutate(n.id)}
                      disabled={reenviarMutation.isPending}
                      title="Reenviar notificação com erro"
                    >
                      {reenviarMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          onClick={() => setShowModal(true)}
        >
          <Stethoscope className="w-4 h-4 mr-2" />
          Notificar ao e-SUS
        </Button>

        {/* Modal de confirmação */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm bg-background rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <Stethoscope className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Notificar ao e-SUS</p>
                  <p className="text-xs text-muted-foreground">Ministério da Saúde</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agravo notificado</label>
                <Select value={tipoAgravo} onValueChange={(v) => setTipoAgravo(v as TipoAgravoESUS)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AGRAVO_LABELS) as TipoAgravoESUS[]).map((k) => (
                      <SelectItem key={k} value={k}>{AGRAVO_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-700 space-y-1">
                <p className="font-semibold">Atenção</p>
                <p>Esta notificação será enviada ao e-SUS Notifica ({integracao?.ambiente === 'producao' ? 'PRODUCAO' : 'homologação'}). Confirme apenas se o caso foi avaliado por um profissional de saúde.</p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  disabled={enviarMutation.isPending}
                  onClick={() => enviarMutation.mutate()}
                >
                  {enviarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmar envio
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
