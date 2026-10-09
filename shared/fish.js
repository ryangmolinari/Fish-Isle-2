// As 50 espécies de Fish Isle — 10 por ilha (4 comuns, 3 incomuns, 2 raras, 1 lendária).
//
// Campos:
//   size [min,max] em cm · weight [min,max] em kg · value = moedas no tamanho médio
//   difficulty 0..1 (minigame) · behavior = padrão de movimento na luta
//   weight = peso relativo dentro da raridade (probabilidade final = chance da raridade × peso/soma)
//   art = especificação visual usada pelos três formatos (sprite, ícone e coleção)
//     shape: [proporção comprimento/altura, posição do ponto mais alto 0..1, cabeça arredondada 0..1,
//             espessura do pedúnculo 0..1, barriga relativa ao dorso]
//     tail/dorsal/anal/pectoral/mouth: formatos de nadadeira e boca
//     pattern: padrão de cor · extras: detalhes distintivos · colors: [dorso, barriga, detalhe, nadadeira]

import { RARITIES, RARITY_ORDER } from './config.js';

export const ISLAND_IDS = ['tropical', 'mangue', 'congelada', 'vulcanica', 'cristais'];

const S = (o) => o;

export const SPECIES = [
  // ───────────────────────── ILHA TROPICAL ─────────────────────────
  S({ id: 'sardinha_coral', name: 'Sardinha-Coral', island: 'tropical', rarity: 'common', weight: 34,
    desc: 'Pequena e veloz, nada em cardumes brilhantes perto dos recifes rasos.',
    size: [9, 18], kg: [0.04, 0.16], value: 8, difficulty: 0.06, behavior: 'smooth',
    art: { shape: [3.4, 0.42, 0.55, 0.22, 0.9], tail: 'fork', dorsal: 'small', anal: 'small', pectoral: 'small', mouth: 'small',
      pattern: 'stripeH', extras: ['shine'], colors: ['#3d8fc4', '#e9f6ff', '#ffd23f', '#8cc8ea'] } }),
  S({ id: 'listrado_lagoa', name: 'Listrado-da-Lagoa', island: 'tropical', rarity: 'common', weight: 28,
    desc: 'Laranja com faixas brancas; adora se esconder entre corais macios.',
    size: [7, 13], kg: [0.05, 0.2], value: 10, difficulty: 0.1, behavior: 'circler',
    art: { shape: [1.9, 0.45, 0.95, 0.42, 1.0], tail: 'round', dorsal: 'double', anal: 'small', pectoral: 'small', mouth: 'small',
      pattern: 'bandsV', extras: ['finEdge'], colors: ['#ff8a2a', '#ffb066', '#ffffff', '#ff9d42'] } }),
  S({ id: 'baiacu_bolinha', name: 'Baiacu-Bolinha', island: 'tropical', rarity: 'common', weight: 22,
    desc: 'Incha feito uma bola espinhosa quando se assusta. Fofo, mas não aperte.',
    size: [10, 22], kg: [0.2, 0.9], value: 13, difficulty: 0.14, behavior: 'sinker',
    art: { shape: [1.25, 0.5, 1.0, 0.3, 1.1], tail: 'fan', dorsal: 'small', anal: 'small', pectoral: 'small', mouth: 'beakShort',
      pattern: 'spots', extras: ['spikes', 'bigEye'], colors: ['#f2cf4a', '#fff6cf', '#8a5a2b', '#e6b83a'] } }),
  S({ id: 'agulhinha_turquesa', name: 'Agulhinha-Turquesa', island: 'tropical', rarity: 'common', weight: 16,
    desc: 'Corpo de lápis e bico pontudo; salta sobre as ondas quando assustada.',
    size: [20, 45], kg: [0.08, 0.4], value: 16, difficulty: 0.2, behavior: 'darter',
    art: { shape: [7.5, 0.5, 0.2, 0.3, 0.9], tail: 'fork', dorsal: 'rear', anal: 'rear', pectoral: 'small', mouth: 'needle',
      pattern: 'gradient', extras: ['shine'], colors: ['#1fb6b0', '#d9fffb', '#0b7f86', '#6fd8d0'] } }),

  S({ id: 'borboleta_recife', name: 'Borboleta-do-Recife', island: 'tropical', rarity: 'uncommon', weight: 40,
    desc: 'Disco amarelo com uma mancha-olho falsa para confundir predadores.',
    size: [10, 20], kg: [0.1, 0.45], value: 42, difficulty: 0.32, behavior: 'circler',
    art: { shape: [1.35, 0.42, 0.6, 0.35, 1.0], tail: 'round', dorsal: 'long', anal: 'long', pectoral: 'small', mouth: 'snout',
      pattern: 'eyespot', extras: ['eyeBand'], colors: ['#ffd84a', '#fff1a6', '#1f1f2e', '#ffc93b'] } }),
  S({ id: 'papagaio_arco_iris', name: 'Papagaio-Arco-Íris', island: 'tropical', rarity: 'uncommon', weight: 33,
    desc: 'Mastiga coral com seu bico e devolve areia branquinha às praias.',
    size: [25, 60], kg: [0.6, 4.2], value: 55, difficulty: 0.38, behavior: 'smooth',
    art: { shape: [2.3, 0.4, 0.9, 0.38, 0.95], tail: 'lunate', dorsal: 'long', anal: 'long', pectoral: 'small', mouth: 'beak',
      pattern: 'scales', extras: ['bump', 'faceLines'], colors: ['#3fcf8e', '#ffd0e4', '#ff6fa8', '#5ad3c0'] } }),
  S({ id: 'voador_celeste', name: 'Voador-Celeste', island: 'tropical', rarity: 'uncommon', weight: 27,
    desc: 'Abre as nadadeiras como asas e plana por dezenas de metros sobre o mar.',
    size: [18, 35], kg: [0.15, 0.6], value: 62, difficulty: 0.44, behavior: 'darter',
    art: { shape: [4.2, 0.4, 0.7, 0.3, 0.85], tail: 'deepFork', dorsal: 'small', anal: 'small', pectoral: 'wing', mouth: 'small',
      pattern: 'gradient', extras: ['shine'], colors: ['#2f6fd6', '#e8f2ff', '#7cc4ff', '#9fd4ff'] } }),

  S({ id: 'garoupa_coralina', name: 'Garoupa-Coralina', island: 'tropical', rarity: 'rare', weight: 60,
    desc: 'Vermelha com pintas azuis elétricas; guarda sua toca no recife com teimosia.',
    size: [40, 90], kg: [1.5, 9.0], value: 160, difficulty: 0.58, behavior: 'sinker',
    art: { shape: [2.5, 0.38, 0.75, 0.45, 1.05], tail: 'round', dorsal: 'spiky', anal: 'small', pectoral: 'round', mouth: 'big',
      pattern: 'dots', extras: ['bigLips'], colors: ['#d93a3a', '#ff9a7a', '#4fd2ff', '#c22f35'] } }),
  S({ id: 'vela_mirim', name: 'Peixe-Vela-Mirim', island: 'tropical', rarity: 'rare', weight: 40,
    desc: 'Ergue uma vela azul enorme nas costas e corta a água como uma lança.',
    size: [60, 140], kg: [3, 18], value: 210, difficulty: 0.66, behavior: 'darter',
    art: { shape: [5.0, 0.35, 0.3, 0.25, 0.85], tail: 'lunate', dorsal: 'sail', anal: 'small', pectoral: 'small', mouth: 'bill',
      pattern: 'bars', extras: ['shine'], colors: ['#1d4f9a', '#dfeaf7', '#56b6ff', '#2a6dd1'] } }),

  S({ id: 'rei_das_mares', name: 'Rei-das-Marés', island: 'tropical', rarity: 'legendary', weight: 1,
    desc: 'Dizem que as marés sobem para saudá-lo. Nadadeiras longas como véus dourados.',
    size: [120, 220], kg: [25, 70], value: 950, difficulty: 0.86, behavior: 'erratic',
    art: { shape: [2.8, 0.36, 0.8, 0.3, 1.0], tail: 'veil', dorsal: 'crown', anal: 'veil', pectoral: 'long', mouth: 'small',
      pattern: 'royal', extras: ['crown', 'whiskers', 'shine'], glow: '#7ff7e8', colors: ['#14b8a6', '#fff4c2', '#ffcd3c', '#f9d56e'] } }),

  // ───────────────────────── ILHA DO MANGUE ─────────────────────────
  S({ id: 'bagre_lodoso', name: 'Bagre-Lodoso', island: 'mangue', rarity: 'common', weight: 32,
    desc: 'Sente a comida pelos bigodes no fundo de lama dos canais.',
    size: [20, 45], kg: [0.3, 1.8], value: 12, difficulty: 0.1, behavior: 'sinker',
    art: { shape: [3.4, 0.3, 1.0, 0.35, 0.75], tail: 'fork', dorsal: 'tall', anal: 'long', pectoral: 'spine', mouth: 'whiskers',
      pattern: 'mottled', extras: ['flatHead', 'adipose'], colors: ['#6b5b45', '#d8ccb0', '#3e3426', '#7a6a50'] } }),
  S({ id: 'tainha_canal', name: 'Tainha-do-Canal', island: 'mangue', rarity: 'common', weight: 28,
    desc: 'Pula para fora d’água sem motivo aparente. Talvez só goste da vista.',
    size: [20, 50], kg: [0.2, 1.5], value: 13, difficulty: 0.14, behavior: 'smooth',
    art: { shape: [3.9, 0.45, 0.8, 0.32, 0.9], tail: 'fork', dorsal: 'double', anal: 'small', pectoral: 'small', mouth: 'small',
      pattern: 'stripeHmulti', extras: ['shine'], colors: ['#7f927a', '#eef1e6', '#5d6d58', '#94a38c'] } }),
  S({ id: 'saltinha_raiz', name: 'Saltinha-da-Raiz', island: 'mangue', rarity: 'common', weight: 24,
    desc: 'Anda na lama com as nadadeiras e tem olhos no topo da cabeça.',
    size: [8, 20], kg: [0.02, 0.12], value: 15, difficulty: 0.18, behavior: 'darter',
    art: { shape: [4.0, 0.2, 1.0, 0.45, 0.7], tail: 'round', dorsal: 'sailSpots', anal: 'long', pectoral: 'arm', mouth: 'small',
      pattern: 'freckles', extras: ['topEyes'], colors: ['#8a7b5c', '#e6dcc0', '#47c4ff', '#9c8a62'] } }),
  S({ id: 'peixe_folha', name: 'Peixe-Folha', island: 'mangue', rarity: 'common', weight: 16,
    desc: 'Imita uma folha caída. Fica imóvel até a presa chegar perto demais.',
    size: [6, 12], kg: [0.01, 0.05], value: 18, difficulty: 0.22, behavior: 'sinker',
    art: { shape: [2.1, 0.55, 0.15, 0.4, 1.0], tail: 'clear', dorsal: 'leaf', anal: 'leaf', pectoral: 'small', mouth: 'lip',
      pattern: 'veins', extras: ['chinBarbel'], colors: ['#a77b37', '#d7b26c', '#6b4a1f', '#c99b55'] } }),

  S({ id: 'robalo_sombrio', name: 'Robalo-Sombrio', island: 'mangue', rarity: 'uncommon', weight: 40,
    desc: 'Caçador de emboscada com uma risca escura impecável ao longo do corpo.',
    size: [35, 90], kg: [0.8, 7.0], value: 50, difficulty: 0.36, behavior: 'darter',
    art: { shape: [3.5, 0.4, 0.25, 0.36, 0.95], tail: 'fork', dorsal: 'double', anal: 'small', pectoral: 'small', mouth: 'underbite',
      pattern: 'lateralLine', extras: ['shine'], colors: ['#b9c4a8', '#f2f4ea', '#1d2418', '#a9b394'] } }),
  S({ id: 'enguia_musgo', name: 'Enguia-Musgo', island: 'mangue', rarity: 'uncommon', weight: 33,
    desc: 'Coberta de manchas cor de musgo, desliza entre as raízes sem fazer barulho.',
    size: [50, 120], kg: [0.5, 3.0], value: 58, difficulty: 0.43, behavior: 'erratic',
    art: { shape: [11, 0.4, 0.6, 0.85, 1.0], tail: 'eel', dorsal: 'eel', anal: 'eel', pectoral: 'small', mouth: 'small',
      pattern: 'marbled', extras: [], colors: ['#4f6b2b', '#b7c47a', '#2b3b16', '#5f7b37'] } }),
  S({ id: 'arqueiro_verde', name: 'Arqueiro-Verde', island: 'mangue', rarity: 'uncommon', weight: 27,
    desc: 'Derruba insetos das folhas com jatos d’água certeiros.',
    size: [12, 30], kg: [0.1, 0.7], value: 64, difficulty: 0.47, behavior: 'circler',
    art: { shape: [2.0, 0.6, 0.35, 0.4, 1.1], tail: 'round', dorsal: 'rear', anal: 'longRear', pectoral: 'small', mouth: 'upturned',
      pattern: 'blotches', extras: ['bigEye'], colors: ['#c6d36a', '#f6f6d8', '#1e2414', '#a9b552'] } }),

  S({ id: 'escamado_bronzeado', name: 'Escamado-Bronzeado', island: 'mangue', rarity: 'rare', weight: 55,
    desc: 'Gigante de escamas grossas que ficam vermelhas perto da cauda. Sobe para respirar.',
    size: [90, 200], kg: [15, 80], value: 230, difficulty: 0.62, behavior: 'sinker',
    art: { shape: [4.6, 0.35, 0.55, 0.55, 0.9], tail: 'round', dorsal: 'rear', anal: 'rear', pectoral: 'small', mouth: 'big',
      pattern: 'bigScalesRed', extras: ['flatHead'], colors: ['#5a6448', '#d8c9a2', '#c2412d', '#7e5a3a'] } }),
  S({ id: 'serpenteiro_malhado', name: 'Serpenteiro-Malhado', island: 'mangue', rarity: 'rare', weight: 45,
    desc: 'Cabeça de serpente, nadadeiras compridas e um temperamento péssimo.',
    size: [40, 100], kg: [1, 7], value: 200, difficulty: 0.7, behavior: 'erratic',
    art: { shape: [5.6, 0.4, 0.45, 0.6, 1.0], tail: 'round', dorsal: 'ribbon', anal: 'ribbon', pectoral: 'small', mouth: 'teeth',
      pattern: 'snake', extras: ['flatHead'], colors: ['#5b4a35', '#c9b38a', '#1f1810', '#4a3c2a'] } }),

  S({ id: 'anciao_raizes', name: 'Ancião-das-Raízes', island: 'mangue', rarity: 'legendary', weight: 1,
    desc: 'Um bagre colossal com bigodes que parecem raízes vivas. Tem musgo nas costas.',
    size: [180, 300], kg: [90, 220], value: 1250, difficulty: 0.9, behavior: 'sinker',
    art: { shape: [3.2, 0.3, 1.0, 0.45, 0.8], tail: 'fork', dorsal: 'tall', anal: 'long', pectoral: 'spine', mouth: 'rootWhiskers',
      pattern: 'bark', extras: ['moss', 'glowEye', 'flatHead'], glow: '#b6ff6a', colors: ['#3d3424', '#a89670', '#9ed65a', '#4f442f'] } }),

  // ───────────────────────── ILHA CONGELADA ─────────────────────────
  S({ id: 'bacalhau_gelo', name: 'Bacalhau-de-Gelo', island: 'congelada', rarity: 'common', weight: 32,
    desc: 'Três nadadeiras nas costas e um barbilho no queixo. Clássico do frio.',
    size: [30, 80], kg: [0.5, 5.0], value: 15, difficulty: 0.12, behavior: 'smooth',
    art: { shape: [3.4, 0.38, 0.75, 0.32, 0.95], tail: 'square', dorsal: 'triple', anal: 'double', pectoral: 'small', mouth: 'chinBarbel',
      pattern: 'speckled', extras: ['lateralWhite'], colors: ['#7b7d68', '#f0ecdc', '#4a4b3c', '#8c8d77'] } }),
  S({ id: 'arenque_prata', name: 'Arenque-Prata', island: 'congelada', rarity: 'common', weight: 28,
    desc: 'Brilha como moeda nova. Viaja em cardumes que parecem nuvens.',
    size: [15, 35], kg: [0.06, 0.4], value: 14, difficulty: 0.1, behavior: 'smooth',
    art: { shape: [4.3, 0.48, 0.5, 0.25, 1.05], tail: 'deepFork', dorsal: 'small', anal: 'small', pectoral: 'small', mouth: 'small',
      pattern: 'silver', extras: ['shine'], colors: ['#46668c', '#f4f8ff', '#9fb6d6', '#7e94b3'] } }),
  S({ id: 'capelim_azul', name: 'Capelim-Azul', island: 'congelada', rarity: 'common', weight: 24,
    desc: 'Miúdo e transparente nas bordas; é o lanche favorito de meio mundo gelado.',
    size: [10, 20], kg: [0.02, 0.06], value: 16, difficulty: 0.16, behavior: 'darter',
    art: { shape: [5.6, 0.5, 0.35, 0.22, 0.9], tail: 'fork', dorsal: 'small', anal: 'fringe', pectoral: 'small', mouth: 'small',
      pattern: 'gradient', extras: ['translucent'], colors: ['#2b78b8', '#e8f6ff', '#a5d8ff', '#b9dcf2'] } }),
  S({ id: 'escorpiao_neve', name: 'Escorpião-da-Neve', island: 'congelada', rarity: 'common', weight: 16,
    desc: 'Cabeçudo e cheio de espinhos, camufla-se nas pedras do fundo.',
    size: [12, 35], kg: [0.1, 0.9], value: 19, difficulty: 0.24, behavior: 'sinker',
    art: { shape: [2.6, 0.18, 0.9, 0.32, 0.8], tail: 'fan', dorsal: 'spiky', anal: 'small', pectoral: 'fanBig', mouth: 'big',
      pattern: 'mottled', extras: ['headSpines', 'flatHead'], colors: ['#8a6f84', '#efe2ea', '#4b3b48', '#b08aa6'] } }),

  S({ id: 'truta_aurora', name: 'Truta-Aurora', island: 'congelada', rarity: 'uncommon', weight: 40,
    desc: 'Pintas rosadas e barriga laranja que lembram a aurora boreal.',
    size: [25, 70], kg: [0.4, 4.5], value: 55, difficulty: 0.34, behavior: 'smooth',
    art: { shape: [3.6, 0.42, 0.65, 0.38, 0.95], tail: 'square', dorsal: 'small', anal: 'whiteEdge', pectoral: 'whiteEdge', mouth: 'small',
      pattern: 'charSpots', extras: ['adipose'], colors: ['#36505a', '#ff8c4a', '#ff9ccf', '#d8603a'] } }),
  S({ id: 'lobo_artico', name: 'Peixe-Lobo-Ártico', island: 'congelada', rarity: 'uncommon', weight: 33,
    desc: 'Dentes de quebrar mexilhão e uma cara de quem acordou cedo demais.',
    size: [50, 120], kg: [2, 18], value: 70, difficulty: 0.46, behavior: 'erratic',
    art: { shape: [5.0, 0.3, 0.95, 0.5, 0.95], tail: 'round', dorsal: 'eel', anal: 'eel', pectoral: 'round', mouth: 'fangs',
      pattern: 'bandsV', extras: ['grumpy'], colors: ['#6f7a86', '#c9d1d8', '#3a414a', '#5d6873'] } }),
  S({ id: 'bolota_gelo', name: 'Bolota-do-Gelo', island: 'congelada', rarity: 'uncommon', weight: 27,
    desc: 'Redonda, cheia de calombos e com uma ventosa na barriga para grudar nas pedras.',
    size: [20, 50], kg: [1, 6], value: 66, difficulty: 0.4, behavior: 'circler',
    art: { shape: [1.55, 0.45, 1.0, 0.35, 1.05], tail: 'round', dorsal: 'hump', anal: 'small', pectoral: 'round', mouth: 'small',
      pattern: 'lumpRows', extras: ['lumps'], colors: ['#4aa3a0', '#d5f0e6', '#2b6f6c', '#5ab8b3'] } }),

  S({ id: 'translucido_polar', name: 'Translúcido-Polar', island: 'congelada', rarity: 'rare', weight: 55,
    desc: 'Tem sangue sem cor e corpo quase invisível. Só os ossos denunciam sua forma.',
    size: [25, 55], kg: [0.4, 1.8], value: 220, difficulty: 0.64, behavior: 'darter',
    art: { shape: [4.4, 0.4, 0.2, 0.28, 0.9], tail: 'fan', dorsal: 'double', anal: 'long', pectoral: 'fanBig', mouth: 'croc',
      pattern: 'bones', extras: ['translucent'], colors: ['#d8eef7', '#ffffff', '#9cc6da', '#e6f6fc'] } }),
  S({ id: 'esturjao_nevado', name: 'Esturjão-Nevado', island: 'congelada', rarity: 'rare', weight: 45,
    desc: 'Placas ósseas em fileiras, focinho comprido e mais de cem invernos de idade.',
    size: [100, 250], kg: [20, 120], value: 260, difficulty: 0.7, behavior: 'sinker',
    art: { shape: [5.4, 0.35, 0.15, 0.25, 0.85], tail: 'shark', dorsal: 'rear', anal: 'rear', pectoral: 'small', mouth: 'snoutBarbels',
      pattern: 'scutes', extras: [], colors: ['#7d8a96', '#eef2f4', '#c9d3db', '#6a7682'] } }),

  S({ id: 'monarca_boreal', name: 'Monarca-Boreal', island: 'congelada', rarity: 'legendary', weight: 1,
    desc: 'Uma presa de gelo na testa e nadadeiras de cristal que tilintam debaixo d’água.',
    size: [150, 260], kg: [60, 160], value: 1500, difficulty: 0.92, behavior: 'erratic',
    art: { shape: [3.8, 0.38, 0.7, 0.3, 0.95], tail: 'iceFork', dorsal: 'iceSpikes', anal: 'small', pectoral: 'iceWing', mouth: 'small',
      pattern: 'aurora', extras: ['tusk', 'frost', 'shine'], glow: '#bfe9ff', colors: ['#2d4f8f', '#e9f6ff', '#8ff0ff', '#c4ecff'] } }),

  // ───────────────────────── ILHA VULCÂNICA ─────────────────────────
  S({ id: 'peixe_brasa', name: 'Peixe-Brasa', island: 'vulcanica', rarity: 'common', weight: 32,
    desc: 'Cor de carvão em brasa. Prefere as águas mornas perto das fontes.',
    size: [8, 20], kg: [0.03, 0.18], value: 17, difficulty: 0.12, behavior: 'smooth',
    art: { shape: [3.0, 0.45, 0.6, 0.3, 1.0], tail: 'fork', dorsal: 'small', anal: 'small', pectoral: 'small', mouth: 'small',
      pattern: 'ember', extras: ['shine'], colors: ['#c2381c', '#ffb347', '#ffe08a', '#e8582a'] } }),
  S({ id: 'carvaozinho', name: 'Carvãozinho', island: 'vulcanica', rarity: 'common', weight: 28,
    desc: 'Atarracado e preto, com rachaduras laranja como lava esfriando.',
    size: [10, 25], kg: [0.1, 0.5], value: 18, difficulty: 0.15, behavior: 'sinker',
    art: { shape: [1.9, 0.5, 1.0, 0.45, 1.0], tail: 'square', dorsal: 'hump', anal: 'small', pectoral: 'round', mouth: 'grumpy',
      pattern: 'lavaCracks', extras: [], colors: ['#24201f', '#3c3532', '#ff7a1a', '#2f2a28'] } }),
  S({ id: 'bodiao_cinza', name: 'Bodião-Cinza', island: 'vulcanica', rarity: 'common', weight: 24,
    desc: 'Limpa as rochas de basalto com os dentinhos. Tem riscas laranja no rosto.',
    size: [12, 30], kg: [0.08, 0.6], value: 20, difficulty: 0.18, behavior: 'circler',
    art: { shape: [3.0, 0.45, 0.8, 0.38, 0.95], tail: 'round', dorsal: 'long', anal: 'long', pectoral: 'small', mouth: 'buckTeeth',
      pattern: 'faceStripes', extras: [], colors: ['#7c8590', '#dfe3e8', '#ff8b3d', '#8f98a3'] } }),
  S({ id: 'tetra_termal', name: 'Tetra-Termal', island: 'vulcanica', rarity: 'common', weight: 16,
    desc: 'Pequenino, alto e com uma faixa vermelha que brilha na água quente.',
    size: [4, 9], kg: [0.005, 0.03], value: 22, difficulty: 0.22, behavior: 'darter',
    art: { shape: [2.2, 0.38, 0.6, 0.3, 1.25], tail: 'deepFork', dorsal: 'tall', anal: 'long', pectoral: 'small', mouth: 'small',
      pattern: 'neon', extras: ['adipose'], colors: ['#4e5a73', '#cfd8e6', '#ff2e4d', '#8ea0bd'] } }),

  S({ id: 'rocha_viva', name: 'Rocha-Viva', island: 'vulcanica', rarity: 'uncommon', weight: 40,
    desc: 'Parece uma pedra com verrugas — até abrir a boca de repente.',
    size: [20, 45], kg: [0.6, 3.0], value: 60, difficulty: 0.38, behavior: 'sinker',
    art: { shape: [2.0, 0.3, 1.0, 0.45, 0.85], tail: 'fan', dorsal: 'spiky', anal: 'small', pectoral: 'fanBig', mouth: 'upturnedBig',
      pattern: 'warts', extras: ['warts', 'flatHead'], colors: ['#6c5a4f', '#a8968a', '#c25b3a', '#5a4a40'] } }),
  S({ id: 'barracuda_fumegante', name: 'Barracuda-Fumegante', island: 'vulcanica', rarity: 'uncommon', weight: 33,
    desc: 'Longa, prateada e com marcas em V escuras. Ataca em linha reta.',
    size: [50, 150], kg: [2, 20], value: 74, difficulty: 0.46, behavior: 'darter',
    art: { shape: [6.2, 0.45, 0.15, 0.28, 0.9], tail: 'fork', dorsal: 'double', anal: 'small', pectoral: 'small', mouth: 'teethLong',
      pattern: 'chevron', extras: ['shine', 'underbite'], colors: ['#5d6873', '#eef0f2', '#2c3138', '#6e7884'] } }),
  S({ id: 'juba_lava', name: 'Juba-de-Lava', island: 'vulcanica', rarity: 'uncommon', weight: 27,
    desc: 'Nadadeiras em leque com listras vermelhas e brancas. Bonita e venenosa.',
    size: [15, 40], kg: [0.2, 1.3], value: 80, difficulty: 0.5, behavior: 'circler',
    art: { shape: [2.6, 0.4, 0.7, 0.38, 1.0], tail: 'fan', dorsal: 'lion', anal: 'small', pectoral: 'lionFan', mouth: 'small',
      pattern: 'zebra', extras: ['tentacles'], colors: ['#c63a2b', '#fff0e2', '#ffffff', '#e86a4c'] } }),

  S({ id: 'enguia_magma', name: 'Enguia-Magma', island: 'vulcanica', rarity: 'rare', weight: 55,
    desc: 'Corpo escuro com veias incandescentes. Deixa um rastro de bolhas quentes.',
    size: [60, 160], kg: [1, 9], value: 250, difficulty: 0.68, behavior: 'erratic',
    art: { shape: [12, 0.4, 0.5, 0.85, 1.0], tail: 'eel', dorsal: 'eel', anal: 'eel', pectoral: 'small', mouth: 'teeth',
      pattern: 'magmaVeins', extras: ['glowEye'], colors: ['#1b1616', '#382a26', '#ff6a00', '#2a2020'] } }),
  S({ id: 'cacao_basaltico', name: 'Cação-Basáltico', island: 'vulcanica', rarity: 'rare', weight: 45,
    desc: 'Pequeno tubarão de pele cinza-carvão, rondando as colunas de basalto.',
    size: [70, 160], kg: [6, 40], value: 280, difficulty: 0.72, behavior: 'darter',
    art: { shape: [4.3, 0.42, 0.25, 0.22, 0.85], tail: 'shark', dorsal: 'shark', anal: 'small', pectoral: 'shark', mouth: 'shark',
      pattern: 'countershade', extras: ['gills'], colors: ['#3f4650', '#d6dade', '#262b31', '#353b44'] } }),

  S({ id: 'fenix_profundezas', name: 'Fênix-das-Profundezas', island: 'vulcanica', rarity: 'legendary', weight: 1,
    desc: 'Renasce a cada erupção. Suas nadadeiras ondulam como labaredas.',
    size: [130, 240], kg: [40, 110], value: 1800, difficulty: 0.93, behavior: 'erratic',
    art: { shape: [3.3, 0.4, 0.7, 0.3, 1.0], tail: 'flame', dorsal: 'flame', anal: 'flame', pectoral: 'flame', mouth: 'small',
      pattern: 'phoenix', extras: ['crest', 'embers', 'shine'], glow: '#ffb03a', colors: ['#d8261c', '#ffe27a', '#ff8a1c', '#ffb02e'] } }),

  // ───────────────────────── ILHA DOS CRISTAIS ─────────────────────────
  S({ id: 'prisminho', name: 'Prisminho', island: 'cristais', rarity: 'common', weight: 32,
    desc: 'Corpo triangular de faces lisas que decompõe a luz em pequenos arco-íris.',
    size: [6, 14], kg: [0.02, 0.08], value: 20, difficulty: 0.14, behavior: 'darter',
    art: { shape: [1.6, 0.5, 0.0, 0.35, 1.0], tail: 'crystal', dorsal: 'none', anal: 'none', pectoral: 'small', mouth: 'small',
      pattern: 'prism', extras: ['facets'], colors: ['#b79bff', '#f3eaff', '#7ff0ff', '#d5c2ff'] } }),
  S({ id: 'peixe_lumen', name: 'Peixe-Lúmen', island: 'cristais', rarity: 'common', weight: 28,
    desc: 'Pontinhos luminosos ao longo do corpo piscam em sequência.',
    size: [8, 18], kg: [0.03, 0.12], value: 21, difficulty: 0.16, behavior: 'smooth',
    art: { shape: [3.6, 0.45, 0.85, 0.28, 0.9], tail: 'fork', dorsal: 'small', anal: 'small', pectoral: 'small', mouth: 'small',
      pattern: 'photophores', extras: ['bigEye', 'glowSpots'], colors: ['#24305e', '#5a6aa8', '#7dfcff', '#3a4a86'] } }),
  S({ id: 'vidrilho', name: 'Vidrilho', island: 'cristais', rarity: 'common', weight: 24,
    desc: 'Transparente como vidro; dá para ver a espinha e o coração batendo.',
    size: [5, 12], kg: [0.01, 0.04], value: 23, difficulty: 0.2, behavior: 'smooth',
    art: { shape: [2.6, 0.45, 0.65, 0.28, 1.1], tail: 'fork', dorsal: 'small', anal: 'long', pectoral: 'small', mouth: 'small',
      pattern: 'glass', extras: ['translucent', 'heart'], colors: ['#c8f2ff', '#ffffff', '#ff7aa8', '#dff8ff'] } }),
  S({ id: 'gema_rosada', name: 'Gema-Rosada', island: 'cristais', rarity: 'common', weight: 16,
    desc: 'Redondinha e cor-de-rosa, com escamas que lembram pedras lapidadas.',
    size: [8, 18], kg: [0.05, 0.3], value: 26, difficulty: 0.24, behavior: 'circler',
    art: { shape: [1.45, 0.5, 0.9, 0.35, 1.0], tail: 'fan', dorsal: 'tall', anal: 'tall', pectoral: 'small', mouth: 'pout',
      pattern: 'gemScales', extras: ['shine'], colors: ['#ff8fc2', '#ffe1f0', '#ffffff', '#ff6fae'] } }),

  S({ id: 'lanterneiro_abissal', name: 'Lanterneiro-Abissal', island: 'cristais', rarity: 'uncommon', weight: 40,
    desc: 'Atrai presas com uma lanterna na testa. Sorriso de dentes finos.',
    size: [15, 45], kg: [0.4, 3], value: 85, difficulty: 0.42, behavior: 'sinker',
    art: { shape: [1.7, 0.42, 1.0, 0.35, 1.05], tail: 'round', dorsal: 'small', anal: 'small', pectoral: 'small', mouth: 'angler',
      pattern: 'deep', extras: ['lure', 'smallEye'], colors: ['#3a2350', '#5d3a7a', '#a6fff2', '#4b2e66'] } }),
  S({ id: 'facetado_ametista', name: 'Facetado-Ametista', island: 'cristais', rarity: 'uncommon', weight: 33,
    desc: 'Placas de ametista cobrem as costas e brilham quando ele vira de lado.',
    size: [20, 50], kg: [0.6, 3.5], value: 92, difficulty: 0.48, behavior: 'smooth',
    art: { shape: [2.4, 0.45, 0.5, 0.36, 1.0], tail: 'crystal', dorsal: 'crystals', anal: 'small', pectoral: 'small', mouth: 'small',
      pattern: 'facetsBig', extras: ['facets'], colors: ['#7a3fc4', '#e7d7ff', '#c79bff', '#9b5ee0'] } }),
  S({ id: 'peixe_espelho', name: 'Peixe-Espelho', island: 'cristais', rarity: 'uncommon', weight: 27,
    desc: 'Alto e achatado como um espelho de mão; reflete as cores ao redor.',
    size: [20, 45], kg: [0.4, 2.2], value: 98, difficulty: 0.52, behavior: 'circler',
    art: { shape: [1.15, 0.5, 0.75, 0.3, 1.0], tail: 'lunate', dorsal: 'thread', anal: 'thread', pectoral: 'small', mouth: 'small',
      pattern: 'iridescent', extras: ['shine'], colors: ['#c4cde0', '#ffffff', '#b5a3ff', '#d6dceb'] } }),

  S({ id: 'dragao_cristalino', name: 'Dragão-Cristalino', island: 'cristais', rarity: 'rare', weight: 55,
    desc: 'Babados ondulantes e chifres de cristal. Nada como se dançasse.',
    size: [30, 70], kg: [0.8, 4], value: 300, difficulty: 0.7, behavior: 'erratic',
    art: { shape: [4.0, 0.4, 0.6, 0.3, 0.9], tail: 'frilly', dorsal: 'frilly', anal: 'frilly', pectoral: 'frilly', mouth: 'snout',
      pattern: 'dragonScales', extras: ['horns', 'frills', 'shine'], colors: ['#1fb7c9', '#d9fbff', '#ffe36e', '#7cf3e4'] } }),
  S({ id: 'oraculo_violeta', name: 'Oráculo-Violeta', island: 'cristais', rarity: 'rare', weight: 45,
    desc: 'Longuíssimo como uma fita, com crista vermelha. Aparece antes de grandes mudanças.',
    size: [150, 400], kg: [10, 60], value: 340, difficulty: 0.74, behavior: 'smooth',
    art: { shape: [13, 0.3, 0.7, 0.4, 0.9], tail: 'pointed', dorsal: 'crestRibbon', anal: 'none', pectoral: 'oar', mouth: 'small',
      pattern: 'oarSpots', extras: ['crest'], colors: ['#c9c2e6', '#f4f0ff', '#e0323e', '#e0323e'] } }),

  S({ id: 'guardiao_prismatico', name: 'Guardião-Prismático', island: 'cristais', rarity: 'legendary', weight: 1,
    desc: 'Couraça de cristal vivo e um chifre que guarda a luz de todas as ilhas.',
    size: [160, 300], kg: [70, 200], value: 2400, difficulty: 0.95, behavior: 'erratic',
    art: { shape: [2.9, 0.4, 0.6, 0.32, 1.0], tail: 'crystalBig', dorsal: 'crystalCrown', anal: 'crystals', pectoral: 'crystalWing', mouth: 'small',
      pattern: 'rainbowArmor', extras: ['horn', 'facets', 'shine', 'aura'], glow: '#e7b8ff', colors: ['#5b3fd1', '#f0e6ff', '#7ff6ff', '#b58cff'] } }),
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s, i) => [s.id, Object.assign(s, { index: i })]));

