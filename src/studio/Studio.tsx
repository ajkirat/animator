import { useState, useEffect, useRef, useCallback } from 'react';
import { toast, Toaster } from 'sonner';

import type { ParsedScene, KlingSettings, ActiveTab } from './types';
import { CHARACTERS, BACKGROUNDS } from './data';
import { parseScript } from './parser';
import { buildPrompt, getNegativePrompt, estimateCost } from './promptBuilder';
import { submitKlingTask, checkKlingTask } from './klingClient';

/* ─── localStorage ──────────────────────────────────────────────────────────── */
const SK = 'kvs_settings_v1';
const PK = 'kvs_project_v1';

const defaultSettings: KlingSettings = { accessKey: '', secretKey: '', quality: 'std', clipDuration: 5 };

function loadSettings(): KlingSettings {
  try { const s = localStorage.getItem(SK); return s ? JSON.parse(s) : defaultSettings; }
  catch { return defaultSettings; }
}
function saveSettings(s: KlingSettings) { try { localStorage.setItem(SK, JSON.stringify(s)); } catch {} }

type SavedProject = { title: string; script: string; chars: string[]; bg: string; scenes: ParsedScene[] };
function loadProject(): SavedProject | null {
  try { const p = localStorage.getItem(PK); return p ? JSON.parse(p) : null; } catch { return null; }
}
function saveProject(p: SavedProject) { try { localStorage.setItem(PK, JSON.stringify(p)); } catch {} }

