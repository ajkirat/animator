export type SceneStatus = 'pending' | 'generating' | 'done' | 'error';
export type ActiveTab   = 'script' | 'scenes' | 'preview';

export interface Character {
  id: string;
  name: string;
  emoji: string;
  color: string;       // hex swatch
  aiDescription: string;
}

export interface Background {
  id: string;
  name: string;
  emoji: string;
  aiDescription: string;
}

export interface ParsedScene {
  id: string;
  index: number;
  rawText: string;
  setting: string;
  characters: string[];  // character ids present in this scene
  action: string;
  narration: string;
  status: SceneStatus;
  taskId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  duration: 5 | 10;
}

export interface KlingSettings {
  accessKey: string;
  secretKey: string;
  quality: 'std' | 'pro';
  clipDuration: 5 | 10;
}
