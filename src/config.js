

// ---------------------------------------------------------------------------
// Palette (soft pastel "clay" look, inspired by the reference images)
// ---------------------------------------------------------------------------
export const P = {
  wall: '#ffd36e', roof: '#b98af0', roofDark: '#9f6fe0', trim: '#f7b7c8',
  door: '#4cc3e0', glass: '#7fd8f2', frame: '#fff8f0', plinth: '#f2b7a0',
  chimney: '#e9a58b', knob: '#f5c542',
  grass: '#86d35b', grassDark: '#6cbf47', dirt: '#b07a52', path: '#f6d5c0',
  trunk: '#9a6a45', pine: '#4f9e5e', pineLight: '#5fb06c',
  bush: '#7dcb55', bushLight: '#97da68', stone: '#d4ccc2',
  petals: ['#ffffff', '#ffc2d9', '#c9b8ff', '#ffe08a'], petalCenter: '#ffd23f',
};

// Current design. Later milestones change this object from the UI.
// Who this house is for. Change these to personalize the sign, plaque and postcard.
export const HOME = { initials: 'C&T', number: '32' };

export const state = {
  // Room blocks "column,floor" (see layout.js); starts as 2 rooms, 1 floor.
  cells: ['0,0', '1,0'],
  doorCol: null,     // column of the front door; null = the middle ground room
  wallColor: P.wall,
  roofColor: P.roof,
  size: 1,           // overall scale of the house
  height: 1,         // floor height multiplier (squat ... tall)
  greenery: 0.5,     // 0 = bare lawn, 1 = overgrown with ivy
  style: 'cottage',
  night: false,      // evening mode
  extras: { fence: false },
  // Things in the garden: { id, type, u, v, rot }; u, v are relative to the
  // island (-1..1), or null for an item's default spot. Filled in by main.js.
  items: [],
  water: [],        // painted water cells "i,j" (see waterdata.js)
  // Per room front ("column,floor" -> 'double', 'bay', 'garage', ...) and per
  // column roof extra (column -> 'dormer' or 'chimney'); see fronts.js.
  fronts: {},
  sides: {},        // "column,floor,left|right|back" -> same kinds, for side and back walls
  roofs: { 1: 'chimney' },
  seed: 7,
};

// Architectural styles: each one is a set of choices, not separate artwork.
export const STYLES = {
  cottage: { label: 'Cottage', texture: 'siding', brick: true, roof: 'gable', window: 'cottage', door: 'cottage',
             trim: '#fff8f0', plinth: '#f2b7a0', wall: '#ffd36e', roofColor: '#b98af0' },
  modern:  { label: 'Modern', texture: 'panels', roof: 'flat', window: 'modern', door: 'modern',
             trim: '#3f4250', plinth: '#d9d4cc', wall: '#fff3df', roofColor: '#6f7fa8' },
  barn:    { label: 'Barn', texture: 'boards', brick: true, roof: 'gambrel', window: 'barn', door: 'barn',
             trim: '#fff8f0', plinth: '#c9b8a6', wall: '#d96a55', roofColor: '#6f7fa8' },
  castle:  { label: 'Castle', texture: 'stone', roof: 'battlements', window: 'arched', door: 'arched',
             trim: '#cfc6b8', plinth: '#a9a29a', wall: '#d8d0c3', roofColor: '#e06a9a',
             towers: true },
  canal:   { label: 'Dutch', texture: 'brick', roof: 'stepped', window: 'canal', door: 'canal', porchRoof: false,
             trim: '#fff8f0', plinth: '#8a8f99', wall: '#a8553f', roofColor: '#4d525c' },
  beach:   { label: 'Beach house', texture: 'siding', roof: 'gable', window: 'beach', door: 'beach', porchRoof: false,
             stilts: 1.15, sand: true, trim: '#ffffff', plinth: '#e8d3b0', wall: '#a9d4f5', roofColor: '#e6d6b4' },
};

export const SWATCHES = {
  wallColor: [
    ['#ffd36e', 'Butter'], ['#f9b8c4', 'Blush'], ['#a8e6c8', 'Mint'], ['#a9d4f5', 'Sky'],
    ['#fff3df', 'Cream'], ['#d96a55', 'Barn red'], ['#d8d0c3', 'Stone'], ['#a8553f', 'Brick'],
  ],
  roofColor: [
    ['#b98af0', 'Lavender'], ['#e0775a', 'Clay tile'], ['#6f7fa8', 'Slate'],
    ['#5fa67a', 'Moss'], ['#e06a9a', 'Berry'], ['#e8b866', 'Straw'], ['#4d525c', 'Anthracite'], ['#e6d6b4', 'Sand'],
  ],
};


export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