/* ─── Tiny helpers ───────────────────────────────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
  pending:    'bg-zinc-300 dark:bg-zinc-600',
  generating: 'bg-amber-400 animate-pulse',
  done:       'bg-emerald-400',
  error:      'bg-red-400',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', generating: 'Generating…', done: 'Ready ✓', error: 'Error',
};

/* ─── Component ──────────────────────────────────────────────────────────────── */
export default function Studio() {
  /* state */
  const [tab, setTab]                 = useState<ActiveTab>('script');
  const [title, setTitle]             = useState('My Kids Video');
  const [script, setScript]           = useState('');
  const [selectedChars, setChars]     = useState(['poppy', 'buddy', 'mimi']);
  const [defaultBg, setDefaultBg]     = useState('garden');
  const [scenes, setScenes]           = useState<ParsedScene[]>([]);
  const [settings, setSettings]       = useState<KlingSettings>(loadSettings);
  const [draft, setDraft]             = useState<KlingSettings>(loadSettings);
  const [showSettings, setShowSett]   = useState(false);
  const [isGenerating, setGenerating] = useState(false);
  const [previewIdx, setPreviewIdx]   = useState(0);
  const [isPlaying, setPlaying]       = useState(false);
  const [darkMode, setDark]           = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const pollMap    = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  /* dark-mode toggle on root */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  /* load saved project */
  useEffect(() => {
    const p = loadProject();
    if (!p) return;
    setTitle(p.title); setScript(p.script); setChars(p.chars); setDefaultBg(p.bg);
    setScenes(p.scenes.map(s => ({ ...s, status: s.status === 'generating' ? 'pending' : s.status })));
  }, []);

  /* persist project */
  useEffect(() => {
    if (!script && !scenes.length) return;
    saveProject({ title, script, chars: selectedChars, bg: defaultBg, scenes });
  }, [title, script, selectedChars, defaultBg, scenes]);

  /* cleanup polls */
  useEffect(() => () => Object.values(pollMap.current).forEach(clearInterval), []);

  /* derived */
  const doneScenes   = scenes.filter(s => s.status === 'done' && s.videoUrl);
  const pendingCount = scenes.filter(s => s.status === 'pending' || s.status === 'error').length;
  const cost         = estimateCost(pendingCount, settings.clipDuration);
  const curScene     = doneScenes[previewIdx];

  /* ── parse ─────────────────────────────────────────────────────────────── */
  const handleParse = useCallback(() => {
    if (!script.trim()) { toast.error('Write a script first'); return; }
    const parsed = parseScript(script, defaultBg, selectedChars);
    if (!parsed.length) { toast.error('Could not find any scenes'); return; }
    setScenes(parsed);
    setTab('scenes');
    toast.success(`Found ${parsed.length} scene${parsed.length > 1 ? 's' : ''} 🎬`);
  }, [script, defaultBg, selectedChars]);

  /* ── poll one scene ────────────────────────────────────────────────────── */
  const pollScene = useCallback((scene: ParsedScene) => {
    if (!scene.taskId) return;
    const iv = setInterval(async () => {
      try {
        const r = await checkKlingTask(scene.taskId!, settings.accessKey, settings.secretKey);
        if (r.status === 'succeed') {
          clearInterval(iv); delete pollMap.current[scene.id];
          setScenes(prev => prev.map(s =>
            s.id === scene.id ? { ...s, status: 'done', videoUrl: r.videoUrl, thumbnailUrl: r.thumbnailUrl } : s
          ));
          toast.success(`Scene ${scene.index + 1} ready! 🎉`);
        } else if (r.status === 'failed') {
          clearInterval(iv); delete pollMap.current[scene.id];
          setScenes(prev => prev.map(s =>
            s.id === scene.id ? { ...s, status: 'error', errorMessage: r.errorMessage ?? 'Failed' } : s
          ));
          toast.error(`Scene ${scene.index + 1} failed`);
        }
      } catch {
        clearInterval(iv); delete pollMap.current[scene.id];
      }
    }, 8000);
    pollMap.current[scene.id] = iv;
  }, [settings]);

  /* ── generate all ──────────────────────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    if (!settings.accessKey || !settings.secretKey) {
      setDraft(settings); setShowSett(true);
      toast.error('Add your Kling API keys first');
      return;
    }
    if (!scenes.length) { toast.error('Parse your script first'); return; }
    const pending = scenes.filter(s => s.status === 'pending' || s.status === 'error');
    if (!pending.length) { toast.info('All scenes are already done'); return; }

    setGenerating(true);
    toast.info(`Submitting ${pending.length} clip${pending.length > 1 ? 's' : ''} to Kling AI…`);

    for (const scene of pending) {
      try {
        setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, status: 'generating' } : s));
        const prompt = buildPrompt(scene);
        const neg    = getNegativePrompt();
        const { taskId } = await submitKlingTask(prompt, neg, settings.accessKey, settings.secretKey, settings.quality, settings.clipDuration);
        setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, taskId } : s));
        pollScene({ ...scene, taskId });
        await new Promise(r => setTimeout(r, 1500));
      } catch (err: any) {
        setScenes(prev => prev.map(s => s.id === scene.id ? { ...s, status: 'error', errorMessage: err.message } : s));
        toast.error(`Scene ${scene.index + 1}: ${err.message}`);
      }
    }
    setGenerating(false);
    toast.success('All submitted — clips generating in background ⏳');
    setTab('scenes');
  }, [scenes, settings, pollScene]);

  /* ── TTS narration ─────────────────────────────────────────────────────── */
  const speak = (text: string) => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85; u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  };

  /* ── video playback ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (videoRef.current && curScene?.videoUrl) {
      videoRef.current.src = curScene.videoUrl;
      if (isPlaying) videoRef.current.play();
    }
  }, [previewIdx, curScene]);

  const handleVideoEnd = () => {
    if (previewIdx < doneScenes.length - 1) {
      const next = previewIdx + 1;
      setPreviewIdx(next);
      if (doneScenes[next]?.narration) speak(doneScenes[next].narration);
    } else { setPlaying(false); window.speechSynthesis?.cancel(); }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) { videoRef.current.pause(); window.speechSynthesis?.cancel(); setPlaying(false); }
    else { videoRef.current.play(); if (curScene?.narration) speak(curScene.narration); setPlaying(true); }
  };

  /* ── character toggle ──────────────────────────────────────────────────── */
  const toggleChar = (id: string) =>
    setChars(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  /* ── save settings ─────────────────────────────────────────────────────── */
  const handleSaveSettings = () => {
    setSettings(draft); saveSettings(draft); setShowSett(false);
    toast.success('Settings saved ✓');
  };

  /* ─────────────────────────────────────────────────────────────────────── */
  const tabBtn = (t: ActiveTab, label: string) => (
    <button
      key={t} onClick={() => setTab(t)}
      className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
        tab === t
          ? 'border-violet-500 text-violet-600 dark:text-violet-400'
          : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >{label}</button>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col">
      <Toaster richColors position="top-center" />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <span className="text-xl">🎬</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="font-black text-sm sm:text-base bg-transparent border-none outline-none flex-1 min-w-0 text-gray-900 dark:text-white"
            placeholder="Video title…"
          />
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            {scenes.length > 0 && (
              <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">
                {doneScenes.length}/{scenes.length} ready
              </span>
            )}
            {!settings.accessKey && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full border border-amber-300 dark:border-amber-700">
                No API key
              </span>
            )}
            <button
              onClick={() => { setDraft(settings); setShowSett(true); }}
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
              title="Settings"
            >⚙️</button>
            <button
              onClick={() => setDark(d => !d)}
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
            >{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </header>

      {/* ── Tab bar (mobile only) ─────────────────────────────────────────── */}
      <nav className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 lg:hidden sticky top-14 z-30">
        {tabBtn('script', '📝 Script')}
        {tabBtn('scenes', `🎬 Scenes${scenes.length ? ` (${scenes.length})` : ''}`)}
        {tabBtn('preview', '▶ Preview')}
      </nav>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 lg:py-6">
        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">

          {/* ── LEFT: Script panel ──────────────────────────────────────── */}
          <div className={`flex flex-col gap-4 ${tab !== 'script' ? 'hidden lg:flex' : ''}`}>

            {/* Characters */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Characters</p>
              <div className="flex flex-wrap gap-2">
                {Object.values(CHARACTERS).map(c => (
                  <button
                    key={c.id} onClick={() => toggleChar(c.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-all ${
                      selectedChars.includes(c.id)
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-violet-300'
                    }`}
                  >
                    <span>{c.emoji}</span><span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Backgrounds */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Default Background</p>
              <div className="flex flex-wrap gap-2">
                {Object.values(BACKGROUNDS).map(bg => (
                  <button
                    key={bg.id} onClick={() => setDefaultBg(bg.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-all ${
                      defaultBg === bg.id
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-violet-300'
                    }`}
                  >
                    {bg.emoji} {bg.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Script textarea */}
            <div className="flex-1 flex flex-col">
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder={`Write your story scene by scene. For example:\n\nScene 1: Poppy hops into the sunny garden carrying a basket of seeds. She waves happily and says "Hello friends! Let's plant a garden today!"\n\nScene 2: Buddy the puppy arrives with a small shovel and starts digging a hole. Poppy watches and claps excitedly.\n\nScene 3: Mimi the cat waters the seeds with a watering can. All three friends smile at their little garden together.`}
                className="flex-1 min-h-[300px] lg:min-h-[380px] w-full rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 resize-none focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 font-mono leading-relaxed transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                {script.length} chars · use "quotes" for dialogue · each scene ≈ 5s of video
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleParse}
                disabled={!script.trim()}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-sm transition-colors shadow-md shadow-violet-200 dark:shadow-none"
              >
                🔍 Parse into Scenes
              </button>
              {scenes.length > 0 && (
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm transition-colors shadow-md shadow-emerald-200 dark:shadow-none flex items-center gap-2"
                >
                  {isGenerating
                    ? <><span className="animate-spin inline-block">⟳</span> Submitting…</>
                    : <>🚀 Generate{cost > 0 ? <span className="font-normal opacity-80 text-xs">(~${cost.toFixed(2)})</span> : ''}</>
                  }
                </button>
              )}
            </div>

            {/* Tips box */}
            {!script && (
              <div className="rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-4 text-sm space-y-1.5">
                <p className="font-black text-violet-700 dark:text-violet-400 text-xs uppercase tracking-wide">💡 Writing tips</p>
                <p className="text-gray-600 dark:text-gray-400">• Name characters: <strong>Poppy</strong>, <strong>Buddy</strong>, <strong>Mimi</strong>…</p>
                <p className="text-gray-600 dark:text-gray-400">• Use <strong>"quotes"</strong> for dialogue — becomes narration</p>
                <p className="text-gray-600 dark:text-gray-400">• Mention the place: <em>garden, beach, space</em>…</p>
                <p className="text-gray-600 dark:text-gray-400">• 24 scenes ≈ 2-minute video · costs ~$3.36</p>
              </div>
            )}
          </div>

          {/* ── RIGHT: Scenes + Preview ──────────────────────────────────── */}
          <div className={`flex flex-col gap-4 ${tab === 'script' ? 'hidden lg:flex' : ''}`}>

            {/* Scenes list */}
            <div className={tab === 'preview' ? 'hidden lg:block' : ''}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-black text-base hidden lg:block">🎬 Scenes</p>
                {scenes.length > 0 && (
                  <p className="text-xs text-gray-400">{doneScenes.length}/{scenes.length} done</p>
                )}
              </div>

              {scenes.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-10 text-center text-gray-400">
                  <p className="text-4xl mb-2">🎭</p>
                  <p className="font-bold text-sm">No scenes yet</p>
                  <p className="text-xs mt-1">Write your script and click "Parse into Scenes"</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[55vh] lg:max-h-[calc(100vh-340px)] overflow-y-auto pr-0.5">
                  {scenes.map(scene => (
                    <div
                      key={scene.id}
                      className={`rounded-2xl border-2 p-3.5 transition-all ${
                        scene.status === 'done'       ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20' :
                        scene.status === 'error'      ? 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20' :
                        scene.status === 'generating' ? 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20' :
                        'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLOR[scene.status]}`} />
                          <span className="text-xs font-black text-gray-500 dark:text-gray-400">Scene {scene.index + 1}</span>
                          <span className="text-xs text-gray-400">
                            {BACKGROUNDS[scene.setting]?.emoji} {scene.characters.map(c => CHARACTERS[c]?.emoji).join('')}
                          </span>
                        </div>
                        <span className={`text-xs font-bold flex-shrink-0 ${
                          scene.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' :
                          scene.status === 'error' ? 'text-red-500' :
                          scene.status === 'generating' ? 'text-amber-600 dark:text-amber-400' :
                          'text-gray-400'
                        }`}>
                          {STATUS_LABEL[scene.status]}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-snug">
                        {scene.rawText.slice(0, 160)}{scene.rawText.length > 160 ? '…' : ''}
                      </p>

                      {scene.status === 'error' && scene.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">{scene.errorMessage}</p>
                      )}
                      {scene.status === 'generating' && (
                        <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 w-3/4 rounded-full shimmer" />
                        </div>
                      )}
                      {scene.status === 'done' && scene.videoUrl && (
                        <div className="flex gap-3 mt-2">
                          <button
                            onClick={() => {
                              const idx = doneScenes.findIndex(s => s.id === scene.id);
                              if (idx >= 0) { setPreviewIdx(idx); setTab('preview'); }
                            }}
                            className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                          >▶ Preview</button>
                          {scene.narration && (
                            <button onClick={() => speak(scene.narration)} className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                              🔊 Read aloud
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {scenes.length > 0 && tab === 'scenes' && (
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-100 dark:shadow-none"
                >
                  {isGenerating
                    ? <><span className="animate-spin">⟳</span> Submitting…</>
                    : <>🚀 Generate All {cost > 0 && <span className="font-normal opacity-80 text-xs">(~${cost.toFixed(2)})</span>}</>
                  }
                </button>
              )}
            </div>

            {/* Preview panel */}
            <div className={`flex flex-col gap-3 ${tab !== 'preview' ? 'hidden lg:flex' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="font-black text-base hidden lg:block">▶ Preview</p>
                {doneScenes.length > 0 && (
                  <p className="text-xs text-gray-400">{doneScenes.length} clip{doneScenes.length !== 1 ? 's' : ''} ready</p>
                )}
              </div>

              {doneScenes.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 aspect-video flex flex-col items-center justify-center text-gray-400 gap-2">
                  <p className="text-4xl">📺</p>
                  <p className="font-bold text-sm">No clips ready yet</p>
                  <p className="text-xs">Generate scenes to preview your video</p>
                </div>
              ) : (
                <>
                  {/* Player */}
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-gray-200 dark:border-gray-800 group">
                    <video
                      ref={videoRef}
                      src={curScene?.videoUrl}
                      className="w-full h-full object-contain"
                      onEnded={handleVideoEnd}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={togglePlay}
                        className="w-14 h-14 rounded-full bg-black/60 hover:bg-black/80 text-white text-2xl flex items-center justify-center transition-colors"
                      >
                        {isPlaying ? '⏸' : '▶'}
                      </button>
                    </div>
                    {curScene && (
                      <div className="absolute bottom-2 left-2">
                        <span className="text-xs text-white bg-black/60 px-2 py-0.5 rounded-full font-bold">
                          {curScene.index + 1} / {scenes.length}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                      disabled={previewIdx === 0}
                      className="w-9 h-9 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >⏮</button>
                    <button
                      onClick={togglePlay}
                      className="w-12 h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xl flex items-center justify-center transition-colors shadow-lg shadow-violet-200 dark:shadow-none"
                    >{isPlaying ? '⏸' : '▶'}</button>
                    <button
                      onClick={() => setPreviewIdx(Math.min(doneScenes.length - 1, previewIdx + 1))}
                      disabled={previewIdx === doneScenes.length - 1}
                      className="w-9 h-9 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >⏭</button>
                  </div>

                  {/* Thumbnail strip */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {doneScenes.map((s, i) => (
                      <button
                        key={s.id} onClick={() => setPreviewIdx(i)}
                        className={`flex-shrink-0 w-16 rounded-xl overflow-hidden border-2 transition-all ${
                          i === previewIdx ? 'border-violet-500' : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'
                        }`}
                      >
                        {s.thumbnailUrl
                          ? <img src={s.thumbnailUrl} alt="" className="w-full aspect-video object-cover" />
                          : <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-400 font-bold">{s.index + 1}</div>
                        }
                      </button>
                    ))}
                  </div>

                  {/* Narration */}
                  {curScene?.narration && (
                    <div className="rounded-2xl border-2 border-violet-100 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                      <p className="text-xs font-bold text-violet-500 mb-1">🔊 Narration</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{curScene.narration}</p>
                      <button
                        onClick={() => speak(curScene.narration)}
                        className="mt-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        Read aloud →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Settings Modal ────────────────────────────────────────────────── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowSett(false); }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-3xl border-2 border-gray-200 dark:border-gray-800 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b-2 border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="font-black text-base">⚙️ Kling API Settings</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Get keys at{' '}
                  <a href="https://klingai.com" target="_blank" rel="noopener noreferrer" className="text-violet-500 underline">klingai.com</a>
                </p>
              </div>
              <button onClick={() => setShowSett(false)} className="w-8 h-8 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {[
                { label: 'Access Key', key: 'accessKey' as const, placeholder: 'Your Kling access key' },
                { label: 'Secret Key', key: 'secretKey' as const, placeholder: 'Your Kling secret key' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                  <input
                    type="password"
                    value={draft[key]}
                    onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 dark:text-white transition-colors"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Quality</label>
                  <select
                    value={draft.quality}
                    onChange={e => setDraft(d => ({ ...d, quality: e.target.value as 'std' | 'pro' }))}
                    className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 dark:text-white"
                  >
                    <option value="std">Standard (~$0.14/clip)</option>
                    <option value="pro">Pro (~$0.28/clip)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Clip Length</label>
                  <select
                    value={draft.clipDuration}
                    onChange={e => setDraft(d => ({ ...d, clipDuration: Number(e.target.value) as 5 | 10 }))}
                    className="w-full rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm focus:outline-none focus:border-violet-500 dark:text-white"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                  </select>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-900 rounded-2xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-black">🔑 How to get Kling API keys:</p>
                <p>1. Sign up at <strong>klingai.com</strong></p>
                <p>2. Go to your account → <strong>API</strong></p>
                <p>3. Create an <strong>Access Key</strong> + <strong>Secret Key</strong></p>
                <p>4. Add $10 credits to start (~3 full videos)</p>
                <p className="text-amber-600 dark:text-amber-400">🔒 Keys stay in your browser only</p>
              </div>
            </div>

            <div className="flex gap-3 p-5 pt-0">
              <button
                onClick={() => setShowSett(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >Cancel</button>
              <button
                onClick={handleSaveSettings}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors shadow-md shadow-violet-200 dark:shadow-none"
              >Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
