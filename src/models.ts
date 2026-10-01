export interface OddsModel {
  id: string;
  name: string;
  workersAiId: string;
  inputUsdPerMillion: number;
  contextWindow: number;
  vision: boolean;
}

export const ODDS_MODELS: readonly OddsModel[] = [
  {
    id: 'clef',
    name: 'Clef (Cloudflare, 27B)',
    workersAiId: '@cf/cloudflare/clef',
    inputUsdPerMillion: 0.24,
    contextWindow: 65536,
    vision: true,
  },
  {
    id: 'clef-flash',
    name: 'Clef Flash (Cloudflare)',
    workersAiId: '@cf/cloudflare/clef-flash',
    inputUsdPerMillion: 0.09,
    contextWindow: 65536,
    vision: true,
  },
];

export function findOddsModel(id: string): OddsModel | undefined {
  return ODDS_MODELS.find((model) => model.id === id);
}
