import { useRef, useState } from 'react';
import { Camera, Loader2, CheckCircle2, XCircle, Bug, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

export interface LarvaIAResult {
  identified: boolean;
  confidence: number;
  classe: string;
  imageUrl: string;
}

interface Props {
  vistoriaId?: string;
  depositoTipo: string;
  onResult?: (result: LarvaIAResult) => void;
}

type State = 'idle' | 'loading' | 'result_positive' | 'result_negative' | 'error';

export function IdentificacaoLarvaIA({ vistoriaId, depositoTipo, onResult }: Props) {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<LarvaIAResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setState('loading');
    setErrorMsg('');
    try {
      const base64 = await fileToBase64(file);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await api.identifyLarva.invoke({
        imageBase64: base64,
        contentType: file.type || 'image/jpeg',
        depositoTipo: depositoTipo,
      } as never) as any;

      // Backend retorna { classificacao, confianca, descricao }
      const res: LarvaIAResult = {
        identified: raw.classificacao === 'positivo',
        confidence: raw.confianca ?? 0,
        classe: raw.classificacao ?? 'inconclusivo',
        imageUrl: '',
      };

      setResult(res);
      setState(res.identified ? 'result_positive' : 'result_negative');
      onResult?.(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao identificar larva.');
      setState('error');
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if (state === 'idle' || state === 'error') {
    return (
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400 text-sm font-semibold hover:bg-violet-100/50 dark:hover:bg-violet-900/30 transition-colors"
        >
          <Camera className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">Identificar larva por foto (IA)</span>
          <Upload className="w-3.5 h-3.5 opacity-60" />
        </button>
        {state === 'error' && (
          <p className="text-xs text-destructive font-semibold">{errorMsg}</p>
        )}
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/30">
        <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        <p className="text-sm text-muted-foreground">Analisando imagem com IA...</p>
      </div>
    );
  }

  // result
  const isPositive = state === 'result_positive';
  return (
    <div
      className={cn(
        'rounded-xl border-2 p-3 space-y-1.5',
        isPositive
          ? 'border-rose-300 bg-rose-50/40 dark:bg-rose-950/20'
          : 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20',
      )}
    >
      <div className="flex items-center gap-2">
        {isPositive ? (
          <Bug className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        )}
        <p className={cn('text-sm font-bold', isPositive ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400')}>
          {isPositive ? 'Larva identificada pela IA' : 'Sem larva detectada'}
        </p>
        {result && (
          <span className="ml-auto text-[10px] font-bold text-muted-foreground">
            {Math.round(result.confidence * 100)}% conf.
          </span>
        )}
      </div>
      {result?.imageUrl && (
        <img
          src={result.imageUrl}
          alt="Foto analisada"
          className="w-full h-24 object-cover rounded-lg mt-1"
        />
      )}
      <button
        type="button"
        className="text-[11px] text-muted-foreground hover:text-foreground underline"
        onClick={() => { setState('idle'); setResult(null); }}
      >
        Tirar outra foto
      </button>
    </div>
  );
}
