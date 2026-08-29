import { nanoid } from 'nanoid';
import type { ParsedScene } from './types';
import { CHARACTERS, BACKGROUNDS } from './data';

const BG_KEYWORDS: Record<string, string> = {
  garden:'garden', meadow:'garden', park:'garden', yard:'garden', outside:'garden', outdoors:'garden',
  forest:'forest', woods:'forest', jungle:'forest', trees:'forest',
  beach:'beach', ocean:'beach', sea:'beach', sand:'beach', shore:'beach',
  space:'space', stars:'space', planet:'space', galaxy:'space', moon:'space', rocket:'space',
  underwater:'underwater', coral:'underwater', fish:'underwater', reef:'underwater',
  classroom:'classroom', school:'classroom', library:'classroom',
  farm:'farm', barn:'farm', field:'farm',
  bedroom:'bedroom', bed:'bedroom', night:'bedroom', sleep:'bedroom', room:'bedroom',
};

function detectBackground(text: string): string {
  const lower = text.toLowerCase();
  for (const [kw, id] of Object.entries(BG_KEYWORDS)) {
    if (lower.includes(kw)) return id;
  }
  return 'garden';
}

function detectCharacters(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.values(CHARACTERS)
    .filter(c => lower.includes(c.name.toLowerCase()))
    .map(c => c.id);
}

function extractNarration(text: string): { narration: string; action: string } {
  const quotes = text.match(/"([^"]+)"/g) ?? [];
  const narration = quotes.map(q => q.replace(/"/g, '')).join(' ');
  const action = text
    .replace(/"[^"]+"/g, '')
    .replace(/\b(says?|said|shouts?|whispers?|asks?|replies?|exclaims?)\b[^.,!?]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { narration, action };
}

function splitIntoBlocks(script: string): string[] {
  const lines = script.split('\n');
  const blocks: string[] = [];
  let cur: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    const isHeader =
      /^(scene\s*\d+\s*[:\-–])/i.test(t) ||
      /^\[.+\]$/.test(t) ||
      /^-{3,}$/.test(t);

    if (isHeader && cur.length > 0) {
      blocks.push(cur.join('\n').trim());
      cur = [];
    }

    if (!isHeader) {
      if (t) cur.push(t);
    } else {
      const content = t
        .replace(/^scene\s*\d+\s*[:\-–]\s*/i, '')
        .replace(/^\[(.+)\]$/, '$1');
      if (content) cur.push(content);
    }
  }
  if (cur.length > 0) blocks.push(cur.join('\n').trim());

  // Fall back to paragraph-split if no explicit markers found
  if (blocks.length <= 1 && script.length > 200) {
    const paras = script.split(/\n\s*\n/).filter(p => p.trim());
    if (paras.length > 1) return paras.map(p => p.trim());
  }

  return blocks.filter(Boolean);
}

export function parseScript(
  script: string,
  defaultBg: string,
  selectedChars: string[]
): ParsedScene[] {
  const blocks = splitIntoBlocks(script);
  return blocks.map((block, i) => {
    const { narration, action } = extractNarration(block);
    let chars = detectCharacters(block);
    if (chars.length === 0) chars = selectedChars.slice(0, 3);
    const setting = detectBackground(block) || defaultBg;
    return {
      id: nanoid(),
      index: i,
      rawText: block,
      setting,
      characters: chars,
      action: action || block.slice(0, 200),
      narration: narration || block.replace(/"[^"]+"/g, '').trim().slice(0, 150),
      status: 'pending',
      duration: 5,
    };
  });
}
