import { userKey } from './auth.js';
 
let WC_EVENTS = [];        // jogos da Copa (cache)
let CATALOG = [];          // catálogo curado (cache)
let LAST_EVENTS = [];      // eventos renderizados atualmente
let _userCoords = null;    // GPS do usuário
let _selectedEvent = null; // evento escolhido para roteiro
let _currentItinerary = null;
let _mapInstance = null;
let _mapMarkers = [];
 
const STORAGE_KEY = 'aces_itineraries';
 
export function setUserCoords(coords) { _userCoords = coords; }
 
// ─── Helpers de rede ────────────────────────────────────────────────────────────
async function getJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { console.warn('[fetch]', url, e); return null; }
}
async function postJSON(url, body) {
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { console.warn('[post]', url, e); return null; }
}
 
// IA via backend (Gemini). Retorna texto ou null.
async function askAI(prompt, maxTokens = 700) {
  const res = await postJSON('/api/v1/ai/generate', { prompt, max_tokens: maxTokens });
  return res?.text || null;
}
async function askAIJSON(prompt, maxTokens = 900) {
  const txt = await askAI(prompt + '\n\nResponda APENAS JSON válido, sem markdown.', maxTokens);
  if (!txt) return null;
  try { return JSON.parse(txt.replace(/^```(?:json)?\n?|```$/gm, '').trim()); }
  catch {
    const m = txt.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }
}
 
// ─── Helpers visuais ────────────────────────────────────────────────────────────
function catColor(cat) {
  const m = { 'Futebol':'#15803d','Sports':'#15803d','Music':'#7c3aed','Música':'#7c3aed',
    'Arts & Theatre':'#db2777','Miscellaneous':'#0891b2','Film':'#ea580c' };
  return m[cat] || '#0369a1';
}
function badge(text, color) {
  return '<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:.7rem;font-weight:700;background:'+color+'18;color:'+color+';border:1px solid '+color+'33">'+text+'</span>';
}
function skeleton(cols) {
  return '<div class="skeleton-card"'+(cols?' style="grid-column:1/-1"':'')+'><span></span><span></span><span></span></div>';
}
function errBox(msg) {
  return '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:.85rem;color:#dc2626;text-align:center;font-size:.86rem">'+msg+'</div>';
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE (Google Places via backend, fallback offline)
// ═══════════════════════════════════════════════════════════════════════════════
 
function attachAutocomplete(inputId, listId, kind, onPick) {
  const input = document.getElementById(inputId);
  const list  = document.getElementById(listId);
  if (!input || !list) return;
  let timer = null, items = [], active = -1;
 
  const close = () => { list.classList.remove('is-open'); list.innerHTML = ''; active = -1; };
  const render = () => {
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((it, i) =>
      '<div class="ac-item'+(i===active?' is-active':'')+'" data-i="'+i+'">'+it.label+'</div>'
    ).join('');
    list.classList.add('is-open');
    list.querySelectorAll('.ac-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const it = items[parseInt(el.dataset.i)];
        input.value = it.label;
        close();
        onPick?.(it);
      });
    });
  };
 
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { close(); return; }
    timer = setTimeout(async () => {
      const res = await getJSON('/api/v1/places/autocomplete?kind=' + kind + '&q=' + encodeURIComponent(q));
      items = res?.data || [];
      active = -1;
      render();
    }, 220);
  });
  input.addEventListener('keydown', (e) => {
    if (!list.classList.contains('is-open')) return;
    if (e.key === 'ArrowDown') { active = Math.min(active+1, items.length-1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active-1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      const it = items[active]; input.value = it.label; close(); onPick?.(it);
    } else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════
 
export async function initEventsScreen() {
  const list = document.getElementById('eventList');
  if (list) list.innerHTML = skeleton(true);
 
  // Autocomplete país e cidade (filtram a lista ao escolher)
  attachAutocomplete('homeCountryInput', 'homeCountryAC', 'country', () => loadEvents());
  attachAutocomplete('homeCityInput', 'homeCityAC', 'city', () => loadEvents());
  const search = document.getElementById('eventSearchInput');
  if (search && !search.dataset.bound) {
    search.dataset.bound = '1';
    let t = null;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadEvents, 300); });
  }
 
  await loadEvents();
}
 
async function loadEvents() {
  const list = document.getElementById('eventList');
  if (list) list.innerHTML = skeleton(true);
 
  const city    = (document.getElementById('homeCityInput')?.value || '').split(',')[0].trim();
  const country = (document.getElementById('homeCountryInput')?.value || '').split(',')[0].trim();
  const keyword = (document.getElementById('eventSearchInput')?.value || '').trim();
 
  // Catálogo curado (base sempre presente)
  if (!CATALOG.length) {
    const cat = await getJSON('/api/v1/events/catalog');
    CATALOG = cat?.data || [];
  }
 
  // Ticketmaster ao vivo (enriquecimento)
  const params = new URLSearchParams();
  if (city) params.set('city', city);
  if (keyword) params.set('keyword', keyword);
  params.set('years_ahead', '2');
  const tm = await getJSON('/api/v1/events/ticketmaster?' + params.toString());
  const tmEvents = tm?.data || [];
 
  // Filtro por texto (catálogo)
  const q = (s) => (s || '').toLowerCase();
  let curated = CATALOG.filter(e => {
    const okC = !country || q(e.country).includes(q(country)) || q(e.city).includes(q(country));
    const okCity = !city || q(e.city).includes(q(city));
    const okKw = !keyword || [e.title, e.evento, e.cat, e.city, e.country].some(v => q(v).includes(q(keyword)));
    return okC && okCity && okKw;
  });
 
  // Janela de 2 anos para os eventos ao vivo (curados podem ter sessões futuras)
  const today = new Date(); today.setHours(0,0,0,0);
  const limit = new Date(today); limit.setFullYear(limit.getFullYear() + 2);
  const inWindow = (e) => {
    if (!e.date) return true;
    const d = new Date(e.date + 'T00:00:00');
    return d >= today && d <= limit;
  };
 
  LAST_EVENTS = [...curated, ...tmEvents.filter(inWindow)];
  renderEventCards(LAST_EVENTS);
}
 
