/* BullCraft — block/item registry, recipes, smelting, advancements */
export const CHUNK = 16, HEIGHT = 64, WATER_LEVEL = 24;
export const SAVE_KEY = 'bullcraft_save_v2';
export const DAY_LENGTH = 1200; // seconds per full day (Minecraft: 20 min)

// ---- Block ids (< 100) ----
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LOG: 5, LEAVES: 6, PLANKS: 7, SAND: 8, GRAVEL: 9, WATER: 10,
  GLASS: 11, POPPY: 12, DANDELION: 13, TALLGRASS: 14, GOLD_BLOCK: 15, IRON_BLOCK: 16, DIAMOND_BLOCK: 17, BEDROCK: 18,
  CRAFTING: 19, FURNACE: 20, FURNACE_LIT: 21, COAL_ORE: 22, IRON_ORE: 23, GOLD_ORE: 24, DIAMOND_ORE: 25, TORCH: 26,
  SNOW: 27, STONE_BRICKS: 28, CHEST: 29, LAVA: 30, GLOWSTONE: 31, BOOKSHELF: 32
};
// ---- Item ids (>= 100) ----
export const I = {
  STICK: 100, COAL: 101, IRON_INGOT: 102, GOLD_INGOT: 103, DIAMOND: 104, APPLE: 105, GOLDEN_APPLE: 106,
  RAW_BEEF: 107, STEAK: 108, RAW_PORK: 109, COOKED_PORK: 110, LEATHER: 111, ROTTEN_FLESH: 112, BREAD: 113,
  WOOD_PICK: 120, STONE_PICK: 121, IRON_PICK: 122, GOLD_PICK: 123, DIAMOND_PICK: 124,
  WOOD_AXE: 130, STONE_AXE: 131, IRON_AXE: 132, GOLD_AXE: 133, DIAMOND_AXE: 134,
  WOOD_SHOVEL: 140, STONE_SHOVEL: 141, IRON_SHOVEL: 142, GOLD_SHOVEL: 143, DIAMOND_SHOVEL: 144,
  WOOD_SWORD: 150, STONE_SWORD: 151, IRON_SWORD: 152, GOLD_SWORD: 153, DIAMOND_SWORD: 154,
};

export const REG = {};
const six = t => [t, t, t, t, t, t];
function block(id, name, o = {}) { REG[id] = Object.assign({ id, name, block: true, maxStack: 64, hard: 1, tool: null, tier: 0 }, o); }
function item(id, name, o = {}) { REG[id] = Object.assign({ id, name, block: false, maxStack: 64 }, o); }

