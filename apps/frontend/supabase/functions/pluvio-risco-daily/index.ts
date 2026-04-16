// supabase/functions/pluvio-risco-daily/index.ts
// Job diário que alimenta pluvio_risco usando Open-Meteo (gratuito, sem API key)

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_ORIGIN") ?? "https://app.sentinella.com.br",
  "https://sentinellamap.com.br",
  "https://app.sentinella.com.br",
  "http://localhost:8080",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// ── helpers ──────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Soma os últimos `n` valores de um array (mais recente = último). */
function sumLast(arr: number[], n: number): number {
  const slice = arr.slice(-n);
  return Math.round(slice.reduce((a, b) => a + b, 0) * 1000) / 1000;
}

/** Dias desde a última chuva > threshold (0 = hoje choveu, null = nunca). */
function diasPosChuva(daily: number[], threshold: number): number | null {
  // daily está em ordem cronológica, último = dt_ref
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i] > threshold) return daily.length - 1 - i;
  }
  return null;
}

/** Quantidade de dias com chuva > threshold nos últimos 7. */
function persistencia7d(daily: number[], threshold: number): number {
  return daily.slice(-7).filter((v) => v > threshold).length;
}

/** Tendência simples: compara média da 1ª metade vs 2ª metade dos últimos N dias. */
function tendencia(daily: number[], days: number): string {
  const slice = daily.slice(-days);
  if (slice.length < 4) return "estavel";
  const mid = Math.floor(slice.length / 2);
  const avg1 = slice.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const avg2 = slice.slice(mid).reduce((a, b) => a + b, 0) / (slice.length - mid);
  const diff = avg2 - avg1;
  if (diff > 1) return "crescente";
  if (diff < -1) return "decrescente";
  return "estavel";
}

/** Retorna label do bin de janela sem chuva. */
function janelaSemChuvaLabel(
  dias: number | null,
  bins: number[][]
): string | null {
  if (dias === null) return null;
  for (const [min, max] of bins) {
    if (dias >= min && dias <= max) return `${min}-${max} dias`;
  }
  return `${dias} dias`;
}

// ── Open-Meteo fetch ────────────────────────────────────────────────

interface DailyWeather {
  precipitation: number[]; // mm per day (chronological)
  temp_mean: number[];
  wind_max: number[];
  dates: string[];
}

