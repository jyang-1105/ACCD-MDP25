// Ashore — the instruction cards shown before a night (like a recipe card before a level).
const C = { voice: '#f7f3ea', hands: '#d9483b', sight: '#3e7fc9', walking: '#e8b931', gold: '#ffd38a' };

// a small merfolk figure: x, y = feet; tail = in the sea
const fig = (x, y, { tail = true, col = '#e9d3c2', ribbons = ['voice', 'hands', 'sight', 'walking'], sit = false, arm = null, s = 1 } = {}) => {
  const k = s;
  const body = sit ? `<ellipse cx="${x}" cy="${y - 10 * k}" rx="${9 * k}" ry="${11 * k}" fill="${col}"/>` : `<rect x="${x - 7 * k}" y="${y - 34 * k}" width="${14 * k}" height="${24 * k}" rx="${7 * k}" fill="${col}"/>`;
  const head = `<circle cx="${x}" cy="${y - (sit ? 28 : 42) * k}" r="${7 * k}" fill="${col}"/>`;
  const lower = tail
    ? `<path d="M${x - 6 * k} ${y - 12 * k} Q${x} ${y + 6 * k} ${x + 10 * k} ${y + 8 * k} L${x + 16 * k} ${y + 2 * k} L${x + 15 * k} ${y + 14 * k} L${x + 4 * k} ${y + 11 * k} Q${x - 8 * k} ${y + 4 * k} ${x - 6 * k} ${y - 12 * k}Z" fill="#1fa3a0"/>`
    : sit ? `<rect x="${x - 2 * k}" y="${y - 3 * k}" width="${20 * k}" height="${4 * k}" rx="${2 * k}" fill="${col}"/>`
      : `<rect x="${x - 5 * k}" y="${y - 12 * k}" width="${4 * k}" height="${12 * k}" rx="${2 * k}" fill="${col}"/><rect x="${x + 1 * k}" y="${y - 12 * k}" width="${4 * k}" height="${12 * k}" rx="${2 * k}" fill="${col}"/>`;
  const rb = ribbons.map((r, i) => `<path d="M${x - 4 * k + i * 3 * k} ${y - (sit ? 22 : 34) * k} q${-6 * k} ${8 * k} ${-14 * k} ${6 * k}" stroke="${C[r]}" stroke-width="${2.2 * k}" fill="none" stroke-linecap="round"/>`).join('');
  const a = arm === 'up' ? `<path d="M${x + 6 * k} ${y - 30 * k} L${x + 10 * k} ${y - 52 * k}" stroke="${col}" stroke-width="${4 * k}" stroke-linecap="round"/>`
    : arm ? `<path d="M${x + 6 * k} ${y - 28 * k} L${arm[0]} ${arm[1]}" stroke="${col}" stroke-width="${4 * k}" stroke-linecap="round"/>` : '';
  return `<g>${lower}${body}${head}${rb}${a}</g>`;
};

const sky = `<defs>
  <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#060d1f"/><stop offset="1" stop-color="#1a3560"/></linearGradient>
  <linearGradient id="sea" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#06213a"/><stop offset=".62" stop-color="#0e5257"/><stop offset=".74" stop-color="#15706e"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
  <radialGradient id="jar"><stop offset="0" stop-color="#c8ffe6"/><stop offset=".5" stop-color="#40ffa0" stop-opacity=".7"/><stop offset="1" stop-color="#40ffa0" stop-opacity="0"/></radialGradient>
  <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff0c8" stop-opacity=".9"/><stop offset="1" stop-color="#fff0c8" stop-opacity="0"/></linearGradient>
</defs><rect width="400" height="300" fill="url(#sk)"/>${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97) % 400}" cy="${(i * 53) % 120}" r="${i % 3 ? 0.8 : 1.4}" fill="#cfe0ff" opacity=".7"/>`).join('')}`;
const lanterns = (x0, x1, y) => {
  let s = '';
  for (let x = x0; x <= x1; x += (x1 - x0) / 4) s += `<circle cx="${x}" cy="${y}" r="14" fill="url(#glow)"/><circle cx="${x}" cy="${y}" r="3" fill="#ffe2a8"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y + 40}" stroke="#4a2e1c" stroke-width="2"/>`;
  return s;
};

