# BullCraft ($BULLCRAFT)

Minecraft-style landing page for the BullCraft Solana memecoin, with a playable browser voxel game
where you are the bull: infinite procedural world, mining, building, crafting, day/night cycle and
local save in the browser (localStorage).

## Files

- `index.html` – landing page (hero, game, about, tokenomics, how to buy, roadmap, community)
- `style.css` – Minecraft-style theme
- `main.js` – page scripts (nav, copy CA, procedural CSS textures)
- `game/` – the voxel game modules (Three.js from CDN via import map, no build step)
- `bullcraft.png` – source logo; `favicon-*.png`, `apple-touch-icon.png`, `logo-*.png` are generated from it
- `vercel.json` – static hosting config

## Run locally

Any static server works, e.g.

```bash
npx --yes serve -l 5173 .
```

## Deploy

Push to GitHub and import the repo in Vercel as a static site (no build command, output directory `.`).

## Game

Survival game in the browser: health, hunger, fall damage, drowning, lava, day/night cycle, zombies at night,
cows and pigs, caves with coal / iron / gold / diamond ore, torches with real block lighting, tools with tiers and
durability, 2x2 and 3x3 crafting, furnace smelting, chests, item drops, XP levels and 24 advancements.

Controls: WASD move · Space jump (double-tap in Creative to fly) · Shift sneak · Ctrl or double-tap W sprint ·
Left click mine / attack · Right click place / use / eat · 1-9 and scroll hotbar · E inventory and crafting ·
Q drop (Ctrl+Q stack) · L advancements · F5 camera · F3 debug · Esc pause. Touch controls appear on phones.

Code lives in the game/ folder (constants, noise, textures, world, mesher, physics, models, entities, inventory, ui, main).

## Links

Contract: DwcXyhEcSvzWgakDKpetZLFvbAHutpGpzhbU4iempump · Telegram: https://t.me/bullcraftonsol
