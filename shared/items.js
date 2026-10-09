// Itens, preços e lojas. Todos os valores aqui são autoritativos no servidor.
import { START_CAPACITY, CAPACITY_STEP, CAPACITY_MAX } from './config.js';

// range: alcance do lançamento (px) · control: tamanho da zona e resposta do ponteiro
// resistance: segundos de tensão máxima tolerada antes de a linha arrebentar
export const RODS = {
  vara_bambu:     { id: 'vara_bambu',     name: 'Vara de Bambu',      tier: 1, price: 0,    range: 170, control: 1.00, resistance: 0.65, color: '#c9a35b', desc: 'Leve e honesta. Toda pescaria começa com ela.' },
  vara_fibra:     { id: 'vara_fibra',     name: 'Vara de Fibra',      tier: 2, price: 350,  range: 215, control: 1.12, resistance: 0.85, color: '#4fb0c6', desc: 'Mais alcance e um pouco mais de firmeza.' },
  vara_carbono:   { id: 'vara_carbono',   name: 'Vara de Carbono',    tier: 3, price: 1400, range: 260, control: 1.25, resistance: 1.05, color: '#3a3f4a', desc: 'Rígida e precisa, aguenta puxões fortes.' },
  vara_abissal:   { id: 'vara_abissal',   name: 'Vara Abissal',       tier: 4, price: 4200, range: 300, control: 1.38, resistance: 1.35, color: '#2c4fa3', desc: 'Forjada para peixes grandes e teimosos.' },
  vara_prismatica:{ id: 'vara_prismatica',name: 'Vara Prismática',    tier: 5, price: 9500, range: 340, control: 1.5,  resistance: 1.65, color: '#b48cff', desc: 'Cristal flexível que amortece cada arrancada.' },
};
export const ROD_ORDER = ['vara_bambu', 'vara_fibra', 'vara_carbono', 'vara_abissal', 'vara_prismatica'];

// Iscas: consumidas a cada lançamento. waitMult reduz a espera; rarity multiplica o peso das categorias.
export const BAITS = {
  minhoca:        { id: 'minhoca',        name: 'Minhoca',            pack: 10, price: 20,  waitMult: 0.85, rarity: {},                                      color: '#d98a8a', desc: 'Isca universal. Mordidas um pouco mais rápidas.' },
  camarao:        { id: 'camarao',        name: 'Camarão',            pack: 10, price: 45,  waitMult: 0.75, rarity: { uncommon: 1.15 },                     color: '#ff9b73', desc: 'Peixes de recife adoram. Mais incomuns.' },
  minhoca_lodo:   { id: 'minhoca_lodo',   name: 'Minhoca-do-Lodo',    pack: 10, price: 55,  waitMult: 0.72, rarity: { uncommon: 1.2, rare: 1.08 },          color: '#7a6a3a', desc: 'Cheiro forte de mangue. Atrai os desconfiados.' },
  krill:          { id: 'krill',          name: 'Krill Congelado',    pack: 10, price: 70,  waitMult: 0.75, rarity: { rare: 1.2 },                          color: '#ff7a7a', desc: 'Pequenino e irresistível para peixes raros.' },
  grilo_brasa:    { id: 'grilo_brasa',    name: 'Grilo-de-Brasa',     pack: 10, price: 85,  waitMult: 0.65, rarity: { uncommon: 1.2, rare: 1.2 },           color: '#ff6a2a', desc: 'Ainda quentinho. Mordidas rápidas e fortes.' },
  isca_luminosa:  { id: 'isca_luminosa',  name: 'Isca Luminosa',      pack: 10, price: 120, waitMult: 0.7,  rarity: { rare: 1.3, legendary: 1.15 },         color: '#9ff6ff', desc: 'Brilha no escuro. Leve ajuda com os mais raros.' },
};