block(B.AIR, 'Air', { tiles: null });
block(B.GRASS, 'Grass Block', { tiles: ['grass_side', 'grass_side', 'grass_top', 'dirt', 'grass_side', 'grass_side'], hard: 0.6, tool: 'shovel', drop: B.DIRT });
block(B.DIRT, 'Dirt', { tiles: six('dirt'), hard: 0.5, tool: 'shovel' });
block(B.STONE, 'Stone', { tiles: six('stone'), hard: 1.5, tool: 'pickaxe', tier: 1, drop: B.COBBLE });
block(B.COBBLE, 'Cobblestone', { tiles: six('cobble'), hard: 2, tool: 'pickaxe', tier: 1 });
block(B.LOG, 'Oak Log', { tiles: ['log', 'log', 'log_top', 'log_top', 'log', 'log'], hard: 2, tool: 'axe' });
block(B.LEAVES, 'Oak Leaves', { tiles: six('leaves'), hard: 0.2, cutout: true, drop: 0, dropFn: r => r < 0.05 ? I.APPLE : r < 0.07 ? I.STICK : 0, light: 1 });
block(B.PLANKS, 'Oak Planks', { tiles: six('planks'), hard: 2, tool: 'axe', fuel: 15 });
block(B.SAND, 'Sand', { tiles: six('sand'), hard: 0.5, tool: 'shovel' });
block(B.GRAVEL, 'Gravel', { tiles: six('gravel'), hard: 0.6, tool: 'shovel' });
block(B.WATER, 'Water', { tiles: six('water'), liquid: true, noCollide: true, unbreakable: true, light: 2 });
block(B.GLASS, 'Glass', { tiles: six('glass'), hard: 0.3, cutout: true, drop: 0 });
block(B.POPPY, 'Poppy', { tiles: six('poppy'), hard: 0, cross: true, noCollide: true });
block(B.DANDELION, 'Dandelion', { tiles: six('dandelion'), hard: 0, cross: true, noCollide: true });
block(B.TALLGRASS, 'Grass', { tiles: six('tallgrass'), hard: 0, cross: true, noCollide: true, drop: 0 });
block(B.GOLD_BLOCK, 'Block of Gold', { tiles: six('gold_block'), hard: 3, tool: 'pickaxe', tier: 3 });
block(B.IRON_BLOCK, 'Block of Iron', { tiles: six('iron_block'), hard: 5, tool: 'pickaxe', tier: 2 });
block(B.DIAMOND_BLOCK, 'Block of Diamond', { tiles: six('diamond_block'), hard: 5, tool: 'pickaxe', tier: 3 });
block(B.BEDROCK, 'Bedrock', { tiles: six('bedrock'), unbreakable: true });
block(B.CRAFTING, 'Crafting Table', { tiles: ['craft_side', 'craft_side', 'craft_top', 'planks', 'craft_side', 'craft_side'], hard: 2.5, tool: 'axe', fuel: 15, use: 'crafting' });
block(B.FURNACE, 'Furnace', { tiles: ['furnace_side', 'furnace_side', 'furnace_top', 'furnace_top', 'furnace_front', 'furnace_side'], hard: 3.5, tool: 'pickaxe', tier: 1, use: 'furnace' });
block(B.FURNACE_LIT, 'Furnace', { tiles: ['furnace_side', 'furnace_side', 'furnace_top', 'furnace_top', 'furnace_front_lit', 'furnace_side'], hard: 3.5, tool: 'pickaxe', tier: 1, drop: B.FURNACE, use: 'furnace', light: 13 });
block(B.COAL_ORE, 'Coal Ore', { tiles: six('coal_ore'), hard: 3, tool: 'pickaxe', tier: 1, drop: I.COAL, xp: [0, 2] });
block(B.IRON_ORE, 'Iron Ore', { tiles: six('iron_ore'), hard: 3, tool: 'pickaxe', tier: 2 });
block(B.GOLD_ORE, 'Gold Ore', { tiles: six('gold_ore'), hard: 3, tool: 'pickaxe', tier: 3 });
block(B.DIAMOND_ORE, 'Diamond Ore', { tiles: six('diamond_ore'), hard: 3, tool: 'pickaxe', tier: 3, drop: I.DIAMOND, xp: [3, 7] });
block(B.TORCH, 'Torch', { tiles: six('torch'), hard: 0, cross: true, noCollide: true, light: 14, torch: true });
block(B.SNOW, 'Snow Block', { tiles: six('snow'), hard: 0.2, tool: 'shovel' });
block(B.STONE_BRICKS, 'Stone Bricks', { tiles: six('stone_bricks'), hard: 1.5, tool: 'pickaxe', tier: 1 });
block(B.CHEST, 'Chest', { tiles: ['chest_side', 'chest_side', 'chest_top', 'chest_top', 'chest_front', 'chest_side'], hard: 2.5, tool: 'axe', use: 'chest' });
block(B.LAVA, 'Lava', { tiles: six('lava'), liquid: true, noCollide: true, unbreakable: true, light: 15, damage: true });
block(B.GLOWSTONE, 'Glowstone', { tiles: six('glowstone'), hard: 0.3, light: 15 });
block(B.BOOKSHELF, 'Bookshelf', { tiles: ['bookshelf', 'bookshelf', 'planks', 'planks', 'bookshelf', 'bookshelf'], hard: 1.5, tool: 'axe', fuel: 15 });

