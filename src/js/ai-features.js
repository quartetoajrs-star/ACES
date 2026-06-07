/**
 * ai-features.js — Funcionalidades alimentadas por IA (Anthropic API)
 * Controla: Eventos, Mapa Mundial, Rotas e Recomendações
 */
 
const HOST_CITIES = [
  { name: 'New York/New Jersey', country: 'EUA',    cc: 'US', lat: 40.7,  lon: -74.0,  stadium: 'MetLife Stadium',             matches: 8 },
  { name: 'Los Angeles',         country: 'EUA',    cc: 'US', lat: 34.1,  lon: -118.3, stadium: 'SoFi Stadium',                matches: 6 },
  { name: 'San Francisco',       country: 'EUA',    cc: 'US', lat: 37.8,  lon: -122.4, stadium: "Levi's Stadium",              matches: 6 },
  { name: 'Dallas',              country: 'EUA',    cc: 'US', lat: 32.8,  lon: -96.8,  stadium: 'AT&T Stadium',                matches: 6 },
  { name: 'Miami',               country: 'EUA',    cc: 'US', lat: 25.8,  lon: -80.2,  stadium: 'Hard Rock Stadium',           matches: 6 },
  { name: 'Boston',              country: 'EUA',    cc: 'US', lat: 42.4,  lon: -71.1,  stadium: 'Gillette Stadium',            matches: 6 },
  { name: 'Chicago',             country: 'EUA',    cc: 'US', lat: 41.9,  lon: -87.6,  stadium: 'Soldier Field',               matches: 5 },
  { name: 'Seattle',             country: 'EUA',    cc: 'US', lat: 47.6,  lon: -122.3, stadium: 'Lumen Field',                 matches: 5 },
  { name: 'Philadelphia',        country: 'EUA',    cc: 'US', lat: 40.0,  lon: -75.2,  stadium: 'Lincoln Financial Field',     matches: 5 },
  { name: 'Kansas City',         country: 'EUA',    cc: 'US', lat: 39.1,  lon: -94.6,  stadium: 'Arrowhead Stadium',           matches: 5 },
  { name: 'Atlanta',             country: 'EUA',    cc: 'US', lat: 33.7,  lon: -84.4,  stadium: 'Mercedes-Benz Stadium',       matches: 5 },
  { name: 'Houston',             country: 'EUA',    cc: 'US', lat: 29.8,  lon: -95.4,  stadium: 'NRG Stadium',                 matches: 5 },
  { name: 'Toronto',             country: 'Canada', cc: 'CA', lat: 43.7,  lon: -79.4,  stadium: 'BMO Field',                   matches: 6 },
  { name: 'Vancouver',           country: 'Canada', cc: 'CA', lat: 49.3,  lon: -123.1, stadium: 'BC Place',                    matches: 6 },
  { name: 'Cidade do Mexico',    country: 'Mexico', cc: 'MX', lat: 19.4,  lon: -99.1,  stadium: 'Estadio Azteca',              matches: 8 },
  { name: 'Guadalajara',         country: 'Mexico', cc: 'MX', lat: 20.7,  lon: -103.4, stadium: 'Estadio Akron',               matches: 5 },
  { name: 'Monterrey',           country: 'Mexico', cc: 'MX', lat: 25.7,  lon: -100.3, stadium: 'Estadio BBVA',                matches: 5 },
];
 
