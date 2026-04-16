/**
 * Edge Function: resumo-diario
 * Cron: 0 18 * * * (18h UTC diariamente)
 * Gera resumo executivo do dia via Claude Haiku e envia push para supervisores.
 *
 * Cache: verifica ia_insights (tipo='resumo_diario', valido_ate > now()) antes
 * de chamar a API. Persiste em ia_insights (com tokens) + resumos_diarios (compat).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function jwtPayloadRole(token: string): string | null {
  try {
    const p = token.split('.')[1];
    if (!p) return null;
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '==='.slice((b64.length + 3) % 4);
    const payload = JSON.parse(atob(pad)) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `Você é um especialista em vigilância epidemiológica municipal.

Gere um resumo executivo para o gestor municipal.

REGRAS:
- máximo 4 parágrafos curtos
- comece pelo mais urgente
- linguagem simples e direta
- não inventar dados
- finalizar com ações práticas recomendadas para o dia`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Não autorizado' }, 401);
  }
  const bearer = authHeader.slice(7).trim();

  if (jwtPayloadRole(bearer) !== 'service_role') {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return json({ error: 'Não autorizado' }, 401);
    }
  }

  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@sentinelaweb.com.br';

  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  }

  let targetClienteId: string | null = null;
  let forceRefresh = false;
  try {
    const body = await req.json();
    targetClienteId = body.cliente_id ?? null;
    forceRefresh    = body.force_refresh === true;
  } catch { /* cron call, no body */ }

  const today        = new Date().toISOString().split('T')[0];
  const dataFormatada = new Date().toLocaleDateString('pt-BR');

  let clientesQuery = supabase
    .from('clientes')
    .select('id, nome')
    .eq('ativo', true);

  if (targetClienteId) {
    clientesQuery = clientesQuery.eq('id', targetClienteId);
  }

  const { data: clientes } = await clientesQuery;

  const resultados: {
    cliente_id: string;
    ok: boolean;
    cached?: boolean;
    texto?: string;
    erro?: string;
  }[] = [];

  for (const cliente of (clientes ?? [])) {
    try {
      // ── Cache check: ia_insights válido ──────────────────────────────────
      if (!forceRefresh) {
        const { data: cached } = await supabase
          .from('ia_insights')
          .select('id, texto, created_at')
          .eq('cliente_id', cliente.id)
          .eq('tipo', 'resumo_diario')
          .gt('valido_ate', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached) {
          resultados.push({ cliente_id: cliente.id, ok: true, cached: true, texto: cached.texto });
          continue;
        }
      }

      // ── Coleta métricas do dia ────────────────────────────────────────────
      const [vistorias, focos, slas, casos, operacoes, focosAtivos] = await Promise.all([
        supabase.from('vistorias')
          .select('id, acesso_realizado')
          .eq('cliente_id', cliente.id)
          .gte('created_at', today),
        supabase.from('levantamento_itens')
          .select('id')
          .eq('cliente_id', cliente.id)
          .gte('created_at', today),
        supabase.from('sla_operacional')
          .select('id')
          .eq('cliente_id', cliente.id)
          .eq('status', 'vencido')
          .gte('vencido_em', today),
        supabase.from('casos_notificados')
          .select('id')
          .eq('cliente_id', cliente.id)
          .gte('data_notificacao', today),
        supabase.from('operacoes')
          .select('id')
          .eq('cliente_id', cliente.id)
          .eq('status', 'concluido')
          .gte('updated_at', today),
        supabase.from('focos_risco')
          .select('id, status, score_prioridade')
          .eq('cliente_id', cliente.id)
          .not('status', 'in', '(resolvido,descartado)')
          .is('deleted_at', null),
      ]);

      const totalVistorias = vistorias.data?.length ?? 0;
      const comAcesso      = vistorias.data?.filter((v) => v.acesso_realizado).length ?? 0;
      const semAcesso      = totalVistorias - comAcesso;
      const totalFocos     = focos.data?.length ?? 0;
      const totalSlas      = slas.data?.length ?? 0;
      const totalCasos     = casos.data?.length ?? 0;
      const totalOps       = operacoes.data?.length ?? 0;
      const focosAtivosArr = focosAtivos.data ?? [];
      const focosUrgentes  = focosAtivosArr.filter((f) => (f.score_prioridade ?? 0) >= 50).length;

      const metricas = {
        vistorias: totalVistorias,
        com_acesso: comAcesso,
        sem_acesso: semAcesso,
        focos_novos: totalFocos,
        focos_ativos: focosAtivosArr.length,
        focos_urgentes: focosUrgentes,
        slas_vencidos: totalSlas,
        casos: totalCasos,
        operacoes: totalOps,
      };

      // ── Gera sumário via Claude Haiku ─────────────────────────────────────
      const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
      let sumario = `Dia ${dataFormatada}: ${totalVistorias} vistorias (${comAcesso} com acesso), `
        + `${focosAtivosArr.length} focos ativos (${focosUrgentes} urgentes), `
        + `${totalSlas} SLAs vencidos, ${totalCasos} casos notificados.`;

      let tokensIn:  number | undefined;
      let tokensOut: number | undefined;

      if (anthropicKey) {
        const userPrompt = `Dados operacionais do dia ${dataFormatada}:
- Vistorias realizadas: ${totalVistorias} (com acesso: ${comAcesso}, sem acesso: ${semAcesso})
- Focos ativos no sistema: ${focosAtivosArr.length} (${focosUrgentes} com prioridade urgente)
- Novos focos identificados hoje: ${totalFocos}
- SLAs vencidos hoje: ${totalSlas}
- Casos notificados: ${totalCasos}
- Operações concluídas: ${totalOps}`;

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (claudeRes.ok) {
          const claudeJson = await claudeRes.json();
          sumario    = claudeJson.content?.[0]?.text ?? sumario;
          tokensIn   = claudeJson.usage?.input_tokens;
          tokensOut  = claudeJson.usage?.output_tokens;
        }
      }

      const validoAte = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // ── Persiste em ia_insights (cache + rastreio) ────────────────────────
      await supabase.from('ia_insights').insert({
        cliente_id: cliente.id,
        tipo:       'resumo_diario',
        texto:      sumario,
        payload:    metricas,
        modelo:     'claude-haiku-4-5-20251001',
        tokens_in:  tokensIn  ?? null,
        tokens_out: tokensOut ?? null,
        valido_ate: validoAte,
      });

      // ── Persiste em resumos_diarios (backward compat) ─────────────────────
      await supabase.from('resumos_diarios').upsert({
        cliente_id: cliente.id,
        data_ref:   today,
        sumario,
        metricas,
      }, { onConflict: 'cliente_id,data_ref' });

      // ── Push para supervisores ────────────────────────────────────────────
      if (vapidPublic && vapidPrivate) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('cliente_id', cliente.id);

        const primeirasLinhas = sumario.split('\n').slice(0, 2).join(' ').slice(0, 120);

        for (const sub of (subs ?? [])) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({
                title: `📋 Resumo do dia — ${cliente.nome}`,
                body:  primeirasLinhas,
                tag:   `resumo-diario-${cliente.id}`,
                url:   '/gestor/central',
              }),
            );
          } catch (err) {
            if ((err as { statusCode?: number }).statusCode === 410) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint)
                .catch(() => undefined);
            }
          }
        }
      }

      resultados.push({ cliente_id: cliente.id, ok: true, cached: false, texto: sumario });
    } catch (e) {
      resultados.push({ cliente_id: cliente.id, ok: false, erro: String(e) });
    }
  }

  return json({ date: today, resultados });
});
