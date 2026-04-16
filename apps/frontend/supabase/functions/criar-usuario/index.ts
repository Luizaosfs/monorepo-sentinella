/**
 * criar-usuario — Edge Function segura para provisionamento de usuários.
 *
 * Usa service_role key (nunca exposta ao cliente) para:
 * 1. Criar o login no Supabase Auth via admin API
 * 2. Inserir o registro em public.usuarios
 * 3. Atribuir o papel em public.papeis_usuarios
 *
 * Somente admin ou supervisor do mesmo cliente podem chamar esta função.
 * Supervisor não pode criar usuários com papel admin ou supervisor.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PRODUCTION_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br';
const ALLOWED_ORIGINS_CU = new Set([
  PRODUCTION_ORIGIN,
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
]);

function getCors(requestOrigin: string | null) {
  const origin = requestOrigin && ALLOWED_ORIGINS_CU.has(requestOrigin)
    ? requestOrigin
    : PRODUCTION_ORIGIN;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const CORS = getCors(req.headers.get('origin'));
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Autenticar o chamador ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    // Cliente com a sessão do chamador (para verificar papel)
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Cliente admin com service_role (para criar usuário)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verificar papel do chamador via RPC (usa RLS/SECURITY DEFINER)
    const { data: papelChamador, error: papelErr } = await callerClient.rpc('get_meu_papel');
    if (papelErr || !papelChamador) return json({ error: 'Forbidden' }, 403);

    const isAdmin = papelChamador === 'admin';
    const isSupervisor = papelChamador === 'supervisor' || papelChamador === 'moderador';

    if (!isAdmin && !isSupervisor) return json({ error: 'Forbidden: papel insuficiente' }, 403);

    // ── Validar payload ────────────────────────────────────────────────────
    const body = await req.json();
    const { nome, email, senha, cliente_id, papel, agrupamento_id } = body as {
      nome: string;
      email: string;
      senha: string;
      cliente_id: string | null;
      papel: string;
      agrupamento_id?: string | null;
    };

    if (!nome?.trim() || !email?.trim() || !senha || !papel) {
      return json({ error: 'nome, email, senha e papel são obrigatórios' }, 400);
    }

    const emailNorm = email.trim().toLowerCase();
    const papelNorm = papel.toLowerCase();

    // Supervisor não pode criar admin, supervisor ou analista_regional
    const PAPEIS_RESTRITOS_SUPERVISOR = ['admin', 'supervisor', 'moderador', 'analista_regional'];
    if (isSupervisor && PAPEIS_RESTRITOS_SUPERVISOR.includes(papelNorm)) {
      return json({ error: 'Supervisor não pode criar usuários com este papel' }, 403);
    }

    // analista_regional requer agrupamento_id e NÃO pode ter cliente_id
    if (papelNorm === 'analista_regional') {
      if (!agrupamento_id) {
        return json({ error: 'analista_regional requer agrupamento_id' }, 400);
      }
      if (cliente_id) {
        return json({ error: 'analista_regional não pode ter cliente_id' }, 400);
      }
    }

    // Supervisor só pode criar usuários no próprio cliente
    if (isSupervisor) {
      const { data: eu } = await callerClient
        .from('usuarios')
        .select('cliente_id')
        .eq('auth_id', (await callerClient.auth.getUser()).data.user?.id ?? '')
        .maybeSingle();

      if (!eu || eu.cliente_id !== cliente_id) {
        return json({ error: 'Supervisor só pode criar usuários no próprio cliente' }, 403);
      }
    }

    // ── Verificar e-mail duplicado ─────────────────────────────────────────
    const { data: existing } = await adminClient
      .from('usuarios')
      .select('id')
      .eq('email', emailNorm)
      .maybeSingle();

    if (existing) return json({ error: 'EMAIL_EXISTS', email: emailNorm }, 409);

    // ── Criar login no Auth ────────────────────────────────────────────────
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: emailNorm,
      password: senha,
      email_confirm: true, // provisionado por admin — sem necessidade de confirmar e-mail
      user_metadata: { must_change_password: true },
    });

    if (authError || !authData.user) {
      return json({ error: authError?.message ?? 'Erro ao criar login' }, 500);
    }

    const authId = authData.user.id;

    // ── Inserir em public.usuarios ─────────────────────────────────────────
    const { error: insertErr } = await adminClient.from('usuarios').insert({
      nome: nome.trim(),
      email: emailNorm,
      cliente_id: papelNorm === 'analista_regional' ? null : (cliente_id || null),
      agrupamento_id: agrupamento_id || null,
      auth_id: authId,
    });

    if (insertErr) {
      // Rollback: remover o auth user para não deixar órfão
      await adminClient.auth.admin.deleteUser(authId);
      return json({ error: insertErr.message }, 500);
    }

    // ── Atribuir papel ─────────────────────────────────────────────────────
    const { error: papelInsertErr } = await adminClient.from('papeis_usuarios').insert({
      usuario_id: authId,
      papel: papelNorm,
    });

    if (papelInsertErr) {
      // Rollback: remover auth user e registro de usuarios para não deixar órfãos
      await adminClient.from('usuarios').delete().eq('auth_id', authId);
      await adminClient.auth.admin.deleteUser(authId);
      return json({ error: papelInsertErr.message }, 500);
    }

    return json({ ok: true, auth_id: authId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});

