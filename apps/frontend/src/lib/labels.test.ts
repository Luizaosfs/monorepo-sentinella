import { describe, it, expect } from 'vitest';
import {
  PAPEL_LABEL,
  PAPEL_LABEL_CURTO,
  STATUS_FOCO_LABEL,
  STATUS_SLA_LABEL,
  STATUS_LEVANTAMENTO_LABEL,
  STATUS_VISTORIA_LABEL,
  PRIORIDADE_LABEL,
  ORIGEM_FOCO_LABEL,
  getPapelLabel,
  getPrioridadeLabel,
  normalizarPapelParaExibicao,
} from './labels';

describe('labels', () => {
  it('PAPEL_LABEL cobre todos os papéis canônicos', () => {
    expect(PAPEL_LABEL.admin).toBeTruthy();
    expect(PAPEL_LABEL.supervisor).toBeTruthy();
    expect(PAPEL_LABEL.agente).toBeTruthy();
    expect(PAPEL_LABEL.notificador).toBeTruthy();
    // legado pré-migration — exibe igual ao canônico
    expect(PAPEL_LABEL.operador).toBe(PAPEL_LABEL.agente);
    // gestor nunca existiu no enum — não deve ter entrada própria
    expect(PAPEL_LABEL.gestor).toBeUndefined();
  });

  it('PAPEL_LABEL_CURTO cobre todos os papéis canônicos e legado operador', () => {
    const papeis = [
      'admin',
      'supervisor',
      'operador',
      'agente',
      'notificador',
    ] as const;
    for (const p of papeis) {
      expect(PAPEL_LABEL_CURTO[p], `PAPEL_LABEL_CURTO.${p} ausente`).toBeTruthy();
    }
    // operador: legado pré-migration, exibe igual a agente
    expect(PAPEL_LABEL_CURTO.operador).toBe(PAPEL_LABEL_CURTO.agente);
    // gestor nunca existiu no enum — não deve ter entrada própria
    expect(PAPEL_LABEL_CURTO.gestor).toBeUndefined();
  });

  describe('getPapelLabel', () => {
    it('retorna label longo por padrão', () => {
      expect(getPapelLabel('admin')).toBe(PAPEL_LABEL.admin);
    });
    it('retorna label curto quando curto=true', () => {
      expect(getPapelLabel('agente', true)).toBe(PAPEL_LABEL_CURTO.agente);
    });
    it('retorna em dash para null/undefined/vazio', () => {
      expect(getPapelLabel(null)).toBe('—');
      expect(getPapelLabel(undefined)).toBe('—');
    });
    it('é case-insensitive', () => {
      expect(getPapelLabel('ADMIN')).toBe(PAPEL_LABEL.admin);
    });
    it('retorna o valor cru para papel desconhecido', () => {
      expect(getPapelLabel('desconhecido')).toBe('desconhecido');
    });
  });

  describe('normalizarPapelParaExibicao (labels) — normalização para exibição na UI', () => {
    it('normaliza admin', () => expect(normalizarPapelParaExibicao('admin')).toBe('admin'));
    it('normaliza supervisor', () => expect(normalizarPapelParaExibicao('supervisor')).toBe('supervisor'));
    it('moderador → agente (fallback — nunca existiu no enum)', () => expect(normalizarPapelParaExibicao('moderador')).toBe('agente'));
    it('gestor → agente (fallback — alias de UI, nunca existiu no enum)', () => expect(normalizarPapelParaExibicao('gestor')).toBe('agente'));
    it('analista_regional → "analista_regional" (P5)', () => expect(normalizarPapelParaExibicao('analista_regional')).toBe('analista_regional'));
    it('ANALISTA_REGIONAL → "analista_regional" (case-insensitive)', () => expect(normalizarPapelParaExibicao('ANALISTA_REGIONAL')).toBe('analista_regional'));
    it('normaliza notificador', () => expect(normalizarPapelParaExibicao('notificador')).toBe('notificador'));
    it('normaliza agente (canônico)', () => expect(normalizarPapelParaExibicao('agente')).toBe('agente'));
    it('normaliza operador → agente (legado pré-migration)', () => expect(normalizarPapelParaExibicao('operador')).toBe('agente'));
    it('é case-insensitive e ignora espaços', () => {
      expect(normalizarPapelParaExibicao('  ADMIN  ')).toBe('admin');
      expect(normalizarPapelParaExibicao('OPERADOR')).toBe('agente');
    });
    it('retorna "agente" como fallback para papel desconhecido', () => {
      expect(normalizarPapelParaExibicao('usuario')).toBe('agente');
      expect(normalizarPapelParaExibicao('cliente')).toBe('agente');
      expect(normalizarPapelParaExibicao('')).toBe('agente');
    });
    it('retorna "agente" para null/undefined', () => {
      expect(normalizarPapelParaExibicao(null)).toBe('agente');
      expect(normalizarPapelParaExibicao(undefined)).toBe('agente');
    });
  });

  describe('STATUS_SLA_LABEL', () => {
    it('cobre todos os estados de SLA', () => {
      expect(STATUS_SLA_LABEL.pendente).toBeTruthy();
      expect(STATUS_SLA_LABEL.em_atendimento).toBeTruthy();
      expect(STATUS_SLA_LABEL.concluido).toBeTruthy();
      expect(STATUS_SLA_LABEL.vencido).toBeTruthy();
    });
  });

  describe('STATUS_LEVANTAMENTO_LABEL', () => {
    it('cobre estados de levantamento_itens', () => {
      expect(STATUS_LEVANTAMENTO_LABEL.pendente).toBeTruthy();
      expect(STATUS_LEVANTAMENTO_LABEL.em_atendimento).toBeTruthy();
      expect(STATUS_LEVANTAMENTO_LABEL.resolvido).toBeTruthy();
    });
  });

  describe('STATUS_VISTORIA_LABEL', () => {
    it('cobre estados de vistoria', () => {
      expect(STATUS_VISTORIA_LABEL.pendente).toBeTruthy();
      expect(STATUS_VISTORIA_LABEL.visitado).toBeTruthy();
      expect(STATUS_VISTORIA_LABEL.fechado).toBeTruthy();
      expect(STATUS_VISTORIA_LABEL.revisita).toBeTruthy();
    });
  });

  it('STATUS_FOCO_LABEL cobre todos os 8 estados do fluxo', () => {
    expect(STATUS_FOCO_LABEL.suspeita).toBe('Suspeita');
    expect(STATUS_FOCO_LABEL.em_triagem).toBe('Em triagem');
    expect(STATUS_FOCO_LABEL.aguarda_inspecao).toBe('Aguarda inspeção');
    expect(STATUS_FOCO_LABEL.em_inspecao).toBe('Em inspeção');
    expect(STATUS_FOCO_LABEL.confirmado).toBe('Confirmado');
    expect(STATUS_FOCO_LABEL.em_tratamento).toBe('Em tratamento');
    expect(STATUS_FOCO_LABEL.resolvido).toBe('Resolvido');
    expect(STATUS_FOCO_LABEL.descartado).toBe('Descartado');
  });

  it('PRIORIDADE_LABEL inclui P1–P5 e aliases legados', () => {
    expect(PRIORIDADE_LABEL.P1).toContain('Crítica');
    expect(PRIORIDADE_LABEL['Crítica']).toBeTruthy();
    expect(PRIORIDADE_LABEL['Monitoramento']).toBeTruthy();
  });

  it('ORIGEM_FOCO_LABEL cobre origens', () => {
    expect(ORIGEM_FOCO_LABEL.drone).toContain('Drone');
    expect(ORIGEM_FOCO_LABEL.cidadao).toContain('Denúncia');
  });

  it('getPrioridadeLabel retorna em dash para vazio', () => {
    expect(getPrioridadeLabel(null)).toBe('—');
    expect(getPrioridadeLabel(undefined)).toBe('—');
    expect(getPrioridadeLabel('')).toBe('—');
  });

  it('getPrioridadeLabel usa mapa ou retorna o valor cru', () => {
    expect(getPrioridadeLabel('P1')).toBe(PRIORIDADE_LABEL.P1);
    expect(getPrioridadeLabel('custom_unknown')).toBe('custom_unknown');
  });
});
