import type { Character, Background } from './types';

export const CHARACTERS: Record<string, Character> = {
  poppy: {
    id: 'poppy', name: 'Poppy', emoji: '🐶', color: '#FFD58A',
    aiDescription: 'Poppy, a golden retriever puppy with a round oversized head, big round brown eyes, tan fur with a cream belly patch, floppy darker-tan ears, red collar with a small yellow bone-shaped tag, chubby rounded body',
  },
  momo: {
    id: 'momo', name: 'Momo', emoji: '🐱', color: '#B0C4DE',
    aiDescription: 'Momo, a blue-grey kitten with a round body, small pointed ears, and a pink ribbon bow',
  },
  quackers: {
    id: 'quackers', name: 'Quackers', emoji: '🦆', color: '#FFE66D',
    aiDescription: 'Quackers, a yellow duck with a round body and orange beak',
  },
  buddy: {
    id: 'buddy', name: 'Buddy', emoji: '🐕', color: '#D4A96A',
    aiDescription: 'Buddy, an adorable golden retriever puppy with a red collar and gold tag, big brown puppy eyes, floppy ears, soft golden fur, plump round body',
  },
  lily: {
    id: 'lily', name: 'Lily', emoji: '🐑', color: '#E0E8FF',
    aiDescription: 'Lily, an adorable white fluffy lamb with a yellow bow around her neck, big gentle blue eyes, soft white wool, tiny hooves, plump round body',
  },
  sunny: {
    id: 'sunny', name: 'Sunny', emoji: '🐥', color: '#FFF0A0',
    aiDescription: 'Sunny, a cheerful bright yellow duckling with a small orange beak, round black eyes, tiny yellow wings, orange webbed feet, fluffy downy feathers',
  },
};

export const BACKGROUNDS: Record<string, Background> = {
  picnic:    { id: 'picnic',    name: 'Picnic',         emoji: '🧺', aiDescription: 'a picnic blanket spread under a large leafy tree, sage-green grass, soft diffused daytime sky, gentle dappled shade, muted pastel tones, calm and peaceful outdoor setting' },
  garden:    { id: 'garden',    name: 'Sunny Garden',   emoji: '🌸', aiDescription: 'a calm sunny garden with soft sage-green grass, gentle flowers, pale blue sky, muted pastel tones, soft diffused daylight' },
  forest:    { id: 'forest',    name: 'Forest',         emoji: '🌲', aiDescription: 'a calm forest with tall trees, soft dappled light through leaves, mossy ground, muted greens, peaceful atmosphere' },
  beach:     { id: 'beach',     name: 'Beach',          emoji: '🏖️', aiDescription: 'a calm beach with pale golden sand, soft blue ocean, muted pastel sky, gentle diffused daylight, peaceful atmosphere' },
  space:     { id: 'space',     name: 'Outer Space',    emoji: '🚀', aiDescription: 'a gentle space scene with soft twinkling stars, muted pastel planets, calm cosmic atmosphere' },
  underwater:{ id: 'underwater',name: 'Underwater',     emoji: '🌊', aiDescription: 'a gentle underwater scene with soft coral, calm fish, muted blue-green light, peaceful atmosphere' },
  classroom: { id: 'classroom', name: 'Classroom',      emoji: '🏫', aiDescription: 'a calm bright classroom with soft natural light, wooden desks, bookshelves, muted warm tones' },
  farm:      { id: 'farm',      name: 'Farm',           emoji: '🚜', aiDescription: 'a calm sunny farm with soft green fields, a gentle breeze, muted earthy tones, peaceful countryside' },
  bedroom:   { id: 'bedroom',   name: 'Bedroom',        emoji: '🌙', aiDescription: "a cozy child's bedroom with warm soft lamp light, gentle colors, stuffed animals, calm peaceful atmosphere" },
};

export const STYLE_SUFFIX =
  '3D CGI toddler animation style, daytime, soft muted pastel daylight, gentle diffused sun, sage-green grass, soft sky blue, no hard highlights, no sparkle or confetti effects, character motion is slow and deliberate, calm and conversational tone, high quality render.';

export const NEGATIVE_PROMPT =
  'realistic humans, scary, dark themes, violence, text overlays, watermark, low quality, blurry, adult content, logos, high saturation colors, bouncy motion, sparkle effects, confetti, chanting, singing.';