function renderEventCards(events) {
  const list = document.getElementById('eventList');
  const label = document.getElementById('eventCountLabel');
  if (label) label.textContent = events.length + ' evento' + (events.length!==1?'s':'');
  if (!list) return;
  if (!events.length) {
    list.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted)">Nenhum evento encontrado. Tente outra cidade ou termo.</div>';
    return;
  }
  list.innerHTML = events.slice(0, 40).map(e => {
    const col = catColor(e.cat);
    const nSessions = (e.sessions || []).length;
    const btnLabel = nSessions ? ('Ver ' + nSessions + ' atrações') : 'Criar roteiro';
    return '<div class="card event-card" style="display:flex;flex-direction:column;gap:.5rem">'
      + '<div style="display:flex;justify-content:space-between;align-items:center">'
      +   badge(e.cat || 'Evento', col)
      +   (nSessions ? '<span style="font-size:.72rem;font-weight:700;color:'+col+'">'+nSessions+' atrações</span>'
                     : (e.phase ? '<span style="font-size:.72rem;color:var(--muted)">'+e.phase+'</span>' : ''))
      + '</div>'
      + '<h3 style="font-size:1rem;margin:0;line-height:1.3">'+(e.title || e.evento)+'</h3>'
      + (e.descricao ? '<p style="font-size:.8rem;color:var(--muted);margin:0;line-height:1.5">'+e.descricao+'</p>' : '')
      + '<div style="font-size:.82rem;color:var(--muted);line-height:1.7">'
      +   '<div>📍 '+(e.city||'')+(e.country?', '+e.country:'')+'</div>'
      +   (e.venue ? '<div>🏟 '+e.venue+'</div>' : '')
      +   (e.date ? '<div>📅 '+(nSessions?'a partir de ':'')+e.date+(e.time&&!nSessions?' · '+e.time:'')+'</div>' : '')
      + '</div>'
      + '<button class="button button-primary" style="width:100%;margin-top:auto" data-evid="'+e.id+'">'+btnLabel+'</button>'
      + '</div>';
  }).join('');
 
  list.querySelectorAll('[data-evid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = events.find(x => x.id === btn.dataset.evid);
      if (!ev) return;
      if ((ev.sessions || []).length) openSessionPicker(ev);
      else createItinerary(ev);
    });
  });
}
 
