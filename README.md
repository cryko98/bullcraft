# BullCraft ($BULLCRAFT)

Minecraft-style landing page for the BullCraft Solana memecoin, with a playable browser voxel game
where you are the bull: infinite procedural world, mining, building, crafting, day/night cycle and
local save in the browser (localStorage).

## Files

- `index.html` – landing page (hero, game, about, tokenomics, how to buy, roadmap, community)
- `style.css` – Minecraft-style theme
- `main.js` – page scripts (nav, copy CA, procedural CSS textures)
- `game.js` – the voxel game (Three.js from CDN, no build step)
- `bullcraft.png` – source logo; `favicon-*.png`, `apple-touch-icon.png`, `logo-*.png` are generated from it
- `vercel.json` – static hosting config

## Run locally

Any static server works, e.g.

```bash
npx --yes serve -l 5173 .
```

## Deploy

Push to GitHub and import the repo in Vercel as a static site (no build command, output directory `.`).

## Game controls

WASD move · Space jump · Shift sprint · Mouse look · Left click mine · Right click place · 1–9 / scroll hotbar ·
E inventory & crafting · F fly · F5 first/third person · Esc pause. Touch controls appear on phones.

## Before launch

Replace the contract address in `index.html` (`#caText`) and the social / swap links.