item(I.STICK, 'Stick', { icon: 'stick', fuel: 5 });
item(I.COAL, 'Coal', { icon: 'coal', fuel: 80 });
item(I.IRON_INGOT, 'Iron Ingot', { icon: 'ingot', color: [216, 216, 216] });
item(I.GOLD_INGOT, 'Gold Ingot', { icon: 'ingot', color: [245, 212, 66] });
item(I.DIAMOND, 'Diamond', { icon: 'diamond' });
item(I.APPLE, 'Apple', { icon: 'apple', food: 4, sat: 2.4 });
item(I.GOLDEN_APPLE, 'Golden Apple', { icon: 'apple', color: [250, 215, 60], food: 4, sat: 9.6, heal: 4 });
item(I.RAW_BEEF, 'Raw Beef', { icon: 'meat', color: [200, 70, 70], food: 3, sat: 1.8 });
item(I.STEAK, 'Steak', { icon: 'meat', color: [120, 70, 40], food: 8, sat: 12.8 });
item(I.RAW_PORK, 'Raw Porkchop', { icon: 'meat', color: [240, 150, 150], food: 3, sat: 1.8 });
item(I.COOKED_PORK, 'Cooked Porkchop', { icon: 'meat', color: [200, 130, 80], food: 8, sat: 12.8 });
item(I.LEATHER, 'Leather', { icon: 'leather' });
item(I.ROTTEN_FLESH, 'Rotten Flesh', { icon: 'meat', color: [110, 120, 60], food: 4, sat: 0.8 });
item(I.BREAD, 'Bread', { icon: 'bread', food: 5, sat: 6 });

const TIERS = [
  { key: 'WOOD', name: 'Wooden', tier: 1, speed: 2, dur: 59, color: [156, 107, 60], mat: B.PLANKS },
  { key: 'STONE', name: 'Stone', tier: 2, speed: 4, dur: 131, color: [143, 143, 143], mat: B.COBBLE },
  { key: 'IRON', name: 'Iron', tier: 3, speed: 6, dur: 250, color: [216, 216, 216], mat: I.IRON_INGOT },
  { key: 'GOLD', name: 'Golden', tier: 1, speed: 12, dur: 32, color: [245, 212, 66], mat: I.GOLD_INGOT },
  { key: 'DIAMOND', name: 'Diamond', tier: 4, speed: 8, dur: 1561, color: [78, 230, 224], mat: I.DIAMOND },
];
const TOOL_TYPES = [
  { key: 'PICK', name: 'Pickaxe', type: 'pickaxe', dmg: [2, 3, 4, 2, 5], shape: ['MMM', '.S.', '.S.'] },
  { key: 'AXE', name: 'Axe', type: 'axe', dmg: [7, 9, 9, 7, 9], shape: ['MM.', 'MS.', '.S.'] },
  { key: 'SHOVEL', name: 'Shovel', type: 'shovel', dmg: [2.5, 3.5, 4.5, 2.5, 5.5], shape: ['M', 'S', 'S'] },
  { key: 'SWORD', name: 'Sword', type: 'sword', dmg: [4, 5, 6, 4, 7], shape: ['M', 'M', 'S'] },
];
export const TOOL_RECIPES = [];
TOOL_TYPES.forEach(tt => TIERS.forEach((tier, ti) => {
  const id = I[tier.key + '_' + tt.key];
  item(id, tier.name + ' ' + tt.name, { icon: tt.type, color: tier.color, maxStack: 1, toolType: tt.type, tier: tier.tier, speed: tier.speed, dur: tier.dur, dmg: tt.dmg[ti], fuel: ti === 0 ? 10 : 0 });
  TOOL_RECIPES.push({ out: [id, 1], shape: tt.shape, key: { M: tier.mat, S: I.STICK } });
}));

export const PLACEABLE = Object.values(REG).filter(r => r.block && r.id !== B.AIR && !r.unbreakable && r.id !== B.FURNACE_LIT).map(r => r.id).concat([B.WATER, B.LAVA, B.BEDROCK]);
export const CREATIVE_ITEMS = PLACEABLE.concat(Object.values(REG).filter(r => !r.block).map(r => r.id));

