// Paletas e clima visual de cada região.
import { T } from '/shared/islands.js';

const base = {
  [T.SAND]: '#f1dcaa', [T.GRASS]: '#7cc35a', [T.PATH]: '#d9bb83', [T.MUD]: '#7a6346', [T.SNOW]: '#eef5fb',
  [T.ICE]: '#bfe6f5', [T.BLACKSAND]: '#46424a', [T.BASALT]: '#5d575c', [T.LAVA]: '#ff6a1a', [T.CRYSTAL]: '#9d86d6',
  [T.RUIN]: '#b9b3c9', [T.DIRT]: '#9c7d57', [T.JUNGLE]: '#4f9d4a', [T.ASH]: '#7f7a7c', [T.MOSS]: '#6f8f45',
};

export const PALETTES = {
  tropical: {
    ground: { ...base, [T.JUNGLE]: '#62b052' },
    waterShallow: '#5fe0d6', waterDeep: '#1f8fb8', waterAbyss: '#17608f', foam: '#ffffff', waveTint: '#ffffff',
    reef: ['#ff8a80', '#ffb36b', '#ff6fa8', '#ffe07a', '#b388ff'],
    tint: 'rgba(255,214,150,0.07)', vignette: 0.18, light: 1, sky: '#6fd3e6',
    shoreShadow: 'rgba(10,70,90,0.22)', speck: '#ffffff',
  },
  mangue: {
    ground: { ...base, [T.MUD]: '#6b583c', [T.DIRT]: '#7d6845', [T.JUNGLE]: '#3f7a35', [T.MOSS]: '#5b7a34', [T.PATH]: '#a08055', [T.SAND]: '#c7b386' },
    waterShallow: '#7fae6a', waterDeep: '#3d6b48', waterAbyss: '#2a4f3a', foam: '#e8f3d0', waveTint: '#dff3c4',
    tint: 'rgba(40,90,40,0.16)', vignette: 0.32, light: 0.9, sky: '#7fae8a',
    shoreShadow: 'rgba(20,40,20,0.3)', speck: '#e8ffd0',
  },
  congelada: {
    ground: { ...base, [T.DIRT]: '#bdc6d0', [T.PATH]: '#dbe6ef', [T.SNOW]: '#f2f7fc', [T.ICE]: '#c6e8f6' },
    waterShallow: '#3d7fb3', waterDeep: '#1d4f86', waterAbyss: '#123566', foam: '#f4fbff', waveTint: '#e8f6ff',
    tint: 'rgba(120,170,230,0.12)', vignette: 0.24, light: 0.95, sky: '#a9d4f0',
    shoreShadow: 'rgba(10,30,70,0.3)', speck: '#ffffff',
  },
  vulcanica: {
    ground: { ...base, [T.DIRT]: '#7a6656', [T.PATH]: '#a08a74', [T.BLACKSAND]: '#2f2c31', [T.BASALT]: '#55525a', [T.ASH]: '#86807e' },
    waterShallow: '#3f8f9a', waterDeep: '#1f5468', waterAbyss: '#173a4c', foam: '#e9eef0', waveTint: '#ffd9b0',
    spring: '#7fd8d0',
    tint: 'rgba(255,90,30,0.13)', vignette: 0.36, light: 0.85, sky: '#c8735a',
    shoreShadow: 'rgba(0,0,0,0.35)', speck: '#ffcfa0',
  },
  cristais: {
    ground: { ...base, [T.SAND]: '#e6d6f2', [T.CRYSTAL]: '#8f78d0', [T.RUIN]: '#a9a3c4', [T.PATH]: '#b3abd2' },
    waterShallow: '#6a5fd0', waterDeep: '#3a2f8f', waterAbyss: '#261d63', foam: '#efe6ff', waveTint: '#f1d6ff',
    tint: 'rgba(60,30,140,0.28)', vignette: 0.42, light: 0.72, sky: '#3a2f6f',
    shoreShadow: 'rgba(20,0,60,0.35)', speck: '#d9c4ff',
  },
};

// Luzes de ambiente desenhadas com mistura aditiva (cor, raio)
export const LIGHTS = {
  torch: ['#ffb05a', 90], lamp: ['#ffd27a', 90], lantern_post: ['#ffe28a', 110], campfire: ['#ff9a3a', 150],
  crystal_big: ['#c79bff', 150], crystal_small: ['#9ff0ff', 70], glow_mushroom: ['#7ff6ff', 50], glow_plant: ['#a6ff9a', 55],
  crystal_lamp: ['#e2c4ff', 120], steam_vent: ['#ff7a2a', 70], lava_rock: ['#ff6a1a', 40], shop_vulcanica: ['#ff8a3a', 120],
  temple: ['#c9a8ff', 200], volcano: ['#ff5a1a', 320], cabin: ['#ffcf7a', 80], stilt_hut: ['#ffcf7a', 70],
};
