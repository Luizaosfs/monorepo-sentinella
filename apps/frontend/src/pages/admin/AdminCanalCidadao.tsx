import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { http } from '@sentinella/api-client';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Megaphone, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FocoRiscoAtivo } from '@/types/database';
import { STALE } from '@/lib/queryConfig';

type StatusAtendimento = 'pendente' | 'em_atendimento' | 'resolvido';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClienteComSlug {
  id: string;
  nome: string;
  slug: string | null;
}

// ⚠ Divergência intencional — decisão de produto (ver docs/INVENTARIO_STATUS_ATENDIMENTO.md)
// No canal cidadão, `confirmado` aparece como "Pendente" (ainda não tratado do ponto de vista
// do gestor), diferindo de enrichItensComFoco onde `confirmado` → 'em_atendimento'.
// Não substituir por mapFocoToStatusOperacional sem validação de produto.
function mapFocoStatusToAtendimento(status?: string | null): StatusAtendimento {
  const s = String(status ?? '').toLowerCase();
  if (s === 'resolvido' || s === 'descartado' || s === 'cancelado') return 'resolvido';
  if (s === 'em_triagem' || s === 'em_tratamento') return 'em_atendimento';
  return 'pendente';
}

// ── QR Image ─────────────────────────────────────────────────────────────────

