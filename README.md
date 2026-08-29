# 🎬 Kids Video Studio

Make Pixar-style animated kids videos from a simple text script. Powered by Kling AI.

## How it works

1. **Write a script** — describe each scene in plain English
2. **Pick characters** — Poppy 🐰, Buddy 🐶, Mimi 🐱 and more
3. **Click Generate** — Kling AI renders each scene as a 3D animated clip
4. **Preview & narrate** — watch your video with browser text-to-speech

**Cost:** ~$3.36 per 2-minute video (24 clips × $0.14 at Kling standard quality).

## Setup

### 1. Clone & install
```bash
git clone https://github.com/ajkirat/animator
cd animator
npm install
```

### 2. Create a free Supabase project
Go to supabase.com → New project → copy your Project URL and anon key.

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env — paste your Supabase URL and anon key
```

### 4. Deploy the edge function (one-time)
```bash
npx supabase login
npx supabase functions deploy kling-proxy --project-ref YOUR_PROJECT_REF
```

### 5. Run locally
```bash
npm run dev
```

### 6. Add Kling API keys in the app
- Go to klingai.com → sign up → API → create keys
- In the app, click the gear icon and paste your Access Key + Secret Key
- Add $10 credits to start (about 3 full 2-min videos)

## Deploy to Vercel
1. Go to vercel.com → Import → select `animator`
2. Add environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
3. Deploy
