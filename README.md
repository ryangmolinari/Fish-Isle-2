# Fish Isle 🎣

Jogo de pesca **multiplayer 2D top-down** para navegador. Até **12 jogadores por sala**, cinco ilhas
realmente diferentes, **50 espécies** colecionáveis, barcos com rota pontilhada, lojas regionais e um
minigame de tensão validado pelo servidor.

Toda a arte é desenhada por código (Canvas 2D) e empacotada em atlas em tempo de execução — não há
arquivos de imagem para baixar. O servidor não tem dependências externas.

---

## Como executar

Requisitos: **Node.js 18+** (os testes de integração usam o WebSocket nativo do **Node 22+**).

```bash
npm start              # http://localhost:3000
PORT=8080 npm start    # outra porta
```

Não é preciso `npm install`: o servidor HTTP e o WebSocket usam apenas módulos nativos do Node.
Abra o endereço em várias abas ou computadores da mesma rede para jogar juntos.

- **Jogar** entra numa sala pública com vaga (ou cria uma).
- **Criar sala** cria uma sala privada; o código de 5 letras aparece no canto superior direito (botão *copiar*).
- **Entrar** usa um código. Se a sala estiver cheia: *“A sala XXXXX está cheia (12/12). Tente outra sala ou crie uma nova.”*
- **Continuar** volta para a última sala com o mesmo personagem (até 30 min depois).

### Hospedagem
O jogo precisa de um processo Node com WebSocket (não roda só em hospedagem estática como o GitHub Pages).
Serviços como Render, Railway ou Fly.io funcionam: comando `npm start`, porta via `PORT`. As salas ficam
em memória — reiniciar o servidor encerra as salas.

## Controles

| Tecla | Ação |
|---|---|
| **WASD / setas** | Andar · no barco: W acelera, S freia/dá ré, A/D viram |
| **Mouse** | Mirar; segurar e soltar para lançar; segurar para recolher na luta |
| **Botão direito** | Cancelar a pesca |
| **E** | Interagir: loja, embarcar, desembarcar |
| **I** | Inventário e coleção |
| **M** | Mapa e destinos |
| **Esc** | Fechar janelas / abrir configurações |

Com qualquer janela aberta, os comandos do mundo ficam bloqueados.

## Como se joga

1. **Pesca:** aproxime-se da margem ou do píer, aponte para a água (o retículo fica verde) e **segure** o botão
   para carregar a força. Ao soltar, o personagem balança a vara, a linha sai da ponta e a boia faz um arco
   até a água, com respingo e círculos. Quando a boia afunda e aparece o **!**, clique a tempo.
2. **Minigame de tensão:** segure para recolher (a tensão sobe) e solte para afrouxar. Mantenha o ponteiro na
   **zona verde** até encher a barra. Na zona vermelha a linha arrebenta. Peixes mais raros têm zona menor,
   movimentos diferentes (suave, circular, afundador, arisco, errático) e puxões mais fortes.
3. **Pontos de pesca** borbulhantes (com sombras de peixes) dão mordidas mais rápidas e um pouco mais de raros.
4. **Loja (E no vendedor):** venda individual ou em lote com confirmação do valor, varas (5 níveis), iscas,
   mochila maior e cosméticos de personagem e de barco. Cada ilha tem visual e produtos próprios.
5. **Barcos:** no fim do cais aparece **“E — Entrar no barco”**. Escolha o destino no mapa (**M**) e siga a
   **rota pontilhada** até a passagem marcada por boias. A transição leva à outra ilha, perto da passagem de
   volta; uma nova rota leva até o cais. Desembarque com **E** perto de um cais.

## Estrutura