// ── Seletor de sessões (Copa = vários jogos; festival = vários dias) ──────────
function openSessionPicker(ev) {
  const panel = document.getElementById('selectedEventSummary');
  if (!panel) { createItinerary(ev); return; }
  const col = catColor(ev.cat);
  panel.innerHTML =
    '<div style="padding:1rem">'
    + '<button id="backToEvents" class="button button-secondary" style="padding:.3rem .7rem;margin-bottom:.6rem">← Voltar</button>'
    + '<span class="eyebrow">'+(ev.cat||'Evento')+'</span>'
    + '<h3 style="margin:.3rem 0 .2rem">'+(ev.title||ev.evento)+'</h3>'
    + '<p style="font-size:.82rem;color:var(--muted);margin:0 0 .8rem">Escolha a atração para montar seu roteiro:</p>'
    + '<div style="display:grid;gap:.45rem;max-height:60vh;overflow:auto">'
    + ev.sessions.map(s =>
        '<button class="session-pick" data-sid="'+s.id+'" style="text-align:left;border:1px solid var(--line);border-radius:10px;padding:.6rem .8rem;background:#fff;cursor:pointer">'
        + '<div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center">'
        + '<strong style="font-size:.85rem">'+s.label+'</strong>'
        + '<span style="font-size:.72rem;font-weight:700;color:'+col+'">'+(s.phase||'')+'</span></div>'
        + '<div style="font-size:.78rem;color:var(--muted);margin-top:.2rem">📅 '+s.date+(s.time?' · '+s.time:'')+' · 📍 '+(s.venue||s.city)+'</div>'
        + '</button>'
      ).join('')
    + '</div></div>';
 
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('backToEvents')?.addEventListener('click', () => { panel.innerHTML = ''; });
  panel.querySelectorAll('.session-pick').forEach(b =>
    b.addEventListener('click', async () => {
      // Busca a sessão "cheia" no backend e monta o roteiro
      const full = await getJSON('/api/v1/events/find?id=' + encodeURIComponent(b.dataset.sid));
      if (full && !full.error) createItinerary(full);
      else {
        const s = ev.sessions.find(x => x.id === b.dataset.sid);
        createItinerary({ ...ev, ...s, title: ev.evento + ' — ' + s.label, sessions: [] });
      }
    }));
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: AVALIAR LOCAIS (importa locais dos roteiros salvos)
// ═══════════════════════════════════════════════════════════════════════════════
 
const RATINGS_KEY = 'aces_ratings';
 
function loadRatings() {
  try { return JSON.parse(localStorage.getItem(userKey(RATINGS_KEY)) || '[]'); } catch { return []; }
}
function saveRatings(arr) { localStorage.setItem(userKey(RATINGS_KEY), JSON.stringify(arr)); }
 
// Reúne todos os locais únicos a partir dos roteiros salvos
function collectPlaces() {
  const saved = loadSaved();
  const places = new Map();
  const add = (nome, tipo, contexto) => {
    if (!nome) return;
    const key = nome.toLowerCase();
    if (!places.has(key)) places.set(key, { nome, tipo, contexto });
  };
  saved.forEach(it => {
    const ev = it.event || {};
    if (ev.venue) add(ev.venue, 'Local do evento', ev.title || '');
    (it.hotels || []).forEach(h => add(h.nome, 'Hospedagem', ev.city || ''));
    (it.restaurants || []).forEach(r => add(r.nome, 'Restaurante', ev.city || ''));
  });
  return [...places.values()];
}
 
let _ratingStars = 0;
 
export function initRatingsScreen() {
  const sel = document.getElementById('ratingPoiSelect');
  const starsBox = document.getElementById('ratingStars');
  const submit = document.getElementById('submitRatingButton');
 
  const places = collectPlaces();
 
  if (sel) {
    if (!places.length) {
      sel.innerHTML = '<option value="">Nenhum local — crie e salve um roteiro primeiro</option>';
    } else {
      sel.innerHTML = '<option value="">Selecione um local do seu roteiro</option>'
        + places.map(p => '<option value="'+p.nome.replace(/"/g,'&quot;')+'">'+p.nome+' · '+p.tipo+(p.contexto?' ('+p.contexto+')':'')+'</option>').join('');
    }
  }
 
  // Estrelas clicáveis
  if (starsBox && !starsBox.dataset.bound) {
    starsBox.dataset.bound = '1';
    const render = () => {
      starsBox.innerHTML = [1,2,3,4,5].map(n =>
        '<span class="star" data-n="'+n+'" style="cursor:pointer;font-size:1.6rem;color:'+(n<=_ratingStars?'#f59e0b':'#d1d5db')+'">★</span>'
      ).join('');
      starsBox.querySelectorAll('.star').forEach(s =>
        s.addEventListener('click', () => { _ratingStars = parseInt(s.dataset.n); render(); }));
    };
    render();
  } else if (starsBox) {
    _ratingStars = 0;
    starsBox.querySelectorAll('.star').forEach(s => s.style.color = '#d1d5db');
  }
 
  if (submit && !submit.dataset.bound) {
    submit.dataset.bound = '1';
    submit.addEventListener('click', () => {
      const local = document.getElementById('ratingPoiSelect')?.value;
      const coment = document.getElementById('ratingCommentInput')?.value || '';
      if (!local) { toast('Selecione um local.'); return; }
      if (!_ratingStars) { toast('Dê uma nota de 1 a 5.'); return; }
      const arr = loadRatings();
      arr.unshift({ id: 'r'+Date.now(), local, nota: _ratingStars, comentario: coment, data: Date.now() });
      saveRatings(arr);
      _ratingStars = 0;
      const ci = document.getElementById('ratingCommentInput'); if (ci) ci.value = '';
      initRatingsScreen();
      renderRatingsList();
      toast('Avaliação registrada!');
    });
  }
 
  renderRatingsList();
}
 
function renderRatingsList() {
  const host = document.getElementById('ratingsList');
  if (!host) return;
  const arr = loadRatings();
  if (!arr.length) {
    host.innerHTML = '<p style="font-size:.85rem;color:var(--muted)">Nenhuma avaliação ainda.</p>';
    return;
  }
  host.innerHTML = arr.map(r =>
    '<div class="itin-card"><div style="display:flex;justify-content:space-between;align-items:center">'
    + '<strong style="font-size:.86rem">'+r.local+'</strong>'
    + '<span style="color:#f59e0b;font-size:.9rem">'+'★'.repeat(r.nota)+'<span style="color:#d1d5db">'+'★'.repeat(5-r.nota)+'</span></span></div>'
    + (r.comentario?'<p style="font-size:.82rem;margin:.3rem 0 .4rem;color:var(--muted)">'+r.comentario+'</p>':'')
    + '<button class="button button-secondary" data-delrating="'+r.id+'" style="padding:.25rem .6rem">✕ Remover</button></div>'
  ).join('');
  host.querySelectorAll('[data-delrating]').forEach(b =>
    b.addEventListener('click', () => {
      saveRatings(loadRatings().filter(x => x.id !== b.dataset.delrating));
      renderRatingsList();
    }));
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: BOAS-VINDAS (hero vivo — destaques e próximos eventos)
// ═══════════════════════════════════════════════════════════════════════════════
 
export async function initWelcomeScreen() {
  const featured = document.getElementById('welcomeFeatured');
  const upcoming = document.getElementById('welcomeUpcoming');
  if (!featured && !upcoming) return;
 
  if (!CATALOG.length) {
    const cat = await getJSON('/api/v1/events/catalog');
    CATALOG = cat?.data || [];
  }
 
  // Destaques: Copa + 3 grandes eventos
  if (featured) {
    const destaque = CATALOG.slice(0, 4);
    featured.innerHTML = destaque.map(e => {
      const n = (e.sessions || []).length;
      const img = e.image ? ('src/assets/img/' + e.image + '.png') : '';
      return '<div class="uf-feat-card" data-wid="'+e.id+'">'
        + '<div class="uf-feat-top">'+(img?'<img src="'+img+'" alt="" />':'')
        +   '<span class="uf-feat-tag">'+(e.cat||'Evento')+'</span></div>'
        + '<div class="uf-feat-body">'
        +   '<h3>'+(e.title||e.evento)+'</h3>'
        +   '<div class="meta">📍 '+(e.city||'')+'<br>📅 '+(n?'a partir de ':'')+(e.date||'')+'</div>'
        +   '<span class="uf-feat-cta">'+(n? n+' atrações →' : 'Criar roteiro →')+'</span>'
        + '</div></div>';
    }).join('');
    featured.querySelectorAll('[data-wid]').forEach(c =>
      c.addEventListener('click', () => {
        const ev = CATALOG.find(x => x.id === c.dataset.wid);
        if (!ev) return;
        if ((ev.sessions||[]).length) { goTo('home'); openSessionPicker(ev); }
        else createItinerary(ev);
      }));
  }
 
  // Próximos eventos: ordena por data (curados + sessões da Copa)
  if (upcoming) {
    const flat = [];
    CATALOG.forEach(e => {
      if ((e.sessions||[]).length) e.sessions.slice(0,3).forEach(s =>
        flat.push({ ...e, ...s, title: e.evento + ' — ' + s.label, sessions: [] }));
      else flat.push(e);
    });
    flat.sort((a,b) => (a.date||'').localeCompare(b.date||''));
    upcoming.innerHTML = flat.slice(0, 6).map(e => {
      const d = e.date ? new Date(e.date+'T00:00:00') : null;
      const ds = d ? d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }) : '—';
      return '<div class="uf-up-card" data-uid="'+e.id+'">'
        + '<div class="uf-up-date">'+ds+'</div>'
        + '<h4>'+(e.title||e.evento)+'</h4>'
        + '<div class="meta">📍 '+(e.city||'')+'</div></div>';
    }).join('');
    upcoming.querySelectorAll('[data-uid]').forEach(c =>
      c.addEventListener('click', async () => {
        const full = await getJSON('/api/v1/events/find?id=' + encodeURIComponent(c.dataset.uid));
        if (full && !full.error) createItinerary(full);
      }));
  }
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// ROTEIRO: criar → pré-visualizar → editar → salvar/PDF
// ═══════════════════════════════════════════════════════════════════════════════
 
export async function createItinerary(ev) {
  _selectedEvent = ev;
  goTo('itinerary');
 
  const agendaList = document.getElementById('agendaList');
  const builder    = document.getElementById('itineraryBuilder');
  const h1 = document.querySelector('#screen-itinerary .screen-heading h1');
  if (h1) h1.textContent = 'Roteiro: ' + (ev.title || ev.evento);
  if (agendaList) agendaList.innerHTML = skeleton();
  if (builder) builder.innerHTML = skeleton();
 
  const origin = _userCoords ? (_userCoords.latitude + ',' + _userCoords.longitude) : null;
  const res = await postJSON('/api/v1/itinerary', { event: ev, origin });
 
  if (!res || !res.ok) {
    if (agendaList) agendaList.innerHTML = errBox('Falha ao montar o roteiro.');
    if (builder) builder.innerHTML = '';
    return;
  }
  _currentItinerary = res;
  renderItineraryPreview(res);
}
 
function renderItineraryPreview(it) {
  const agendaList = document.getElementById('agendaList');
  const builder    = document.getElementById('itineraryBuilder');
  const lbl = document.getElementById('agendaCountLabel');
  if (lbl) lbl.textContent = (it.agenda?.length || 0) + ' atividades';
 
  const icons = { hotel:'🏨', transporte:'🚌', evento:'🎫', alimentacao:'🍽️', turismo:'🗺️' };
 
  // Agenda (esquerda)
  if (agendaList) {
    agendaList.innerHTML = (it.agenda || []).map(a =>
      '<div class="itin-card"><div style="display:flex;justify-content:space-between;align-items:center">'
      + '<strong style="font-size:.85rem">'+(icons[a.tipo]||'📌')+' '+a.atividade+'</strong>'
      + '<span style="font-size:.76rem;background:rgba(0,0,0,.06);padding:2px 8px;border-radius:999px">'+a.hora+'</span>'
      + '</div><p style="font-size:.8rem;margin:.2rem 0 0;color:var(--muted)">'+(a.detalhe||'')+'</p></div>'
    ).join('');
  }
 
  // Builder (direita): hotéis, restaurantes, deslocamento, custo, ações
  if (builder) {
    const ev = it.event || {};
    const hotels = (it.hotels||[]).map(h =>
      '<div class="itin-place"><div><strong style="font-size:.84rem">'+h.nome+'</strong>'
      + '<div style="font-size:.76rem;color:var(--muted)">'+(h.endereco||'')+'</div></div>'
      + (h.rating ? '<span style="font-size:.78rem;color:#d97706">★ '+h.rating+'</span>' : '')+'</div>'
    ).join('') || '<p style="font-size:.82rem;color:var(--muted)">Sem dados de hospedagem.</p>';
 
    const rests = (it.restaurants||[]).map(r =>
      '<div class="itin-place"><div><strong style="font-size:.84rem">'+r.nome+'</strong>'
      + '<div style="font-size:.76rem;color:var(--muted)">'+(r.endereco||'')+'</div></div>'
      + (r.rating ? '<span style="font-size:.78rem;color:#d97706">★ '+r.rating+'</span>' : '')+'</div>'
    ).join('') || '<p style="font-size:.82rem;color:var(--muted)">Sem dados de restaurantes.</p>';
 
    const travel = it.travel && it.travel.ok
      ? '<div class="itin-card">🚌 Deslocamento até o local: <strong>'+it.travel.duration+'</strong> ('+it.travel.distance+')</div>'
      : '';
 
    builder.innerHTML =
      '<div class="itin-section"><p style="font-size:.82rem;color:var(--muted)">📅 '+(ev.date||'')+' · ⏰ '+(ev.time||'')+' · 📍 '+(ev.city||'')+'</p></div>'
      + travel
      + '<div class="itin-card"><strong style="font-size:.82rem;color:#15803d">💰 Custo médio estimado</strong><p style="font-size:.88rem;margin:.2rem 0 0">'+(it.custo_medio||'—')+'</p></div>'
      + '<div class="itin-section"><strong style="font-size:.85rem">🏨 Hospedagem próxima</strong>'+hotels+'</div>'
      + '<div class="itin-section"><strong style="font-size:.85rem">🍽️ Restaurantes próximos</strong>'+rests+'</div>'
      + '<div style="display:grid;gap:.5rem;margin-top:.8rem">'
      +   '<button class="button button-primary" id="editItinBtn" style="width:100%">✏️ Editar roteiro</button>'
      +   '<button class="button button-secondary" id="saveItinBtn" style="width:100%">💾 Salvar roteiro</button>'
      +   '<button class="button button-secondary" id="pdfItinBtn" style="width:100%">📄 Exportar PDF</button>'
      + '</div>';
 
    document.getElementById('editItinBtn')?.addEventListener('click', openEditor);
    document.getElementById('saveItinBtn')?.addEventListener('click', () => { saveItinerary(it); toast('Roteiro salvo!'); });
    document.getElementById('pdfItinBtn')?.addEventListener('click', () => exportPDF(it));
  }
}
 
// ── Editor ──────────────────────────────────────────────────────────────────
function openEditor() {
  if (!_currentItinerary) return;
  goTo('edit');
  const editor = document.getElementById('itineraryEditor');
  if (!editor) return;
  const ag = _currentItinerary.agenda || [];
  editor.innerHTML =
    '<div class="panel" style="padding:1rem">'
    + '<p style="font-size:.84rem;color:var(--muted);margin-bottom:.6rem">Edite os horários e atividades do seu roteiro:</p>'
    + '<div id="editRows">'
    + ag.map((a, i) =>
        '<div class="agenda-edit-row">'
        + '<input value="'+(a.hora||'')+'" data-i="'+i+'" data-f="hora" />'
        + '<input value="'+(a.atividade||'').replace(/"/g,'&quot;')+'" data-i="'+i+'" data-f="atividade" />'
        + '<button class="button button-secondary" data-del="'+i+'" style="padding:.3rem .6rem">✕</button>'
        + '</div>'
      ).join('')
    + '</div>'
    + '<div style="display:flex;gap:.5rem;margin-top:.8rem;flex-wrap:wrap">'
    +   '<button class="button button-secondary" id="addRowBtn">+ Adicionar item</button>'
    +   '<button class="button button-primary" id="saveEditBtn">Salvar alterações</button>'
    + '</div></div>';
 
  const collect = () => {
    const rows = {};
    editor.querySelectorAll('#editRows input').forEach(inp => {
      const i = inp.dataset.i, f = inp.dataset.f;
      rows[i] = rows[i] || { tipo: (_currentItinerary.agenda[i]?.tipo) || 'evento', detalhe: (_currentItinerary.agenda[i]?.detalhe)||'' };
      rows[i][f] = inp.value;
    });
    return Object.values(rows);
  };
  editor.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      _currentItinerary.agenda = collect().filter((_, idx) => idx !== parseInt(b.dataset.del));
      openEditor();
    }));
  document.getElementById('addRowBtn')?.addEventListener('click', () => {
    _currentItinerary.agenda = [...collect(), { hora:'12:00', atividade:'Nova atividade', detalhe:'', tipo:'turismo' }];
    openEditor();
  });
  document.getElementById('saveEditBtn')?.addEventListener('click', () => {
    _currentItinerary.agenda = collect();
    renderItineraryPreview(_currentItinerary);
    goTo('itinerary');
    toast('Alterações aplicadas!');
  });
}
 
// ── Persistência (localStorage) ───────────────────────────────────────────────
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(userKey(STORAGE_KEY)) || '[]'); } catch { return []; }
}
function saveItinerary(it) {
  const all = loadSaved();
  const rec = { ...it, savedAt: Date.now(), id: 'it' + Date.now() };
  all.unshift(rec);
  try { localStorage.setItem(userKey(STORAGE_KEY), JSON.stringify(all.slice(0, 30))); } catch {}
  renderSavedList();
  renderFinal();
}
 
