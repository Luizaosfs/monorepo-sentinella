-- Corrige políticas RLS do módulo de vistoria para usar a função
-- public.usuario_pode_acessar_cliente(cliente_id), mantendo isolamento
-- por cliente e permitindo leitura para admin da plataforma.

-- ── imoveis ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "imoveis_isolamento" ON imoveis;
CREATE POLICY "imoveis_isolamento" ON imoveis
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- ── vistorias ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vistorias_isolamento" ON vistorias;
CREATE POLICY "vistorias_isolamento" ON vistorias
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- ── vistoria_depositos ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vistoria_depositos_isolamento" ON vistoria_depositos;
CREATE POLICY "vistoria_depositos_isolamento" ON vistoria_depositos
  USING (
    EXISTS (
      SELECT 1
      FROM vistorias v
      WHERE v.id = vistoria_depositos.vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

-- ── vistoria_sintomas ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vistoria_sintomas_isolamento" ON vistoria_sintomas;
CREATE POLICY "vistoria_sintomas_isolamento" ON vistoria_sintomas
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- ── vistoria_riscos ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vistoria_riscos_isolamento" ON vistoria_riscos;
CREATE POLICY "vistoria_riscos_isolamento" ON vistoria_riscos
  USING (
    EXISTS (
      SELECT 1
      FROM vistorias v
      WHERE v.id = vistoria_riscos.vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

-- ── vistoria_calhas ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "isolamento_vistoria_calhas" ON vistoria_calhas;
CREATE POLICY "isolamento_vistoria_calhas" ON vistoria_calhas
  USING (
    EXISTS (
      SELECT 1
      FROM vistorias v
      WHERE v.id = vistoria_calhas.vistoria_id
        AND public.usuario_pode_acessar_cliente(v.cliente_id)
    )
  );