```
shared/          Código usado pelo servidor e pelo navegador (mesmos resultados nos dois lados)
  config.js      Balanceamento: raridades e probabilidades, pesca, rede, barcos
  fish.js        As 50 espécies (dados + especificação visual) e o sorteio
  islands.js     Geração determinística das 5 ilhas, colisão, cais, passagens e rotas (A*)
  items.js       Varas, iscas, cosméticos, lojas e preços
  minigame.js    Simulação determinística do minigame (validada pelo servidor)
  rng.js         Ruído e números pseudoaleatórios determinísticos
server/
  index.js       HTTP (arquivos do jogo) + salas
  ws.js          WebSocket RFC 6455 sem dependências
  room.js        Estado autoritativo: pesca, economia, barcos, viagens, reconexão
public/
  index.html, css/style.css
  js/game.js     Laço do jogo, câmera, movimento, barco, viagens, HUD
  js/fishing.js  Lançamento, mordida, minigame e animações locais da pesca
  js/entities.js Jogadores (vara, linha, boia, barco), interpolação dos remotos
  js/world/      Renderização da região e partículas (pool)
  js/art/        Arte procedural: peixes, personagens, objetos, terreno, barcos, paletas
  js/ui/         Menu, HUD, inventário/coleção, loja, mapa, configurações
  js/audio.js    Efeitos e ambiente de cada ilha (Web Audio, sem arquivos)
  dev/           Páginas de inspeção: catálogo de peixes, personagens, regiões
tests/           Testes de dados, servidor, navegador, carga e desempenho
```

## Arquitetura multiplayer

- **Servidor autoritativo.** Sorteio do peixe (na mordida), tamanho, valor, recompensas, compras, vendas,
  consumo de iscas e transições de região acontecem no servidor. O cliente nunca envia moedas nem capturas.
- **Minigame verificável.** O servidor envia a semente e os parâmetros; o cliente joga e devolve só a sequência
  de entradas (1 bit por passo de 1/30 s). O servidor **reproduz a simulação determinística** e confere o
  resultado e o tempo real decorrido — resultados forjados são rejeitados.
- **Movimento validado:** velocidade máxima, colisão e água navegável. Desvios recebem correção de posição.
- **Rede separada da renderização:** posições a 15 Hz; snapshots a 15 Hz **apenas para quem está na mesma
  ilha**; os remotos são interpolados com 120 ms de atraso.
- **Sala de 12:** conta todos os jogadores da sala, em qualquer ilha. Quem cai tem a vaga reservada por 45 s;
  o perfil fica guardado por 30 min. A mesma sessão aberta em outra aba derruba a anterior (nunca duplica).
  Desconexões no meio da pesca voltam o personagem ao estado normal.
- **Barcos:** cada jogador recebe o próprio barco ao embarcar, numa vaga livre ao lado do cais — com 12
  jogadores há barco para todos.

## Conteúdo

| Ilha | Identidade | Cais / loja |
|---|---|---|
| **Tropical** (inicial) | praias claras, coqueiros, recifes de coral, casinhas de madeira, mirante | Cabana do Seu Coco |
| **Mangue** | canais estreitos, passarelas, árvores com raízes aéreas, vitórias-régias, vaga-lumes | Palafita da Dona Lama |
| **Congelada** | neve, pinheiros, cabanas de toras, campo de gelo com buracos de pesca, fiordes | Iglu do Velho Bóris |
| **Vulcânica** | areia preta, colunas de basalto, rio de lava, fontes termais, vulcão fumegante | Forja da Brasa |
| **Cristais** | arquipélago com ruínas e templo, cristais luminosos, plantas bioluminescentes | Santuário de Lumi |

Cada ilha tem formato, terreno, objetos, iluminação, partículas, sons ambientes e 6–8 pontos de pesca próprios.

### Espécies (10 por ilha: 4 comuns, 3 incomuns, 2 raras, 1 lendária)

Probabilidades iniciais por categoria: **55% comum · 28% incomum · 14% rara · 3% lendária**, distribuídas
pelo `weight` de cada espécie. Iscas e pontos de pesca aplicam multiplicadores (configuráveis); nenhuma vara
garante lendários. Cada espécie tem sprite do mundo, ícone e imagem de coleção gerados pela mesma geometria
(veja `/dev/fish.html` com o servidor rodando).

<!-- tabela gerada a partir de shared/fish.js -->
**Ilha Tropical**

