// Estratégia automática do minigame (usada pelos bots de teste).
// skill 0..1: 1 = reação perfeita; valores menores atrasam e erram.
export function botHold(s, skill = 1, rand = Math.random) {
  const lead = s.tension + s.tv * 0.18;
  let hold = lead < s.zc;
  if (s.tension > 0.86) hold = false;
  if (rand() > 0.55 + 0.45 * skill) hold = !hold;
  return hold;
}
