/**
 * ai-features.js — Funcionalidades alimentadas por IA (Anthropic API)
 * Controla: Eventos, Mapa Mundial, Rotas e Recomendações
 */
 
const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
 
// ─── Dados estáticos da Copa do Mundo 2026 ───────────────────────────────────
 
const HOST_CITIES = [
  { name: 'New York/New Jersey', country: 'USA', lat: 40.7, lon: -74.0, flag: '🇺🇸', stadium: 'MetLife Stadium', matches: 8 },
  { name: 'Los Angeles',         country: 'USA', lat: 34.1, lon: -118.3, flag: '🇺🇸', stadium: 'SoFi Stadium',    matches: 6 },
  { name: 'San Francisco',       country: 'USA', lat: 37.8, lon: -122.4, flag: '🇺🇸', stadium: 'Levi\'s Stadium', matches: 6 },
  { name: 'Dallas',              country: 'USA', lat: 32.8, lon: -96.8,  flag: '🇺🇸', stadium: 'AT&T Stadium',   matches: 6 },
  { name: 'Miami',               country: 'USA', lat: 25.8, lon: -80.2,  flag: '🇺🇸', stadium: 'Hard Rock Stadium', matches: 6 },
  { name: 'Boston',              country: 'USA', lat: 42.4, lon: -71.1,  flag: '🇺🇸', stadium: 'Gillette Stadium', matches: 6 },
  { name: 'Chicago',             country: 'USA', lat: 41.9, lon: -87.6,  flag: '🇺🇸', stadium: 'Soldier Field', matches: 5 },
  { name: 'Seattle',             country: 'USA', lat: 47.6, lon: -122.3, flag: '🇺🇸', stadium: 'Lumen Field', matches: 5 },
  { name: 'Philadelphia',        country: 'USA', lat: 40.0, lon: -75.2,  flag: '🇺🇸', stadium: 'Lincoln Financial Field', matches: 5 },
  { name: 'Kansas City',         country: 'USA', lat: 39.1, lon: -94.6,  flag: '🇺🇸', stadium: 'Arrowhead Stadium', matches: 5 },
  { name: 'Atlanta',             country: 'USA', lat: 33.7, lon: -84.4,  flag: '🇺🇸', stadium: 'Mercedes-Benz Stadium', matches: 5 },
  { name: 'Houston',             country: 'USA', lat: 29.8, lon: -95.4,  flag: '🇺🇸', stadium: 'NRG Stadium', matches: 5 },
  { name: 'Toronto',             country: 'Canada', lat: 43.7, lon: -79.4, flag: '🇨🇦', stadium: 'BMO Field', matches: 6 },
  { name: 'Vancouver',           country: 'Canada', lat: 49.3, lon: -123.1, flag: '🇨🇦', stadium: 'BC Place', matches: 6 },
  { name: 'Mexico City',         country: 'Mexico', lat: 19.4, lon: -99.1, flag: '🇲🇽', stadium: 'Estadio Azteca', matches: 8 },
  { name: 'Guadalajara',         country: 'Mexico', lat: 20.7, lon: -103.4, flag: '🇲🇽', stadium: 'Estadio Akron', matches: 5 },
  { name: 'Monterrey',           country: 'Mexico', lat: 25.7, lon: -100.3, flag: '🇲🇽', stadium: 'Estadio BBVA', matches: 5 },
];
 
