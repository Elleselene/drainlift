# DrainLift

Web dashboard para sa DrainLift, isang IoT drainage unit na nagbabantay sa waste compartment
ng canal at nagpapadala ng alert kapag puno na ito. Thesis project ito para sa mga barangay
na gustong maiwasan ang baradong kanal at pagbaha.

> Naka-Supabase na ang login, admin profile, at notification state — permanente na ang mga
> ito (see "Supabase setup" sa baba). Ang ultrasonic sensor / actuator hardware pa rin ang
> simulated, gamit ang "Simulate Alert" / "Mark Waste Removed" na buttons sa Dashboard, at ang
> `POST /api/sensor-reading` endpoint na tatawagin balang araw ng totoong Arduino/Raspberry Pi.

## Pages

| Route            | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `/login`         | Sign in gamit ang totoong Supabase Auth account                  |
| `/`              | Dashboard: live alert (mula sa Supabase), device info, notification history |
| `/notifications` | Buong alert history na may filter (All / Acknowledged / Auto-Released) at pagination |
| `/about`         | Tungkol sa project at sa mga researchers                         |
| `/profile`       | Admin profile mula sa Supabase (pwedeng i-edit ang name, phone, role) |

## Supabase setup (kailangan bago gumana ang login at ang backend)

Ang totoong login, admin profile, at ang notification state (FULL/NOT_FULL, acknowledge,
release) ay naka-store na sa Supabase (isang libreng hosted na Postgres database + Auth
service) — hindi na sa RAM lang ng server o sa browser localStorage.

**1. Gumawa ng Supabase account at project**

1. Pumunta sa [supabase.com](https://supabase.com), mag-sign up (pwede gamit ang GitHub)
2. **New Project** — pumili ng pangalan, password (para sa database — i-save ito), at region
   (pumili ng malapit, hal. Singapore)
3. Hintayin matapos ang pag-setup (1-2 minuto)

**2. Patakbuhin ang schema**

1. Sa Supabase dashboard, pumunta sa **SQL Editor** (kaliwang sidebar) → **New query**
2. Buksan ang `supabase/schema.sql` na kasama sa project na ito, i-copy ang buong laman
3. I-paste sa SQL Editor, i-click **Run**
4. Dapat walang error — nagawa na ang mga tables (`profiles`, `notification_state`,
   `notification_history`)

**3. Gumawa ng unang admin account**

1. Sa Supabase dashboard, **Authentication** → **Users** → **Add user** → **Create new user**
2. Ilagay ang email at password ng unang barangay admin (ito ang gagamitin sa login page)
3. I-check ang **"Auto Confirm User"** (para hindi na kailangan ng email verification)
4. Awtomatikong magkakaroon ng profile row ang user na ito (name, phone, role) — pwede mo
   itong i-edit sa **Profile** page ng app pagkatapos mag-login

**4. Kunin ang mga API key**

1. Sa Supabase dashboard, **Project Settings** (gear icon) → **API**
2. Kukunin mo ang tatlong ito:
   - **Project URL** (hal. `https://xxxxxxxxxxxx.supabase.co`)
   - **anon / public** key
   - **service_role** key (**LIHIM ITO** — hindi dapat makita ng ibang tao)

**5. I-configure locally (para sa `npm run dev`)**

1. I-copy ang `.env.example` bilang bagong file na `.env` (parehong folder)
2. Palitan ng totoong values ang apat na variable doon (galing sa hakbang 4)
3. I-restart ang `npm run dev` kung tumatakbo ito

**6. I-configure sa Render (para sa live/deployed na version)**

1. Sa Render dashboard, buksan ang `drainlift` web service
2. **Environment** tab (kaliwang sidebar)
3. Idagdag ang apat na environment variable (parehong pangalan sa `.env` mo):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. I-save — awtomatiko nitong ire-restart/re-deploy ang service gamit ang mga bagong values

## Paano gumagana ang alert

1. Kapag puno na ang waste compartment, may lalabas na alert sa dashboard.
2. Pwedeng i-**acknowledge** ng barangay responder ang alert.
3. Kung walang nag-acknowledge sa loob ng 5 minutes, kusang **nagre-release** ang unit
   para hindi maiwang barado ang canal.

## Tech stack

- TanStack Start (file-based routing + SSR)
- React + TypeScript
- Tailwind CSS v4
- shadcn/ui components (nasa `src/components/ui`)
- Vite, may Nitro para sa build output

## Paano patakbuhin

Kailangan ng Node.js at npm.

```sh
npm install
npm run dev
```

Buksan ang http://localhost:8080

Iba pang commands:

```sh
npm run build     # production build (lalabas sa .output/)
npm run start     # patakbuhin ang production build (node .output/server/index.mjs)
npm run preview   # i-preview ang production build gamit ang vite preview
npm run lint      # ESLint
npm run format    # Prettier
```

## Pag-deploy sa Render

Naka-configure na ang project para gumana bilang plain Node.js web service — ito ang gamit ng
Render. Ang server (Nitro `node-server` preset) ay awtomatikong nakikinig sa `PORT` na
environment variable na ibinibigay ni Render, kaya walang kailangang i-configure pa dito.

**Opsyon A — Gamit ang `render.yaml` (Blueprint, pinakamadali)**

1. I-push ang project sa isang GitHub repository.
2. Sa Render dashboard: **New** → **Blueprint** → ikonekta ang repo.
3. Mababasa ni Render ang `render.yaml` na nasa root ng project at awtomatikong ise-setup ang
   lahat (build command, start command, atbp).
4. I-click ang **Apply** / **Create**.

**Opsyon B — Manual setup (New Web Service)**

1. Sa Render dashboard: **New** → **Web Service** → ikonekta ang GitHub repo.
2. I-set ang mga sumusunod:
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
3. I-click ang **Create Web Service**.

Aabutin ng ilang minuto ang unang deploy. Kapag tapos na, may lalabas na live URL galing kay
Render (hal. `https://drainlift.onrender.com`).

> Note: kung gagamitin sa ibang host na Cloudflare Workers imbes na plain Node (hal. Render,
> Railway), palitan ang `NITRO_PRESET` environment variable sa build step (hal.
> `NITRO_PRESET=cloudflare-module npm run build`). Default na "node-server" ang preset, ito ang
> gamit ng Render.

## Folder structure

```
src/
  routes/          # bawat file = isang page (__root.tsx ang layout na balot sa lahat)
  components/
    dl/            # sariling components ng DrainLift (AppShell, primitives)
    ui/            # shadcn/ui components
  lib/
    drainlift.ts   # dummy data at helper functions
    app-state.tsx  # theme, login session, at profile (React Context)
  styles.css       # colors, fonts, at custom Tailwind utilities
  server.ts        # server entry na may error page
```
