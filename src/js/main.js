import { AppState } from './state.js';
 
const initialized = new Set();
let AI = null;
let aiLoadFailed = false;
 
async function loadAI() {
  if (AI || aiLoadFailed) return AI;
  try { AI = await import('./ai-features.js'); }
  catch (e) { aiLoadFailed = true; console.error('[ACES] ai-features falhou — navegação ativa.', e); }
  return AI;
}
 
document.addEventListener('DOMContentLoaded', () => {
  console.log('ACES-UrbanFlow carregado.');
  setupNavigation();
  setupMenuToggle();
  setupConsentModal();
  loadAI();
  // Registra localização inicial do usuário (métricas), se já permitida
  requestInitialLocation();
});
 
function requestInitialLocation() {
  if (!navigator.geolocation) return;
  // Só pede silenciosamente se a permissão já foi concedida antes
  navigator.permissions?.query?.({ name: 'geolocation' }).then(p => {
    if (p.state === 'granted') {
      navigator.geolocation.getCurrentPosition(async pos => {
        AppState.update('userLocation', pos.coords);
        const ai = await loadAI(); ai?.setUserCoords?.(pos.coords);
      });
    }
  }).catch(() => {});
}
 
function setupNavigation() {
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-screen-target]');
    if (!btn) return;
    e.preventDefault();
    navigateTo(btn.dataset.screenTarget);
    document.getElementById('primaryNav')?.classList.remove('is-open');
    document.getElementById('menuToggle')?.setAttribute('aria-expanded', 'false');
  });
}
 
function navigateTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
  document.getElementById('screen-' + screenId)?.classList.add('is-active');
  document.querySelectorAll('.nav-link').forEach(link =>
    link.classList.toggle('is-active', link.dataset.screenTarget === screenId));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  initScreenAI(screenId);
}
 
async function initScreenAI(screenId) {
  const ai = await loadAI();
  if (!ai) return;
  try {
    // Telas que devem reagir sempre (não só na 1ª vez)
    if (screenId === 'routes')    { ai.initRoutesScreen?.(); }
    if (screenId === 'itinerary') { ai.initItineraryScreen?.(); }
    if (screenId === 'final')     { ai.renderFinal?.(); }
    if (screenId === 'map')       { ai.initMapScreen?.(); }
 
    if (!initialized.has(screenId)) {
      initialized.add(screenId);
      switch (screenId) {
        case 'home':            ai.initEventsScreen?.();          break;
        case 'recommendations': ai.initRecommendationsScreen?.(); break;
      }
    }
  } catch (e) { console.error('[ACES] Erro na tela "' + screenId + '":', e); }
}
 
function setupMenuToggle() {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('primaryNav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}
 
function setupConsentModal() {
  const modal = document.getElementById('consentModal');
  const accept = document.getElementById('acceptConsentButton');
  const decline = document.getElementById('declineConsentButton');
  if (!modal) return;
  const close = () => modal.classList.remove('is-visible');
 
  accept?.addEventListener('click', () => {
    close();
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        AppState.update('userLocation', pos.coords);
        const ai = await loadAI(); ai?.setUserCoords?.(pos.coords);
      },
      err => console.warn('Localização negada:', err)
    );
  });
  decline?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
 
