import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFocoDadosMinimos } from '@/hooks/queries/useFocosRisco';
import { useNavigate } from 'react-router-dom';

const LABEL_PENDENCIA: Record<string, string> = {
  sem_localizacao: 'Localização (endereço ou coordenadas)',
  sem_bairro:      'Bairro ou região',
  sem_descricao:   'Descrição / observação',
  sem_evidencia:   'Evidência (foto, vistoria, drone ou caso notificado)',
};

const CRITERIOS: Array<{
  key: keyof Pick<
    NonNullable<ReturnType<typeof useFocoDadosMinimos>['data']>,
    'tem_localizacao' | 'tem_bairro' | 'tem_classificacao' | 'tem_descricao' | 'tem_evidencia'
  >;
  label: string;
}> = [
  { key: 'tem_localizacao',   label: 'Localização'  },
  { key: 'tem_bairro',        label: 'Bairro / região' },
  { key: 'tem_classificacao', label: 'Classificação' },
  { key: 'tem_descricao',     label: 'Descrição'    },
  { key: 'tem_evidencia',     label: 'Evidência'    },
];

interface Props {
  focoId: string;
  /** Rota para a tela de completar dados. Default: mesma página (sem botão). */
  completarHref?: string;
}

export function DadosMinimosPainel({ focoId, completarHref }: Props) {
  const { data, isLoading } = useFocoDadosMinimos(focoId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            Dados mínimos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="h-4 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { tem_dados_minimos, pendencias } = data;

  return (
    <Card className={`rounded-xl border-l-4 ${
      tem_dados_minimos
        ? 'border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
        : 'border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
    }`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          {tem_dados_minimos ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
          Dados mínimos
          <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
            tem_dados_minimos
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          }`}>
            {tem_dados_minimos ? 'Completo' : 'Incompleto'}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-3 space-y-3">
        {/* Checklist de critérios */}
        <ul className="space-y-1.5">
          {CRITERIOS.map(({ key, label }) => {
            const ok = data[key] as boolean;
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                {ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Pendências */}
        {!tem_dados_minimos && pendencias.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Pendências
            </p>
            <ul className="space-y-0.5">
              {pendencias.map((p) => (
                <li key={p} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                  {LABEL_PENDENCIA[p] ?? p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Botão completar dados */}
        {!tem_dados_minimos && completarHref && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs mt-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
            onClick={() => navigate(completarHref)}
          >
            Completar dados
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