let ALL_EVENTS = [
  // Copa do Mundo 2026
  { id:'wc01', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Brasil',    away:'Argentina',     date:'2026-06-18', time:'21:00', city:'New York/New Jersey', country:'EUA',    phase:'Fase de grupos', risk:'Alto'  },
  { id:'wc02', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Portugal',  away:'Franca',        date:'2026-06-20', time:'18:00', city:'Los Angeles',          country:'EUA',    phase:'Fase de grupos', risk:'Medio' },
  { id:'wc03', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Alemanha',  away:'Espanha',       date:'2026-06-22', time:'15:00', city:'Dallas',               country:'EUA',    phase:'Fase de grupos', risk:'Medio' },
  { id:'wc04', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Mexico',    away:'Colombia',      date:'2026-06-15', time:'20:00', city:'Cidade do Mexico',     country:'Mexico', phase:'Fase de grupos', risk:'Alto'  },
  { id:'wc05', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Canada',    away:'Marrocos',      date:'2026-06-16', time:'17:00', city:'Toronto',              country:'Canada', phase:'Fase de grupos', risk:'Baixo' },
  { id:'wc06', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Inglaterra',away:'Japao',         date:'2026-06-21', time:'15:00', city:'Chicago',              country:'EUA',    phase:'Fase de grupos', risk:'Baixo' },
  { id:'wc07', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Italia',    away:'EUA',           date:'2026-06-24', time:'21:00', city:'Miami',                country:'EUA',    phase:'Fase de grupos', risk:'Alto'  },
  { id:'wc08', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Australia', away:'Coreia do Sul', date:'2026-06-19', time:'18:00', city:'Seattle',              country:'EUA',    phase:'Fase de grupos', risk:'Baixo' },
  { id:'wc09', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Uruguai',   away:'Croatia',       date:'2026-06-23', time:'18:00', city:'Houston',              country:'EUA',    phase:'Fase de grupos', risk:'Medio' },
  { id:'wc10', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Holanda',   away:'Senegal',       date:'2026-06-17', time:'15:00', city:'Philadelphia',         country:'EUA',    phase:'Fase de grupos', risk:'Baixo' },
  { id:'wc11', cat:'Futebol',   evento:'Copa do Mundo FIFA 2026', home:'Final',     away:'A definir',     date:'2026-07-19', time:'18:00', city:'New York/New Jersey',  country:'EUA',    phase:'Final',          risk:'Alto'  },
  // NBA Finals 2026
  { id:'nba1', cat:'Basquete',  evento:'NBA Finals 2026', home:'Boston Celtics',          away:'Oklahoma City Thunder', date:'2026-06-10', time:'21:00', city:'Boston',     country:'EUA', phase:'Jogo 4',  risk:'Medio' },
  { id:'nba2', cat:'Basquete',  evento:'NBA Finals 2026', home:'Oklahoma City Thunder',   away:'Boston Celtics',        date:'2026-06-14', time:'21:00', city:'Houston',    country:'EUA', phase:'Jogo 6',  risk:'Medio' },
  // Wimbledon 2026
  { id:'ten1', cat:'Tenis',     evento:'Wimbledon 2026',  home:'Semifinal Masculino',     away:'',              date:'2026-07-05', time:'14:00', city:'Londres',              country:'RU',     phase:'Semifinal', risk:'Baixo' },
  { id:'ten2', cat:'Tenis',     evento:'Wimbledon 2026',  home:'Final Masculino',         away:'',              date:'2026-07-13', time:'14:00', city:'Londres',              country:'RU',     phase:'Final',     risk:'Baixo' },
  { id:'ten3', cat:'Tenis',     evento:'US Open 2026',    home:'Final',                   away:'',              date:'2026-09-07', time:'15:00', city:'New York/New Jersey',  country:'EUA',    phase:'Final',     risk:'Baixo' },
  // Formula 1
  { id:'f1_1', cat:'Formula 1', evento:'F1 GP do Canada 2026',     home:'GP Montreal',   away:'',  date:'2026-06-08', time:'14:00', city:'Toronto',  country:'Canada', phase:'Corrida', risk:'Baixo' },
  { id:'f1_2', cat:'Formula 1', evento:'F1 GP dos EUA 2026',       home:'GP Austin',     away:'',  date:'2026-10-18', time:'14:00', city:'Houston',  country:'EUA',    phase:'Corrida', risk:'Baixo' },
  { id:'f1_3', cat:'Formula 1', evento:'F1 GP de Las Vegas 2026',  home:'GP Las Vegas',  away:'',  date:'2026-11-21', time:'22:00', city:'Las Vegas',country:'EUA',    phase:'Corrida', risk:'Medio' },
  // UFC
  { id:'ufc1', cat:'MMA / UFC', evento:'UFC 315', home:'Jon Jones',          away:'Tom Aspinall',    date:'2026-05-09', time:'22:00', city:'Las Vegas', country:'EUA', phase:'Principal',    risk:'Medio' },
  { id:'ufc2', cat:'MMA / UFC', evento:'UFC 316', home:'Islam Makhachev',    away:'Charles Oliveira',date:'2026-06-28', time:'22:00', city:'Las Vegas', country:'EUA', phase:'Principal',    risk:'Medio' },
  // MLB World Series
  { id:'mlb1', cat:'Beisebol',  evento:'MLB World Series 2026', home:'A definir', away:'A definir', date:'2026-10-20', time:'20:00', city:'New York/New Jersey', country:'EUA', phase:'Jogo 1', risk:'Baixo' },
  // NHL Stanley Cup
  { id:'nhl1', cat:'Hoquei',    evento:'Stanley Cup Finals 2026', home:'Florida Panthers', away:'Colorado Avalanche', date:'2026-06-12', time:'20:00', city:'Miami', country:'EUA', phase:'Jogo 4', risk:'Baixo' },
];
 
let CATEGORIES = ["Todos", ...new Set(ALL_EVENTS.map(e => e.cat))];
let _selectedEvent = null;
 
// ═══════════════════════════════════════════════════════════════════════════════
// PROXY DE IA — backend FastAPI usa OPENAI_KEY
// ═══════════════════════════════════════════════════════════════════════════════
 
async function callClaude(prompt, maxTokens = 700) {
  try {
    const res = await fetch('/api/v1/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, max_tokens: maxTokens }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data?.text || null;
  } catch (e) {
    console.error('[AI]', e);
    return null;
  }
}
 
async function callClaudeJSON(prompt, maxTokens = 900) {
  const text = await callClaude(prompt + '\n\nResponda APENAS JSON puro e valido. Sem markdown, sem texto extra.', maxTokens);
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/^```(?:json)?\n?|```$/gm, '').trim());
  } catch {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }
}
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
 
function riskBadge(risk) {
  const m = { 'Alto':'#dc2626', 'Medio':'#d97706', 'Baixo':'#16a34a' };
  const c = m[risk] || '#6b7280';
  return '<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:.72rem;font-weight:800;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44">' + (risk==='Medio'?'Médio':risk) + '</span>';
}
 
function catBadge(cat) {
  const m = { 'Futebol':'#15803d','Basquete':'#ea580c','Tenis':'#ca8a04','Formula 1':'#dc2626','MMA / UFC':'#7c3aed','Beisebol':'#0369a1','Hoquei':'#0891b2' };
  const c = m[cat] || '#6b7280';
  const label = cat === 'Tenis' ? 'Tênis' : cat === 'Hoquei' ? 'Hóquei' : cat;
  return '<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:700;background:' + c + '18;color:' + c + ';border:1px solid ' + c + '33">' + label + '</span>';
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════
 
export async function initEventsScreen() {
  buildCountryFilter();
  setupEventSearch();
 
  const list = document.getElementById('eventList');
  if (list) list.innerHTML = '<div class="skeleton-card" style="grid-column:1/-1"><span></span><span></span><span></span></div>';
 
  // Tenta buscar jogos REAIS da Copa (API-Football) via backend
  try {
    const res = await fetch('/api/v1/events/real');
    const data = await res.json();
    const reais = [...(data.futebol || []), ...(data.outros || [])];
    if (reais.length) {
      // Substitui a lista estática pelos eventos reais (mantém os "outros" tipos como complemento)
      const naoCopa = ALL_EVENTS.filter(e => e.evento !== 'Copa do Mundo FIFA 2026');
      ALL_EVENTS = [...reais, ...naoCopa];
      CATEGORIES = ['Todos', ...new Set(ALL_EVENTS.map(e => e.cat))];
    }
  } catch (e) {
    console.warn('[Eventos] usando lista de demonstração (API-Football indisponível):', e);
  }
 
  buildCategoryFilters();
  renderEventCards(ALL_EVENTS);
  filterAndRender();
}
 
function buildCategoryFilters() {
  const host = document.getElementById('eventSearchInput')?.closest('.panel');
  if (!host || document.getElementById('catFilters')) return;
  const div = document.createElement('div');
  div.id = 'catFilters';
  div.style.cssText = 'display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.75rem';
  div.innerHTML = CATEGORIES.map(c =>
    '<button class="cat-btn" data-cat="' + c + '" style="padding:.35rem .85rem;border-radius:999px;font-size:.78rem;font-weight:700;cursor:pointer;border:1px solid var(--line);background:var(--surface-soft);color:var(--ink)">' + c + '</button>'
  ).join('');
  host.appendChild(div);
  div.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      div.querySelectorAll('.cat-btn').forEach(b => { b.style.background='var(--surface-soft)'; b.style.color='var(--ink)'; b.style.borderColor='var(--line)'; });
      btn.style.background='#15803d'; btn.style.color='#fff'; btn.style.borderColor='transparent';
      filterAndRender();
    });
  });
  div.querySelector('[data-cat="Todos"]').click();
}
 
function buildCountryFilter() {
  const cs = document.getElementById('homeCountrySelect');
  const ci = document.getElementById('homeCitySelect');
  if (!cs || !ci) return;
  cs.innerHTML = ['Todos',...new Set(HOST_CITIES.map(c=>c.country))].map(c =>
    '<option value="'+c+'">'+(c==='Todos'?'Todos os paises':c)+'</option>'
  ).join('');
  const upd = () => {
    const sel = cs.value;
    const cities = sel==='Todos' ? ['Todas as cidades',...HOST_CITIES.map(c=>c.name)]
      : ['Todas as cidades',...HOST_CITIES.filter(c=>c.country===sel).map(c=>c.name)];
    ci.innerHTML = cities.map(c=>'<option value="'+c+'">'+c+'</option>').join('');
    filterAndRender();
  };
  cs.addEventListener('change', upd);
  ci.addEventListener('change', filterAndRender);
  upd();
}
 
function filterAndRender() {
  const country = document.getElementById('homeCountrySelect')?.value || 'Todos';
  const city    = document.getElementById('homeCitySelect')?.value    || 'Todas as cidades';
  const search  = (document.getElementById('eventSearchInput')?.value || '').toLowerCase();
  const catBtn  = document.querySelector('#catFilters .cat-btn[style*="color: #fff"], #catFilters .cat-btn[style*="color:#fff"]');
  const cat     = catBtn?.dataset?.cat || 'Todos';
 
  const filtered = ALL_EVENTS.filter(e => {
    const byCountry = country==='Todos' || e.country===country;
    const byCity    = city==='Todas as cidades' || e.city===city;
    const byCat     = cat==='Todos' || e.cat===cat;
    const bySearch  = !search || [e.home,e.away,e.city,e.evento,e.cat].some(v=>v.toLowerCase().includes(search));
    return byCountry && byCity && byCat && bySearch;
  });
 
  renderEventCards(filtered);
  const lbl = document.getElementById('eventCountLabel');
  if (lbl) lbl.textContent = filtered.length + ' evento' + (filtered.length!==1?'s':'');
}
 
function setupEventSearch() {
  document.getElementById('eventSearchInput')?.addEventListener('input', filterAndRender);
}
 
function renderEventCards(events) {
  const list = document.getElementById('eventList');
  if (!list) return;
  if (!events.length) {
    list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted)">Nenhum evento encontrado.</div>';
    return;
  }
  list.innerHTML = events.map(e => {
    const cityInfo = HOST_CITIES.find(c=>c.name===e.city)||{};
    const title = e.away ? e.home+' x '+e.away : e.home;
    return '<div class="card event-card" style="display:flex;flex-direction:column;gap:.45rem">'
      + '<div style="display:flex;justify-content:space-between;align-items:center">' + catBadge(e.cat) + riskBadge(e.risk) + '</div>'
      + '<h3 style="font-size:.98rem;margin:0;line-height:1.3">' + title + '</h3>'
      + '<div style="font-size:.81rem;color:var(--muted);line-height:1.8">'
      + '<div>Cidade: ' + e.city + ', ' + e.country + '</div>'
      + '<div>Local: ' + (cityInfo.stadium||e.evento) + '</div>'
      + '<div>Data: ' + e.date + ' as ' + e.time + '</div>'
      + '<div>Fase: ' + e.phase + '</div>'
      + '</div>'
      + '<button class="button button-primary" style="width:100%;margin-top:auto" data-evid="' + e.id + '">Ver analise de risco</button>'
      + '</div>';
  }).join('');
 
  list.querySelectorAll('[data-evid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = ALL_EVENTS.find(e=>e.id===btn.dataset.evid);
      if (ev) showRiskAnalysis(ev);
    });
  });
}
 
async function showRiskAnalysis(ev) {
  const panel = document.getElementById('selectedEventSummary');
  if (!panel) return;
  _selectedEvent = ev;
  const title = ev.away ? ev.home+' x '+ev.away : ev.home;
  const cityInfo = HOST_CITIES.find(c=>c.name===ev.city)||{};
 
  panel.innerHTML = '<div style="padding:1rem"><div style="margin-bottom:.5rem">'+catBadge(ev.cat)+'</div>'
    + '<h3 style="margin:.2rem 0 .3rem">'+title+'</h3>'
    + '<p style="font-size:.82rem;color:var(--muted);margin-bottom:.75rem">'+ev.date+' - '+ev.city+'</p>'
    + '<div class="skeleton-card"><span></span><span></span><span></span></div>'
    + '<p style="font-size:.78rem;color:var(--muted);margin-top:.4rem">IA analisando...</p></div>';
 
  const result = await callClaudeJSON(
    'Analise logistica do evento: ' + title
    + '\nEvento: ' + ev.evento
    + '\nCidade: ' + ev.city + ', ' + ev.country
    + '\nLocal: ' + (cityInfo.stadium||ev.city)
    + '\nData: ' + ev.date + ' as ' + ev.time
    + '\nFase: ' + ev.phase
    + '\n\nRetorne JSON: {"risco":"Alto/Medio/Baixo","publico_estimado":"numero com unidade",'
    + '"dica_transporte":"frase curta","dica_chegada":"frase curta","alerta":"frase curta"}'
  );
 
  if (!result) {
    panel.innerHTML = '<div style="padding:1rem"><div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:.75rem;color:#dc2626;font-size:.84rem;text-align:center">Falha. Verifique OPENAI_KEY no Render.</div></div>';
    return;
  }
 
  const riskLabel = result.risco==='Medio' ? 'Médio' : (result.risco||'N/A');
 
  panel.innerHTML = '<div style="padding:1rem">'
    + '<div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:.4rem">Analise de Risco — IA</div>'
    + '<h3 style="margin:0 0 .5rem">'+title+'</h3>'
    + '<div style="display:grid;gap:.4rem">'
    + mkCard('<strong>Nivel de risco</strong><div style="margin-top:.2rem">'+riskBadge(result.risco)+'</div>')
    + mkCard('Publico estimado: <strong>'+result.publico_estimado+'</strong>')
    + mkCard('Transporte: '+result.dica_transporte)
    + mkCard('Chegada: '+result.dica_chegada)
    + '<div class="indicator-card" style="padding:.6rem .8rem;border-left:3px solid #d97706"><span style="font-size:.82rem;color:#d97706">Alerta: '+result.alerta+'</span></div>'
    + '<button class="button button-primary" style="width:100%;margin-top:.15rem" id="planBtn">Criar planejamento</button>'
    + '</div></div>';
 
  document.getElementById('planBtn')?.addEventListener('click', () => createPlanning(ev));
}
 
function mkCard(html) {
  return '<div class="indicator-card" style="padding:.6rem .8rem"><span style="font-size:.82rem">'+html+'</span></div>';
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: PLANEJAMENTO
// ═══════════════════════════════════════════════════════════════════════════════
 
export async function createPlanning(ev) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('is-active'));
  document.getElementById('screen-itinerary')?.classList.add('is-active');
  document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('is-active',l.dataset.screenTarget==='itinerary'));
  window.scrollTo({top:0,behavior:'smooth'});
 
  const agList  = document.getElementById('agendaList');
  const itinDiv = document.getElementById('itineraryBuilder');
  if (!agList||!itinDiv) return;
 
  const title = ev.away ? ev.home+' x '+ev.away : ev.home;
  const ci    = HOST_CITIES.find(c=>c.name===ev.city)||{};
  const h1    = document.querySelector('#screen-itinerary .screen-heading h1');
  const lbl   = document.getElementById('agendaCountLabel');
  if (h1) h1.textContent = 'Planejamento: '+title;
  if (lbl) lbl.textContent = '';
 
  agList.innerHTML  = '<div class="skeleton-card"><span></span><span></span><span></span></div>';
  itinDiv.innerHTML = '<div class="skeleton-card"><span></span><span></span></div>';
 
  const result = await callClaudeJSON(
    'Crie um itinerario detalhado para: '+title+' — '+ev.evento
    +'\nLocal: '+(ci.stadium||ev.city)+', '+ev.city+', '+ev.country
    +'\nData: '+ev.date+' as '+ev.time
    +'\n\nRetorne JSON: {"agenda":[{"hora":"08:00","atividade":"nome","detalhe":"descricao","tipo":"hotel"}],'
    +'"dicas":["dica1","dica2","dica3"],"orcamento":"USD XXX–YYY por pessoa"}'
  , 1000);
 
  if (!result) {
    agList.innerHTML = '<div style="padding:1rem;color:#dc2626">Falha ao gerar agenda.</div>';
    itinDiv.innerHTML = '';
    return;
  }
 
  const icons = {hotel:'Hotel',transporte:'Onibus',evento:'Bola',alimentacao:'Prato',turismo:'Mapa'};
  const emojiMap = {hotel:'🏨',transporte:'🚌',evento:'⚽',alimentacao:'🍔',turismo:'🗺️'};
 
  if (lbl) lbl.textContent = (result.agenda?.length||0)+' atividades';
 
  agList.innerHTML = (result.agenda||[]).map(item =>
    '<div style="padding:.65rem .9rem;border-left:3px solid #15803d;margin-bottom:.35rem;background:var(--surface-soft);border-radius:0 8px 8px 0">'
    + '<div style="display:flex;justify-content:space-between;align-items:center">'
    + '<strong style="font-size:.84rem">'+(emojiMap[item.tipo]||'📌')+' '+item.atividade+'</strong>'
    + '<span style="font-size:.76rem;background:rgba(0,0,0,.07);padding:2px 8px;border-radius:999px">'+item.hora+'</span>'
    + '</div>'
    + '<p style="font-size:.8rem;margin:.15rem 0 0;color:var(--muted)">'+item.detalhe+'</p>'
    + '</div>'
  ).join('');
 
  itinDiv.innerHTML = '<div style="margin-bottom:.6rem">'
    + '<p style="font-size:.82rem;color:var(--muted)">Data: '+ev.date+' | Hora: '+ev.time+' | Local: '+ev.city+'</p>'
    + '</div>'
    + '<div style="background:rgba(21,128,61,.08);border-radius:10px;padding:.65rem .8rem;margin-bottom:.65rem">'
    + '<strong style="font-size:.8rem;color:#15803d">Orcamento estimado</strong>'
    + '<p style="font-size:.88rem;margin:.15rem 0 0">'+(result.orcamento||'Consulte localmente')+'</p>'
    + '</div>'
    + '<div style="display:grid;gap:.4rem;margin-bottom:.8rem">'
    + (result.dicas||[]).map(d=>'<div class="indicator-card" style="padding:.55rem .8rem"><span style="font-size:.82rem">Dica: '+d+'</span></div>').join('')
    + '</div>'
    + '<button class="button button-secondary" style="width:100%" data-screen-target="routes">Planejar rota</button>';
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: MAPA
// ═══════════════════════════════════════════════════════════════════════════════
 
