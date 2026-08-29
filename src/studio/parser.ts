import { nanoid } from 'nanoid';
import type { ParsedScene } from './types';
import { CHARACTERS } from './data';

const BG_KEYWORDS: Record<string, string> = {
  picnic:'picnic', blanket:'picnic', basket:'picnic',
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

// Strip everything before shot 1 and after the last numbered shot block
function stripPreambleAndPostamble(script: string): string {
  const lines = script.split('\n');

  // Find first shot: line starting with "1 —" (including markdown bold **1 —**)
  const firstShot = lines.findIndex(l => /^\s*\*{0,2}1\s*[—–\-]\s/.test(l));
  const trimmed = firstShot > 0 ? lines.slice(firstShot) : lines;

  // Find last numbered shot header, then keep only up to the end of that shot's content.
  // Stop at any line that looks like a section header not part of a shot (##, "Using this", "Same ")
  const result: string[] = [];
  let inShots = true;
  for (const line of trimmed) {
    const t = line.trim();
    // Stop collecting if we hit a non-shot section marker
    if (inShots && (/^#{1,3}\s/.test(t) || /^using this/i.test(t) || /^same ".+rule/i.test(t))) {
      inShots = false;
    }
    if (inShots) result.push(line);
  }
  return result.join('\n');
}

function splitIntoBlocks(script: string): string[] {
  const cleaned = stripPreambleAndPostamble(script);
  const lines = cleaned.split('\n');
  const blocks: string[] = [];
  let cur: string[] = [];

  for (const line of lines) {
    const t = line.trim();

    // Skip CHARACTERS / STYLE header blocks (between triple backticks or CHARACTERS: lines)
    if (/^```/.test(t) || /^CHARACTERS:/i.test(t) || /^STYLE:/i.test(t)) continue;

    const isHeader =
      // "1 — 0:00–0:10" or "**12 — 1:50–2:00**" numbered shot format
      /^\*{0,2}\d+\s*[—–-]\s*\d+:\d+/.test(t) ||
      // "Scene 1:" or "Scene 1 —"
      /^(scene\s*\d+\s*[:\-–])/i.test(t) ||
      // Shot 1:
      /^(shot\s*\d+\s*[:\-–])/i.test(t) ||
      /^\[.+\]$/.test(t) ||
      /^-{3,}$/.test(t);

    if (isHeader && cur.length > 0) {
      blocks.push(cur.join('\n').trim());
      cur = [];
    }

    if (!isHeader) {
      if (t) cur.push(t);
    } else {
      // Strip the header label, keep only descriptive content after it
      const content = t
        .replace(/^\d+\s*[—–-]\s*[\d:–—]+\s*/g, '')   // "1 — 0:00–0:10"
        .replace(/^(scene|shot)\s*\d+\s*[:\-–]\s*/i, '')
        .replace(/^\[(.+)\]$/, '$1')
        .trim();
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
  const blocks = splitIntoBlocks(script.replace(/```[\s\S]*?```/g, ''));
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
      duration: 10,
    };
  });
}
