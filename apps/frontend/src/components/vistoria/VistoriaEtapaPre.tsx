import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface EtapaPreData {
  origem_visita: 'denuncia' | 'liraa' | 'drone' | null;
  habitat_selecionado: string | null;
  condicao_habitat: 'seco' | 'agua_parada' | 'inundado' | null;
}

export const ETAPA_PRE_DEFAULT: EtapaPreData = {
  origem_visita: null,
  habitat_selecionado: null,
  condicao_habitat: null,
};

const ORIGENS: { key: NonNullable<EtapaPreData['origem_visita']>; label: string }[] = [
  { key: 'denuncia', label: 'Denúncia' },
  { key: 'liraa',    label: 'Rota LIRAa' },
  { key: 'drone',    label: 'Drone (IA)' },
];

const HABITATS = [
  { key: 'pneu',        label: 'Pneu' },
  { key: 'vaso_planta', label: 'Vaso de planta' },
  { key: 'piscina',     label: 'Piscina' },
  { key: 'caixa_dagua', label: "Caixa d'água" },
  { key: 'outro',       label: 'Outro...' },
];

const CONDICOES: { key: NonNullable<EtapaPreData['condicao_habitat']>; label: string }[] = [
  { key: 'seco',        label: 'Seco' },
  { key: 'agua_parada', label: 'Água parada' },
  { key: 'inundado',    label: 'Inundado' },
];

interface Props {
  data: EtapaPreData;
  onChange: (data: EtapaPreData) => void;
  onNext: () => void;
  /** Quando true, origem_visita já foi pré-definida pelo foco e não pode ser alterada. */
  origemLocked?: boolean;
}

export function VistoriaEtapaPre({ data, onChange, onNext, origemLocked }: Props) {
  const canAdvance = data.origem_visita !== null;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Origem da visita
            </p>
            {origemLocked && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Definida pelo foco
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ORIGENS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => !origemLocked && onChange({ ...data, origem_visita: key })}
                className={cn(
                  'h-12 rounded-xl border-2 text-sm font-bold transition-all',
                  !origemLocked && 'active:scale-95',
                  data.origem_visita === key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/40',
                  origemLocked && data.origem_visita !== key && 'opacity-30 cursor-default',
                  origemLocked && data.origem_visita === key && 'cursor-default',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Seleção de habitat
          </p>
          <div className="flex flex-wrap gap-2">
            {HABITATS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  onChange({
                    ...data,
                    habitat_selecionado: data.habitat_selecionado === key ? null : key,
                  })
                }
                className={cn(
                  'px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95',
                  data.habitat_selecionado === key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.habitat_selecionado && (
        <Card className="rounded-2xl border-border">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Condição do habitat
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CONDICOES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ ...data, condicao_habitat: key })}
                  className={cn(
                    'h-12 rounded-xl border-2 text-sm font-bold transition-all active:scale-95',
                    data.condicao_habitat === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        className="w-full h-12 rounded-xl text-base font-bold"
        onClick={onNext}
        disabled={!canAdvance}
      >
        Continuar
      </Button>
    </div>
  );
}