export function initMapScreen() {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  canvas.classList.add('world-map');
  canvas.style.position='relative'; canvas.style.overflow='hidden'; canvas.style.padding='0';
  canvas.innerHTML = buildMap();
  canvas.querySelectorAll('.city-pin').forEach(pin => {
    pin.addEventListener('click', () => {
      const city = HOST_CITIES.find(c=>c.name===pin.dataset.city);
      if (city) showCityInfo(city);
    });
  });
  const panel = document.getElementById('poiDetails');
  if (panel) {
    panel.innerHTML = '<div style="padding:1rem"><span class="eyebrow">Copa do Mundo 2026</span>'
      + '<h2 style="margin:.4rem 0 .5rem;font-size:1rem">17 cidades-sede</h2>'
      + '<p style="font-size:.86rem;color:var(--muted)">Clique em um marcador para ver analise logistica.</p>'
      + '<div style="margin-top:.75rem;display:grid;gap:.35rem">'
      + [['EUA','12 cidades','#15803d'],['Canada','2 cidades','#c41e3a'],['Mexico','3 cidades','#006847']].map(([c,n,col])=>
          '<div class="indicator-card" style="padding:.5rem .8rem;border-left:3px solid '+col+';font-size:.84rem"><strong>'+c+'</strong> — '+n+'</div>'
        ).join('')
      + '</div></div>';
  }
}
 