const SAMPLE_MATCHES = [
  { id: 'm1', home: 'Brasil',    away: 'Argentina',    date: '2026-06-18', time: '21:00', city: 'New York/New Jersey', country: 'USA',    phase: 'Grupo F', risk: 'Alto' },
  { id: 'm2', home: 'Portugal',  away: 'França',       date: '2026-06-20', time: '18:00', city: 'Los Angeles',        country: 'USA',    phase: 'Grupo D', risk: 'Médio' },
  { id: 'm3', home: 'Alemanha',  away: 'Espanha',      date: '2026-06-22', time: '15:00', city: 'Dallas',             country: 'USA',    phase: 'Grupo C', risk: 'Médio' },
  { id: 'm4', home: 'México',    away: 'Colombia',     date: '2026-06-15', time: '20:00', city: 'Mexico City',        country: 'Mexico', phase: 'Grupo B', risk: 'Alto' },
  { id: 'm5', home: 'Canadá',    away: 'Marrocos',     date: '2026-06-16', time: '17:00', city: 'Toronto',            country: 'Canada', phase: 'Grupo A', risk: 'Baixo' },
  { id: 'm6', home: 'Inglaterra','away': 'Japão',      date: '2026-06-21', time: '15:00', city: 'Chicago',            country: 'USA',    phase: 'Grupo E', risk: 'Baixo' },
  { id: 'm7', home: 'Itália',    away: 'EUA',          date: '2026-06-24', time: '21:00', city: 'Miami',              country: 'USA',    phase: 'Grupo A', risk: 'Alto' },
  { id: 'm8', home: 'Austrália', away: 'Coreia do Sul',date: '2026-06-19', time: '18:00', city: 'Seattle',            country: 'USA',    phase: 'Grupo H', risk: 'Baixo' },
  { id: 'm9', home: 'Uruguai',   away: 'Croácia',      date: '2026-06-23', time: '18:00', city: 'Houston',            country: 'USA',    phase: 'Grupo G', risk: 'Médio' },
  { id: 'm10', home: 'Holanda',  away: 'Senegal',      date: '2026-06-17', time: '15:00', city: 'Philadelphia',       country: 'USA',    phase: 'Grupo C', risk: 'Baixo' },
  { id: 'm11', home: 'Bélgica',  away: 'Suíça',        date: '2026-06-25', time: '21:00', city: 'Boston',             country: 'USA',    phase: 'Grupo F', risk: 'Médio' },
  { id: 'm12', home: 'México',   away: 'Equador',      date: '2026-06-18', time: '21:00', city: 'Guadalajara',        country: 'Mexico', phase: 'Grupo B', risk: 'Médio' },
];
 
// ─── Utilitário de chamada à API Anthropic ────────────────────────────────────
 
async function callClaude(prompt, maxTokens = 600) {
  try {
    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return data?.content?.[0]?.text || null;
  } catch (e) {
    console.error('[AI] Erro na chamada:', e);
    return null;
  }
}
 
async function callClaudeJSON(prompt, maxTokens = 800) {
  const text = await callClaude(prompt + '\n\nResponda APENAS com JSON puro, sem markdown, sem texto extra.', maxTokens);
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}
 
// ─── Cor do risco ─────────────────────────────────────────────────────────────
 
