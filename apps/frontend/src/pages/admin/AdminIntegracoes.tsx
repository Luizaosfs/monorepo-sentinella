import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { toast } from 'sonner';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, XCircle, Plug, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { STALE } from '@/lib/queryConfig';
import { validarConfiguracaoIntegracao } from '@/lib/sinan';
import type { AmbienteIntegracao, ItemNotificacaoESUS } from '@/types/database';

export default function AdminIntegracoes() {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    api_key: '',
    endpoint_url: 'https://notifica.saude.gov.br/api/notificacoes',
    codigo_ibge: '',
    unidade_saude_cnes: '',
    ambiente: 'homologacao' as AmbienteIntegracao,
    ativo: false,
  });
  const [testResult, setTestResult] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: integracao, isLoading } = useQuery({
    queryKey: ['integracao_esus', clienteId],
    queryFn: () => api.integracoes.getByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
    select: (data) => {
      if (data && !loaded) {
        setForm({
          api_key: '', // nunca pré-preencher — campo vazio = manter chave existente
          endpoint_url: data.endpoint_url,
          codigo_ibge: data.codigo_ibge ?? '',
          unidade_saude_cnes: data.unidade_saude_cnes ?? '',
          ambiente: data.ambiente,
          ativo: data.ativo,
        });
        setLoaded(true);
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const meta = {
        endpoint_url:       form.endpoint_url,
        codigo_ibge:        form.codigo_ibge || null,
        unidade_saude_cnes: form.unidade_saude_cnes || null,
        ambiente:           form.ambiente,
        ativo:              form.ativo,
      };
      // Se já existe integração e usuário não digitou nova chave → só atualiza metadados
      if (integracao && !form.api_key) {
        return api.integracoes.updateMeta(integracao.id, meta);
      }
      // Criação ou troca de chave → upsert completo
      return api.integracoes.upsert({
        cliente_id: clienteId!,
        tipo: 'esus_notifica',
        api_key: form.api_key,
        ...meta,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integracao_esus', clienteId] });
      setLoaded(false);
      toast.success('Configuração salva com sucesso.');
    },
    onError: () => toast.error('Erro ao salvar configuração.'),
  });

  async function handleTestar() {
    if (!clienteId) return;
    setTesting(true);
    setTestResult(null);
    const result = await api.integracoes.testarConexao(clienteId);
    setTestResult(result);
    setTesting(false);
  }

  // api_key considerada válida se já existe (integracao.api_key_masked) mesmo que campo vazio
  const apiKeyValida = !!form.api_key || !!integracao?.api_key_masked;
  const validacao = validarConfiguracaoIntegracao({
    api_key:             apiKeyValida ? (form.api_key || '••••') : '',
    codigo_ibge:         form.codigo_ibge,
    unidade_saude_cnes:  form.unidade_saude_cnes,
    ativo:               form.ativo,
  });

  if (isLoading) return (
    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <AdminPageHeader
        title="Integrações"
        description="Configure a integração com o e-SUS Notifica para envio de notificações compulsórias ao Ministério da Saúde."
      />

      {/* Status card */}
      <Card className="rounded-2xl">
        <CardContent className="p-5 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${integracao?.ativo ? 'bg-emerald-100 dark:bg-emerald-950' : 'bg-muted'}`}>
            <Plug className={`w-6 h-6 ${integracao?.ativo ? 'text-emerald-600' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">e-SUS Notifica</p>
              {integracao?.ativo ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Ativo</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Inativo</Badge>
              )}
              {integracao?.ambiente === 'homologacao' && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">Homologação</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {integracao?.ultima_sincronizacao
                ? `Último envio: ${new Date(integracao.ultima_sincronizacao).toLocaleString('pt-BR')}`
                : 'Nenhum envio realizado ainda.'
              }
            </p>
          </div>
          <a
            href="https://servicos-datasus.saude.gov.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            Portal DATASUS <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card className="rounded-2xl border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Como obter as credenciais</p>
          </div>
          <ol className="text-sm text-amber-700 dark:text-amber-400 space-y-1 list-decimal list-inside">
            <li>Acesse o Portal de Serviços DATASUS e faça login com conta Gov.br</li>
            <li>Selecione "e-SUS Notifica" e solicite acesso para homologação</li>
            <li>Informe o IP público do servidor desta aplicação</li>
            <li>Aguarde a aprovação (geralmente 1–3 dias úteis)</li>
            <li>Receba a API Key por e-mail e configure abaixo</li>
            <li>Teste a conexão antes de ativar em produção</li>
          </ol>
        </CardContent>
      </Card>

      {/* Formulário */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuração da API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>API Key <span className="text-destructive">*</span></Label>
              <Input
                type="password"
                placeholder={integracao?.api_key_masked ?? 'eyJhbGci... (obtida no Portal DATASUS)'}
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                className="rounded-xl font-mono text-sm"
              />
              {integracao?.api_key_masked && !form.api_key && (
                <p className="text-xs text-muted-foreground">Chave atual: <span className="font-mono">{integracao.api_key_masked}</span> — deixe em branco para manter</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Código IBGE do Município <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex: 5201108 (7 dígitos)"
                value={form.codigo_ibge}
                onChange={(e) => setForm({ ...form, codigo_ibge: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                className="rounded-xl"
                maxLength={7}
              />
              <p className="text-xs text-muted-foreground">Consulte em ibge.gov.br</p>
            </div>

            <div className="space-y-1.5">
              <Label>CNES da Unidade Notificante <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex: 0012345 (7 dígitos)"
                value={form.unidade_saude_cnes}
                onChange={(e) => setForm({ ...form, unidade_saude_cnes: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                className="rounded-xl"
                maxLength={7}
              />
              <p className="text-xs text-muted-foreground">CNES do serviço de vigilância</p>
            </div>

            <div className="space-y-1.5">
              <Label>Ambiente</Label>
              <Select value={form.ambiente} onValueChange={(v) => setForm({ ...form, ambiente: v as AmbienteIntegracao })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Endpoint URL</Label>
              <Input
                value={form.endpoint_url}
                onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })}
                className="rounded-xl text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">Altere apenas se o MS fornecer URL diferente</p>
            </div>
          </div>

          {/* Ativo toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border-2 border-border">
            <div>
              <p className="text-sm font-semibold">Ativar integração</p>
              <p className="text-xs text-muted-foreground">Quando ativo, notificações poderão ser enviadas ao Ministério da Saúde.</p>
            </div>
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              disabled={!validacao.valida && !form.ativo}
            />
          </div>

          {/* Erros de validação */}
          {form.ativo && !validacao.valida && (
            <div className="space-y-1">
              {validacao.erros.map((e) => (
                <div key={e} className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="w-4 h-4 shrink-0" />
                  {e}
                </div>
              ))}
            </div>
          )}

          {/* Teste de conexão */}
          {testResult && (
            <div className={`flex items-start gap-3 p-3.5 rounded-xl border-2 ${testResult.ok ? 'border-emerald-300 bg-emerald-50/50' : 'border-rose-300 bg-rose-50/50'}`}>
              {testResult.ok
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                : <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              }
              <p className={`text-sm font-medium ${testResult.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {testResult.mensagem}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={handleTestar}
              disabled={testing || !apiKeyValida}
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Testar conexão
            </Button>
            <Button
              className="flex-1 rounded-xl font-bold"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar configuração
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de notificações enviadas */}
      <HistoricoNotificacoes clienteId={clienteId} />
    </div>
  );
}

function HistoricoNotificacoes({ clienteId }: { clienteId: string | null | undefined }) {
  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['notificacoes_esus', clienteId],
    queryFn: () => api.notificacoesESUS.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });

  if (!notificacoes.length && !isLoading) return null;

  const STATUS_CONFIG: Record<ItemNotificacaoESUS['status'], { label: string; color: string }> = {
    enviado:    { label: 'Enviado',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    pendente:   { label: 'Pendente',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
    erro:       { label: 'Erro',       color: 'bg-rose-100 text-rose-700 border-rose-200' },
    descartado: { label: 'Descartado', color: 'bg-muted text-muted-foreground' },
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Histórico de Notificações</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            {notificacoes.slice(0, 20).map((n) => {
              const cfg = STATUS_CONFIG[n.status];
              return (
                <div key={n.id} className="flex items-center justify-between p-3 rounded-xl border bg-card gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {n.tipo_agravo} — {n.numero_notificacao ?? 'Sem número'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString('pt-BR')}
                      {n.erro_mensagem && ` · ${n.erro_mensagem}`}
                    </p>
                  </div>
                  <Badge className={`shrink-0 text-xs ${cfg.color}`}>{cfg.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