// Cosméticos: slot 'hat' (personagem), 'paint' e 'flag' (barco). Sem efeito na pesca.
export const COSMETICS = {
  chapeu_palha:      { id: 'chapeu_palha',      slot: 'hat',   name: 'Chapéu de Palha',     price: 120, color: '#e8c770', desc: 'Sombra fresquinha para o sol tropical.' },
  chapeu_explorador: { id: 'chapeu_explorador', slot: 'hat',   name: 'Chapéu de Explorador',price: 180, color: '#a08a5c', desc: 'Pronto para qualquer canal do mangue.' },
  gorro_la:          { id: 'gorro_la',          slot: 'hat',   name: 'Gorro de Lã',         price: 160, color: '#d6455a', desc: 'Com pompom. Indispensável no gelo.' },
  bandana_brasa:     { id: 'bandana_brasa',     slot: 'hat',   name: 'Bandana de Brasa',    price: 200, color: '#ff6a2a', desc: 'Resiste ao calor das fontes termais.' },
  tiara_cristal:     { id: 'tiara_cristal',     slot: 'hat',   name: 'Tiara de Cristal',    price: 600, color: '#b79bff', desc: 'Brilha suavemente à noite.' },
  bone_capitao:      { id: 'bone_capitao',      slot: 'hat',   name: 'Quepe de Capitão',    price: 300, color: '#f4f4f4', desc: 'Para quem já conhece todas as rotas.' },
  pintura_coral:     { id: 'pintura_coral',     slot: 'paint', name: 'Pintura Coral',       price: 150, color: '#ff7b6b', desc: 'Casco coral com faixa creme.' },
  pintura_musgo:     { id: 'pintura_musgo',     slot: 'paint', name: 'Pintura Musgo',       price: 170, color: '#5f8a3a', desc: 'Camuflagem perfeita entre as raízes.' },
  pintura_gelo:      { id: 'pintura_gelo',      slot: 'paint', name: 'Pintura Glacial',     price: 190, color: '#9fd8f0', desc: 'Azul gelo com detalhes brancos.' },
  pintura_basalto:   { id: 'pintura_basalto',   slot: 'paint', name: 'Pintura Basalto',     price: 220, color: '#3a3a40', desc: 'Grafite com friso laranja.' },
  pintura_ametista:  { id: 'pintura_ametista',  slot: 'paint', name: 'Pintura Ametista',    price: 650, color: '#8a55e0', desc: 'Violeta profundo com reflexos.' },
  bandeira_peixe:    { id: 'bandeira_peixe',    slot: 'flag',  name: 'Bandeira de Peixe',   price: 90,  color: '#ffd23f', desc: 'Um peixinho tremulando no mastro.' },
  bandeira_estrela:  { id: 'bandeira_estrela',  slot: 'flag',  name: 'Bandeira Estelar',    price: 260, color: '#7ff6ff', desc: 'Para navegantes da Ilha dos Cristais.' },
};

export function capacityUpgradePrice(currentCapacity) {
  if (currentCapacity >= CAPACITY_MAX) return null;
  const n = (currentCapacity - START_CAPACITY) / CAPACITY_STEP; // 0,1,2…
  return [150, 320, 600, 1000, 1600, 2400][n] ?? 3000;
}

// Lojas por ilha. Itens comuns + produtos regionais.
export const SHOPS = {
  tropical: {
    name: 'Cabana do Seu Coco', keeper: 'Seu Coco', theme: { bg: '#fff3d6', accent: '#ff8a3d', ink: '#5a3a1a', banner: '#2fc4b2' },
    greeting: 'Bem-vindo à cabana! Sol, sal e varas boas.',
    rods: ['vara_fibra', 'vara_carbono'], baits: ['minhoca', 'camarao'], cosmetics: ['chapeu_palha', 'pintura_coral', 'bandeira_peixe'],
  },
  mangue: {
    name: 'Palafita da Dona Lama', keeper: 'Dona Lama', theme: { bg: '#e9efd9', accent: '#5f8a3a', ink: '#2e3a1c', banner: '#8a6b3a' },
    greeting: 'Cuidado com as raízes, querido. O que vai levar?',
    rods: ['vara_fibra', 'vara_carbono'], baits: ['minhoca', 'minhoca_lodo'], cosmetics: ['chapeu_explorador', 'pintura_musgo', 'bandeira_peixe'],
  },
  congelada: {
    name: 'Iglu do Velho Bóris', keeper: 'Velho Bóris', theme: { bg: '#eef6fb', accent: '#3a7fc4', ink: '#1c2f45', banner: '#d6455a' },
    greeting: 'Feche a porta, está entrando frio! Varas de verdade aqui.',
    rods: ['vara_carbono', 'vara_abissal'], baits: ['minhoca', 'krill'], cosmetics: ['gorro_la', 'pintura_gelo', 'bone_capitao'],
  },
  vulcanica: {
    name: 'Forja da Brasa', keeper: 'Mestra Brasa', theme: { bg: '#2b2220', accent: '#ff7a2a', ink: '#ffe8d6', banner: '#ff4a1c' },
    greeting: 'Tudo aqui foi temperado no calor do vulcão.',
    rods: ['vara_carbono', 'vara_abissal'], baits: ['minhoca', 'grilo_brasa'], cosmetics: ['bandana_brasa', 'pintura_basalto', 'bone_capitao'],
  },
  cristais: {
    name: 'Santuário de Lumi', keeper: 'Lumi', theme: { bg: '#241a3d', accent: '#b48cff', ink: '#f1e8ff', banner: '#7ff6ff' },
    greeting: 'Os cristais cantaram que você viria.',
    rods: ['vara_abissal', 'vara_prismatica'], baits: ['minhoca', 'isca_luminosa'], cosmetics: ['tiara_cristal', 'pintura_ametista', 'bandeira_estrela'],
  },
};

export function shopSells(islandId, kind, id) {
  const s = SHOPS[islandId];
  if (!s) return false;
  if (kind === 'rod') return s.rods.includes(id);
  if (kind === 'bait') return s.baits.includes(id);
  if (kind === 'cosmetic') return s.cosmetics.includes(id);
  if (kind === 'capacity') return true;
  return false;
}
