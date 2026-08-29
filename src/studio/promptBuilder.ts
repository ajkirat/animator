import type { ParsedScene } from './types';
import { CHARACTERS, BACKGROUNDS, STYLE_SUFFIX, NEGATIVE_PROMPT } from './data';

export function buildPrompt(scene: ParsedScene): string {
  const bg   = BACKGROUNDS[scene.setting] ?? BACKGROUNDS['garden'];
  const chars = scene.characters
    .map(id => CHARACTERS[id]?.aiDescription)
    .filter(Boolean)
    .join(', and ');

  const parts = [
    chars ? `Featuring ${chars}.` : '',
    `Setting: ${bg.aiDescription}.`,
    scene.action ? `${scene.action}.` : '',
    STYLE_SUFFIX,
  ].filter(Boolean);

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export const getNegativePrompt = () => NEGATIVE_PROMPT;

export function estimateCost(pendingCount: number, duration: 5 | 10 = 5): number {
  return pendingCount * (duration === 5 ? 0.14 : 0.28);
}
