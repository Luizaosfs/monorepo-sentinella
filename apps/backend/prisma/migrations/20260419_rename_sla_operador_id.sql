ALTER TABLE "sla_operacional" RENAME COLUMN "operador_id" TO "agente_id";
ALTER TABLE "sla_operacional" RENAME CONSTRAINT "sla_operacional_operador_id_fkey" TO "sla_operacional_agente_id_fkey";