function riskBadge(risk) {
  const map = { 'Alto': 'var(--risk)', 'Médio': 'var(--alert)', 'Baixo': 'var(--sky)' };
  return `<span style="
    display:inline-block;padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:800;
    background:${(map[risk] || 'var(--muted)') + '22'};
    color:${map[risk] || 'var(--muted)'};
    border:1px solid ${(map[risk] || 'var(--muted)') + '44'}">${risk}</span>`;
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════
 
export function initEventsScreen() {
  populateCountrySelect();
  renderEventCards(SAMPLE_MATCHES);
  setupEventSearch();
}
 
function populateCountrySelect() {
  const countrySelect = document.getElementById('homeCountrySelect');
  const citySelect    = document.getElementById('homeCitySelect');
  if (!countrySelect || !citySelect) return;
 
  const countries = ['Todos', ...new Set(HOST_CITIES.map(c => c.country))];
  countrySelect.innerHTML = countries.map(c =>
    `<option value="${c}">${c === 'Todos' ? '🌎 Todos os países' : c}</option>`
  ).join('');
 
  const updateCities = () => {
    const sel = countrySelect.value;
    const cities = sel === 'Todos'
      ? ['Todas as cidades', ...HOST_CITIES.map(c => c.name)]
      : ['Todas as cidades', ...HOST_CITIES.filter(c => c.country === sel).map(c => c.name)];
    citySelect.innerHTML = cities.map(c => `<option value="${c}">${c}</option>`).join('');
    filterAndRender();
  };
 
  countrySelect.addEventListener('change', updateCities);
  citySelect.addEventListener('change', filterAndRender);
  updateCities();
}
 
function filterAndRender() {
  const country = document.getElementById('homeCountrySelect')?.value;
  const city    = document.getElementById('homeCitySelect')?.value;
  const search  = document.getElementById('eventSearchInput')?.value?.toLowerCase() || '';
 
  let filtered = SAMPLE_MATCHES.filter(m => {
    const matchCountry = !country || country === 'Todos' || m.country === country;
    const matchCity    = !city    || city === 'Todas as cidades' || m.city === city;
    const matchSearch  = !search  || m.home.toLowerCase().includes(search) || m.away.toLowerCase().includes(search) || m.city.toLowerCase().includes(search);
    return matchCountry && matchCity && matchSearch;
  });
 
  renderEventCards(filtered);
  const label = document.getElementById('eventCountLabel');
  if (label) label.textContent = `${filtered.length} evento${filtered.length !== 1 ? 's' : ''}`;
}
 
function setupEventSearch() {
  const input = document.getElementById('eventSearchInput');
  if (input) input.addEventListener('input', filterAndRender);
}
 
function renderEventCards(matches) {
  const list = document.getElementById('eventList');
  if (!list) return;
 
  if (!matches.length) {
    list.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Nenhum evento encontrado para este filtro.</div>';
    return;
  }
 
  list.innerHTML = matches.map(m => {
    const city = HOST_CITIES.find(c => c.name === m.city) || {};
    return `
    <div class="card event-card" style="cursor:pointer" data-id="${m.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
        <span style="font-size:.78rem;font-weight:700;color:var(--muted)">${m.phase}</span>
        ${riskBadge(m.risk)}
      </div>
      <h3 style="font-size:1.05rem;margin-bottom:.3rem">${m.home} × ${m.away}</h3>
      <p style="font-size:.84rem;margin:0 0 .75rem">
        📍 ${city.flag || ''} ${m.city}, ${m.country}<br>
        🏟️ ${city.stadium || ''}<br>
        📅 ${m.date} às ${m.time}
      </p>
      <button class="button button-primary" style="width:100%;margin-top:auto" data-match="${m.id}">
        Ver análise de risco
      </button>
    </div>`;
  }).join('');
 
  list.querySelectorAll('[data-match]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const match = SAMPLE_MATCHES.find(m => m.id === btn.dataset.match);
      if (match) showRiskAnalysis(match);
    });
  });
}
 