function QrCode({ url }: { url: string }) {
  const encodedUrl = encodeURIComponent(url);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}&margin=10`;
  return (
    <div className="flex flex-col items-center gap-3">
      <img
        src={src}
        alt="QR Code do canal cidadão"
        className="rounded-xl border border-border/60 shadow-sm"
        width={200}
        height={200}
      />
      <a
        href={src}
        download="canal-cidadao-qr.png"
        className="text-xs text-primary hover:underline flex items-center gap-1"
      >
        <ExternalLink className="w-3 h-3" /> Baixar QR Code
      </a>
    </div>
  );
}

// ── Complaint row ─────────────────────────────────────────────────────────────

function ComplaintRow({ foco }: { foco: FocoRiscoAtivo }) {
  const statusAtend = mapFocoStatusToAtendimento(foco.status);
  const isPending = statusAtend === 'pendente';
  const p = (foco.payload ?? {}) as {
    foto_url?: string | null;
    bairro_nome?: string | null;
    quadra_codigo?: string | null;
    agente_sugerido_nome?: string | null;
    descricao_original?: string | null;
  };
  const descricao = foco.observacao ?? p.descricao_original ?? null;
  const protocolo = (foco as { protocolo_publico?: string | null }).protocolo_publico;
  const local =
    [p.bairro_nome, p.quadra_codigo ? `Qd. ${p.quadra_codigo}` : null]
      .filter(Boolean)
      .join(' · ') || foco.endereco_normalizado;

  const date = new Date(foco.created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isPending && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] px-1.5 py-0">
              Novo
            </Badge>
          )}
          <span className="text-xs font-mono text-muted-foreground">
            {protocolo ?? foco.codigo_foco ?? foco.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <p className="text-sm text-foreground mt-1 line-clamp-2">
          {descricao || local || '(sem descrição)'}
        </p>
        {local && (
          <p className="text-xs text-muted-foreground mt-0.5">{local}</p>
        )}
        {p.agente_sugerido_nome && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Agente: {p.agente_sugerido_nome}
          </p>
        )}
        {p.foto_url && (
          <img
            src={p.foto_url}
            alt="Foto da denúncia"
            className="mt-1.5 h-16 w-24 object-cover rounded-lg border border-border/60"
          />
        )}
        {(foco.latitude != null && foco.longitude != null) && (
          <a
            href={`https://www.google.com/maps?q=${foco.latitude},${foco.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
          >
            <ExternalLink className="w-3 h-3" /> Ver no mapa
          </a>
        )}
      </div>
      <Badge
        variant="outline"
        className={`shrink-0 text-[10px] ${
          isPending
            ? 'border-amber-300 text-amber-700 dark:text-amber-400'
            : 'border-emerald-300 text-emerald-700 dark:text-emerald-400'
        }`}
      >
        {statusAtend === 'resolvido' ? 'Resolvido' : statusAtend === 'em_atendimento' ? 'Em andamento' : 'Pendente'}
      </Badge>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const AdminCanalCidadao: React.FC = () => {
  const { clienteId } = useClienteAtivo();
  const [selectedBairroId, setSelectedBairroId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Bairros (regiões) do cliente
  const { data: regioes = [], isLoading: regLoading } = useQuery({
    queryKey: ['regioes', clienteId],
    queryFn: () => api.regioes.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  // Slug do cliente ativo
  const { data: clienteData } = useQuery<ClienteComSlug | null>({
    queryKey: ['cliente_slug', clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const raw = await http.get(`/clientes/${encodeURIComponent(clienteId)}`) as Record<string, unknown>;
      if (!raw) return null;
      return { id: raw.id as string, nome: raw.nome as string, slug: (raw.slug as string | null) ?? null } as ClienteComSlug;
    },
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  // Denúncias recebidas (últimas 20)
  const {
    data: denuncias = [],
    isLoading: denLoading,
    refetch: refetchDenuncias,
  } = useQuery<FocoRiscoAtivo[]>({
    queryKey: ['canal_cidadao_denuncias', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      try {
        const res = await api.focosRisco.list(clienteId, { origem_tipo: 'cidadao' });
        const data = ((res as { data?: FocoRiscoAtivo[] } | null)?.data ?? []) as FocoRiscoAtivo[];
        return [...data]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 200);
      } catch {
        return [];
      }
    },
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });

  const slug = clienteData?.slug;
  const canGenerateUrl = !!slug && !!selectedBairroId;
  const canalUrl = canGenerateUrl
    ? `${window.location.origin}/denuncia/${slug}/${selectedBairroId}`
    : '';

  const handleCopy = async () => {
    if (!canalUrl) return;
    await navigator.clipboard.writeText(canalUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const pendingCount = denuncias.filter((d) => mapFocoStatusToAtendimento(d.status) === 'pendente').length;
  const resolvedCount = denuncias.length - pendingCount;

  return (
    <div className="space-y-6 animate-fade-in">
      <AdminPageHeader
        title="Canal Cidadão"
        description="Gere QR codes para que cidadãos reportem focos de dengue diretamente pelo celular"
        icon={Megaphone}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{denuncias.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Aguardando</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resolvedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Resolvidas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Gerador de QR */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Gerar QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {!slug && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                Este cliente não possui um <strong>slug</strong> configurado. Edite o cadastro do cliente para habilitar o canal público.
              </div>
            )}

            {/* Seletor de bairro */}
            <div className="space-y-2">
              <Label>Selecione o bairro / região</Label>
              {regLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando regiões...
                </div>
              ) : regioes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma região cadastrada para este cliente.</p>
              ) : (
                <Select
                  value={selectedBairroId}
                  onValueChange={setSelectedBairroId}
                  disabled={!slug}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma região..." />
                  </SelectTrigger>
                  <SelectContent>
                    {regioes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.regiao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* URL */}
            {canGenerateUrl && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>URL do canal</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all text-muted-foreground border border-border/60">
                      {canalUrl}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCopy}
                      title="Copiar link"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      asChild
                      title="Abrir link"
                    >
                      <a href={canalUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex justify-center pt-2">
                  <QrCode url={canalUrl} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Denúncias recebidas */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Últimas denúncias
                {pendingCount > 0 && (
                  <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                    {pendingCount} novo{pendingCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => refetchDenuncias()}
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {denLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Carregando...</span>
              </div>
            ) : denuncias.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Megaphone className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhuma denúncia recebida ainda.</p>
                <p className="text-xs text-muted-foreground/70">
                  Gere um QR Code e compartilhe com moradores da região.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {denuncias.map((f) => (
                  <ComplaintRow key={f.id} foco={f} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default AdminCanalCidadao;