export const isSolid = id => id !== B.AIR && !REG[id].noCollide;
export const isOpaque = id => id !== B.AIR && !REG[id].cutout && !REG[id].cross && !REG[id].liquid;
export const blocksLight = id => id !== B.AIR && !REG[id].cross && !REG[id].liquid && id !== B.GLASS;

// ---- Recipes ----
// shape: array of rows, key: char -> id ; shapeless: array of ids
export const RECIPES = [
  { out: [B.PLANKS, 4], shapeless: [B.LOG] },
  { out: [I.STICK, 4], shape: ['P', 'P'], key: { P: B.PLANKS } },
  { out: [B.CRAFTING, 1], shape: ['PP', 'PP'], key: { P: B.PLANKS } },
  { out: [B.FURNACE, 1], shape: ['CCC', 'C.C', 'CCC'], key: { C: B.COBBLE } },
  { out: [B.CHEST, 1], shape: ['PPP', 'P.P', 'PPP'], key: { P: B.PLANKS } },
  { out: [B.TORCH, 4], shape: ['C', 'S'], key: { C: I.COAL, S: I.STICK } },
  { out: [B.STONE_BRICKS, 4], shape: ['SS', 'SS'], key: { S: B.STONE } },
  { out: [B.GOLD_BLOCK, 1], shape: ['GGG', 'GGG', 'GGG'], key: { G: I.GOLD_INGOT } },
  { out: [B.IRON_BLOCK, 1], shape: ['III', 'III', 'III'], key: { I: I.IRON_INGOT } },
  { out: [B.DIAMOND_BLOCK, 1], shape: ['DDD', 'DDD', 'DDD'], key: { D: I.DIAMOND } },
  { out: [I.GOLD_INGOT, 9], shapeless: [B.GOLD_BLOCK] },
  { out: [I.IRON_INGOT, 9], shapeless: [B.IRON_BLOCK] },
  { out: [I.DIAMOND, 9], shapeless: [B.DIAMOND_BLOCK] },
  { out: [I.GOLDEN_APPLE, 1], shape: ['GGG', 'GAG', 'GGG'], key: { G: I.GOLD_INGOT, A: I.APPLE } },
  { out: [B.BOOKSHELF, 1], shape: ['PPP', 'LLL', 'PPP'], key: { P: B.PLANKS, L: I.LEATHER } },
  { out: [B.GLOWSTONE, 1], shape: ['CG', 'GC'], key: { C: I.COAL, G: B.GLASS } },
  { out: [I.BREAD, 1], shape: ['TTT'], key: { T: B.TALLGRASS } },
  ...TOOL_RECIPES,
];

export const SMELTING = {
  [B.IRON_ORE]: { out: I.IRON_INGOT, xp: 0.7 },
  [B.GOLD_ORE]: { out: I.GOLD_INGOT, xp: 1 },
  [B.SAND]: { out: B.GLASS, xp: 0.1 },
  [B.COBBLE]: { out: B.STONE, xp: 0.1 },
  [B.LOG]: { out: I.COAL, xp: 0.15 },
  [I.RAW_BEEF]: { out: I.STEAK, xp: 0.35 },
  [I.RAW_PORK]: { out: I.COOKED_PORK, xp: 0.35 },
};
export const SMELT_TIME = 10; // seconds per item