async function fetchOpenMeteo(
  lat: number,
  lon: number,
  endDate: string,
  pastDays: number,
  forecastDays: number = 3
): Promise<DailyWeather> {
  const startDt = new Date(endDate);
  startDt.setDate(startDt.getDate() - pastDays + 1);
  const startDate = fmtDate(startDt);

  // Extend end date to include forecast days
  const forecastEnd = new Date(endDate);
  forecastEnd.setDate(forecastEnd.getDate() + forecastDays);
  const forecastEndDate = fmtDate(forecastEnd);

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_sum,temperature_2m_mean,wind_speed_10m_max` +
    `&start_date=${startDate}&end_date=${forecastEndDate}` +
    `&timezone=America%2FCampo_Grande`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Open-Meteo ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const d = data.daily || {};

  return {
    precipitation: (d.precipitation_sum || []).map((v: number | null) => v ?? 0),
    temp_mean: (d.temperature_2m_mean || []).map((v: number | null) => v ?? null),
    wind_max: (d.wind_speed_10m_max || []).map((v: number | null) => v ?? null),
    dates: d.time || [],
  };
}

// ── Risk classification (matches Python classify_bairro) ────────────

interface RiskPolicy {
  defaults: { chuva_relevante_mm: number; dias_lookup_max: number; tendencia_dias: number };
  bins_sem_chuva: number[][];
  rules: RiskRule[];
  fallback: RiskRule;
  temp_factors: { temp_min: number; temp_max: number; factor: number }[];
  vento_factors: { vento_min: number; vento_max: number; factor: number }[];
  temp_adjust: { temp_min: number; temp_max: number; delta_pp: number }[];
  vento_adjust: { vento_min: number; vento_max: number; delta_pp: number }[];
  persistencia_adjust: { dias_min: number; dias_max: number; delta_pp: number }[];
  tendencia_adjust: { tendencia: string; delta_pp: number }[];
}

interface RiskRule {
  chuva_mm_min: number;
  chuva_mm_max: number;
  dias_min: number;
  dias_max: number;
  situacao_ambiental: string;
  probabilidade_label: string;
  probabilidade_pct_min: number;
  probabilidade_pct_max: number;
  classificacao: string;
  icone: string;
  severity: number;
}

function classifyRegion(
  mm24h: number,
  diasPos: number | null,
  tempC: number | null,
  ventoKmh: number | null,
  persist7d: number,
  tend: string,
  policy: RiskPolicy
) {
  const d = diasPos ?? 0;

  // Find matching rule
  let rule = policy.fallback;
  for (const r of policy.rules) {
    if (mm24h >= r.chuva_mm_min && mm24h < r.chuva_mm_max && d >= r.dias_min && d <= r.dias_max) {
      rule = r;
      break;
    }
  }

  const probMin = rule.probabilidade_pct_min;
  const probMax = rule.probabilidade_pct_max;

  // Apply PP adjustments
  let deltaPP = 0;

  if (tempC !== null) {
    for (const a of policy.temp_adjust) {
      if (tempC >= a.temp_min && tempC <= a.temp_max) { deltaPP += a.delta_pp; break; }
    }
  }
  if (ventoKmh !== null) {
    for (const a of policy.vento_adjust) {
      if (ventoKmh >= a.vento_min && ventoKmh <= a.vento_max) { deltaPP += a.delta_pp; break; }
    }
  }
  for (const a of policy.persistencia_adjust) {
    if (persist7d >= a.dias_min && persist7d <= a.dias_max) { deltaPP += a.delta_pp; break; }
  }
  for (const a of policy.tendencia_adjust) {
    if (a.tendencia === tend) { deltaPP += a.delta_pp; break; }
  }

  const finalMin = Math.max(0, Math.min(100, probMin + deltaPP));
  const finalMax = Math.max(0, Math.min(100, probMax + deltaPP));

  // Reclassify based on final probability
  let classificacaoFinal = rule.classificacao;
  const avgFinal = (finalMin + finalMax) / 2;
  if (avgFinal >= 80) classificacaoFinal = "Crítico";
  else if (avgFinal >= 65) classificacaoFinal = "Muito Alto";
  else if (avgFinal >= 45) classificacaoFinal = "Alto";
  else if (avgFinal >= 25) classificacaoFinal = "Moderado";
  else classificacaoFinal = "Baixo";

  return {
    situacao_ambiental: rule.situacao_ambiental,
    prob_label: rule.probabilidade_label,
    prob_base_min: probMin,
    prob_base_max: probMax,
    prob_final_min: Math.round(finalMin * 100) / 100,
    prob_final_max: Math.round(finalMax * 100) / 100,
    classificacao_final: classificacaoFinal,
  };
}

// ── Load policy from DB ─────────────────────────────────────────────

async function loadPolicy(
  sb: SupabaseClient,
  clienteId: string
): Promise<RiskPolicy | null> {
  const { data: pol } = await sb
    .from("sentinela_risk_policy")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!pol) return null;
  const pid = pol.id;

  const [
    { data: defs },
    { data: rules },
    { data: fallback },
    { data: binsSC },
    { data: tempAdj },
    { data: ventoAdj },
    { data: persAdj },
    { data: tendAdj },
    { data: tempFact },
    { data: ventoFact },
  ] = await Promise.all([
    sb.from("sentinela_risk_defaults").select("*").eq("policy_id", pid).limit(1).single(),
    sb.from("sentinela_risk_rule").select("*").eq("policy_id", pid).order("idx"),
    sb.from("sentinela_risk_fallback_rule").select("*").eq("policy_id", pid).limit(1).single(),
    sb.from("sentinela_risk_bin_sem_chuva").select("*").eq("policy_id", pid).order("idx"),
    sb.from("sentinela_risk_temp_adjust_pp").select("*").eq("policy_id", pid).order("idx"),
    sb.from("sentinela_risk_vento_adjust_pp").select("*").eq("policy_id", pid).order("idx"),
    sb.from("sentinela_risk_persistencia_adjust_pp").select("*").eq("policy_id", pid).order("idx"),
    sb.from("sentinela_risk_tendencia_adjust_pp").select("*").eq("policy_id", pid),
    sb.from("sentinela_risk_temp_factor").select("*").eq("policy_id", pid).order("idx"),
    sb.from("sentinela_risk_vento_factor").select("*").eq("policy_id", pid).order("idx"),
  ]);

  interface RiskDefaultsRow {
    chuva_relevante_mm: number;
    dias_lookup_max: number;
    tendencia_dias: number;
  }
  const d: RiskDefaultsRow = (defs || { chuva_relevante_mm: 5, dias_lookup_max: 30, tendencia_dias: 7 }) as RiskDefaultsRow;
  const fb = (fallback || {
    chuva_mm_min: 0, chuva_mm_max: 999, dias_min: 0, dias_max: 999,
    situacao_ambiental: "Sem regra", probabilidade_label: "Media",
    probabilidade_pct_min: 40, probabilidade_pct_max: 60,
    classificacao: "Moderado", icone: "🟠", severity: 3,
  }) as unknown as RiskRule;

  return {
    defaults: {
      chuva_relevante_mm: d.chuva_relevante_mm as number,
      dias_lookup_max: d.dias_lookup_max as number,
      tendencia_dias: d.tendencia_dias as number,
    },
    bins_sem_chuva: (binsSC || []).map((b: { min_val: number; max_val: number }) => [b.min_val, b.max_val]),
    rules: (rules || []) as unknown as RiskRule[],
    fallback: fb,
    temp_factors: (tempFact || []) as RiskPolicy["temp_factors"],
    vento_factors: (ventoFact || []) as RiskPolicy["vento_factors"],
    temp_adjust: (tempAdj || []) as RiskPolicy["temp_adjust"],
    vento_adjust: (ventoAdj || []) as RiskPolicy["vento_adjust"],
    persistencia_adjust: (persAdj || []) as RiskPolicy["persistencia_adjust"],
    tendencia_adjust: (tendAdj || []) as RiskPolicy["tendencia_adjust"],
  };
}

// ── Main handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Aceita: (1) cron interno via x-cron-secret, (2) admin autenticado via JWT.
  const cronSecret = req.headers.get("x-cron-secret");
  const validCron = cronSecret === Deno.env.get("CRON_SECRET");

  if (!validCron) {
    // Tenta validar JWT de usuário admin
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const sbAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: { user }, error: authErr } = await sbAnon.auth.getUser(jwt);
    if (authErr || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    // Verifica papel via papeis_usuarios (usuarios.papel_app foi removida em 20261015000002)
    const sbSvc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: papelRow } = await sbSvc
      .from("papeis_usuarios")
      .select("papel")
      .eq("usuario_id", user.id)
      .maybeSingle();
    if (!["admin", "supervisor"].includes(papelRow?.papel ?? "")) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // D-1
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const dtRef = fmtDate(yesterday);

    // 1. Get all active clients
    const { data: clientes } = await sb
      .from("clientes")
      .select("id")
      .eq("ativo", true);

    if (!clientes || clientes.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: "Nenhum cliente ativo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalInserted = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const cliente of clientes) {
      try {
        // 2. Get regions with lat/lon
        const { data: regioes } = await sb
          .from("regioes")
          .select("id, regiao, latitude, longitude")
          .eq("cliente_id", cliente.id);

        if (!regioes || regioes.length === 0) continue;

        interface RegiaoRow {
          id: string;
          regiao?: string;
          latitude: number | null;
          longitude: number | null;
        }
        interface RegiaoWithCoords extends RegiaoRow {
          latitude: number;
          longitude: number;
        }
        const regioesWithCoords = (regioes as RegiaoRow[]).filter(
          (r): r is RegiaoWithCoords =>
            typeof r.latitude === "number" &&
            Number.isFinite(r.latitude) &&
            typeof r.longitude === "number" &&
            Number.isFinite(r.longitude)
        );
        if (regioesWithCoords.length === 0) continue;

        // 3. Load risk policy
        const policy = await loadPolicy(sb, cliente.id);
        if (!policy) {
          errors.push(`Cliente ${cliente.id}: sem policy ativa`);
          continue;
        }

        const pastDays = policy.defaults.dias_lookup_max;

        // 4. Check existing records for this dt_ref
        const regIds = regioesWithCoords.map((r) => r.id);
        const { data: existing } = await sb
          .from("pluvio_risco")
          .select("regiao_id")
          .eq("dt_ref", dtRef)
          .in("regiao_id", regIds);

        const existingSet = new Set(
          (existing || []).map((e: { regiao_id: string }) => e.regiao_id)
        );

        // 5. Fetch weather + classify for each region
        interface PluvioRiscoInsertRow {
          regiao_id: string;
          dt_ref: string;
          chuva_24h: number;
          chuva_72h: number;
          chuva_7d: number;
          dias_pos_chuva: number | null;
          janela_sem_chuva: string | null;
          persistencia_7d: number;
          tendencia: string;
          situacao_ambiental: string;
          prob_label: string;
          prob_base_min: number;
          prob_base_max: number;
          prob_final_min: number;
          prob_final_max: number;
          classificacao_final: string;
          temp_c: number | null;
          vento_kmh: number | null;
          temp_med_c: number | null;
          vento_med_kmh: number | null;
          prev_d1_mm: number | null;
          prev_d2_mm: number | null;
          prev_d3_mm: number | null;
        }
        const rows: PluvioRiscoInsertRow[] = [];

        for (const reg of regioesWithCoords) {
          if (existingSet.has(reg.id)) {
            totalSkipped++;
            continue;
          }

          try {
            // Small delay to respect Open-Meteo rate limits
            await new Promise((r) => setTimeout(r, 200));

            const weather = await fetchOpenMeteo(
              reg.latitude,
              reg.longitude,
              dtRef,
              pastDays,
              3
            );

            // Split historical (up to dtRef) and forecast (after dtRef)
            const dtRefIdx = weather.dates.indexOf(dtRef);
            const precip = dtRefIdx >= 0 ? weather.precipitation.slice(0, dtRefIdx + 1) : weather.precipitation;
            const forecastPrecip = dtRefIdx >= 0 ? weather.precipitation.slice(dtRefIdx + 1) : [];
            const threshold = policy.defaults.chuva_relevante_mm;

            const chuva24h = precip.length > 0 ? precip[precip.length - 1] : 0;
            const chuva72h = sumLast(precip, 3);
            const chuva7d = sumLast(precip, 7);
            const diasPos = diasPosChuva(precip, threshold);
            const persist = persistencia7d(precip, threshold);
            const tend = tendencia(precip, policy.defaults.tendencia_dias);

            // Temperature and wind for dt_ref (last value)
            const tempC =
              weather.temp_mean.length > 0
                ? weather.temp_mean[weather.temp_mean.length - 1]
                : null;
            const ventoKmh =
              weather.wind_max.length > 0
                ? weather.wind_max[weather.wind_max.length - 1]
                : null;

            const classif = classifyRegion(
              chuva24h,
              diasPos,
              tempC,
              ventoKmh,
              persist,
              tend,
              policy
            );

            rows.push({
              regiao_id: reg.id,
              dt_ref: dtRef,
              chuva_24h: chuva24h,
              chuva_72h: chuva72h,
              chuva_7d: chuva7d,
              dias_pos_chuva: diasPos,
              janela_sem_chuva: janelaSemChuvaLabel(
                diasPos,
                policy.bins_sem_chuva
              ),
              persistencia_7d: persist,
              tendencia: tend,
              situacao_ambiental: classif.situacao_ambiental,
              prob_label: classif.prob_label,
              prob_base_min: classif.prob_base_min,
              prob_base_max: classif.prob_base_max,
              prob_final_min: classif.prob_final_min,
              prob_final_max: classif.prob_final_max,
              classificacao_final: classif.classificacao_final,
              temp_c: tempC,
              vento_kmh: ventoKmh,
              temp_med_c: tempC,
              vento_med_kmh: ventoKmh,
              prev_d1_mm: forecastPrecip[0] ?? null,
              prev_d2_mm: forecastPrecip[1] ?? null,
              prev_d3_mm: forecastPrecip[2] ?? null,
            });
          } catch (err) {
            errors.push(`Regiao ${reg.regiao} (${reg.id}): ${(err as Error).message}`);
          }
        }

        // 6. Batch insert
        if (rows.length > 0) {
          const { error: insErr } = await sb.from("pluvio_risco").insert(rows);
          if (insErr) {
            errors.push(`Insert cliente ${cliente.id}: ${insErr.message}`);
          } else {
            totalInserted += rows.length;
          }
        }
      } catch (err) {
        errors.push(`Cliente ${cliente.id}: ${(err as Error).message}`);
      }
    }

    const result = {
      ok: true,
      dt_ref: dtRef,
      inserted: totalInserted,
      skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`[pluvio-risco-daily] concluído — clientes=${result.clientes_processados ?? 0} erros=${result.errors?.length ?? 0}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[pluvio-risco-daily] Fatal:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
