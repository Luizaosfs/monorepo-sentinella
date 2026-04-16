-- Fix: v_focos_risco_agrupados usava f.id::text no ELSE (individual sem bairro/região)
-- Causa: focos de drone sem imovel_id e sem regiao_id mostravam UUID bruto na triagem territorial
-- Fix: COALESCE(f.codigo_foco, f.id::text) — exibe código legível; fallback para UUID se null

CREATE OR REPLACE VIEW "public"."v_focos_risco_agrupados" AS
 SELECT "f"."cliente_id",
        CASE
            WHEN (("i"."quarteirao" IS NOT NULL) AND ("i"."quarteirao" <> ''::"text")) THEN 'quadra'::"text"
            WHEN (("i"."bairro" IS NOT NULL) AND ("i"."bairro" <> ''::"text")) THEN 'bairro'::"text"
            WHEN ("r"."id" IS NOT NULL) THEN 'regiao'::"text"
            ELSE 'item'::"text"
        END AS "agrupador_tipo",
        CASE
            WHEN (("i"."quarteirao" IS NOT NULL) AND ("i"."quarteirao" <> ''::"text")) THEN "i"."quarteirao"
            WHEN (("i"."bairro" IS NOT NULL) AND ("i"."bairro" <> ''::"text")) THEN "i"."bairro"
            WHEN ("r"."id" IS NOT NULL) THEN COALESCE("r"."regiao", ("r"."id")::"text")
            ELSE COALESCE("f"."codigo_foco", ("f"."id")::"text")
        END AS "agrupador_valor",
    ("count"(*))::integer AS "quantidade_focos",
    ("count"(*) FILTER (WHERE ("f"."status" = ANY (ARRAY['em_triagem'::"text", 'aguarda_inspecao'::"text"]))))::integer AS "quantidade_elegivel",
    ("count"(*) FILTER (WHERE ("f"."status" = 'em_triagem'::"text")))::integer AS "ct_em_triagem",
    ("count"(*) FILTER (WHERE ("f"."status" = 'aguarda_inspecao'::"text")))::integer AS "ct_aguarda_inspecao",
    ("count"(*) FILTER (WHERE ("f"."responsavel_id" IS NULL)))::integer AS "ct_sem_responsavel",
    "min"(
        CASE "f"."prioridade"
            WHEN 'P1'::"text" THEN 1
            WHEN 'P2'::"text" THEN 2
            WHEN 'P3'::"text" THEN 3
            WHEN 'P4'::"text" THEN 4
            WHEN 'P5'::"text" THEN 5
            ELSE 99
        END) AS "prioridade_max_ord",
    "array_agg"("f"."id" ORDER BY "f"."score_prioridade" DESC NULLS LAST) AS "foco_ids",
    "avg"("f"."latitude") AS "lat_media",
    "avg"("f"."longitude") AS "lng_media"
   FROM (("public"."focos_risco" "f"
     LEFT JOIN "public"."imoveis" "i" ON (("i"."id" = "f"."imovel_id")))
     LEFT JOIN "public"."regioes" "r" ON (("r"."id" = "f"."regiao_id")))
  WHERE (("f"."deleted_at" IS NULL) AND ("f"."status" <> ALL (ARRAY['resolvido'::"text", 'descartado'::"text"])))
  GROUP BY "f"."cliente_id",
        CASE
            WHEN (("i"."quarteirao" IS NOT NULL) AND ("i"."quarteirao" <> ''::"text")) THEN 'quadra'::"text"
            WHEN (("i"."bairro" IS NOT NULL) AND ("i"."bairro" <> ''::"text")) THEN 'bairro'::"text"
            WHEN ("r"."id" IS NOT NULL) THEN 'regiao'::"text"
            ELSE 'item'::"text"
        END,
        CASE
            WHEN (("i"."quarteirao" IS NOT NULL) AND ("i"."quarteirao" <> ''::"text")) THEN "i"."quarteirao"
            WHEN (("i"."bairro" IS NOT NULL) AND ("i"."bairro" <> ''::"text")) THEN "i"."bairro"
            WHEN ("r"."id" IS NOT NULL) THEN COALESCE("r"."regiao", ("r"."id")::"text")
            ELSE COALESCE("f"."codigo_foco", ("f"."id")::"text")
        END;

COMMENT ON VIEW "public"."v_focos_risco_agrupados" IS
  'Focos de risco ativos agrupados por território (quadra>bairro>regiao>item). '
  'Inclui contadores de status, ct_sem_responsavel e centróide do grupo. '
  'Fix 20270221: agrupador_valor usa COALESCE(codigo_foco, id::text) para focos individuais.';