| Espécie | Raridade | Tamanho | Valor base | Dificuldade | Chance |
|---|---|---|---|---|---|
| Sardinha-Coral | ● Comum | 9–18 cm | 8 | 6% | 18.7% |
| Listrado-da-Lagoa | ● Comum | 7–13 cm | 10 | 10% | 15.4% |
| Baiacu-Bolinha | ● Comum | 10–22 cm | 13 | 14% | 12.1% |
| Agulhinha-Turquesa | ● Comum | 20–45 cm | 16 | 20% | 8.8% |
| Borboleta-do-Recife | ◆ Incomum | 10–20 cm | 42 | 32% | 11.2% |
| Papagaio-Arco-Íris | ◆ Incomum | 25–60 cm | 55 | 38% | 9.2% |
| Voador-Celeste | ◆ Incomum | 18–35 cm | 62 | 44% | 7.6% |
| Garoupa-Coralina | ★ Rara | 40–90 cm | 160 | 58% | 8.4% |
| Peixe-Vela-Mirim | ★ Rara | 60–140 cm | 210 | 66% | 5.6% |
| Rei-das-Marés | ♛ Lendária | 120–220 cm | 950 | 86% | 3.0% |

**Ilha do Mangue**

| Espécie | Raridade | Tamanho | Valor base | Dificuldade | Chance |
|---|---|---|---|---|---|
| Bagre-Lodoso | ● Comum | 20–45 cm | 12 | 10% | 17.6% |
| Tainha-do-Canal | ● Comum | 20–50 cm | 13 | 14% | 15.4% |
| Saltinha-da-Raiz | ● Comum | 8–20 cm | 15 | 18% | 13.2% |
| Peixe-Folha | ● Comum | 6–12 cm | 18 | 22% | 8.8% |
| Robalo-Sombrio | ◆ Incomum | 35–90 cm | 50 | 36% | 11.2% |
| Enguia-Musgo | ◆ Incomum | 50–120 cm | 58 | 43% | 9.2% |
| Arqueiro-Verde | ◆ Incomum | 12–30 cm | 64 | 47% | 7.6% |
| Escamado-Bronzeado | ★ Rara | 90–200 cm | 230 | 62% | 7.7% |
| Serpenteiro-Malhado | ★ Rara | 40–100 cm | 200 | 70% | 6.3% |
| Ancião-das-Raízes | ♛ Lendária | 180–300 cm | 1250 | 90% | 3.0% |

**Ilha Congelada**

| Espécie | Raridade | Tamanho | Valor base | Dificuldade | Chance |
|---|---|---|---|---|---|
| Bacalhau-de-Gelo | ● Comum | 30–80 cm | 15 | 12% | 17.6% |
| Arenque-Prata | ● Comum | 15–35 cm | 14 | 10% | 15.4% |
| Capelim-Azul | ● Comum | 10–20 cm | 16 | 16% | 13.2% |
| Escorpião-da-Neve | ● Comum | 12–35 cm | 19 | 24% | 8.8% |
| Truta-Aurora | ◆ Incomum | 25–70 cm | 55 | 34% | 11.2% |
| Peixe-Lobo-Ártico | ◆ Incomum | 50–120 cm | 70 | 46% | 9.2% |
| Bolota-do-Gelo | ◆ Incomum | 20–50 cm | 66 | 40% | 7.6% |
| Translúcido-Polar | ★ Rara | 25–55 cm | 220 | 64% | 7.7% |
| Esturjão-Nevado | ★ Rara | 100–250 cm | 260 | 70% | 6.3% |
| Monarca-Boreal | ♛ Lendária | 150–260 cm | 1500 | 92% | 3.0% |

**Ilha Vulcânica**

| Espécie | Raridade | Tamanho | Valor base | Dificuldade | Chance |
|---|---|---|---|---|---|
| Peixe-Brasa | ● Comum | 8–20 cm | 17 | 12% | 17.6% |
| Carvãozinho | ● Comum | 10–25 cm | 18 | 15% | 15.4% |
| Bodião-Cinza | ● Comum | 12–30 cm | 20 | 18% | 13.2% |
| Tetra-Termal | ● Comum | 4–9 cm | 22 | 22% | 8.8% |
| Rocha-Viva | ◆ Incomum | 20–45 cm | 60 | 38% | 11.2% |
| Barracuda-Fumegante | ◆ Incomum | 50–150 cm | 74 | 46% | 9.2% |
| Juba-de-Lava | ◆ Incomum | 15–40 cm | 80 | 50% | 7.6% |
| Enguia-Magma | ★ Rara | 60–160 cm | 250 | 68% | 7.7% |
| Cação-Basáltico | ★ Rara | 70–160 cm | 280 | 72% | 6.3% |
| Fênix-das-Profundezas | ♛ Lendária | 130–240 cm | 1800 | 93% | 3.0% |