export function renderSavedList() {
  const host = document.getElementById('agendaList');
  // Mostra lista de salvos somente quando NÃO há roteiro ativo em construção
  if (!host || _currentItinerary) return;
  const all = loadSaved();
  const lbl = document.getElementById('agendaCountLabel');
  if (lbl) lbl.textContent = all.length + ' salvos';
  if (!all.length) {
    host.innerHTML = '<p style="font-size:.85rem;color:var(--muted)">Nenhum roteiro salvo ainda. Selecione um evento e clique em "Criar roteiro".</p>';
    return;
  }
  host.innerHTML = all.map(it =>
    '<div class="saved-itin-card"><div><strong style="font-size:.88rem">'+(it.event?.title||'Roteiro')+'</strong>'
    + '<div style="font-size:.78rem;color:var(--muted)">📅 '+(it.event?.date||'')+' · 📍 '+(it.event?.city||'')+'</div></div>'
    + '<div style="display:flex;gap:.4rem"><button class="button button-secondary" data-open="'+it.id+'" style="padding:.35rem .7rem">Abrir</button>'
    + '<button class="button button-secondary" data-del="'+it.id+'" style="padding:.35rem .7rem">✕</button></div></div>'
  ).join('');
  host.querySelectorAll('[data-open]').forEach(b =>
    b.addEventListener('click', () => {
      const it = loadSaved().find(x => x.id === b.dataset.open);
      if (it) { _currentItinerary = it; renderItineraryPreview(it); }
    }));
  host.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      const all2 = loadSaved().filter(x => x.id !== b.dataset.del);
      localStorage.setItem(userKey(STORAGE_KEY), JSON.stringify(all2));
      if (_currentItinerary && _currentItinerary.id === b.dataset.del) _currentItinerary = null;
      renderSavedList(); renderFinal();
      toast('Roteiro excluído.');
    }));
}
 
