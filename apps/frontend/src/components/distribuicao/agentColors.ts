const PALETTE = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#d97706',
  '#9333ea',
  '#0891b2',
  '#c2410c',
  '#be185d',
  '#0f766e',
  '#7c3aed',
  '#ca8a04',
  '#065f46',
];

export function buildAgentColorMap(agentIds: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  agentIds.forEach((id, i) => {
    map[id] = PALETTE[i % PALETTE.length];
  });
  return map;
}