**Ilha dos Cristais**

| Espécie | Raridade | Tamanho | Valor base | Dificuldade | Chance |
|---|---|---|---|---|---|
| Prisminho | ● Comum | 6–14 cm | 20 | 14% | 17.6% |
| Peixe-Lúmen | ● Comum | 8–18 cm | 21 | 16% | 15.4% |
| Vidrilho | ● Comum | 5–12 cm | 23 | 20% | 13.2% |
| Gema-Rosada | ● Comum | 8–18 cm | 26 | 24% | 8.8% |
| Lanterneiro-Abissal | ◆ Incomum | 15–45 cm | 85 | 42% | 11.2% |
| Facetado-Ametista | ◆ Incomum | 20–50 cm | 92 | 48% | 9.2% |
| Peixe-Espelho | ◆ Incomum | 20–45 cm | 98 | 52% | 7.6% |
| Dragão-Cristalino | ★ Rara | 30–70 cm | 300 | 70% | 7.7% |
| Oráculo-Violeta | ★ Rara | 150–400 cm | 340 | 74% | 6.3% |
| Guardião-Prismático | ♛ Lendária | 160–300 cm | 2400 | 95% | 3.0% |

## Balanceamento

- `shared/config.js` → `RARITIES[*].chance`, `FISHING` (espera, janela de reação, bônus dos pontos de pesca), barcos e rede.
- `shared/fish.js` → `weight`, `value`, `difficulty`, `size`, `kg` e `behavior` de cada espécie.
- `shared/items.js` → preços, alcance/controle/resistência das varas, efeitos das iscas, produtos de cada loja.
- `shared/minigame.js` → como dificuldade e vara viram tamanho da zona, puxões e resistência da linha.

Taxa de captura medida em 40 lutas por espécie com um jogador automático (habilidade 0,8), por raridade e vara:

| | Bambu | Fibra | Carbono | Abissal | Prismática |
|---|---|---|---|---|---|
| Comum | 100% | 100% | 100% | 100% | 100% |
| Incomum | 99% | 100% | 100% | 100% | 100% |
| Rara | 63% | 90% | 98% | 99% | 99% |
| Lendária | 2% | 10% | 45% | 77% | 92% |

O jogador automático reage quase sem erro; pessoas tendem a ficar abaixo desses valores. As varas melhores
ajudam na luta, mas não mudam a chance de um lendário morder (3%).

## Testes e validação

```bash
npm run test:data        # dados e mapas (50 espécies, 10/ilha, cais, rotas, chegadas, pontos de pesca)
npm test                 # integração do servidor com 12 clientes reais via WebSocket
node tests/bots.js --url ws://localhost:3000/ws --n 11 --secs 60   # carga: 11 jogadores simulados
python3 tests/e2e_full.py http://localhost:3000/                   # navegador: fluxo completo (Playwright)
python3 tests/perf12.py 3000 1280 720 high                         # FPS com 12 jogadores na mesma ilha
node tests/map-preview.js                                           # PNGs dos mapas de colisão
```

### Resultados (09/10/2026)