export function initItineraryScreen() {
  // Se não há roteiro ativo, mostra os salvos
  if (!_currentItinerary) renderSavedList();
  const saveBtn = document.getElementById('savePreferencesButton');
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = '1';
    saveBtn.addEventListener('click', () => {
      if (_currentItinerary) { saveItinerary(_currentItinerary); toast('Roteiro salvo!'); }
      else toast('Nenhum roteiro ativo.');
    });
  }
}
 
export function renderFinal() {
  const host = document.getElementById('finalItinerary');
  if (!host) return;
  const all = loadSaved();
  if (!all.length) {
    host.innerHTML = '<p style="font-size:.85rem;color:var(--muted)">Nenhum roteiro salvo. Crie e salve um roteiro para vê-lo aqui de forma simplificada.</p>';
    return;
  }
  host.innerHTML = all.map(it =>
    '<div class="panel" style="padding:1rem;margin-bottom:.8rem">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem">'
    +   '<h3 style="margin:0 0 .3rem;font-size:1rem">'+(it.event?.title||'Roteiro')+'</h3>'
    +   '<button class="button button-secondary" data-delfinal="'+it.id+'" style="padding:.3rem .65rem">✕ Excluir</button>'
    + '</div>'
    + '<p style="font-size:.8rem;color:var(--muted);margin:0 0 .6rem">📅 '+(it.event?.date||'')+' · 📍 '+(it.event?.city||'')+' · 💰 '+(it.custo_medio||'')+'</p>'
    + '<div style="display:grid;gap:.3rem">'
    + (it.agenda||[]).map(a => '<div style="font-size:.84rem;display:flex;gap:.6rem"><span style="font-weight:700;min-width:48px">'+a.hora+'</span><span>'+a.atividade+'</span></div>').join('')
    + '</div></div>'
  ).join('');
 
  host.querySelectorAll('[data-delfinal]').forEach(b =>
    b.addEventListener('click', () => {
      const all2 = loadSaved().filter(x => x.id !== b.dataset.delfinal);
      localStorage.setItem(userKey(STORAGE_KEY), JSON.stringify(all2));
      if (_currentItinerary && _currentItinerary.id === b.dataset.delfinal) _currentItinerary = null;
      renderFinal(); renderSavedList();
      toast('Roteiro excluído.');
    }));
}
 
