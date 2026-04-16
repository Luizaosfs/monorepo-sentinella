/**
 * AdminImportarImoveis — Importação em lote de imóveis via CSV ou XLSX.
 * Rota: /admin/importar-imoveis
 * Acesso: supervisor e admin.
 *
 * Fluxo:
 *  1. Upload CSV ou XLSX (drag & drop ou clique)
 *  2. Preview + validação (lat/lng opcionais, tipo padrão residencial)
 *  3. Importação: geocodificação automática → deduplicação → batch insert
 *  4. Relatório final (7 métricas) + download CSV de erros
 */
import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Upload, FileText, AlertCircle, CheckCircle2, XCircle,
  ArrowLeft, Download, RefreshCw, ExternalLink, Info,
  MapPin, Copy,
} from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn }       from '@/lib/utils';
import { api }      from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth }  from '@/hooks/useAuth';
import type { TipoImovel } from '@/types/database';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

type GeoStatus = 'tem_coord' | 'sem_coord' | 'geocoded' | 'geo_falhou';

interface RowParsed {
  linha:        number;
  logradouro:   string;
  numero:       string;
  complemento:  string;
  bairro:       string;
  quarteirao:   string;
  cidade:       string;
  uf:           string;
  lat:          number | null;
  lng:          number | null;
  tipo:         TipoImovel;
  cep:          string;
  referencia:   string;
  avisos:       string[];   // não-fatais
  erros:        string[];   // fatais
  valido:       boolean;
  duplicado:    boolean;
  geoStatus:    GeoStatus;
}

interface ImportStats {
  totalLidos:     number;
  validos:        number;
  importados:     number;
  duplicados:     number;
  geocodificados: number;
  geoFalhou:      number;
  comErro:        number;
  linhasErro:     { linha: number; status: string; mensagem: string }[];
}

// ── Constantes ────────────────────────────────────────────────────────────────

const HEADER_ALIASES: Record<string, string> = {
  logradouro: 'logradouro', rua: 'logradouro', endereco: 'logradouro', endereço: 'logradouro',
  av: 'logradouro', avenida: 'logradouro', alameda: 'logradouro',
  numero: 'numero', número: 'numero', num: 'numero', nro: 'numero', n: 'numero', no: 'numero',
  complemento: 'complemento', comp: 'complemento',
  bairro: 'bairro',
  quarteirao: 'quarteirao', quarteirão: 'quarteirao', quadra: 'quarteirao', lote: 'quarteirao',
  latitude: 'latitude', lat: 'latitude',
  longitude: 'longitude', lng: 'longitude', lon: 'longitude',
  tipo_imovel: 'tipo_imovel', tipo: 'tipo_imovel', 'tipo imóvel': 'tipo_imovel', 'tipo imovel': 'tipo_imovel',
  cep: 'cep',
  referencia: 'referencia', referência: 'referencia', ponto_referencia: 'referencia', ref: 'referencia',
  cidade: 'cidade', municipio: 'cidade', município: 'cidade',
  uf: 'uf', estado: 'uf',
};

const TIPO_MAP: Record<string, TipoImovel> = {
  residencial: 'residencial', r: 'residencial',
  comercial: 'comercial', c: 'comercial',
  terreno: 'terreno', t: 'terreno',
  ponto_estrategico: 'ponto_estrategico', 'ponto estratégico': 'ponto_estrategico',
  'ponto estrategico': 'ponto_estrategico', estrategico: 'ponto_estrategico',
  estratégico: 'ponto_estrategico', pe: 'ponto_estrategico',
};

const REQUIRED_HEADERS = ['logradouro', 'numero', 'bairro'];
const MAX_GEOCODE = 300;

// ── Funções de parse ──────────────────────────────────────────────────────────

function normalizeHeader(raw: string): string {
  const clean = raw.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
  return HEADER_ALIASES[clean] ?? clean;
}