async function showRiskAnalysis(match) {
  const panel = document.getElementById('selectedEventSummary');
  if (!panel) return;
 
  panel.innerHTML = `
    <div style="padding:1rem">
      <p style="font-weight:700;margin-bottom:.75rem">${match.home} × ${match.away}</p>
      <div class="skeleton-card"><span></span><span></span><span></span></div>
      <p style="font-size:.82rem;color:var(--muted);margin-top:.5rem">A IA está analisando o evento...</p>
    </div>`;
 
  const result = await callClaudeJSON(`
    Você é um sistema de análise logística para a Copa do Mundo 2026.
    Analise este jogo: ${match.home} vs ${match.away}
    Cidade: ${match.city}, ${match.country}
    Data: ${match.date} às ${match.time}
    Fase: ${match.phase}
    
    Retorne JSON com:
    {
      "risco": "Alto/Médio/Baixo",
      "publico_estimado": "número como string",
      "dica_transporte": "string curta",
      "dica_chegada": "string curta",
      "alerta": "string curta"
    }
  `);
 
  if (!result) {
    panel.innerHTML = `<div class="error-state" style="padding:1rem">Falha ao carregar análise.</div>`;
    return;
  }
 
  panel.innerHTML = `
    <div style="padding:1rem">
      <span class="eyebrow" style="font-size:.72rem">Análise de Risco — IA</span>
      <h3 style="margin:.4rem 0 .75rem">${match.home} × ${match.away}</h3>
      <div style="display:grid;gap:.5rem">
        <div class="indicator-card" style="padding:.75rem">
          <strong>Nível de risco</strong>
          <div style="margin-top:.25rem">${riskBadge(result.risco)}</div>
        </div>
        <div class="indicator-card" style="padding:.75rem">
          <strong>Público estimado</strong>
          <span style="display:block;color:var(--muted);font-size:.88rem">${result.publico_estimado || 'N/A'} torcedores</span>
        </div>
        <div class="indicator-card" style="padding:.75rem">
          <span style="font-size:.78rem;color:var(--muted)">🚌 Transporte</span>
          <p style="margin:.2rem 0 0;font-size:.86rem">${result.dica_transporte}</p>
        </div>
        <div class="indicator-card" style="padding:.75rem">
          <span style="font-size:.78rem;color:var(--muted)">⏰ Chegada</span>
          <p style="margin:.2rem 0 0;font-size:.86rem">${result.dica_chegada}</p>
        </div>
        <div class="indicator-card" style="padding:.75rem;border-left:3px solid var(--alert)">
          <span style="font-size:.78rem;color:var(--alert)">⚠️ Alerta</span>
          <p style="margin:.2rem 0 0;font-size:.86rem">${result.alerta}</p>
        </div>
      </div>
    </div>`;
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: MAPA MUNDIAL
// ═══════════════════════════════════════════════════════════════════════════════
 
export function initMapScreen() {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  canvas.classList.add('world-map');
  canvas.style.position = 'relative';
  canvas.style.overflow = 'hidden';
  canvas.style.padding = '0';
 
  canvas.innerHTML = buildWorldMapSVG();
 
  canvas.querySelectorAll('.city-pin').forEach(pin => {
    pin.addEventListener('click', () => {
      const cityName = pin.dataset.city;
      const city = HOST_CITIES.find(c => c.name === cityName);
      if (city) showCityInfo(city);
    });
  });
 
  // Painel de detalhes inicial
  const poiPanel = document.getElementById('poiDetails');
  if (poiPanel) {
    poiPanel.innerHTML = `
      <div style="padding:1rem">
        <span class="eyebrow">Copa do Mundo 2026</span>
        <h2 style="margin:.4rem 0 .5rem;font-size:1rem">17 cidades-sede</h2>
        <p style="font-size:.86rem;color:var(--muted)">Clique em um marcador no mapa para ver detalhes e análise logística da cidade-sede.</p>
        <div style="margin-top:1rem;display:grid;gap:.4rem">
          ${['🇺🇸 EUA — 12 cidades','🇨🇦 Canadá — 2 cidades','🇲🇽 México — 3 cidades'].map(t =>
            `<div class="indicator-card" style="padding:.6rem .8rem;font-size:.84rem">${t}</div>`
          ).join('')}
        </div>
      </div>`;
  }
}
 
function latLonToXY(lat, lon) {
  // Projeção equiretangular — América do Norte: lon -130 a -60, lat 15 a 55
  const minLon = -130, maxLon = -60, minLat = 15, maxLat = 55;
  const W = 680, H = 420;
  const x = ((lon - minLon) / (maxLon - minLon)) * W;
  const y = ((maxLat - lat) / (maxLat - minLat)) * H;
  return { x: Math.round(x), y: Math.round(y) };
}
 
function buildWorldMapSVG() {
  // Contorno simplificado da América do Norte (projeção equiretangular, lon -130 a -60, lat 15 a 55)
  const coastNA = `
    M 0,120 C 20,90 30,60 45,40 C 60,20 80,5 110,3 C 130,1 145,15 150,30
    L 155,28 C 165,18 180,8 200,5 C 220,3 235,15 240,30
    C 255,20 270,15 285,20 C 295,25 305,35 310,50
    C 340,30 370,20 400,22 C 430,24 445,38 450,55
    C 460,45 475,38 490,40 C 510,42 520,55 525,70
    L 680,65 L 680,420 L 0,420 Z
  `;
 
  // Golfo do México (forma aproximada)
  const gulf = `M 180,310 C 210,280 260,265 310,270 C 350,275 385,295 400,320 C 380,350 340,370 290,370 C 240,370 200,350 180,310 Z`;
 
  // Grandes Lagos (simplified)
  const lakes = `
    M 395,155 C 415,148 435,150 445,160 C 440,170 430,175 415,173 C 400,172 390,165 395,155 Z
    M 420,173 C 445,168 465,172 470,182 C 465,192 450,195 435,192 C 420,190 412,183 420,173 Z
  `;
 
  const pins = HOST_CITIES.map(city => {
    const { x, y } = latLonToXY(city.lat, city.lon);
    const color = city.country === 'USA' ? '#15803d' : city.country === 'Canada' ? '#c41e3a' : '#006847';
    return `
      <g class="city-pin" data-city="${city.name}" style="cursor:pointer">
        <circle cx="${x}" cy="${y}" r="10" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
        <circle cx="${x}" cy="${y}" r="5" fill="${color}"/>
        <title>${city.flag} ${city.name} — ${city.matches} jogos</title>
      </g>`;
  }).join('');
 
  // Labels das principais cidades (simplificado para não poluir)
  const mainCities = HOST_CITIES.filter(c => c.matches >= 6);
  const labels = mainCities.map(city => {
    const { x, y } = latLonToXY(city.lat, city.lon);
    const shortName = city.name.split('/')[0];
    const anchor = x > 450 ? 'end' : 'start';
    const dx = x > 450 ? -14 : 14;
    return `<text x="${x + dx}" y="${y + 4}" font-size="10" font-family="Manrope,sans-serif" font-weight="700" fill="#1f2937" text-anchor="${anchor}">${shortName}</text>`;
  }).join('');
 
  // Legenda
  const legend = `
    <g transform="translate(16,390)">
      <circle cx="6" cy="6" r="5" fill="#15803d"/>
      <text x="15" y="10" font-size="10" font-family="Manrope,sans-serif" fill="#6b7280">EUA</text>
      <circle cx="56" cy="6" r="5" fill="#c41e3a"/>
      <text x="65" y="10" font-size="10" font-family="Manrope,sans-serif" fill="#6b7280">Canadá</text>
      <circle cx="118" cy="6" r="5" fill="#006847"/>
      <text x="127" y="10" font-size="10" font-family="Manrope,sans-serif" fill="#6b7280">México</text>
    </g>`;
 
  return `
    <svg width="100%" viewBox="0 0 680 420" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <rect width="680" height="420" fill="#dbeafe" rx="0"/>
      <!-- Terra -->
      <path d="${coastNA}" fill="#d1fae5" stroke="#86efac" stroke-width="1.5"/>
      <!-- Golfo México -->
      <path d="${gulf}" fill="#bfdbfe"/>
      <!-- Grandes Lagos -->
      <path d="${lakes}" fill="#bfdbfe"/>
      <!-- Título -->
      <text x="340" y="22" font-size="13" font-family="Manrope,sans-serif" font-weight="800" fill="#1f2937" text-anchor="middle">Copa do Mundo 2026 — Cidades-Sede</text>
      <!-- Marcadores -->
      ${pins}
      <!-- Labels -->
      ${labels}
      ${legend}
    </svg>`;
}
 
async function showCityInfo(city) {
  const panel = document.getElementById('poiDetails');
  if (!panel) return;
 
  panel.innerHTML = `
    <div style="padding:1rem">
      <span class="eyebrow" style="font-size:.72rem">${city.flag} ${city.country}</span>
      <h2 style="margin:.4rem 0 .3rem;font-size:1.05rem">${city.name}</h2>
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:.75rem">🏟️ ${city.stadium} · ${city.matches} jogos</p>
      <div class="skeleton-card"><span></span><span></span><span></span></div>
      <p style="font-size:.78rem;color:var(--muted);margin-top:.4rem">Carregando análise logística...</p>
    </div>`;
 
  const result = await callClaudeJSON(`
    Você é um especialista em logística de eventos esportivos.
    Analise a cidade-sede da Copa do Mundo 2026: ${city.name}, ${city.country}
    Estádio: ${city.stadium} (${city.matches} jogos)
 
    Responda em JSON:
    {
      "nivel_risco": "Alto/Médio/Baixo",
      "populacao": "número aproximado",
      "melhor_transporte": "string curta",
      "hotel_tip": "dica curta de hospedagem",
      "curiosidade": "fato interessante sobre a cidade"
    }
  `);
 
  if (!result) {
    panel.innerHTML = `<div class="error-state" style="padding:1rem">Falha ao carregar dados.</div>`;
    return;
  }
 
  panel.innerHTML = `
    <div style="padding:1rem">
      <span class="eyebrow" style="font-size:.72rem">${city.flag} ${city.country}</span>
      <h2 style="margin:.4rem 0 .3rem;font-size:1.05rem">${city.name}</h2>
      <p style="font-size:.82rem;color:var(--muted);margin-bottom:.75rem">🏟️ ${city.stadium} · ${city.matches} jogos</p>
      <div style="display:grid;gap:.45rem">
        <div class="indicator-card" style="padding:.6rem .8rem">
          <strong>Risco logístico</strong>
          <div style="margin-top:.25rem">${riskBadge(result.nivel_risco)}</div>
        </div>
        <div class="indicator-card" style="padding:.6rem .8rem">
          <span style="font-size:.75rem;color:var(--muted)">🚌 Melhor transporte</span>
          <p style="font-size:.85rem;margin:.2rem 0 0">${result.melhor_transporte}</p>
        </div>
        <div class="indicator-card" style="padding:.6rem .8rem">
          <span style="font-size:.75rem;color:var(--muted)">🏨 Hospedagem</span>
          <p style="font-size:.85rem;margin:.2rem 0 0">${result.hotel_tip}</p>
        </div>
        <div class="indicator-card" style="padding:.6rem .8rem;border-left:3px solid var(--sky)">
          <span style="font-size:.75rem;color:var(--sky)">💡 Curiosidade</span>
          <p style="font-size:.85rem;margin:.2rem 0 0">${result.curiosidade}</p>
        </div>
      </div>
    </div>`;
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: ROTAS
// ═══════════════════════════════════════════════════════════════════════════════
 
export function initRoutesScreen() {
  const destSelect = document.getElementById('routeDestinationSelect');
  if (destSelect) {
    destSelect.innerHTML = '<option value="">Selecione uma cidade-sede</option>' +
      HOST_CITIES.map(c => `<option value="${c.name}">${c.flag} ${c.name} — ${c.stadium}</option>`).join('');
  }
 
  const form = document.getElementById('routeForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await generateRoute();
    });
  }
}
 