| Validação | Resultado |
|---|---|
| Dados e mapas (`npm run test:data`) | **27/27** — exatamente 50 espécies, 10 exclusivas por ilha (4/3/2/1), probabilidades 55/28/14/3, silhuetas distintas, spawn, loja e cais alcançáveis, barco cabe no cais, rotas até todas as passagens sem cruzar outras, chegadas ligadas ao mar aberto, pontos de pesca ao alcance da vara inicial, minigame determinístico |
| Servidor (`npm test`) | **15/15** — 12 entram pelo código, **13º recusado** com mensagem, reconexão restaura sem duplicar, mesma sessão em 2 abas derruba a antiga, lançamento em terra bloqueado, **luta forjada rejeitada**, ciclo de pesca com sorteio no servidor, venda com valor conferido e clique duplo sem duplicação, compra fora da loja recusada, viagem pelas 5 ilhas preservando inventário e moedas, desembarque longe do cais recusado, **12 barcos no mesmo cais** |
| Navegador (`tests/e2e_full.py`) | **43/43** — 3 capturas completas (carregar → lançar → boia na água → mordida → minigame → peixe apresentado), inventário (I), coleção, loja (E) com venda em lote confirmada e compra, mapa (M), embarque “E — Entrar no barco”, rota pontilhada, viagem e desembarque nas **5 ilhas** (Tropical → Mangue → Congelada → Vulcânica → Cristais → Tropical), dados preservados, **reconexão automática** sem duplicar, nenhum erro de JavaScript |
| Carga (`tests/bots.js`, 11 bots + 1 navegador) | sala 12/12; 0 correções de posição; bots pescando, vendendo, navegando e viajando entre ilhas ao mesmo tempo |
| Memória (`tests/memory.py`, 6 trocas de ilha) | heap JS entre 6 e 9 MB, sem crescimento contínuo (+1,3 MB entre a 2ª e a 6ª troca); blocos de terreno e atlas liberados a cada troca |

### Desempenho medido

Ambiente: Chromium 141 *headless* com Canvas 2D **rasterizado por software (sem GPU)**, contêiner Linux com
2 vCPUs e 8 GB; servidor e 11 bots rodando na mesma máquina. Cenário de pior caso: **12 jogadores na mesma ilha**,
câmera no píer com 7 jogadores pescando e os demais navegando por perto. 30 s de medição após aquecimento.

| Resolução | Qualidade | Resolução dinâmica | FPS médio | FPS mínimo | 10% piores | JS por quadro |
|---|---|---|---|---|---|---|
| 1280×720 | Alta | desligada | **58,3** | 50,3 | 54,2 | 1,3 ms |
| 1280×720 | Alta | ligada (ficou em 100%) | **57,8** | 38,7 | 56,0 | 1,3 ms |
| 1920×1080 | Alta | desligada | 35,1 | 28,1 | 30,0 | 1,2 ms |
| 1920×1080 | Média | desligada | 51,7 | 38,7 | 44,5 | 1,1 ms |
| 1920×1080 | Alta | ligada (estabilizou em 65%) | **59,0** | 50,0 | 56,0 | 1,4 ms |

Leitura: a lógica e as chamadas de desenho custam ~1,3 ms por quadro; o restante é rasterização de pixels,
que neste ambiente é feita pela CPU. Em 1280×720 o jogo fica perto de 60 FPS mesmo sem GPU. Em 1920×1080 a
qualidade Alta sem ajuste fica em ~35 FPS aqui; com a **resolução dinâmica** (ligada por padrão) a resolução
interna cai até manter ~60 FPS. Os mínimos isolados coincidem com a geração de blocos novos de terreno ao
explorar (limitada a 5 ms por quadro). Não houve medição em hardware físico com GPU; o contador em
*Configurações → Mostrar FPS* mostra o FPS real e a resolução interna em uso.

Otimizações aplicadas: só o que está na câmera é desenhado; o terreno é pré-renderizado em blocos de 256 px
(água + terra fundidas num só bitmap, LRU) gerados sob demanda; objetos em atlas por região, liberados ao
trocar de ilha; quadros de personagem e imagens de peixes em caches limitados (LRU); partículas em *pool*
fixo; ondas como sprites esparsos sobre a água; sombras num único preenchimento; tom de luz e vinheta numa
única passada; rede a 15 Hz separada da renderização, com interpolação; snapshots só da própria ilha.

## Limitações conhecidas

- As salas e o progresso vivem em memória no servidor (sem contas nem banco de dados).
- Suporte a toque é básico (um dedo funciona como mouse); o jogo foi pensado para teclado e mouse.
- As fontes (Baloo 2 e Nunito) vêm do Google Fonts; sem internet, o navegador usa fontes do sistema.