function parseCSV(text: string): { headers: string[]; rawRows: Record<string, string>[] } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rawRows: [] };

  const firstLine = lines[0];
  const sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = !inQ; }
      } else if (ch === sep && !inQ) {
        fields.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = parseLine(lines[0]).map(normalizeHeader);
  const rawRows = lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
  return { headers, rawRows };
}

function parseXLSX(buffer: ArrayBuffer): { headers: string[]; rawRows: Record<string, string>[] } {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  if (data.length < 2) return { headers: [], rawRows: [] };

  const headers = (data[0] as string[]).map(h => normalizeHeader(String(h ?? '')));
  const rawRows = data.slice(1)
    .filter(row => (row as string[]).some(v => String(v ?? '').trim()))
    .map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = String((row as string[])[i] ?? '').trim(); });
      return obj;
    });
  return { headers, rawRows };
}

function validarCoordenada(val: string, tipo: 'lat' | 'lng'): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(',', '.'));
  if (isNaN(n)) return null;
  if (tipo === 'lat' && (n < -35 || n > 5))   return null;
  if (tipo === 'lng' && (n < -74 || n > -32))  return null;
  return n;
}

function validarRow(raw: Record<string, string>, linha: number): RowParsed {
  const erros: string[] = [];
  const avisos: string[] = [];

  const logradouro  = raw['logradouro']?.trim() || '';
  const numero      = raw['numero']?.trim() || '';
  const complemento = raw['complemento']?.trim() || '';
  const bairro      = raw['bairro']?.trim() || '';
  const quarteirao  = raw['quarteirao']?.trim() || '';
  const cep         = raw['cep']?.trim() || '';
  const referencia  = raw['referencia']?.trim() || '';
  const cidade      = raw['cidade']?.trim() || '';
  const uf          = raw['uf']?.trim() || '';

  if (!logradouro) erros.push('logradouro obrigatório');
  if (!numero)     erros.push('numero obrigatório');
  if (!bairro)     erros.push('bairro obrigatório');

  const lat = validarCoordenada(raw['latitude'] ?? '', 'lat');
  const lng = validarCoordenada(raw['longitude'] ?? '', 'lng');
  // lat/lng são opcionais — ausência gera geocodificação automática, não erro
  const geoStatus: GeoStatus = (lat !== null && lng !== null) ? 'tem_coord' : 'sem_coord';

  // tipo_imovel: padrão residencial se ausente
  const tipoRaw = (raw['tipo_imovel'] ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let tipo: TipoImovel = 'residencial';
  if (tipoRaw) {
    const mapeado = TIPO_MAP[tipoRaw];
    if (!mapeado) {
      avisos.push(`tipo_imovel "${tipoRaw}" desconhecido — usando residencial`);
    } else {
      tipo = mapeado;
    }
  } else {
    avisos.push('tipo_imovel ausente — usando residencial');
  }

  return {
    linha, logradouro, numero, complemento, bairro, quarteirao, cidade, uf,
    lat, lng, tipo, cep, referencia,
    erros, avisos, valido: erros.length === 0, duplicado: false, geoStatus,
  };
}

// ── Geocodificação via Nominatim ──────────────────────────────────────────────

async function geocodificarEndereco(
  logradouro: string, numero: string, bairro: string,
  cidade: string, uf: string,
): Promise<{ lat: number; lng: number } | null> {
  const partes = [logradouro, numero, bairro, cidade, uf, 'Brasil'].filter(Boolean);
  const q = encodeURIComponent(partes.join(', '));
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
      { headers: { 'User-Agent': 'Sentinella-Importador/1.0 (plataforma municipal; contato: suporte@sentinella.app)' } },
    );
    if (!resp.ok) return null;
    const data = await resp.json() as { lat: string; lon: string }[];
    if (!data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Modelos para download ─────────────────────────────────────────────────────

const CSV_MODELO = `logradouro,numero,complemento,bairro,quarteirao,latitude,longitude,tipo_imovel,cep,cidade,uf
Rua das Acácias,42,,Centro,Q01,-15.7801,-47.9292,residencial,70000-000,Brasília,DF
Av. Brasil,100,Sala 5,Jardim América,Q02,,,comercial,,Brasília,DF
Rua XV de Novembro,50,,Vila Nova,,,,terreno,,,
`;

function downloadModeloCSV() {
  const blob = new Blob([CSV_MODELO], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'modelo_imoveis_sentinella.csv'; a.click();
  URL.revokeObjectURL(url);
}

function downloadModeloXLSX() {
  const headers = ['logradouro','numero','complemento','bairro','quarteirao','latitude','longitude','tipo_imovel','cep','cidade','uf'];
  const exemplos = [
    ['Rua das Acácias','42','','Centro','Q01','-15.7801','-47.9292','residencial','70000-000','Brasília','DF'],
    ['Av. Brasil','100','Sala 5','Jardim América','Q02','','','comercial','','Brasília','DF'],
    ['Rua XV de Novembro','50','','Vila Nova','','','','terreno','','',''],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...exemplos]);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Imóveis');
  XLSX.writeFile(wb, 'modelo_imoveis_sentinella.xlsx');
}

function downloadRelatorioCSV(stats: ImportStats) {
  const linhas = [
    ['linha', 'status', 'mensagem'],
    ...stats.linhasErro.map(e => [String(e.linha), e.status, e.mensagem]),
  ];
  const csv = linhas.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'relatorio_importacao_sentinella.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminImportarImoveis() {
  const navigate = useNavigate();
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const { usuario } = useAuth();

  const [step, setStep]             = useState<ImportStep>('upload');
  const [filename, setFilename]     = useState('');
  const [rows, setRows]             = useState<RowParsed[]>([]);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progresso
  const [fase, setFase]             = useState<'geocodificando' | 'importando'>('geocodificando');
  const [progressDone, setProgressDone]   = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  const [stats, setStats] = useState<ImportStats>({
    totalLidos: 0, validos: 0, importados: 0, duplicados: 0,
    geocodificados: 0, geoFalhou: 0, comErro: 0, linhasErro: [],
  });

  // ── Parse ────────────────────────────────────────────────────────────────

  function processRawRows(headers: string[], rawRows: Record<string, string>[], name: string) {
    const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      setParseError(`Colunas obrigatórias ausentes: ${missing.join(', ')}`);
      return;
    }
    if (rawRows.length === 0) { setParseError('Arquivo sem linhas de dados.'); return; }

    const parsed = rawRows.map((raw, i) => validarRow(raw, i + 2));
    setFilename(name);
    setRows(parsed);
    setParseError('');
    setStep('preview');
  }

  const MAX_FILE_SIZE_MB = 5;

  const processFile = useCallback((file: File) => {
    setParseError('');

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setParseError(`Arquivo muito grande. Limite: ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { headers, rawRows } = parseXLSX(e.target?.result as ArrayBuffer);
          processRawRows(headers, rawRows, file.name);
        } catch {
          setParseError('Erro ao ler XLSX. Verifique se o arquivo não está corrompido.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'csv' || ext === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const { headers, rawRows } = parseCSV(e.target?.result as string);
        processRawRows(headers, rawRows, file.name);
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      setParseError('Formato não suportado. Use .csv ou .xlsx');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ── Importação ────────────────────────────────────────────────────────────

  async function executarImportacao() {
    if (!clienteId) return;
    setStep('importing');

    const validas = rows.filter(r => r.valido);
    const invalidas = rows.filter(r => !r.valido);
    const semCoord = validas.filter(r => r.geoStatus === 'sem_coord');
    const linhasErro: ImportStats['linhasErro'] = invalidas.map(r => ({
      linha: r.linha, status: 'erro', mensagem: r.erros.join('; '),
    }));

    // ── Fase 1: Geocodificação ─────────────────────────────────────────────
    let geocodificados = 0;
    let geoFalhou = 0;
    const mutableRows = validas.map(r => ({ ...r }));

    if (semCoord.length > 0) {
      const toGeo = semCoord.slice(0, MAX_GEOCODE);
      const cidadeFallback = clienteAtivo?.nome?.replace(/prefeitura\s+(municipal\s+)?de\s+/i, '') ?? '';
      const ufFallback = (clienteAtivo as { uf?: string })?.uf ?? '';

      setFase('geocodificando');
      setProgressDone(0);
      setProgressTotal(toGeo.length);

      for (let i = 0; i < toGeo.length; i++) {
        const src = toGeo[i];
        const result = await geocodificarEndereco(
          src.logradouro, src.numero, src.bairro,
          src.cidade || cidadeFallback,
          src.uf || ufFallback,
        );
        const idx = mutableRows.findIndex(r => r.linha === src.linha);
        if (idx >= 0) {
          if (result) {
            mutableRows[idx].lat = result.lat;
            mutableRows[idx].lng = result.lng;
            mutableRows[idx].geoStatus = 'geocoded';
            geocodificados++;
          } else {
            mutableRows[idx].geoStatus = 'geo_falhou';
            geoFalhou++;
            linhasErro.push({ linha: src.linha, status: 'geo_falhou', mensagem: 'Geocodificação falhou — importado sem coordenadas' });
          }
        }
        setProgressDone(i + 1);
        await sleep(1100); // Nominatim: 1 req/s
      }

      if (semCoord.length > MAX_GEOCODE) {
        const extras = semCoord.length - MAX_GEOCODE;
        geoFalhou += extras;
        linhasErro.push({ linha: 0, status: 'geo_falhou', mensagem: `${extras} imóveis sem coordenadas excederam o limite de geocodificação (${MAX_GEOCODE}) e foram importados sem lat/lng` });
        semCoord.slice(MAX_GEOCODE).forEach(r => {
          const idx = mutableRows.findIndex(mr => mr.linha === r.linha);
          if (idx >= 0) mutableRows[idx].geoStatus = 'geo_falhou';
        });
      }
    }

    // ── Fase 2: Deduplicação ───────────────────────────────────────────────
    setFase('importando');
    setProgressDone(0);
    setProgressTotal(mutableRows.length);

    let chavesExistentes = new Set<string>();
    try {
      chavesExistentes = await api.imoveis.buscarChavesExistentes(clienteId);
    } catch { /* best-effort */ }

    const paraImportar: typeof mutableRows = [];
    let duplicados = 0;

    for (const r of mutableRows) {
      const chave = `${r.logradouro.toLowerCase().trim()}|${r.numero.toLowerCase().trim()}|${r.bairro.toLowerCase().trim()}`;
      if (chavesExistentes.has(chave)) {
        duplicados++;
        linhasErro.push({ linha: r.linha, status: 'duplicado', mensagem: `${r.logradouro}, ${r.numero} — ${r.bairro} já existe no sistema` });
      } else {
        paraImportar.push(r);
      }
    }

    // ── Fase 3: Insert ────────────────────────────────────────────────────
    let logId: string | null = null;
    try {
      logId = await api.importLog.criar({
        clienteId, criadoPor: usuario?.id, filename, totalLinhas: rows.length,
      });
    } catch { /* best-effort */ }

    const registros = paraImportar.map(r => ({
      cliente_id:  clienteId,
      logradouro:  r.logradouro,
      numero:      r.numero,
      complemento: r.complemento || null,
      bairro:      r.bairro,
      quarteirao:  r.quarteirao || null,
      latitude:    r.lat ?? null,
      longitude:   r.lng ?? null,
      tipo_imovel: r.tipo,
      ativo:       true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any));

    const { importados, falhas } = await api.imoveis.batchCreate(
      clienteId, registros, (done) => setProgressDone(done),
    );

    if (falhas > 0) {
      linhasErro.push({ linha: 0, status: 'erro', mensagem: `${falhas} registro(s) falharam no banco de dados` });
    }

    const resultado: ImportStats = {
      totalLidos:     rows.length,
      validos:        validas.length,
      importados,
      duplicados,
      geocodificados,
      geoFalhou,
      comErro:        invalidas.length + falhas,
      linhasErro,
    };
    setStats(resultado);

    if (logId) {
      api.importLog.finalizar(logId, {
        importados,
        comErro:        resultado.comErro,
        ignorados:      invalidas.length,
        erros:          linhasErro,
        status:         falhas === 0 ? 'concluido' : 'falhou',
        duplicados,
        geocodificados,
        geoFalhou,
      }).catch(() => {});
    }

    setStep('done');
  }

  function reiniciar() {
    setStep('upload'); setRows([]); setFilename('');
    setParseError(''); setProgressDone(0); setProgressTotal(0);
  }

  // ── Derivados ─────────────────────────────────────────────────────────────

  const validas   = rows.filter(r => r.valido);
  const invalidas = rows.filter(r => !r.valido);
  const semCoord  = validas.filter(r => r.geoStatus === 'sem_coord');
  const pct = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Importar Imóveis</h1>
          <p className="text-sm text-muted-foreground">
            CSV ou XLSX · geocodificação automática · deduplicação inteligente
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {(['upload', 'preview', 'importing', 'done'] as ImportStep[]).map((s, i) => {
          const labels = ['Upload', 'Validação', 'Importando', 'Concluído'];
          const done = (['upload', 'preview', 'importing', 'done'] as ImportStep[]).indexOf(step) > i;
          const active = step === s;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={cn('h-px w-8', done || active ? 'bg-primary' : 'bg-muted')} />}
              <span className={cn('px-2 py-1 rounded-full',
                active ? 'bg-primary text-primary-foreground' :
                done   ? 'bg-primary/20 text-primary' :
                         'bg-muted text-muted-foreground',
              )}>
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── STEP 1: Upload ───────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="space-y-5">

          {/* Zona de drop */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-semibold text-foreground">Arraste o arquivo aqui</p>
            <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
            <div className="flex justify-center gap-2 mt-3">
              <Badge variant="secondary" className="font-mono">.csv</Badge>
              <Badge variant="secondary" className="font-mono">.xlsx</Badge>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          {/* Instruções */}
          <div className="bg-muted/40 rounded-xl p-5 space-y-4">
            <p className="text-sm font-bold">Colunas obrigatórias</p>
            <div className="flex flex-wrap gap-1.5">
              {['logradouro', 'numero', 'bairro'].map(c => (
                <Badge key={c} variant="default" className="font-mono text-xs">{c}</Badge>
              ))}
            </div>

            <p className="text-sm font-bold">Colunas opcionais</p>
            <div className="flex flex-wrap gap-1.5">
              {['complemento', 'quarteirao', 'latitude', 'longitude', 'tipo_imovel', 'cep', 'cidade', 'uf', 'referencia'].map(c => (
                <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
              ))}
            </div>

            <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/60">
              <p><strong>tipo_imovel:</strong> residencial · comercial · terreno · ponto_estrategico (padrão: residencial)</p>
              <p><strong>latitude / longitude:</strong> opcionais — sem elas, geocodificação automática via OpenStreetMap</p>
              <p><strong>cidade / uf:</strong> ajudam a geocodificar endereços sem coordenadas</p>
              <p><strong>Nomes aceitos:</strong> rua, endereço, av → logradouro · num, nro → numero · quadra, lote → quarteirao</p>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Imóveis já cadastrados (mesmo logradouro + número + bairro) serão detectados automaticamente e não serão duplicados.
              </p>
            </div>
          </div>

          {/* Modelos */}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={downloadModeloCSV}>
              <Download className="h-4 w-4" />
              Baixar modelo CSV
            </Button>
            <Button variant="outline" className="gap-2" onClick={downloadModeloXLSX}>
              <Download className="h-4 w-4" />
              Baixar modelo XLSX
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Preview + Validação ──────────────────────────────────── */}
      {step === 'preview' && (
        <div className="space-y-4">

          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/40 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold">{rows.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total lido</p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{validas.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Válidas</p>
            </div>
            <div className={cn('rounded-xl p-4 text-center', invalidas.length > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/40')}>
              <p className={cn('text-2xl font-bold', invalidas.length > 0 ? 'text-red-600' : 'text-muted-foreground')}>{invalidas.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Com erro</p>
            </div>
            <div className={cn('rounded-xl p-4 text-center', semCoord.length > 0 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/40')}>
              <p className={cn('text-2xl font-bold', semCoord.length > 0 ? 'text-amber-600' : 'text-muted-foreground')}>{semCoord.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Sem coordenadas</p>
            </div>
          </div>

          {/* Aviso geocodificação */}
          {semCoord.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
              <MapPin className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>{Math.min(semCoord.length, MAX_GEOCODE)}</strong> imóveis sem coordenadas serão geocodificados automaticamente via OpenStreetMap
                {semCoord.length > MAX_GEOCODE && ` (limite: ${MAX_GEOCODE} — os demais ${semCoord.length - MAX_GEOCODE} serão importados sem lat/lng)`}.
                Esse processo pode levar ~{Math.ceil(Math.min(semCoord.length, MAX_GEOCODE) * 1.2 / 60)} minuto(s).
              </p>
            </div>
          )}

          {/* Preview */}
          <div>
            <p className="text-sm font-semibold mb-2">Prévia (primeiras 10 linhas)</p>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    {['#', 'Logradouro', 'Nº', 'Bairro', 'Tipo', 'Coords', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map(r => (
                    <tr key={r.linha} className={cn('border-t', !r.valido && 'bg-red-50 dark:bg-red-950/20')}>
                      <td className="px-3 py-2 text-muted-foreground">{r.linha}</td>
                      <td className="px-3 py-2 max-w-[120px] truncate">{r.logradouro || <span className="text-destructive">—</span>}</td>
                      <td className="px-3 py-2">{r.numero || <span className="text-destructive">—</span>}</td>
                      <td className="px-3 py-2 max-w-[100px] truncate">{r.bairro || <span className="text-destructive">—</span>}</td>
                      <td className="px-3 py-2">{r.tipo}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {r.lat !== null && r.lng !== null
                          ? <span className="text-green-700 dark:text-green-400">{r.lat.toFixed(3)}, {r.lng.toFixed(3)}</span>
                          : <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><MapPin className="h-3 w-3" />geocodificar</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.valido
                          ? r.avisos.length > 0
                            ? <span className="flex items-center gap-1 text-amber-600"><Info className="h-3.5 w-3.5 shrink-0" />{r.avisos[0]}</span>
                            : <CheckCircle2 className="h-4 w-4 text-green-600" />
                          : <span className="flex items-start gap-1 text-destructive"><XCircle className="h-4 w-4 shrink-0 mt-0.5" />{r.erros.join(' · ')}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && (
                <p className="px-3 py-2 text-xs text-muted-foreground border-t">
                  +{rows.length - 10} linhas não exibidas
                </p>
              )}
            </div>
          </div>

          {/* Erros */}
          {invalidas.length > 0 && (
            <div className="rounded-lg border border-destructive/30 overflow-hidden">
              <div className="bg-destructive/10 px-4 py-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">
                  {invalidas.length} linha(s) com erro — serão ignoradas
                </span>
              </div>
              <div className="divide-y max-h-40 overflow-y-auto">
                {invalidas.slice(0, 50).map(r => (
                  <div key={r.linha} className="px-4 py-2 text-xs">
                    <span className="font-mono font-semibold">Linha {r.linha}:</span>{' '}
                    {r.erros.join(' · ')}
                  </div>
                ))}
                {invalidas.length > 50 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground">+{invalidas.length - 50} mais…</div>
                )}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={reiniciar} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Trocar arquivo
            </Button>
            <Button onClick={executarImportacao} disabled={validas.length === 0} className="gap-2">
              <Upload className="h-4 w-4" />
              Importar {validas.length} imóvel(is) válido(s)
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Importando ────────────────────────────────────────────── */}
      {step === 'importing' && (
        <div className="space-y-6 text-center py-10">
          <RefreshCw className="h-12 w-12 mx-auto text-primary animate-spin" />
          <div>
            <p className="font-semibold text-lg">
              {fase === 'geocodificando' ? 'Geocodificando endereços…' : 'Importando imóveis…'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {fase === 'geocodificando'
                ? `${progressDone} de ${progressTotal} endereços processados`
                : `${progressDone} de ${progressTotal} registros`}
            </p>
          </div>
          <div className="max-w-sm mx-auto space-y-2">
            <Progress value={pct} className="h-3" />
            <p className="text-xs text-muted-foreground">{pct}%</p>
          </div>
          {fase === 'geocodificando' && (
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              A geocodificação usa OpenStreetMap (1 req/s). Não feche esta página.
            </p>
          )}
        </div>
      )}

      {/* ── STEP 4: Concluído ─────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="space-y-6">
          <div className="text-center py-4">
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-500 mb-3" />
            <h2 className="text-xl font-bold">Importação concluída</h2>
          </div>

          {/* 7 métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total lido',       value: stats.totalLidos,     color: 'bg-muted/40' },
              { label: 'Importados',        value: stats.importados,     color: 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300' },
              { label: 'Duplicados',        value: stats.duplicados,     color: 'bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300' },
              { label: 'Geocodificados',    value: stats.geocodificados, color: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300' },
              { label: 'Geo falhou',        value: stats.geoFalhou,      color: stats.geoFalhou > 0 ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300' : 'bg-muted/40' },
              { label: 'Com erro',          value: stats.comErro,        color: stats.comErro > 0 ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300' : 'bg-muted/40' },
              { label: 'Válidos no arquivo',value: stats.validos,        color: 'bg-muted/40' },
            ].map(({ label, value, color }) => (
              <div key={label} className={cn('rounded-xl p-4 text-center', color)}>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Log de erros / avisos */}
          {stats.linhasErro.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted px-4 py-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Detalhes ({stats.linhasErro.length} ocorrências)</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => downloadRelatorioCSV(stats)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar CSV
                </Button>
              </div>
              <div className="divide-y max-h-48 overflow-y-auto">
                {stats.linhasErro.slice(0, 100).map((e, i) => (
                  <div key={i} className="px-4 py-2 text-xs flex items-start gap-2">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] shrink-0',
                        e.status === 'erro'      ? 'border-red-300 text-red-600' :
                        e.status === 'duplicado' ? 'border-sky-300 text-sky-600' :
                                                   'border-amber-300 text-amber-600',
                      )}
                    >
                      {e.status}
                    </Badge>
                    {e.linha > 0 && <span className="font-mono font-semibold shrink-0">Linha {e.linha}:</span>}
                    <span>{e.mensagem}</span>
                  </div>
                ))}
                {stats.linhasErro.length > 100 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground">+{stats.linhasErro.length - 100} mais no relatório CSV…</div>
                )}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={reiniciar} className="gap-2">
              <Copy className="h-4 w-4" /> Importar outro arquivo
            </Button>
            <Button asChild className="gap-2">
              <Link to="/admin/imoveis">
                <ExternalLink className="h-4 w-4" /> Ver imóveis cadastrados
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
