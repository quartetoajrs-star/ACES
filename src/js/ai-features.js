let WC_EVENTS = [];        // jogos da Copa (cache)
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
  const keyword = (document.getElementById('eventSearchInput')?.value || '').trim();
 
  // Busca Copa (cache) + Ticketmaster filtrado
  if (!WC_EVENTS.length) {
    const wc = await getJSON('/api/v1/events/worldcup');
    WC_EVENTS = wc?.data || [];
  }
  const params = new URLSearchParams();
  if (city) params.set('city', city);
  if (keyword) params.set('keyword', keyword);
  const tm = await getJSON('/api/v1/events/ticketmaster?' + params.toString());
  const tmEvents = tm?.data || [];
 
  // Filtra Copa por cidade/keyword se informado
  let wcFiltered = WC_EVENTS;
  if (city) wcFiltered = wcFiltered.filter(e => (e.city||'').toLowerCase().includes(city.toLowerCase()));
  if (keyword) wcFiltered = wcFiltered.filter(e =>
    [e.home, e.away, e.title].some(v => (v||'').toLowerCase().includes(keyword.toLowerCase())));
 
  LAST_EVENTS = [...wcFiltered, ...tmEvents];
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
  list.innerHTML = events.slice(0, 30).map(e => {
    const col = catColor(e.cat);
    return '<div class="card event-card" style="display:flex;flex-direction:column;gap:.5rem">'
      + '<div style="display:flex;justify-content:space-between;align-items:center">'
      +   badge(e.cat || 'Evento', col)
      +   (e.phase ? '<span style="font-size:.72rem;color:var(--muted)">'+e.phase+'</span>' : '')
      + '</div>'
      + '<h3 style="font-size:1rem;margin:0;line-height:1.3">'+(e.title || e.evento)+'</h3>'
      + '<div style="font-size:.82rem;color:var(--muted);line-height:1.7">'
      +   '<div>📍 '+(e.city||'')+(e.country?', '+e.country:'')+'</div>'
      +   (e.venue ? '<div>🏟 '+e.venue+'</div>' : '')
      +   (e.date ? '<div>📅 '+e.date+(e.time?' · '+e.time:'')+'</div>' : '')
      + '</div>'
      + '<button class="button button-primary" style="width:100%;margin-top:auto" data-evid="'+e.id+'">Criar roteiro</button>'
      + '</div>';
  }).join('');
 
  list.querySelectorAll('[data-evid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = events.find(x => x.id === btn.dataset.evid);
      if (ev) createItinerary(ev);
    });
  });
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
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveItinerary(it) {
  const all = loadSaved();
  const rec = { ...it, savedAt: Date.now(), id: 'it' + Date.now() };
  all.unshift(rec);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 30))); } catch {}
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all2));
      renderSavedList(); renderFinal();
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
    + '<h3 style="margin:0 0 .3rem;font-size:1rem">'+(it.event?.title||'Roteiro')+'</h3>'
    + '<p style="font-size:.8rem;color:var(--muted);margin:0 0 .6rem">📅 '+(it.event?.date||'')+' · 📍 '+(it.event?.city||'')+' · 💰 '+(it.custo_medio||'')+'</p>'
    + '<div style="display:grid;gap:.3rem">'
    + (it.agenda||[]).map(a => '<div style="font-size:.84rem;display:flex;gap:.6rem"><span style="font-weight:700;min-width:48px">'+a.hora+'</span><span>'+a.atividade+'</span></div>').join('')
    + '</div></div>'
  ).join('');
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
  // Limpa marcadores
  _mapMarkers.forEach(m => _mapInstance.removeLayer(m));
  _mapMarkers = [];
 
  const center = _mapInstance.getCenter();
 
  // Copa (cache) — sempre mostra os que têm coordenadas
  if (!WC_EVENTS.length) {
    const wc = await getJSON('/api/v1/events/worldcup');
    WC_EVENTS = wc?.data || [];
  }
  // Ticketmaster na região central do mapa
  const tm = await getJSON('/api/v1/events/ticketmaster?lat=' + center.lat.toFixed(3) + '&lng=' + center.lng.toFixed(3));
  const all = [...WC_EVENTS, ...((tm?.data) || [])].filter(e => e.lat && e.lng);
 
  const greenIcon = L.divIcon({ className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:#15803d;border:2px solid #fff;box-shadow:0 0 0 2px #15803d55"></div>' });
  const blueIcon  = L.divIcon({ className: '', html: '<div style="width:14px;height:14px;border-radius:50%;background:#0369a1;border:2px solid #fff;box-shadow:0 0 0 2px #0369a155"></div>' });
 
  all.forEach(e => {
    const icon = e.cat === 'Futebol' ? greenIcon : blueIcon;
    const m = L.marker([e.lat, e.lng], { icon }).addTo(_mapInstance);
    m.bindPopup(
      '<div style="min-width:180px"><strong>'+(e.title||e.evento)+'</strong><br>'
      + '<span style="font-size:.8rem">📍 '+(e.city||'')+'</span><br>'
      + (e.venue?'<span style="font-size:.8rem">🏟 '+e.venue+'</span><br>':'')
      + (e.date?'<span style="font-size:.8rem">📅 '+e.date+(e.time?' '+e.time:'')+'</span><br>':'')
      + '<button onclick="window.__acesCreateItin(\''+e.id+'\')" style="margin-top:6px;padding:4px 10px;border:none;border-radius:6px;background:#15803d;color:#fff;cursor:pointer;font-size:.8rem">Criar roteiro</button>'
      + '</div>'
    );
    _mapMarkers.push(m);
  });
 
  // Expõe handler global para o botão do popup
  window.__acesCreateItin = (id) => {
    const ev = all.find(x => x.id === id);
    if (ev) createItinerary(ev);
  };
 
  const lbl = document.getElementById('mapEventLabel');
  if (lbl) lbl.textContent = all.length + ' eventos no mapa';
}
 
// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN: ROTAS (autocomplete livre + Google Directions)
// ═══════════════════════════════════════════════════════════════════════════════
 
let _routeOrigin = null, _routeDest = null;
 
export function initRoutesScreen() {
  const oi = document.getElementById('routeOriginInput');
  if (oi && !oi.value && _userCoords) oi.value = 'Minha localização (GPS)';
 
  attachAutocomplete('routeOriginInput', 'routeOriginAC', 'geocode', (it) => { _routeOrigin = it.label; });
  attachAutocomplete('routeDestinationInput', 'routeDestinationAC', 'geocode', (it) => { _routeDest = it.label; });
 
  // Pré-preenche destino se veio de um evento
  if (_selectedEvent) {
    const di = document.getElementById('routeDestinationInput');
    if (di && !di.value) {
      di.value = (_selectedEvent.venue ? _selectedEvent.venue + ', ' : '') + (_selectedEvent.city || '');
      _routeDest = di.value;
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
    const mapImg = route.static_map
      ? '<img src="'+route.static_map+'" alt="Rota" style="width:100%;border-radius:12px;border:1px solid var(--line);display:block" loading="lazy"/>' : '';
    const steps = (route.steps||[]).slice(0,7).map((s,i) =>
      '<div style="display:flex;gap:.6rem;padding:.45rem 0;border-bottom:1px solid #eee">'
      + '<span style="flex:0 0 22px;height:22px;border-radius:50%;background:#15803d;color:#fff;font-size:.72rem;font-weight:800;display:grid;place-items:center">'+(i+1)+'</span>'
      + '<div><p style="font-size:.82rem;margin:0">'+s.instrucao+'</p><span style="font-size:.74rem;color:var(--muted)">'+s.distancia+(s.duracao?' · '+s.duracao:'')+'</span></div></div>'
    ).join('');
    out.innerHTML =
      '<div style="display:grid;gap:.6rem;margin-top:.75rem"><div class="panel" style="padding:0;overflow:hidden">'+mapImg
      + '<div style="padding:.9rem"><span style="font-size:.7rem;font-weight:700;color:#15803d">Rota — Google Maps</span>'
      + '<h3 style="margin:.3rem 0;font-size:1rem">'+route.origin_address+' → '+route.destination_address+'</h3>'
      + '<div style="display:flex;gap:1rem;flex-wrap:wrap"><span style="font-size:.86rem">⏱ <strong>'+route.duration+'</strong></span><span style="font-size:.86rem">📏 <strong>'+route.distance+'</strong></span></div></div></div>'
      + (steps?'<div class="panel" style="padding:.9rem"><strong style="font-size:.82rem">Passo a passo</strong>'+steps+'</div>':'')
      + '</div>';
    return;
  }
 
  // Fallback IA (estimativa) quando o Google falha
  const est = await askAIJSON('Estime a rota de "'+origin+'" até "'+dest+'" de '+mode+'. JSON: {"tempo":"X","distancia":"~Y km","dica":"..."}');
  out.innerHTML = est
    ? '<div class="panel" style="padding:.9rem;margin-top:.75rem"><span style="font-size:.7rem;color:var(--muted)">Estimativa</span><h3 style="margin:.3rem 0">'+origin+' → '+dest+'</h3><p style="font-size:.86rem">⏱ '+est.tempo+' · 📏 '+est.distancia+'</p><p style="font-size:.84rem;color:var(--muted)">'+(est.dica||'')+'</p></div>'
    : errBox('Não foi possível gerar a rota. Verifique a chave do Google Maps.');
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
 
  // Copa: 3 jogos de destaque
  if (!WC_EVENTS.length) {
    const wc = await getJSON('/api/v1/events/worldcup');
    WC_EVENTS = wc?.data || [];
  }
  const destaque = WC_EVENTS.slice(0, 3);
 
  // Ticketmaster: grandes shows de música (próximos)
  const near = _userCoords ? ('&lat='+_userCoords.latitude.toFixed(3)+'&lng='+_userCoords.longitude.toFixed(3)) : '';
  const music = await getJSON('/api/v1/events/ticketmaster?classification=Music&keyword=' + near);
  const shows = (music?.data || []).slice(0, 6);
 
  const recs = [...destaque, ...shows];
  if (!recs.length) { list.innerHTML = errBox('Falha ao carregar recomendações.'); return; }
 
  list.innerHTML = recs.map(e => {
    const col = catColor(e.cat);
    const isWC = e.cat === 'Futebol';
    return '<div class="card recommendation-card" style="display:flex;flex-direction:column;gap:.5rem;border-left:3px solid '+col+'">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start">'+badge(isWC?'⚽ Copa do Mundo':'🎵 '+(e.cat||'Evento'), col)+'</div>'
      + '<h3 style="font-size:.96rem;margin:0;line-height:1.3">'+(e.title||e.evento)+'</h3>'
      + '<p style="font-size:.82rem;color:var(--muted);margin:0">📍 '+(e.city||'')+(e.country?', '+e.country:'')+'</p>'
      + (e.date?'<p style="font-size:.82rem;margin:0">📅 '+e.date+(e.time?' · '+e.time:'')+'</p>':'')
      + '<button class="button button-primary" style="width:100%;margin-top:auto" data-recid="'+e.id+'">Criar roteiro</button>'
      + '</div>';
  }).join('');
 
  list.querySelectorAll('[data-recid]').forEach(b =>
    b.addEventListener('click', () => {
      const ev = recs.find(x => x.id === b.dataset.recid);
      if (ev) createItinerary(ev);
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
