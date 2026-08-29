import type { Character, Background } from './types';

export const CHARACTERS: Record<string, Character> = {
  poppy: {
    id: 'poppy', name: 'Poppy', emoji: '🐰', color: '#FFB3C6',
    aiDescription: 'a cute fluffy pink bunny named Poppy with big expressive dark eyes, soft pastel pink fur, long upright ears with pink inner ears, small pink nose, plump round body',
  },
  buddy: {
    id: 'buddy', name: 'Buddy', emoji: '🐶', color: '#FFD58A',
    aiDescription: 'an adorable golden retriever puppy named Buddy with a red leather collar and gold bone-shaped tag, big brown puppy eyes, floppy ears, soft golden fur, plump round body',
  },
  mimi: {
    id: 'mimi', name: 'Mimi', emoji: '🐱', color: '#B0C4DE',
    aiDescription: 'a cute gray tabby kitten named Mimi with a pink bow on her head, big sparkly eyes, soft gray striped fur, fluffy tail, slim graceful figure',
  },
  lily: {
    id: 'lily', name: 'Lily', emoji: '🐑', color: '#E0E8FF',
    aiDescription: 'an adorable white fluffy lamb named Lily with a yellow bow around her neck, big gentle blue eyes, soft white wool, tiny hooves, plump round body',
  },
  rex: {
    id: 'rex', name: 'Rex', emoji: '🦕', color: '#A8E6A3',
    aiDescription: 'a friendly small lime-green baby dinosaur named Rex with big round orange eyes, smooth shiny scales, stubby arms, big happy smile, puppy-sized',
  },
  sunny: {
    id: 'sunny', name: 'Sunny', emoji: '🐥', color: '#FFE66D',
    aiDescription: 'a cheerful bright yellow duckling named Sunny with a small orange beak, round black eyes, tiny yellow wings, orange webbed feet, fluffy downy feathers',
  },
};

export const BACKGROUNDS: Record<string, Background> = {
  garden:    { id: 'garden',    name: 'Sunny Garden',   emoji: '🌸', aiDescription: 'a beautiful sunny garden with lush green grass, colorful flowers, blue sky with fluffy white clouds, warm golden afternoon sunlight, butterflies fluttering' },
  forest:    { id: 'forest',    name: 'Magic Forest',   emoji: '🌲', aiDescription: 'a magical enchanted forest with tall trees, dappled green light through leaves, mossy ground, glowing mushrooms, fireflies, fairy-tale atmosphere' },
  beach:     { id: 'beach',     name: 'Sandy Beach',    emoji: '🏖️', aiDescription: 'a cheerful sunny beach with golden sand, gentle blue ocean waves, colorful beach umbrellas, seashells, sandcastles, bright sunny sky' },
  space:     { id: 'space',     name: 'Outer Space',    emoji: '🚀', aiDescription: 'a colorful outer space scene with twinkling stars, planets, colorful nebulas, asteroids, dreamy cosmic atmosphere in purple and blue tones' },
  underwater:{ id: 'underwater',name: 'Underwater',     emoji: '🌊', aiDescription: 'a beautiful underwater ocean scene with vibrant coral reefs, colorful tropical fish, floating bubbles, soft blue-green light filtering from above' },
  classroom: { id: 'classroom', name: 'Classroom',      emoji: '🏫', aiDescription: 'a bright cheerful classroom with colorful posters on walls, wooden desks, bookshelves, art supplies, warm sunlight through windows' },
  farm:      { id: 'farm',      name: 'Sunny Farm',     emoji: '🚜', aiDescription: 'a warm sunny farm with a red wooden barn, green rolling fields, hay bales, a wooden fence, blue sky, gentle countryside atmosphere' },
  bedroom:   { id: 'bedroom',   name: 'Cozy Bedroom',   emoji: '🌙', aiDescription: "a cozy child's bedroom with warm lamp light, soft colorful bedding, stuffed animals on shelves, fairy string lights, bookshelves" },
};

export const STYLE_SUFFIX =
  'Pixar 3D animation style, soft studio lighting, vibrant saturated colors, adorable character design, high detail, photorealistic textures, children\'s animated movie quality.';

export const NEGATIVE_PROMPT =
  'realistic humans, scary, dark themes, violence, text overlays, watermark, low quality, blurry, adult content, logos.';
