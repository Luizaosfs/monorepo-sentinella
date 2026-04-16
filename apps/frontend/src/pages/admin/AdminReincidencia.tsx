import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw, AlertTriangle, TrendingUp, Beaker, MapPin,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AdminPageHeader from '@/components/AdminPageHeader';
import { ImovelReincidenciaCard } from '@/components/foco/ImovelReincidenciaCard';
import {
  useImoveisReincidentes,
  useReincidenciaPorDeposito,
  useBairrosEmAlertaSazonal,
  PADRAO_LABEL,
  DEPOSITO_LABELS,
} from '@/hooks/queries/useReincidenciaInteligente';
import { useCicloAtivo } from '@/hooks/queries/useCicloAtivo';
import { cn } from '@/lib/utils';

export default function AdminReincidencia() {
  const navigate = useNavigate();
  const { cicloNumero } = useCicloAtivo();
  const proximoCiclo = (cicloNumero % 6) + 1;

  const [filtroPadrao, setFiltroPadrao] = useState<'todos' | 'cronico' | 'recorrente' | 'pontual'>('todos');

  const { data: imoveisReinc = [], isLoading: loadingImoveis } = useImoveisReincidentes(
    filtroPadrao !== 'todos' ? { padrao: filtroPadrao, limit: 50 } : { limit: 50 }
  );
  const { data: porDeposito = [], isLoading: loadingDeposito } = useReincidenciaPorDeposito();
  const bairrosAlerta = useBairrosEmAlertaSazonal(proximoCiclo);

  // KPIs
  const cronicos     = imoveisReinc.filter(i => i.padrao === 'cronico').length;
  const recorrentes  = imoveisReinc.filter(i => i.padrao === 'recorrente').length;
  const comFocoAtivo = imoveisReinc.filter(i => i.focos_ativos > 0).length;
  const semLarvicida = imoveisReinc.filter(
    i => !i.usou_larvicida_alguma_vez && i.total_focos_historico > 1
  ).length;

  // Dados para gráfico
  const chartDeposito = porDeposito
    .slice(0, 7)
    .map(d => ({
      tipo: DEPOSITO_LABELS[d.tipo_deposito]?.split(' — ')[0] ?? d.tipo_deposito,
      reincidentes: d.imoveis_multiciclo,
      total: d.imoveis_afetados,
    }));

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AdminPageHeader
        title="Análise de Reincidência"
        description="Imóveis com padrão persistente de foco e oportunidades de melhoria"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Imóveis crônicos', valor: cronicos, icon: AlertTriangle, cor: 'text-red-500',
            desc: '5+ focos históricos, 3+ reincidências' },
          { label: 'Recorrentes', valor: recorrentes, icon: RotateCcw, cor: 'text-orange-500',
            desc: '3+ focos com ao menos 1 reincidência' },
          { label: 'Com foco ativo', valor: comFocoAtivo, icon: MapPin, cor: 'text-destructive',
            desc: 'Reincidentes com foco aberto agora' },
          { label: 'Sem larvicida', valor: semLarvicida, icon: Beaker, cor: 'text-amber-500',
            desc: 'Reincidentes sem tratamento registrado' },
        ].map(({ label, valor, icon: Icon, cor, desc }) => (
          <Card key={label} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
                <Icon className={cn('h-4 w-4', cor)} />
              </div>
              <p className="text-2xl font-black">{valor}</p>
              <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="imoveis">
        <TabsList className="mb-4">
          <TabsTrigger value="imoveis">Imóveis reincidentes</TabsTrigger>
          <TabsTrigger value="depositos">Por tipo de depósito</TabsTrigger>
          <TabsTrigger value="sazonalidade">Alerta sazonal</TabsTrigger>
        </TabsList>

        {/* Aba: Imóveis reincidentes */}
        <TabsContent value="imoveis" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['todos', 'cronico', 'recorrente', 'pontual'] as const).map(p => (
              <Button
                key={p}
                variant={filtroPadrao === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFiltroPadrao(p)}
              >
                {p === 'todos' ? 'Todos' : PADRAO_LABEL[p]}
              </Button>
            ))}
          </div>

          {loadingImoveis ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : imoveisReinc.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum imóvel reincidente encontrado com os filtros aplicados.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {imoveisReinc.map(imovel => (
                <ImovelReincidenciaCard
                  key={imovel.imovel_id}
                  imovel={imovel}
                  compact
                  onClick={() => navigate(`/admin/imoveis?id=${imovel.imovel_id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Aba: Por tipo de depósito */}
        <TabsContent value="depositos" className="space-y-4">
          {loadingDeposito ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : (
            <>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Depósitos com mais reincidências (imóveis afetados em múltiplos ciclos)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartDeposito} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="tipo" tick={{ fontSize: 10 }} width={60} />
                      <Tooltip />
                      <Bar dataKey="reincidentes" name="Reincidentes multiciclo"
                        fill="#ef4444" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="total" name="Total afetados"
                        fill="#94a3b8" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-0 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {['Depósito', 'Imóveis afetados', 'Multiciclo', 'Índice reincid.', 'Uso larvicida', 'Taxa eliminação'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porDeposito.map((d, i) => (
                        <tr key={`${d.tipo_deposito}-${d.bairro ?? ''}-${i}`}
                          className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium">
                            {DEPOSITO_LABELS[d.tipo_deposito] ?? d.tipo_deposito}
                          </td>
                          <td className="px-4 py-2.5">{d.imoveis_afetados}</td>
                          <td className="px-4 py-2.5 font-semibold text-orange-600">
                            {d.imoveis_multiciclo}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn(
                              'font-bold',
                              (d.indice_reincidencia_pct ?? 0) >= 50 ? 'text-red-600' :
                              (d.indice_reincidencia_pct ?? 0) >= 25 ? 'text-orange-600' :
                              'text-emerald-600',
                            )}>
                              {d.indice_reincidencia_pct ?? 0}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {d.uso_larvicida_pct !== null ? `${d.uso_larvicida_pct}%` : 'N/D'}
                          </td>
                          <td className="px-4 py-2.5">
                            {d.taxa_eliminacao_pct !== null ? `${d.taxa_eliminacao_pct}%` : 'N/D'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Aba: Alerta sazonal */}
        <TabsContent value="sazonalidade">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                Bairros em alerta para o Ciclo {proximoCiclo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bairrosAlerta.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sem dados históricos suficientes para previsão sazonal.
                  O sistema precisará de ao menos 2 anos de dados por ciclo.
                </p>
              ) : (
                <div className="space-y-3">
                  {bairrosAlerta.map((b, i) => (
                    <div key={`${b.bairro}-${b.ciclo}-${i}`}
                      className="flex items-center justify-between p-3 rounded-xl border bg-orange-50 border-orange-200">
                      <div>
                        <p className="font-medium text-sm">{b.bairro ?? 'Bairro não identificado'}</p>
                        <p className="text-xs text-muted-foreground">
                          Média histórica: {b.media_focos_por_ano} focos/ano neste ciclo ·{' '}
                          {b.anos_com_ocorrencia} ano(s) de dados
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-bold text-orange-700">
                          +{b.delta_tendencia.toFixed(1)} focos
                        </p>
                        <p className="text-xs text-muted-foreground">tendência de piora</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Baseado em dados históricos · delta = média últimos 2 anos vs. média geral
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