// ── Exportar PDF (jsPDF) ──────────────────────────────────────────────────────
function exportPDF(it) {
  const jspdf = window.jspdf;
  if (!jspdf || !jspdf.jsPDF) { toast('PDF indisponível.'); return; }
  const doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  const ev = it.event || {};
  let y = 50;
  doc.setFontSize(20); doc.setTextColor('#15803d');
  doc.text('Roteiro UrbanFlow', 40, y); y += 28;
  doc.setFontSize(13); doc.setTextColor('#1f2937');
  doc.text((ev.title || 'Evento'), 40, y); y += 18;
  doc.setFontSize(10); doc.setTextColor('#6b7280');
  doc.text('Data: ' + (ev.date||'-') + '   Local: ' + (ev.venue||ev.city||'-'), 40, y); y += 16;
  doc.text('Custo médio: ' + (it.custo_medio||'-'), 40, y); y += 24;
 
  doc.setFontSize(12); doc.setTextColor('#15803d'); doc.text('Agenda', 40, y); y += 18;
  doc.setFontSize(10); doc.setTextColor('#1f2937');
  (it.agenda||[]).forEach(a => {
    if (y > 760) { doc.addPage(); y = 50; }
    doc.text(a.hora + '  -  ' + a.atividade, 48, y); y += 14;
    if (a.detalhe) { doc.setTextColor('#6b7280'); doc.text('     ' + a.detalhe, 48, y); y += 13; doc.setTextColor('#1f2937'); }
  });
 
  if ((it.hotels||[]).length) {
    y += 10; doc.setFontSize(12); doc.setTextColor('#15803d'); doc.text('Hospedagem', 40, y); y += 16;
    doc.setFontSize(10); doc.setTextColor('#1f2937');
    it.hotels.forEach(h => { if (y>760){doc.addPage();y=50;} doc.text('• ' + h.nome, 48, y); y += 13; });
  }
  doc.save('roteiro-urbanflow.pdf');
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: MAPA (Leaflet + OSM)
// ═══════════════════════════════════════════════════════════════════════════════
 
export async function initMapScreen() {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas || typeof L === 'undefined') return;
  canvas.classList.add('leaflet-host');
 
  if (!_mapInstance) {
    _mapInstance = L.map(canvas).setView([20, -40], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(_mapInstance);
 
    // Ao mover/zoom: busca eventos na região visível (Ticketmaster por centro do mapa)
    let moveTimer = null;
    _mapInstance.on('moveend', () => {
      clearTimeout(moveTimer);
      moveTimer = setTimeout(loadMapEvents, 600);
    });
  } else {
    setTimeout(() => _mapInstance.invalidateSize(), 100);
  }
 
  await loadMapEvents();
 
  const panel = document.getElementById('poiDetails');
  if (panel) panel.innerHTML =
    '<div style="padding:1rem"><span class="eyebrow">Mapa interativo</span>'
    + '<h2 style="margin:.4rem 0 .5rem;font-size:1rem">Eventos por região</h2>'
    + '<p style="font-size:.85rem;color:var(--muted)">Arraste e use o zoom para explorar. Os marcadores mostram jogos da Copa e eventos da região. Clique em um marcador para detalhes.</p></div>';
}
 
async function loadMapEvents() {
  if (!_mapInstance) return;
  _mapMarkers.forEach(m => _mapInstance.removeLayer(m));
  _mapMarkers = [];
 
  const center = _mapInstance.getCenter();
 
  if (!CATALOG.length) {
    const cat = await getJSON('/api/v1/events/catalog');
    CATALOG = cat?.data || [];
  }
 
  // Achata: eventos simples + cada sessao (jogos da Copa, dias de festival) como pino proprio
  const flat = [];
  CATALOG.forEach(e => {
    const sess = e.sessions || [];
    if (sess.length) {
      sess.forEach(s => {
        if (s.lat != null && s.lng != null)
          flat.push({ id: s.id, parentId: e.id, cat: s.cat || e.cat,
            title: e.evento + ' \u2014 ' + s.label, city: s.city, venue: s.venue,
            date: s.date, time: s.time, lat: s.lat, lng: s.lng });
      });
      if (e.lat != null && e.lng != null)
        flat.push({ id: e.id, cat: e.cat, title: e.title || e.evento,
          city: e.city, venue: e.venue, date: e.date, time: e.time,
          lat: e.lat, lng: e.lng, hasSessions: true });
    } else if (e.lat != null && e.lng != null) {
      flat.push({ id: e.id, cat: e.cat, title: e.title || e.evento,
        city: e.city, venue: e.venue, date: e.date, time: e.time, lat: e.lat, lng: e.lng });
    }
  });
 
  const tm = await getJSON('/api/v1/events/ticketmaster?lat=' + center.lat.toFixed(3) + '&lng=' + center.lng.toFixed(3));
  (tm?.data || []).forEach(e => { if (e.lat && e.lng) flat.push(e); });
 
  const iconFor = (cat) => {
    const c = catColor(cat || 'Evento');
    return L.divIcon({ className: '', iconSize: [18,18], iconAnchor: [9,9],
      html: '<div style="width:16px;height:16px;border-radius:50%;background:'+c+';border:2px solid #fff;box-shadow:0 0 0 2px '+c+'66"></div>' });
  };
 
  flat.forEach(e => {
    const m = L.marker([e.lat, e.lng], { icon: iconFor(e.cat) }).addTo(_mapInstance);
    const btnLabel = e.hasSessions ? 'Ver atracoes' : 'Criar roteiro';
    m.bindPopup(
      '<div style="min-width:190px"><strong>'+(e.title||e.evento)+'</strong><br>'
      + '<span style="font-size:.8rem">\ud83d\udccd '+(e.city||'')+'</span><br>'
      + (e.venue?'<span style="font-size:.8rem">\ud83c\udfdf '+e.venue+'</span><br>':'')
      + (e.date?'<span style="font-size:.8rem">\ud83d\udcc5 '+e.date+(e.time?' '+e.time:'')+'</span><br>':'')
      + '<button onclick="window.__acesMapClick(\''+(e.parentId||e.id)+'\',\''+e.id+'\','+(e.hasSessions?'true':'false')+')" style="margin-top:6px;padding:5px 12px;border:none;border-radius:6px;background:#15803d;color:#fff;cursor:pointer;font-size:.8rem;font-weight:700">'+btnLabel+'</button>'
      + '</div>'
    );
    _mapMarkers.push(m);
  });
 
  window.__acesMapClick = async (parentId, id, hasSessions) => {
    if (hasSessions) {
      const ev = CATALOG.find(x => x.id === parentId);
      if (ev) { goTo('home'); openSessionPicker(ev); }
      return;
    }
    const full = await getJSON('/api/v1/events/find?id=' + encodeURIComponent(id));
    if (full && !full.error) { createItinerary(full); return; }
    const live = flat.find(x => x.id === id);
    if (live) createItinerary(live);
  };
 
  const lbl = document.getElementById('mapEventLabel');
  if (lbl) lbl.textContent = flat.length + ' eventos no mapa';
 
  if (flat.length && !_mapCentered) {
    _mapCentered = true;
    try {
      const grp = L.featureGroup(_mapMarkers);
      _mapInstance.fitBounds(grp.getBounds().pad(0.2));
    } catch {}
  }
}
let _mapCentered = false;
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: ROTAS (autocomplete livre + Google Directions)
// ═══════════════════════════════════════════════════════════════════════════════
 
let _routeOrigin = null, _routeDest = null;
 
export function initRoutesScreen() {
  const oi = document.getElementById('routeOriginInput');
  if (oi && !oi.value && _userCoords) oi.value = 'Minha localização (GPS)';
 
  // Guarda as coordenadas escolhidas no autocomplete (mais preciso que geocodar texto)
  attachAutocomplete('routeOriginInput', 'routeOriginAC', 'geocode', (it) => {
    _routeOrigin = (it.lat != null && it.lng != null) ? (it.lat + ',' + it.lng) : it.label;
  });
  attachAutocomplete('routeDestinationInput', 'routeDestinationAC', 'geocode', (it) => {
    _routeDest = (it.lat != null && it.lng != null) ? (it.lat + ',' + it.lng) : it.label;
  });
 
  // Origem: ao focar, se for o texto GPS, seleciona tudo para facilitar troca
  if (oi && !oi.dataset.bound) {
    oi.dataset.bound = '1';
    oi.addEventListener('focus', () => { if (/minha localiza/i.test(oi.value)) oi.select(); });
    oi.addEventListener('input', () => { _routeOrigin = null; }); // texto manual → será geocodado
  }
 
  // Pré-preenche destino se veio de um evento
  if (_selectedEvent) {
    const di = document.getElementById('routeDestinationInput');
    if (di && !di.value) {
      if (_selectedEvent.lat != null && _selectedEvent.lng != null) {
        di.value = (_selectedEvent.venue || _selectedEvent.city || 'Destino');
        _routeDest = _selectedEvent.lat + ',' + _selectedEvent.lng;
      } else {
        di.value = (_selectedEvent.venue ? _selectedEvent.venue + ', ' : '') + (_selectedEvent.city || '');
        _routeDest = di.value;
      }
    }
  }
 
  const form = document.getElementById('routeForm');
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';
    form.addEventListener('submit', async (e) => { e.preventDefault(); await generateRoute(); });
  }
}
 