// ---- Advancements (tasks) ----
export const ADVANCEMENTS = [
  { id: 'wood', name: 'Getting Wood', desc: 'Punch a tree and pick up an oak log', icon: B.LOG, check: s => s.obtained[B.LOG] },
  { id: 'planks', name: 'Benchmarking', desc: 'Craft a crafting table', icon: B.CRAFTING, check: s => s.crafted[B.CRAFTING] },
  { id: 'pick', name: 'Time to Mine!', desc: 'Craft a wooden pickaxe', icon: I.WOOD_PICK, check: s => s.crafted[I.WOOD_PICK] },
  { id: 'stone', name: 'Stone Age', desc: 'Mine stone with a pickaxe', icon: B.COBBLE, check: s => s.obtained[B.COBBLE] },
  { id: 'spick', name: 'Getting an Upgrade', desc: 'Craft a stone pickaxe', icon: I.STONE_PICK, check: s => s.crafted[I.STONE_PICK] },
  { id: 'torch', name: 'Light It Up', desc: 'Place a torch', icon: B.TORCH, check: s => s.placed[B.TORCH] },
  { id: 'furnace', name: 'Hot Topic', desc: 'Craft a furnace', icon: B.FURNACE, check: s => s.crafted[B.FURNACE] },
  { id: 'iron', name: 'Acquire Hardware', desc: 'Smelt an iron ingot', icon: I.IRON_INGOT, check: s => s.smelted[I.IRON_INGOT] },
  { id: 'ipick', name: "Isn't It Iron Pick", desc: 'Craft an iron pickaxe', icon: I.IRON_PICK, check: s => s.crafted[I.IRON_PICK] },
  { id: 'gold', name: 'Bull Market', desc: 'Obtain a gold ingot', icon: I.GOLD_INGOT, check: s => s.obtained[I.GOLD_INGOT] },
  { id: 'goldblock', name: 'Shiny Herd', desc: 'Craft a block of gold', icon: B.GOLD_BLOCK, check: s => s.crafted[B.GOLD_BLOCK] },
  { id: 'diamond', name: 'Diamonds!', desc: 'Obtain a diamond', icon: I.DIAMOND, check: s => s.obtained[I.DIAMOND] },
  { id: 'dsword', name: 'Diamond Sword', desc: 'Craft a diamond sword', icon: I.DIAMOND_SWORD, check: s => s.crafted[I.DIAMOND_SWORD] },
  { id: 'chest', name: 'Treasure Chest', desc: 'Craft a chest', icon: B.CHEST, check: s => s.crafted[B.CHEST] },
  { id: 'house', name: 'Home Sweet Home', desc: 'Place 64 blocks', icon: B.PLANKS, check: s => s.placedTotal >= 64 },
  { id: 'stack', name: 'Fully Stacked', desc: 'Collect 64 cobblestone', icon: B.COBBLE, check: s => (s.obtained[B.COBBLE] || 0) >= 64 },
  { id: 'cow', name: 'Cow Tipper', desc: 'Harvest some leather', icon: I.LEATHER, check: s => s.obtained[I.LEATHER] },
  { id: 'food', name: 'Delicious Dish', desc: 'Eat a cooked steak or porkchop', icon: I.STEAK, check: s => s.eaten[I.STEAK] || s.eaten[I.COOKED_PORK] },
  { id: 'zombie', name: 'Monster Hunter', desc: 'Kill a zombie', icon: I.ROTTEN_FLESH, check: s => s.killed.zombie },
  { id: 'night', name: 'Night Owl', desc: 'Survive a full night', icon: B.GLOWSTONE, check: s => s.nights >= 1 },
  { id: 'deep', name: 'Deep Dive', desc: 'Dig down to Y=8', icon: B.BEDROCK, check: s => s.minY <= 8 },
  { id: 'sky', name: 'Sky High', desc: 'Climb to Y=60', icon: B.SNOW, check: s => s.maxY >= 60 },
  { id: 'gapple', name: 'Golden Bull', desc: 'Craft a golden apple', icon: I.GOLDEN_APPLE, check: s => s.crafted[I.GOLDEN_APPLE] },
  { id: 'lvl10', name: 'Experienced', desc: 'Reach XP level 10', icon: I.DIAMOND, check: s => s.maxLevel >= 10 },
];

export const MOB_TYPES = {
  cow: { name: 'Cow', hp: 10, w: 0.9, h: 1.4, speed: 1.6, drops: [[I.RAW_BEEF, 1, 3], [I.LEATHER, 0, 2]], xp: [1, 3], hostile: false },
  pig: { name: 'Pig', hp: 10, w: 0.9, h: 0.9, speed: 1.8, drops: [[I.RAW_PORK, 1, 3]], xp: [1, 3], hostile: false },
  zombie: { name: 'Zombie', hp: 20, w: 0.6, h: 1.95, speed: 2.3, drops: [[I.ROTTEN_FLESH, 0, 2]], xp: [5, 5], hostile: true, dmg: 3 },
};
