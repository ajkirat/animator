import type { ParsedScene } from './types';
import { CHARACTERS, BACKGROUNDS, STYLE_SUFFIX, NEGATIVE_PROMPT } from './data';

function extractCameraAngle(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('wide')) return 'Wide static shot.';
  if (lower.includes('close')) return 'Close static shot.';
  if (lower.includes('medium')) return 'Medium static shot.';
  return 'Static shot.';
}

export function buildPrompt(scene: ParsedScene): string {
  const bg    = BACKGROUNDS[scene.setting] ?? BACKGROUNDS['picnic'] ?? BACKGROUNDS['garden'];
  const chars = scene.characters
    .map(id => CHARACTERS[id]?.aiDescription)
    .filter(Boolean)
    .join(', and ');

  const camera = extractCameraAngle(scene.rawText);

  const parts = [
    camera,
    chars ? `Featuring ${chars}.` : '',
    `Setting: ${bg.aiDescription}.`,
    scene.action ? `${scene.action}.` : '',
    STYLE_SUFFIX,
  ].filter(Boolean);

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export const getNegativePrompt = () => NEGATIVE_PROMPT;

export function estimateCost(pendingCount: number, duration: 5 | 10 = 10): number {
  return pendingCount * (duration === 5 ? 0.14 : 0.28);
}