function latLonToXY(lat,lon){
  return { x:Math.round(((lon-(-130))/((-60)-(-130)))*680), y:Math.round(((55-lat)/(55-15))*420) };
}
 
function buildMap() {
  const coast='M 0,120 C 20,90 30,60 45,40 C 60,20 80,5 110,3 C 130,1 145,15 150,30 L 155,28 C 165,18 180,8 200,5 C 220,3 235,15 240,30 C 255,20 270,15 285,20 C 295,25 305,35 310,50 C 340,30 370,20 400,22 C 430,24 445,38 450,55 C 460,45 475,38 490,40 C 510,42 520,55 525,70 L 680,65 L 680,420 L 0,420 Z';
  const gulf='M 180,310 C 210,280 260,265 310,270 C 350,275 385,295 400,320 C 380,350 340,370 290,370 C 240,370 200,350 180,310 Z';
  const lakes='M 395,155 C 415,148 435,150 445,160 C 440,170 430,175 415,173 C 400,172 390,165 395,155 Z M 420,173 C 445,168 465,172 470,182 C 465,192 450,195 435,192 C 420,190 412,183 420,173 Z';
  const cm={'EUA':'#15803d','Canada':'#c41e3a','Mexico':'#006847'};
  const pins = HOST_CITIES.map(c => {
    const {x,y}=latLonToXY(c.lat,c.lon); const col=cm[c.country]||'#6b7280';
    return '<g class="city-pin" data-city="'+c.name+'" style="cursor:pointer">'
      +'<circle cx="'+x+'" cy="'+y+'" r="11" fill="'+col+'" fill-opacity=".15" stroke="'+col+'" stroke-width="1.5"/>'
      +'<circle cx="'+x+'" cy="'+y+'" r="5" fill="'+col+'"/>'
      +'<title>'+c.cc+' '+c.name+' — '+c.matches+' jogos</title></g>';
  }).join('');
  const labels = HOST_CITIES.filter(c=>c.matches>=6).map(c => {
    const {x,y}=latLonToXY(c.lat,c.lon); const short=c.name.split('/')[0].split(' ').slice(0,2).join(' ');
    const r=x<340; return '<text x="'+(x+(r?13:-13))+'" y="'+(y+4)+'" font-size="9.5" font-family="sans-serif" font-weight="700" fill="#1f2937" text-anchor="'+(r?'start':'end')+'">'+short+'</text>';
  }).join('');
  return '<svg width="100%" viewBox="0 0 680 420" xmlns="http://www.w3.org/2000/svg" style="display:block">'
    +'<rect width="680" height="420" fill="#dbeafe"/>'
    +'<path d="'+coast+'" fill="#d1fae5" stroke="#86efac" stroke-width="1.5"/>'
    +'<path d="'+gulf+'" fill="#bfdbfe"/><path d="'+lakes+'" fill="#bfdbfe"/>'
    +'<text x="340" y="20" font-size="12" font-family="sans-serif" font-weight="800" fill="#1f2937" text-anchor="middle">Copa do Mundo 2026 — Cidades-Sede</text>'
    +pins+labels
    +'<g transform="translate(14,398)"><circle cx="5" cy="5" r="4" fill="#15803d"/><text x="13" y="9" font-size="9" font-family="sans-serif" fill="#4b5563">EUA</text><circle cx="46" cy="5" r="4" fill="#c41e3a"/><text x="54" y="9" font-size="9" font-family="sans-serif" fill="#4b5563">Canada</text><circle cx="100" cy="5" r="4" fill="#006847"/><text x="108" y="9" font-size="9" font-family="sans-serif" fill="#4b5563">Mexico</text></g>'
    +'</svg>';
}
 
