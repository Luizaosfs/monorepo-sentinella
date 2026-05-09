import { useState, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGerarLoteQuadras } from '@/hooks/queries/useGestaoQuadras';
import type { GerarLoteResult } from '@/hooks/queries/useGestaoQuadras';

export interface RegiaoOpcao {
  id: string;
  nome?: string;
  regiao?: string;
}

interface Props {
  open: boolean;
  regioes: RegiaoOpcao[];
  /** Pre-select a region when opening from a specific region row. */
  regiaoIdInicial?: string | null;
  onClose: () => void;
}

function nomeOpcao(r: RegiaoOpcao): string {
  return r.nome ?? r.regiao ?? r.id;
}

export function ModalGerarLoteQuarteiroes({
  open, regioes, regiaoIdInicial, onClose,
}: Props) {
  const gerarLote = useGerarLoteQuadras();

  const [regiaoId, setRegiaoId] = useState(regiaoIdInicial ?? '');
  const [prefixo, setPrefixo] = useState('');
  const [inicio, setInicio] = useState('1');
  const [fim, setFim] = useState('30');
  const [resultado, setResultado] = useState<GerarLoteResult | null>(null);

  // Sync region + reset form whenever the modal opens
  useEffect(() => {
    if (open) {
      setRegiaoId(regiaoIdInicial ?? '');
      setResultado(null);
    }
  }, [open, regiaoIdInicial]);

  const preview = useMemo(() => {
    const p = prefixo.trim().toUpperCase();
    const a = parseInt(inicio, 10);
    const b = parseInt(fim, 10);
    if (!p || isNaN(a) || isNaN(b) || a < 1 || b < a || b - a + 1 > 300) return [];
    return Array.from({ length: b - a + 1 }, (_, i) => `${p}${a + i}`);
  }, [prefixo, inicio, fim]);

  function handleGerar() {
    const p = prefixo.trim();
    const a = parseInt(inicio, 10);
    const b = parseInt(fim, 10);
    if (!regiaoId)          { toast.error('Selecione uma região'); return; }
    if (!p)                 { toast.error('Prefixo é obrigatório'); return; }
    if (isNaN(a) || a < 1) { toast.error('Número inicial inválido (mín. 1)'); return; }
    if (isNaN(b) || b < a) { toast.error('Número final deve ser ≥ inicial'); return; }
    if (b - a + 1 > 300)   { toast.error('Máximo 300 quadras por lote'); return; }

    gerarLote.mutate(
      { regiaoId, prefixo: p, numeroInicial: a, numeroFinal: b },
      {
        onSuccess: (res) => {
          setResultado(res);
          toast.success(`${res.totalCriado} quadra(s) criada(s)`);
        },
      },
    );
  }

  function handleClose() {
    setResultado(null);
    setPrefixo('');
    setInicio('1');
    setFim('30');
    onClose();
  }

  // ── Result panel ──────────────────────────────────────────────────────────
  if (resultado) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resultado do lote</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-2xl font-bold">{resultado.totalSolicitado}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Solicitadas</p>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-3">
                <p className="text-2xl font-bold text-emerald-700">{resultado.totalCriado}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Criadas</p>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3">
                <p className="text-2xl font-bold text-amber-700">{resultado.totalIgnorado}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ignoradas</p>
              </div>
            </div>

            {resultado.totalIgnorado > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Ignoradas — já existentes:</p>
                <div className="max-h-24 overflow-y-auto rounded border p-2 bg-muted/30 text-xs font-mono leading-relaxed">
                  {resultado.ignorados.map((i) => i.codigo).join(', ')}
                </div>
              </div>
            )}

            {resultado.totalCriado > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Criadas:</p>
                <div className="max-h-24 overflow-y-auto rounded border p-2 bg-muted/30 text-xs font-mono leading-relaxed">
                  {resultado.criados.slice(0, 80).join(', ')}
                  {resultado.criados.length > 80 && ` … +${resultado.criados.length - 80} mais`}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResultado(null)}>Gerar outro lote</Button>
            <Button onClick={handleClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar quadras em lote</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Região / Bairro *</Label>
            <Select value={regiaoId} onValueChange={setRegiaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma região" />
              </SelectTrigger>
              <SelectContent>
                {regioes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{nomeOpcao(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lote-pref">Prefixo *</Label>
              <Input
                id="lote-pref"
                placeholder="A"
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lote-ini">Nº inicial</Label>
              <Input
                id="lote-ini"
                type="number"
                min={1}
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lote-fim">Nº final</Label>
              <Input
                id="lote-fim"
                type="number"
                min={1}
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
          </div>

          {preview.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {preview.length} quadra(s) serão geradas (máx. 300 por lote)
              </p>
              <div className="max-h-28 overflow-y-auto rounded border p-2.5 bg-muted/30 text-xs font-mono leading-relaxed">
                {preview.slice(0, 60).join(', ')}
                {preview.length > 60 && ` … +${preview.length - 60} mais`}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleGerar}
            disabled={gerarLote.isPending || preview.length === 0}
          >
            {gerarLote.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Gerar{preview.length > 0 ? ` ${preview.length}` : ''} quadra(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