async function generateRoute() {
  const origin = document.getElementById('routeOriginInput')?.value || 'Minha localização';
  const dest   = document.getElementById('routeDestinationSelect')?.value;
  const mode   = document.getElementById('routeModeSelect')?.value;
 
  const modeLabel = { walking: 'a pé', transit: 'transporte público', drive: 'carro/app' };
  const resultDiv = document.getElementById('routeResult');
  if (!resultDiv) return;
 
  if (!dest) {
    resultDiv.innerHTML = `<div class="error-state">Selecione um destino.</div>`;
    return;
  }
 
  const city = HOST_CITIES.find(c => c.name === dest);
  resultDiv.innerHTML = `
    <div class="skeleton-card" style="margin-top:1rem"><span></span><span></span><span></span></div>
    <p style="font-size:.82rem;color:var(--muted);margin-top:.5rem">A IA está calculando a rota...</p>`;
 
  const result = await callClaudeJSON(`
    Você é um assistente de mobilidade urbana para a Copa do Mundo 2026.
    Origem: ${origin}
    Destino: ${dest}, ${city?.country || ''} — ${city?.stadium || ''}
    Modo: ${modeLabel[mode] || mode}
 
    Responda em JSON:
    {
      "tempo_estimado": "X horas Y minutos",
      "distancia": "aprox. X km",
      "rota_principal": "descrição em 1 linha",
      "dica_1": "dica de mobilidade",
      "dica_2": "dica de segurança",
      "aviso": "qualquer aviso importante",
      "score_conforto": "1-10"
    }
  `);
 
  if (!result) {
    resultDiv.innerHTML = `<div class="error-state" style="margin-top:1rem">Falha ao gerar rota.</div>`;
    return;
  }
 
  resultDiv.innerHTML = `
    <div style="margin-top:1rem;display:grid;gap:.6rem">
      <div class="panel" style="padding:1rem">
        <span class="eyebrow" style="font-size:.7rem">Rota gerada — IA</span>
        <h3 style="margin:.3rem 0">${origin} → ${dest}</h3>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.75rem">
          <span style="font-size:.84rem">⏱️ <strong>${result.tempo_estimado}</strong></span>
          <span style="font-size:.84rem">📏 <strong>${result.distancia}</strong></span>
          <span style="font-size:.84rem">⭐ Conforto: <strong>${result.score_conforto}/10</strong></span>
        </div>
        <div style="background:var(--sky-soft);border-radius:12px;padding:.75rem;margin-bottom:.5rem">
          <strong style="font-size:.82rem;color:var(--sky)">🗺️ Rota principal</strong>
          <p style="font-size:.86rem;margin:.2rem 0 0">${result.rota_principal}</p>
        </div>
      </div>
      <div class="indicator-card" style="padding:.75rem">
        <span style="font-size:.78rem;color:var(--muted)">💡 ${result.dica_1}</span>
      </div>
      <div class="indicator-card" style="padding:.75rem">
        <span style="font-size:.78rem;color:var(--muted)">🛡️ ${result.dica_2}</span>
      </div>
      ${result.aviso ? `
      <div class="indicator-card" style="padding:.75rem;border-left:3px solid var(--alert)">
        <span style="font-size:.78rem;color:var(--alert)">⚠️ ${result.aviso}</span>
      </div>` : ''}
    </div>`;
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: RECOMENDAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════
 
export async function initRecommendationsScreen() {
  const strip = document.getElementById('contextStrip');
  const list  = document.getElementById('recommendationList');
  if (!list) return;
 
  if (strip) {
    strip.innerHTML = `
      <span class="context-pill" style="padding:.4rem .9rem;border-radius:999px;font-size:.82rem;font-weight:700">🌎 Edição 2026</span>
      <span class="context-pill" style="padding:.4rem .9rem;border-radius:999px;font-size:.82rem;font-weight:700">⚽ Copa do Mundo</span>
      <span class="context-pill" style="padding:.4rem .9rem;border-radius:999px;font-size:.82rem;font-weight:700">📍 EUA · Canadá · México</span>`;
  }
 
  list.innerHTML = `
    <div class="skeleton-card" style="grid-column:1/-1"><span></span><span></span><span></span></div>
    <div class="skeleton-card" style="grid-column:1/-1"><span></span><span></span></div>`;
 
  const result = await callClaudeJSON(`
    Você é um consultor de viagens para a Copa do Mundo 2026.
    Recomende os 6 jogos mais imperdíveis da Copa 2026 para um torcedor brasileiro que quer planejar a viagem.
    Considere: rivalidades históricas, cidades mais vibrantes, acessibilidade.
 
    Responda em JSON com array "eventos":
    [
      {
        "jogo": "Time A vs Time B",
        "cidade": "nome da cidade",
        "pais": "USA/Canada/Mexico",
        "motivo": "por que é imperdível (1 frase)",
        "dica_viagem": "dica prática (1 frase)",
        "nivel_emocao": "1-10"
      }
    ]
  `, 1200);
 
  if (!result || !result.eventos) {
    list.innerHTML = `<div class="error-state" style="grid-column:1/-1">Falha ao carregar recomendações.</div>`;
    return;
  }
 
  const countryFlag = { 'USA': '🇺🇸', 'Canada': '🇨🇦', 'Mexico': '🇲🇽' };
 
  list.innerHTML = result.eventos.map(ev => {
    const city = HOST_CITIES.find(c => c.name === ev.cidade) || {};
    const emocao = parseInt(ev.nivel_emocao) || 7;
    const barWidth = (emocao / 10 * 100).toFixed(0);
    return `
    <div class="card recommendation-card" style="border-left:3px solid var(--sky)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem">
        <span style="font-size:.75rem;font-weight:700;color:var(--muted)">${countryFlag[ev.pais] || ''} ${ev.cidade}</span>
        <span style="font-size:.75rem;font-weight:800;color:var(--sky)">⚡ ${ev.nivel_emocao}/10</span>
      </div>
      <h3 style="margin-bottom:.4rem;font-size:.98rem">${ev.jogo}</h3>
      <p style="font-size:.84rem;margin-bottom:.5rem">${ev.motivo}</p>
      <div style="background:var(--line);border-radius:999px;height:4px;margin-bottom:.5rem">
        <div style="width:${barWidth}%;background:linear-gradient(90deg,var(--sky),var(--flow));height:4px;border-radius:999px"></div>
      </div>
      <div style="background:var(--sky-soft);border-radius:10px;padding:.5rem .75rem">
        <span style="font-size:.78rem;color:var(--sky)">✈️ ${ev.dica_viagem}</span>
      </div>
    </div>`;
  }).join('');
}