export function speciesForIsland(islandId) {
  return SPECIES.filter((s) => s.island === islandId);
}

// Tabela de probabilidades por ilha: [{id, p}] com soma 1.
export function spawnTable(islandId, rarityMult = {}) {
  const list = speciesForIsland(islandId);
  const out = [];
  let total = 0;
  for (const r of RARITY_ORDER) {
    const group = list.filter((s) => s.rarity === r);
    const wsum = group.reduce((a, s) => a + s.weight, 0);
    const chance = RARITIES[r].chance * (rarityMult[r] ?? 1);
    for (const s of group) {
      const p = chance * (s.weight / wsum);
      out.push({ id: s.id, p });
      total += p;
    }
  }
  for (const e of out) e.p /= total;
  return out;
}

export function rollSpecies(islandId, rand, rarityMult) {
  const table = spawnTable(islandId, rarityMult);
  let r = rand();
  for (const e of table) {
    if (r < e.p) return SPECIES_BY_ID[e.id];
    r -= e.p;
  }
  return SPECIES_BY_ID[table[table.length - 1].id];
}

// Tamanho tende ao meio do intervalo; peso acompanha o cubo do tamanho.
export function rollSize(species, rand) {
  const t = (rand() + rand() + rand()) / 3; // distribuição em sino
  const big = rand() < 0.04 ? 0.12 : 0;      // raros exemplares grandes
  const f = Math.min(1, t + big);
  const [a, b] = species.size;
  const cm = Math.round((a + (b - a) * f) * 10) / 10;
  const [wa, wb] = species.kg;
  const kg = Math.round((wa + (wb - wa) * f * f * f * 0.6 + (wb - wa) * f * 0.4) * 1000) / 1000;
  const value = Math.max(1, Math.round(species.value * (0.75 + 0.5 * f)));
  return { cm, kg, value, f };
}

export function formatProbability(id) {
  const s = SPECIES_BY_ID[id];
  const e = spawnTable(s.island).find((x) => x.id === id);
  return (e.p * 100).toFixed(e.p < 0.01 ? 2 : 1) + '%';
}
