# DrainLift

Web dashboard para sa DrainLift, isang IoT drainage unit na nagbabantay sa waste compartment
ng canal at nagpapadala ng alert kapag puno na ito. Thesis project ito para sa mga barangay
na gustong maiwasan ang baradong kanal at pagbaha.

> Simulated (dummy) pa ang lahat ng data. Hindi pa nakakabit sa dashboard ang Raspberry Pi / Arduino unit.

## Pages

| Route            | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `/login`         | Sign in page                                                     |
| `/`              | Dashboard: live alert, device info, at notification history      |
| `/notifications` | Buong alert history na may filter (All / Acknowledged / Auto-Released) at pagination |
| `/about`         | Tungkol sa project at sa mga researchers                         |
| `/profile`       | Admin profile (pwedeng i-edit ang name, email, phone)            |

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