export const CARDS = [
  {
    step: '1 / 5',
    title: 'Reach the shore before dawn',
    text: 'Swim to the <b>Shore</b> and get a Land Dweller to <b>notice you</b>.<br>Not understood by dawn? You become <b>sea foam</b>.',
    svg: `<svg viewBox="0 0 400 300">${sky}
      <circle cx="330" cy="60" r="16" fill="#eef3ff" opacity=".9"/>
      <rect y="170" width="400" height="130" fill="url(#sea)"/>
      <path d="M290 170 L400 158 L400 300 L270 300 Z" fill="#d8c39b"/>
      <path d="M150 172 L150 300" stroke="#ffd38a" stroke-dasharray="3 6" stroke-width="2"/>
      <path d="M262 172 L262 300" stroke="#ffd38a" stroke-dasharray="3 6" stroke-width="2"/>
      ${lanterns(300, 390, 120)}
      <rect x="300" y="150" width="88" height="6" rx="2" fill="#efe8dc"/>
      ${fig(50, 245)}${fig(90, 260)}${fig(200, 252, { ribbons: ['hands', 'sight', 'walking'] })}${fig(320, 215, { tail: false, ribbons: ['walking'] })}
      <path d="M60 220 C140 190 220 200 300 196" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="2 7" stroke-linecap="round"/>
      <text x="40" y="292" fill="#9fb0c2" font-size="11" font-family="Public Sans" letter-spacing="2">DEEP SEA</text>
      <text x="170" y="292" fill="#9fb0c2" font-size="11" font-family="Public Sans" letter-spacing="2">SHALLOWS</text>
      <text x="300" y="292" fill="#7a6a50" font-size="11" font-family="Public Sans" letter-spacing="2">SHORE</text></svg>`,
  },
  {
    step: '2 / 5',
    title: 'Every border costs you',
    text: 'Borders open at <b>low tide</b> (a bell rings).<br>1st border: lose your <b>Voice</b>.<br>2nd border: <b>keep one</b> of Hands, Sight, Walking.',
    svg: `<svg viewBox="0 0 400 300">${sky}
      <rect y="190" width="400" height="110" fill="url(#sea)"/>
      <path d="M240 300 C240 230 250 160 262 120 C274 160 284 230 284 300 Z" fill="#120a1c"/>
      <circle cx="262" cy="108" r="16" fill="#120a1c"/><circle cx="262" cy="112" r="8" fill="#8aa39a"/>
      <circle cx="232" cy="190" r="34" fill="url(#jar)"/><circle cx="232" cy="190" r="10" fill="#c8ffe6"/>
      ${['voice', 'hands', 'sight', 'walking'].map((r, i) => `<path d="M${70 + i * 8} ${210 - i * 6} C${110 + i * 10} ${120 - i * 14} ${170} ${140 + i * 8} ${226} ${186}" stroke="${C[r]}" stroke-width="4" fill="none" stroke-linecap="round" opacity="${i === 3 ? 0.35 : 1}"/>`).join('')}
      ${fig(70, 255, { ribbons: ['walking'] })}
      <text x="40" y="60" fill="#ffd38a" font-size="22" font-family="Cormorant Garamond" font-style="italic">“Your voice.”</text>
      <text x="40" y="88" fill="#ffd38a" font-size="22" font-family="Cormorant Garamond" font-style="italic">“Two more.”</text></svg>`,
  },
  {
    step: '3 / 5',
    title: 'Nobody gets there alone',
    text: '<kbd>Q</kbd> ask for help<br><kbd>R</kbd> (hold) take a hand and lead — <b>more hands, faster</b><br><kbd>E</kbd> give someone your ribbon',
    svg: `<svg viewBox="0 0 400 300">${sky}
      <path d="M0 200 L400 186 L400 300 L0 300 Z" fill="#d8c39b"/>
      <rect x="218" y="40" width="22" height="150" fill="url(#beam)"/>
      ${fig(229, 240, { tail: false, sit: true, ribbons: ['hands'], arm: 'up' })}
      ${fig(170, 244, { tail: false, ribbons: ['walking'], arm: [226, 214] })}
      ${fig(120, 246, { tail: false, ribbons: ['sight', 'walking'], arm: [166, 218] })}
      ${fig(290, 242, { tail: false, ribbons: ['walking', 'hands'], arm: [234, 216] })}
      <path d="M186 214 C200 205 214 205 226 212" stroke="#ffd38a" stroke-width="2" fill="none"/>
      <text x="24" y="60" fill="#cfd9e4" font-size="15" font-family="Public Sans">one hand: slow</text>
      <text x="24" y="82" fill="#ffd38a" font-size="15" font-family="Public Sans" font-weight="700">three hands: fast</text></svg>`,
  },
  {
    step: '4 / 5',
    title: 'Go together',
    text: 'Land Dwellers ignore one merfolk.<br><b>Gather around them together</b> and they turn.<br>Rip currents? <b>Hold hands</b> to get through.',
    svg: `<svg viewBox="0 0 400 300">${sky}
      <path d="M0 210 L400 196 L400 300 L0 300 Z" fill="#d8c39b"/>
      ${lanterns(250, 390, 110)}
      <rect x="250" y="168" width="140" height="7" rx="2" fill="#efe8dc"/>
      <path d="M214 262 C214 220 218 190 226 172 C234 190 238 220 238 262 Z" fill="#6b1f1a"/><circle cx="226" cy="160" r="10" fill="#d9a07c"/>
      ${fig(150, 262, { tail: false, ribbons: ['hands'] })}${fig(180, 270, { tail: false, ribbons: ['sight'] })}${fig(120, 272, { tail: false, ribbons: ['walking'] })}
      <path d="M220 160 C200 150 175 170 182 220" stroke="#ffd38a" stroke-width="2.5" fill="none"/>
      <circle cx="182" cy="232" r="22" fill="none" stroke="#ffd38a" stroke-width="3" stroke-dasharray="90 200" transform="rotate(-90 182 232)"/></svg>`,
  },
  {
    step: '5 / 5',
    title: 'Controls',
    text: `<div class="keys">
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>move</span>
      <span>drag</span><span>look</span>
      <span><kbd>Q</kbd></span><span>ask for help</span>
      <span>hold <kbd>R</kbd></span><span>take a hand</span>
      <span><kbd>E</kbd></span><span>give</span>
      <span><kbd>H</kbd></span><span>this screen</span>
    </div><p style="margin:14px 0 0;color:#ffd38a">In the Deep, talk — people near you hear you.</p>`,
    svg: `<svg viewBox="0 0 400 300"><rect width="400" height="300" fill="#081224"/>
      ${[['Q', 70, 90, 1], ['W', 120, 90, 1], ['E', 170, 90, 1], ['R', 220, 90, 1], ['A', 82, 140, 1], ['S', 132, 140, 1], ['D', 182, 140, 1], ['H', 282, 140, 0]].map(([k, x, y, on]) => `<rect x="${x}" y="${y}" width="42" height="42" rx="8" fill="${on ? '#eef2f6' : '#1b2738'}" stroke="#3a4a60"/><text x="${x + 21}" y="${y + 28}" text-anchor="middle" font-family="Public Sans" font-weight="700" font-size="18" fill="${on ? '#0a0f16' : '#cfd9e4'}">${k}</text>`).join('')}
      <rect x="110" y="200" width="200" height="40" rx="8" fill="#eef2f6"/><text x="210" y="226" text-anchor="middle" font-family="Public Sans" font-weight="700" font-size="15" fill="#0a0f16">SPACE</text>
      <rect x="320" y="70" width="44" height="70" rx="22" fill="none" stroke="#cfd9e4" stroke-width="2"/><line x1="342" y1="70" x2="342" y2="96" stroke="#cfd9e4" stroke-width="2"/>
      <circle cx="342" cy="190" r="16" fill="none" stroke="#ffd38a" stroke-width="2"/><rect x="336" y="178" width="12" height="18" rx="6" fill="#ffd38a"/><line x1="342" y1="200" x2="342" y2="212" stroke="#ffd38a" stroke-width="2"/></svg>`,
  },
];

export function mountHowto({ onDone, doneLabel = 'Ready' }) {
  let i = 0;
  const $ = id => document.getElementById(id);
  const render = () => {
    const c = CARDS[i];
    $('howArt').innerHTML = c.svg; $('howStep').textContent = c.step; $('howTitle').textContent = c.title; $('howText').innerHTML = c.text;
    $('howDots').innerHTML = CARDS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    $('howBack').disabled = i === 0;
    $('howNext').textContent = i === CARDS.length - 1 ? doneLabel : 'Next';
  };
  $('howBack').onclick = () => { if (i > 0) { i--; render(); } };
  $('howNext').onclick = () => { if (i < CARDS.length - 1) { i++; render(); } else { $('howto').classList.add('hidden'); onDone && onDone(); } };
  $('howto').classList.remove('hidden');
  render();
}
