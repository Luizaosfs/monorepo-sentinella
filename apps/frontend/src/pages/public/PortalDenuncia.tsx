import { useState, useRef, useEffect, useCallback } from 'react';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Link } from 'react-router-dom';
import { http } from '@sentinella/api-client';
import { api } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import {
  MapPin, Send, CheckCircle2, Loader2, AlertTriangle,
  Camera, X, Search, Map as MapIcon, Building2, ChevronRight,
  Megaphone, Shield, Navigation,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';
import { extractErrorMessage, uploadDenunciaFoto } from '@/lib/canalCidadaoUtils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Coords { latitude: number; longitude: number }

interface ClienteResolvido {
  cliente_id: string;
  cliente_nome: string;
  cidade: string;
  uf: string;
  slug: string;
  metodo: string;
}

type Etapa = 'localizando' | 'confirmando' | 'formulario' | 'sucesso' | 'nao_encontrado';

// ── Step indicator ─────────────────────────────────────────────────────────────

const STEPS = ['Localização', 'Confirmação', 'Denúncia'] as const;

function StepBar({ current }: { current: 0 | 1 | 2 }) {
  return (
    <div className="flex items-center gap-0 w-full max-w-xs mx-auto">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300',
                  done && 'bg-emerald-500 text-white',
                  active && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                  !done && !active && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn('text-[10px] font-medium leading-none whitespace-nowrap',
                active ? 'text-primary' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px flex-1 mx-1 mb-4 transition-colors duration-300',
                i < current ? 'bg-emerald-400' : 'bg-border'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────

function Header({ step }: { step?: 0 | 1 | 2 }) {
  return (
    <header className="gradient-login-panel px-4 pb-5 pt-4 shadow-lg">
      <div className="flex items-center justify-center mb-4">
        <Logo className="text-xl text-white" showIcon={false} />
      </div>
      {step !== undefined && <StepBar current={step} />}
    </header>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

const PortalDenuncia: React.FC = () => {
  const [etapa, setEtapa] = useState<Etapa>('localizando');

  // Localização
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const mapPickerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Resolução do cliente
  const [clienteResolvido, setClienteResolvido] = useState<ClienteResolvido | null>(null);
  const [resolvendoCliente, setResolvendoCliente] = useState(false);
  const [buscarManual, setBuscarManual] = useState('');

  // Formulário
  const [descricao, setDescricao] = useState('');
  const [endereco, setEndereco] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [jaExistia] = useState(false);
  const [fotoFoiPerdida, setFotoFoiPerdida] = useState(false);

  // ── Geolocalização ────────────────────────────────────────────────────────

  const requestGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocalização não suportada neste dispositivo.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    // enableHighAccuracy:false reduz dependência do “network location” do Chrome (googleapis 403 em algumas redes/VPNs).
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => {
        setGeoError('Não foi possível obter sua localização. Use o mapa ou informe a cidade manualmente.');
        setGeoLoading(false);
      },
      { timeout: 20000, enableHighAccuracy: false, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => { requestGeolocate(); }, [requestGeolocate]);

  // ── Mapa picker ──────────────────────────────────────────────────────────

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setCoords({ latitude: lat, longitude: lng });
    setGeoError(null);
    setShowMapPicker(false);
  }, []);

  useEffect(() => {
    if (!showMapPicker || !mapPickerRef.current || mapInstanceRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2x,
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });
    const map = L.map(mapPickerRef.current, { zoomControl: true }).setView([-15.78, -47.93], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else markerRef.current = L.marker([lat, lng]).addTo(map);
      handleMapClick(lat, lng);
    });
    mapInstanceRef.current = map;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [showMapPicker, handleMapClick]);

  // ── Resolver cliente ──────────────────────────────────────────────────────

  const resolverCliente = useCallback(async (lat: number, lng: number) => {
    setResolvendoCliente(true);
    try {
      const resultado = await api.clientes.resolverPorCoordenadaPublico(lat, lng);
      if (resultado) {
        setClienteResolvido({
          cliente_id: resultado.id,
          cliente_nome: resultado.nome,
          cidade: resultado.cidade,
          uf: resultado.uf,
          slug: resultado.slug,
          metodo: resultado.metodo,
        });
        setEtapa('confirmando');
      } else setEtapa('nao_encontrado');
    } catch { setEtapa('nao_encontrado'); }
    finally { setResolvendoCliente(false); }
  }, []);

  const handleConfirmarLocalizacao = async () => {
    if (coords) await resolverCliente(coords.latitude, coords.longitude);
  };

  // ── Busca manual ──────────────────────────────────────────────────────────

  const handleBuscarCidadeManual = async () => {
    if (!buscarManual.trim()) return;
    setResolvendoCliente(true);
    try {
      const data = await http.get<{ id: string; nome: string; cidade?: string; uf?: string; slug?: string } | null>(
        `/clientes/por-cidade?cidade=${encodeURIComponent(buscarManual.trim())}`
      );
      if (data) {
        setClienteResolvido({
          cliente_id: data.id,
          cliente_nome: data.nome,
          cidade: data.cidade ?? data.nome,
          uf: data.uf ?? '',
          slug: data.slug ?? '',
          metodo: 'manual',
        });
        setEtapa('confirmando');
      } else setEtapa('nao_encontrado');
    } catch { setEtapa('nao_encontrado'); }
    finally { setResolvendoCliente(false); }
  };

  // ── Foto ──────────────────────────────────────────────────────────────────

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleRemoveFoto = () => {
    setFoto(null);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    if (fotoInputRef.current) fotoInputRef.current.value = '';
  };

  const uploadFoto = async (): Promise<{ url: string; public_id: string } | null> => {
    if (!foto) return null;
    setFotoUploading(true);
    try {
      return await uploadDenunciaFoto(foto);
    } finally {
      setFotoUploading(false);
    }
  };

  // ── Envio ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteResolvido || !descricao.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fotoResult = await uploadFoto();

      const result = await http.post<{ protocolo: string; id: string }>('/denuncias/cidadao', {
        slug: clienteResolvido.slug,
        bairroId: null,
        descricao: endereco.trim()
          ? `${descricao.trim()} — Endereço: ${endereco.trim()}`
          : descricao.trim(),
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        fotoUrl: fotoResult?.url ?? null,
        fotoPublicId: fotoResult?.public_id ?? null,
      });
      if (foto && !fotoResult) setFotoFoiPerdida(true);
      setProtocolo(result.protocolo?.toUpperCase() ?? 'N/A');
      setEtapa('sucesso');
    } catch (err) { setSubmitError(extractErrorMessage(err)); }
    finally { setSubmitting(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // TELA 1 — Localização
  // ─────────────────────────────────────────────────────────────────────────
  if (etapa === 'localizando') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header step={0} />

        <div className="flex-1 flex flex-col items-center p-4 pt-8 pb-10">
          <div className="w-full max-w-sm space-y-6">

            {/* Hero text */}
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center justify-center shadow-sm">
                  <Megaphone className="w-8 h-8 text-amber-500" />
                </div>
              </div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Canal do Cidadão</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Denuncie focos de dengue de forma rápida e anônima. A equipe municipal irá agir.
              </p>
            </div>

            {/* Trust pills */}
            <div className="flex justify-center gap-2 flex-wrap">
              {[
                { icon: Shield, label: 'Anônimo' },
                { icon: CheckCircle2, label: 'Gratuito' },
                { icon: Navigation, label: 'Geolocalizado' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                  <Icon className="w-3 h-3" />{label}
                </span>
              ))}
            </div>

            {/* GPS status */}
            <div className="space-y-3">
              {geoLoading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Obtendo localização...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Aguarde alguns segundos</p>
                  </div>
                </div>
              ) : coords ? (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Localização capturada</p>
                      <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-mono mt-0.5">
                        {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                      </p>
                    </div>
                    <button type="button" onClick={() => setCoords(null)} className="text-emerald-500 hover:text-emerald-700 transition-colors shrink-0 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : geoError ? (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{geoError}</p>
                  </div>
                </div>
              ) : null}

              {/* Botão continuar (com GPS) */}
              {coords && (
                <Button
                  className="w-full h-12 font-bold rounded-2xl text-sm"
                  onClick={handleConfirmarLocalizacao}
                  disabled={resolvendoCliente}
                >
                  {resolvendoCliente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Identificando cidade...</>
                    : <><ChevronRight className="w-4 h-4 mr-2" />Continuar</>}
                </Button>
              )}

              {/* Botão tentar novamente */}
              {!geoLoading && !coords && (
                <Button variant="outline" className="w-full h-11 rounded-2xl font-semibold text-sm" onClick={requestGeolocate}>
                  <Navigation className="w-4 h-4 mr-2" />Usar minha localização
                </Button>
              )}
            </div>

            {/* Divisor */}
            {!geoLoading && (
              <>
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-border/50" />
                  <span className="mx-3 text-xs text-muted-foreground font-medium">ou</span>
                  <div className="flex-grow border-t border-border/50" />
                </div>

                {/* Mapa picker */}
                <div className="space-y-2">
                  <Button
                    type="button" variant="outline"
                    className="w-full h-10 rounded-xl text-sm gap-2 font-medium"
                    onClick={() => setShowMapPicker((v) => !v)}
                  >
                    <MapIcon className="w-4 h-4" />
                    {showMapPicker ? 'Fechar mapa' : 'Marcar no mapa'}
                  </Button>
                  {showMapPicker && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground text-center">Toque no mapa para marcar sua localização</p>
                      <div ref={mapPickerRef} className="w-full h-52 rounded-xl overflow-hidden border border-border shadow-sm" />
                    </div>
                  )}
                </div>

                {/* Busca por cidade */}
                <div className="space-y-2">
                  <Label htmlFor="buscar-cidade" className="text-xs font-medium text-muted-foreground">
                    Ou informe o nome da sua cidade
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="buscar-cidade"
                      placeholder="Ex: Três Lagoas"
                      value={buscarManual}
                      onChange={(e) => setBuscarManual(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBuscarCidadeManual()}
                      className="h-11 rounded-xl"
                    />
                    <Button
                      type="button" variant="outline" size="icon"
                      className="h-11 w-11 rounded-xl shrink-0"
                      onClick={handleBuscarCidadeManual}
                      disabled={resolvendoCliente || !buscarManual.trim()}
                    >
                      {resolvendoCliente
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed pt-2">
              Sua identidade não é registrada. Informações usadas exclusivamente para ações de saúde pública.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TELA 2 — Confirmação da cidade
  // ─────────────────────────────────────────────────────────────────────────
  if (etapa === 'confirmando' && clienteResolvido) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header step={1} />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-6">

            <Card className="border-border/60 shadow-sm overflow-hidden">
              <div className="gradient-login-panel px-6 py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <p className="text-white/70 text-sm mb-1">Identificamos que você está em</p>
                <p className="text-3xl font-extrabold text-white tracking-tight">{clienteResolvido.cidade}</p>
                <p className="text-white/60 text-sm font-medium mt-1">{clienteResolvido.uf} · Brasil</p>
              </div>
              <CardContent className="p-5 space-y-3">
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  Sua denúncia será registrada para a prefeitura de{' '}
                  <strong className="text-foreground">{clienteResolvido.cidade}</strong>. Está correto?
                </p>
                <Button className="w-full h-12 font-bold rounded-xl" onClick={() => setEtapa('formulario')}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />Sim, é minha cidade
                </Button>
                <Button
                  variant="ghost" className="w-full h-10 rounded-xl text-muted-foreground text-sm"
                  onClick={() => { setClienteResolvido(null); setCoords(null); setBuscarManual(''); setEtapa('localizando'); }}
                >
                  Não, corrigir localização
                </Button>
              </CardContent>
            </Card>

            {clienteResolvido.metodo === 'centroide' && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                Identificado pelo centro do município — verifique se está correto.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TELA 3 — Formulário de denúncia
  // ─────────────────────────────────────────────────────────────────────────
  if (etapa === 'formulario') {
    const isSending = submitting || fotoUploading;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header step={2} />
        <div className="flex-1 flex flex-col items-center p-4 pt-6 pb-10">
          <div className="w-full max-w-sm space-y-5">

            {/* Cidade confirmada */}
            {clienteResolvido && (
              <button
                type="button"
                onClick={() => { setClienteResolvido(null); setCoords(null); setEtapa('localizando'); }}
                className="w-full flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5 hover:bg-primary/10 transition-colors group"
              >
                <Building2 className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm font-semibold text-primary flex-1 text-left">
                  {clienteResolvido.cidade} — {clienteResolvido.uf}
                </p>
                <X className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
              </button>
            )}

            <div className="text-center space-y-1">
              <h1 className="text-xl font-black text-foreground">Encontrou água parada?</h1>
              <p className="text-xs text-muted-foreground">Preencha as informações abaixo. Quanto mais detalhes, melhor.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* 1. Foto */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">1</span>
                  Foto do local
                  <span className="text-muted-foreground/60 font-normal normal-case ml-1">(recomendado)</span>
                </p>
                {fotoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-border/60">
                    <img src={fotoPreview} alt="Prévia" className="w-full h-44 object-cover" />
                    <button
                      type="button" onClick={handleRemoveFoto}
                      className="absolute top-2 right-2 rounded-full bg-background/90 p-1.5 hover:bg-background shadow-sm transition-colors"
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                    <div className="absolute bottom-2 left-2 rounded-full bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 flex items-center gap-1 shadow">
                      <CheckCircle2 className="w-3 h-3" />Foto adicionada
                    </div>
                  </div>
                ) : (
                  <button
                    type="button" onClick={() => fotoInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-7 text-primary hover:border-primary/60 hover:bg-primary/10 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold">Tirar foto agora</p>
                      <p className="text-xs text-muted-foreground mt-0.5">ou escolher da galeria</p>
                    </div>
                  </button>
                )}
                <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFotoChange} />
              </div>

              {/* 2. Endereço */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">2</span>
                  Endereço aproximado
                  {coords && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-normal normal-case">
                      <MapPin className="w-3 h-3" />GPS ativo
                    </span>
                  )}
                </p>
                <Input
                  placeholder="Ex: Rua das Flores, 123 — próximo à escola"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* 3. Descrição */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">3</span>
                  O que você viu?<span className="text-destructive ml-0.5">*</span>
                </p>
                <Textarea
                  placeholder="Ex: piscina abandonada com água parada, caixa d'água sem tampa, lote com entulho..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value.slice(0, 500))}
                  rows={4}
                  required
                  className="resize-none rounded-xl"
                />
                <p className={cn('text-right text-[10px]', descricao.length >= 450 ? 'text-amber-500' : 'text-muted-foreground')}>
                  {descricao.length}/500
                </p>
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{submitError}</span>
                </div>
              )}

              <Button type="submit" disabled={isSending || !descricao.trim()} className="w-full h-14 text-base font-bold rounded-2xl shadow-lg shadow-primary/20">
                {isSending
                  ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{fotoUploading ? 'Enviando foto...' : 'Registrando denúncia...'}</>
                  : <><Send className="w-5 h-5 mr-2" />Enviar denúncia</>}
              </Button>
            </form>

            <Link to="/denuncia/consultar" className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors pt-1">
              <Search className="w-3 h-3" />Consultar protocolo existente
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TELA — Não encontrado
  // ─────────────────────────────────────────────────────────────────────────
  if (etapa === 'nao_encontrado') {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-foreground">Cidade não encontrada</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sua cidade ainda não faz parte do programa Sentinella ou não foi possível identificá-la automaticamente.
              </p>
            </div>
            <div className="space-y-3">
              <Button className="w-full h-12 rounded-2xl font-bold" onClick={() => { setCoords(null); setBuscarManual(''); setEtapa('localizando'); }}>
                Tentar novamente
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se sua cidade deveria estar no programa, entre em contato com a prefeitura local.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TELA — Sucesso
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">
            {jaExistia ? 'Denúncia já registrada!' : 'Denúncia registrada!'}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {jaExistia
              ? 'Já existe uma denúncia recente para este local. Seu relato foi contabilizado.'
              : 'Obrigado! A equipe municipal irá analisar o local informado.'}
          </p>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6 text-center space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Protocolo</p>
            <p className="text-4xl font-extrabold text-primary tracking-[0.2em]">{protocolo}</p>
            <p className="text-xs text-muted-foreground">Guarde este número para acompanhar sua denúncia</p>
          </CardContent>
        </Card>

        {fotoFoiPerdida && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Sua denúncia foi registrada, mas a foto não pôde ser enviada.</span>
          </div>
        )}

        <Link
          to="/denuncia/consultar"
          className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline font-medium"
        >
          <Search className="w-4 h-4" />Acompanhar minha denúncia
        </Link>

        <button
          type="button"
          onClick={() => { setEtapa('localizando'); setDescricao(''); setEndereco(''); setFoto(null); setFotoPreview(null); setProtocolo(null); setCoords(null); setFotoFoiPerdida(false); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Registrar outra denúncia
        </button>
      </div>
    </div>
  );
};

export default PortalDenuncia;