async function generateRoute() {
  const oiVal = (document.getElementById('routeOriginInput')?.value || '').trim();
  const diVal = (document.getElementById('routeDestinationInput')?.value || '').trim();
  const mode  = document.getElementById('routeModeSelect')?.value || 'transit';
  const out   = document.getElementById('routeResult');
  if (!out) return;
 
  let origin = _routeOrigin || oiVal;
  if ((/minha localiza/i.test(origin) || !origin) && _userCoords)
    origin = _userCoords.latitude + ',' + _userCoords.longitude;
  const dest = _routeDest || diVal;
 
  if (!dest) { out.innerHTML = errBox('Informe um destino.'); return; }
  out.innerHTML = skeleton();
 
  const params = new URLSearchParams({ origin, destination: dest, mode });
  const route = await getJSON('/api/v1/maps/route?' + params.toString());
 
  if (route && route.ok) {
    const steps = (route.steps||[]).slice(0,7).map((s,i) =>
      '<div style="display:flex;gap:.6rem;padding:.45rem 0;border-bottom:1px solid #eee">'
      + '<span style="flex:0 0 22px;height:22px;border-radius:50%;background:#15803d;color:#fff;font-size:.72rem;font-weight:800;display:grid;place-items:center">'+(i+1)+'</span>'
      + '<div><p style="font-size:.82rem;margin:0">'+s.instrucao+'</p><span style="font-size:.74rem;color:var(--muted)">'+s.distancia+'</span></div></div>'
    ).join('');
    out.innerHTML =
      '<div style="display:grid;gap:.6rem;margin-top:.75rem">'
      + '<div class="panel" style="padding:.9rem"><span style="font-size:.7rem;font-weight:700;color:#15803d">Rota — OpenStreetMap</span>'
      + '<h3 style="margin:.3rem 0;font-size:1rem">'+route.origin_address.split(',')[0]+' → '+route.destination_address.split(',')[0]+'</h3>'
      + '<div style="display:flex;gap:1rem;flex-wrap:wrap"><span style="font-size:.86rem">⏱ <strong>'+route.duration+'</strong></span><span style="font-size:.86rem">📏 <strong>'+route.distance+'</strong></span></div></div>'
      + '<div id="routeMiniMap" style="height:280px;border-radius:12px;overflow:hidden;border:1px solid var(--line)"></div>'
      + (steps?'<div class="panel" style="padding:.9rem"><strong style="font-size:.82rem">Passo a passo</strong>'+steps+'</div>':'')
      + '</div>';
    drawRouteMap(route);
    return;
  }
 
  // Fallback IA (estimativa) quando o roteamento falha
  const est = await askAIJSON('Estime a rota de "'+origin+'" até "'+dest+'" de '+mode+'. JSON: {"tempo":"X","distancia":"~Y km","dica":"..."}');
  out.innerHTML = est
    ? '<div class="panel" style="padding:.9rem;margin-top:.75rem"><span style="font-size:.7rem;color:var(--muted)">Estimativa</span><h3 style="margin:.3rem 0">'+origin+' → '+dest+'</h3><p style="font-size:.86rem">⏱ '+est.tempo+' · 📏 '+est.distancia+'</p><p style="font-size:.84rem;color:var(--muted)">'+(est.dica||'')+'</p></div>'
    : errBox('Não foi possível gerar a rota. Tente endereços mais específicos.');
}
 