async function showCityInfo(city) {
  const panel = document.getElementById('poiDetails');
  if (!panel) return;
  panel.innerHTML = '<div style="padding:1rem"><span class="eyebrow">'+city.country+'</span>'
    +'<h2 style="margin:.4rem 0 .3rem;font-size:1.05rem">'+city.name+'</h2>'
    +'<p style="font-size:.82rem;color:var(--muted);margin-bottom:.75rem">'+city.stadium+' · '+city.matches+' jogos</p>'
    +'<div class="skeleton-card"><span></span><span></span><span></span></div></div>';
 
  const result = await callClaudeJSON(
    'Analise a cidade-sede Copa 2026: '+city.name+', '+city.country
    +'\nEstadio: '+city.stadium+' ('+city.matches+' jogos)'
    +'\nRetorne JSON: {"nivel_risco":"Alto/Medio/Baixo","melhor_transporte":"string","hotel_tip":"string","curiosidade":"string"}'
  );
 
  if (!result) { panel.innerHTML='<div style="padding:1rem;color:#dc2626">Falha.</div>'; return; }
 
  panel.innerHTML = '<div style="padding:1rem">'
    +'<span style="font-size:.72rem;color:var(--muted)">'+city.country+'</span>'
    +'<h2 style="margin:.3rem 0;font-size:1.05rem">'+city.name+'</h2>'
    +'<p style="font-size:.82rem;color:var(--muted);margin-bottom:.7rem">'+city.stadium+' · '+city.matches+' jogos</p>'
    +'<div style="display:grid;gap:.4rem">'
    +mkCard('<strong>Risco logistico</strong><div style="margin-top:.2rem">'+riskBadge(result.nivel_risco)+'</div>')
    +mkCard('Transporte: '+result.melhor_transporte)
    +mkCard('Hospedagem: '+result.hotel_tip)
    +'<div class="indicator-card" style="padding:.6rem .8rem;border-left:3px solid #15803d"><span style="font-size:.82rem;color:#15803d">Curiosidade: '+result.curiosidade+'</span></div>'
    +'</div></div>';
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: ROTAS
// ═══════════════════════════════════════════════════════════════════════════════
 
// Coordenadas do usuário (definidas pelo main.js após consentimento de localização)
let _userCoords = null;
export function setUserCoords(coords) { _userCoords = coords; }
 
export function initRoutesScreen() {
  const ds = document.getElementById('routeDestinationSelect');
  if (ds && ds.options.length<=1) {
    ds.innerHTML = '<option value="">Selecione a cidade de destino</option>'
      + HOST_CITIES.map(c=>'<option value="'+c.name+'">'+c.cc+' '+c.name+' — '+c.stadium+'</option>').join('');
  }
  // Pré-preenche destino se veio de um planejamento
  if (_selectedEvent?.city && ds) ds.value = _selectedEvent.city;
 
  // Melhora o campo de origem (o valor fixo "Minha localização" não geocodifica)
  const orig = document.getElementById('routeOriginInput');
  if (orig) {
    orig.placeholder = 'Hotel, aeroporto ou endereço de partida';
    if (orig.value === 'Minha localização') orig.value = '';
  }
 
  const form = document.getElementById('routeForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound='1';
    form.addEventListener('submit', async e=>{ e.preventDefault(); await generateRoute(); });
  }
}
 
async function generateRoute() {
  const originRaw = (document.getElementById('routeOriginInput')?.value || '').trim();
  const dest      = document.getElementById('routeDestinationSelect')?.value || '';
  const mode      = document.getElementById('routeModeSelect')?.value || 'transit';
  const labels    = { walking:'a pé', transit:'transporte público', drive:'carro/app' };
  const out       = document.getElementById('routeResult');
  if (!out) return;
  if (!dest) { out.innerHTML = '<div style="color:#dc2626;padding:.5rem">Selecione um destino.</div>'; return; }
 
  const ci = HOST_CITIES.find(c => c.name === dest) || {};
 
  // Resolve a origem: texto digitado > coordenadas do GPS > centro da cidade-destino
  let origin = originRaw;
  if (!origin && _userCoords) origin = _userCoords.latitude + ',' + _userCoords.longitude;
  if (!origin) origin = ci.lat + ',' + ci.lon; // fallback: centro da cidade-sede
 
  // Destino para o Google: nome do estádio + cidade (melhor geocodificação)
  const destQuery = (ci.stadium || dest) + ', ' + dest.split('/')[0];
 
  out.innerHTML = '<div class="skeleton-card" style="margin-top:.75rem"><span></span><span></span><span></span></div>'
    + '<p style="font-size:.8rem;color:var(--muted);margin-top:.4rem">Consultando Google Maps...</p>';
 
  // 1) Rota real via Google Maps
  let route = null;
  try {
    const params = new URLSearchParams({ origin, destination: destQuery, mode });
    const res = await fetch('/api/v1/maps/route?' + params.toString());
    route = await res.json();
  } catch (e) { console.error('[Maps]', e); }
 
  // 2) Dicas contextuais via IA (em paralelo conceitual)
  const tips = await callClaudeJSON(
    'Dicas de mobilidade para chegar ao estádio ' + (ci.stadium || dest) + ' em ' + dest
    + ' usando ' + (labels[mode] || mode) + ' durante a Copa 2026.'
    + '\nRetorne JSON: {"dica_1":"dica de mobilidade","dica_2":"dica de segurança","aviso":"aviso de evento ou null","score_conforto":8}'
  );
 
  // ── Sucesso: rota real do Google Maps ──
  if (route && route.ok) {
    const mapImg = route.static_map
      ? '<img src="' + route.static_map + '" alt="Mapa da rota" style="width:100%;border-radius:12px;display:block;border:1px solid var(--line)" loading="lazy"/>'
      : '';
    const stepsHtml = (route.steps || []).slice(0, 6).map((s, i) =>
      '<div style="display:flex;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--line,#eee)">'
      + '<span style="flex:0 0 22px;height:22px;border-radius:50%;background:#15803d;color:#fff;font-size:.72rem;font-weight:800;display:grid;place-items:center">' + (i+1) + '</span>'
      + '<div style="flex:1"><p style="font-size:.82rem;margin:0">' + s.instrucao + '</p>'
      + '<span style="font-size:.74rem;color:var(--muted)">' + s.distancia + (s.duracao ? ' · ' + s.duracao : '') + '</span></div>'
      + '</div>'
    ).join('');
 
    out.innerHTML = '<div style="display:grid;gap:.6rem;margin-top:.75rem">'
      + '<div class="panel" style="padding:0;overflow:hidden">'
      +   mapImg
      +   '<div style="padding:.9rem">'
      +     '<span style="font-size:.7rem;font-weight:700;color:#15803d">Rota real — Google Maps</span>'
      +     '<h3 style="margin:.3rem 0;font-size:1rem">' + (route.origin_address || origin) + ' → ' + (ci.stadium || dest) + '</h3>'
      +     '<div style="display:flex;flex-wrap:wrap;gap:1rem;margin:.5rem 0">'
      +       '<span style="font-size:.86rem">⏱ <strong>' + route.duration + '</strong></span>'
      +       '<span style="font-size:.86rem">📏 <strong>' + route.distance + '</strong></span>'
      +       '<span style="font-size:.86rem">🚦 ' + (labels[mode] || mode) + '</span>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + (stepsHtml ? '<div class="panel" style="padding:.9rem"><strong style="font-size:.82rem">Passo a passo</strong>' + stepsHtml + '</div>' : '')
      + (tips ? mkCard('💡 ' + tips.dica_1) + mkCard('🛡️ ' + tips.dica_2)
              + (tips.aviso && tips.aviso !== 'null' ? '<div class="indicator-card" style="padding:.6rem .8rem;border-left:3px solid #d97706"><span style="font-size:.82rem;color:#d97706">⚠️ ' + tips.aviso + '</span></div>' : '') : '')
      + '</div>';
    return;
  }
 
  // ── Fallback: Google falhou (ex: rota intercontinental a pé). Usa estimativa da IA ──
  const est = await callClaudeJSON(
    'Estime uma rota para Copa 2026. Origem: ' + origin + '\nDestino: ' + (ci.stadium || dest) + ', ' + (ci.country || '')
    + '\nModo: ' + (labels[mode] || mode)
    + '\nRetorne JSON: {"tempo_estimado":"X h Y min","distancia":"~X km","rota_principal":"descrição 1 linha"}'
  );
 
  const motivo = route?.error ? '<p style="font-size:.78rem;color:var(--muted);margin:.3rem 0 0">Google Maps: ' + route.error + ' — exibindo estimativa.</p>' : '';
 
  if (!est && !tips) { out.innerHTML = '<div style="color:#dc2626;margin-top:.5rem">Falha ao gerar rota. Verifique as chaves no Render.</div>'; return; }
 
  out.innerHTML = '<div style="display:grid;gap:.6rem;margin-top:.75rem">'
    + '<div class="panel" style="padding:.9rem">'
    +   '<span style="font-size:.7rem;font-weight:700;color:var(--muted)">Estimativa — IA</span>'
    +   '<h3 style="margin:.3rem 0;font-size:1rem">' + (originRaw || 'Origem') + ' → ' + (ci.stadium || dest) + '</h3>'
    +   (est ? '<div style="display:flex;flex-wrap:wrap;gap:1rem;margin:.5rem 0">'
    +     '<span style="font-size:.86rem">⏱ <strong>' + est.tempo_estimado + '</strong></span>'
    +     '<span style="font-size:.86rem">📏 <strong>' + est.distancia + '</strong></span></div>'
    +     '<div style="background:rgba(21,128,61,.08);border-radius:10px;padding:.65rem .8rem"><p style="font-size:.84rem;margin:0">' + est.rota_principal + '</p></div>' : '')
    +   motivo
    + '</div>'
    + (tips ? mkCard('💡 ' + tips.dica_1) + mkCard('🛡️ ' + tips.dica_2) : '')
    + '</div>';
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: RECOMENDACOES
// ═══════════════════════════════════════════════════════════════════════════════
 
export async function initRecommendationsScreen() {
  const strip = document.getElementById('contextStrip');
  const list  = document.getElementById('recommendationList');
  if (!list) return;
  if (strip) {
    strip.innerHTML = '<span class="context-pill" style="padding:.35rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700">Copa 2026</span>'
      +' <span class="context-pill" style="padding:.35rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700">NBA / Wimbledon</span>'
      +' <span class="context-pill" style="padding:.35rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700">F1 / UFC</span>';
  }
  list.innerHTML = '<div class="skeleton-card" style="grid-column:1/-1"><span></span><span></span><span></span></div>';
 
  const result = await callClaudeJSON(
    'Recomende 6 grandes eventos esportivos de 2026 para um torcedor brasileiro.'
    +' Inclua variedade: futebol, basquete, tenis, F1, UFC — nao apenas Copa do Mundo.'
    +' Retorne array JSON direto (nao envolva em objeto): '
    +'[{"jogo":"Nome","categoria":"Futebol/Basquete/Tenis/Formula1/MMA","cidade":"Cidade, Pais",'
    +'"data":"Mes 2026","motivo":"Por que imperdivel (1 frase)","dica":"Dica pratica (1 frase)","emocao":9}]'
  , 1400);
 
  const eventos = Array.isArray(result) ? result : (result?.eventos || result?.recomendacoes || []);
 
  if (!eventos.length) {
    list.innerHTML = '<div style="grid-column:1/-1;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:1rem;color:#dc2626;text-align:center">Falha ao carregar. Verifique OPENAI_KEY no Render.</div>';
    return;
  }
 
  const cMap={'Futebol':'#15803d','Basquete':'#ea580c','Tenis':'#ca8a04','Formula1':'#dc2626','MMA':'#7c3aed','Beisebol':'#0369a1'};
 
  list.innerHTML = eventos.map(ev => {
    const emocao = parseInt(ev.emocao)||parseInt(ev.nivel_emocao)||7;
    const col    = cMap[ev.categoria] || '#6b7280';
    const dica   = ev.dica || ev.dica_viagem || '';
    return '<div class="card recommendation-card" style="display:flex;flex-direction:column;gap:.45rem;border-left:3px solid '+col+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      +'<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:700;background:'+col+'18;color:'+col+';border:1px solid '+col+'33">'+ev.categoria+'</span>'
      +'<span style="font-size:.75rem;font-weight:800;color:'+col+'">'+emocao+'/10</span>'
      +'</div>'
      +'<h3 style="font-size:.96rem;margin:0;line-height:1.3">'+ev.jogo+'</h3>'
      +'<p style="font-size:.82rem;color:var(--muted);margin:0">'+ev.cidade+' · '+ev.data+'</p>'
      +'<p style="font-size:.84rem;margin:0">'+ev.motivo+'</p>'
      +'<div style="background:var(--line,#e5e7eb);border-radius:999px;height:4px">'
      +'<div style="width:'+Math.round(emocao/10*100)+'%;background:'+col+';height:4px;border-radius:999px"></div>'
      +'</div>'
      +(dica ? '<div style="background:'+col+'12;border-radius:10px;padding:.4rem .7rem"><span style="font-size:.78rem;color:'+col+'">' + dica + '</span></div>' : '')
      +'</div>';
  }).join('');
}
}
