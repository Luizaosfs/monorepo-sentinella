import { useState } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  SentinelaRiskRule,
  SentinelaRiskFallbackRule,
  SentinelaRiskTempFactor,
  SentinelaRiskVentoFactor,
  SentinelaRiskTempAdjustPp,
  SentinelaRiskVentoAdjustPp,
  SentinelaRiskPersistenciaAdjustPp,
  SentinelaRiskTendenciaAdjustPp,
} from '@/types/database';

interface Props {
  policyId: string;
}

export const TabImport = ({ policyId }: Props) => {
  const [json, setJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const handleImport = async () => {
    let parsed: {
      defaults?: {
        chuva_relevante_mm: number;
        dias_lookup_max: number;
        tendencia_dias: number;
        janela_sem_chuva_bins?: number[][];
        intensidade_chuva_bins?: number[][];
        persistencia_7d_bins?: number[][];
      };
      fallback_rule?: Partial<SentinelaRiskFallbackRule>;
      rules?: Partial<SentinelaRiskRule>[];
      temp_factors?: Partial<SentinelaRiskTempFactor>[];
      vento_factors?: Partial<SentinelaRiskVentoFactor>[];
      temp_adjust_pp?: Partial<SentinelaRiskTempAdjustPp>[];
      vento_adjust_pp?: Partial<SentinelaRiskVentoAdjustPp>[];
      persistencia_adjust_pp?: Partial<SentinelaRiskPersistenciaAdjustPp>[];
      tendencia_adjust_pp?: Partial<SentinelaRiskTendenciaAdjustPp>[];
    };
    try {
      parsed = JSON.parse(json);
    } catch {
      toast.error('JSON inválido');
      return;
    }

    setImporting(true);
    setLog([]);

    try {
      const importLog = await api.riskPolicyEditor.importAll(policyId, parsed);
      setLog([...importLog, '🎉 Importação finalizada com sucesso!']);
      toast.success('Importação concluída!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro na importação: ' + msg);
      setLog(prev => [...prev, '❌ Erro: ' + msg]);
    }
    setImporting(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Importar JSON</p>
      <p className="text-xs text-muted-foreground">
        Cole o JSON completo de configuração. Os dados existentes desta política serão substituídos.
      </p>
      <div className="space-y-2">
        <Label>JSON</Label>
        <Textarea
          value={json}
          onChange={e => setJson(e.target.value)}
          placeholder='{"defaults": {...}, "rules": [...], ...}'
          rows={10}
          className="font-mono text-xs"
        />
      </div>
      <Button onClick={handleImport} disabled={importing || !json.trim()} size="sm">
        {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
        Importar
      </Button>

      {log.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 max-h-60 overflow-y-auto">
          {log.map((l, i) => (
            <p key={i} className="text-xs font-mono">{l}</p>
          ))}
        </div>
      )}
    </div>
  );
};