let _routeMap = null;
function drawRouteMap(route) {
  const host = document.getElementById('routeMiniMap');
  if (!host || typeof L === 'undefined') return;
  if (_routeMap) { _routeMap.remove(); _routeMap = null; }
  _routeMap = L.map(host);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(_routeMap);
  const geo = route.geometry || [];
  const s = route.start_location, e = route.end_location;
  if (geo.length) {
    const line = L.polyline(geo, { color: '#1a73e8', weight: 5 }).addTo(_routeMap);
    _routeMap.fitBounds(line.getBounds(), { padding: [30, 30] });
  } else if (s && e) {
    _routeMap.setView([s.lat, s.lng], 12);
  }
  if (s) L.marker([s.lat, s.lng]).addTo(_routeMap).bindPopup('Origem');
  if (e) L.marker([e.lat, e.lng]).addTo(_routeMap).bindPopup('Destino');
  setTimeout(() => _routeMap.invalidateSize(), 120);
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: RECOMENDAÇÕES (Copa + grandes shows do Ticketmaster)
// ═══════════════════════════════════════════════════════════════════════════════
 
export async function initRecommendationsScreen() {
  const strip = document.getElementById('contextStrip');
  const list  = document.getElementById('recommendationList');
  if (!list) return;
  if (strip) strip.innerHTML =
    '<span class="context-pill" style="padding:.35rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700">⚽ Copa 2026</span> '
    + '<span class="context-pill" style="padding:.35rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700">🎵 Grandes shows</span> '
    + '<span class="context-pill" style="padding:.35rem .8rem;border-radius:999px;font-size:.8rem;font-weight:700">🌎 Eventos por vir</span>';
  list.innerHTML = skeleton(true);
 
  // Endpoint robusto: combina Copa + shows + esportes, com fallback no servidor
  const near = _userCoords ? ('?lat='+_userCoords.latitude.toFixed(3)+'&lng='+_userCoords.longitude.toFixed(3)) : '';
  const res = await getJSON('/api/v1/recommendations' + near);
  const recs = res?.data || [];
  if (!recs.length) {
    list.innerHTML = errBox('Sem recomendações no momento. Tente novamente em instantes.');
    return;
  }
 
  list.innerHTML = recs.map(e => {
    const col = catColor(e.cat);
    const isWC = e.cat === 'Futebol';
    const nSessions = (e.sessions || []).length;
    const recBtnLabel = nSessions ? ('Ver ' + nSessions + ' atrações') : 'Criar roteiro';
    return '<div class="card recommendation-card" style="display:flex;flex-direction:column;gap:.5rem;border-left:3px solid '+col+'">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'+badge(isWC?'⚽ Copa do Mundo':'🎵 '+(e.cat||'Evento'), col)+'</div>'
      + '<h3 style="font-size:.96rem;margin:0;line-height:1.3">'+(e.title||e.evento)+'</h3>'
      + '<p style="font-size:.82rem;color:var(--muted);margin:0">📍 '+(e.city||'')+(e.country?', '+e.country:'')+'</p>'
      + (e.date?'<p style="font-size:.82rem;margin:0">📅 '+e.date+(e.time?' · '+e.time:'')+'</p>':'')
      + '<button class="button button-primary" style="width:100%;margin-top:auto" data-recid="'+e.id+'">'+recBtnLabel+'</button>'
      + '</div>';
  }).join('');
 
  list.querySelectorAll('[data-recid]').forEach(b =>
    b.addEventListener('click', () => {
      const ev = recs.find(x => x.id === b.dataset.recid);
      if (!ev) return;
      if ((ev.sessions || []).length) { goTo('home'); openSessionPicker(ev); }
      else createItinerary(ev);
    }));
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// Utilidades de navegação/toast (compartilhadas com main.js)
// ═══════════════════════════════════════════════════════════════════════════════
 
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
  document.getElementById('screen-' + screenId)?.classList.add('is-active');
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('is-active', l.dataset.screenTarget === screenId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
 
function toast(msg) {
  const region = document.getElementById('toastRegion');
  if (!region) { console.log('[toast]', msg); return; }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  el.style.cssText = 'background:#15803d;color:#fff;padding:.7rem 1.1rem;border-radius:10px;margin-top:.5rem;box-shadow:0 6px 20px rgba(0,0,0,.2);font-size:.86rem';
  region.appendChild(el);
  setTimeout(() => el.remove(), 3000);
 }
