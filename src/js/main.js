import { AppState } from './state.js';
import * as Auth from './auth.js';
 
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
  Auth.ensureSeedUser();        // garante usuário teste/teste
  setupNavigation();
  setupMenuToggle();
  setupConsentModal();
  setupAuth();
  loadAI();
  requestInitialLocation();
  refreshAccountUI();
  // Popula o hero da tela inicial (já visível)
  loadAI().then(ai => ai?.initWelcomeScreen?.());
});
 
function requestInitialLocation() {
  if (!navigator.geolocation) return;
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
    if (screenId === 'routes')    ai.initRoutesScreen?.();
    if (screenId === 'itinerary') ai.initItineraryScreen?.();
    if (screenId === 'final')     ai.renderFinal?.();
    if (screenId === 'map')       ai.initMapScreen?.();
    if (screenId === 'welcome')   ai.initWelcomeScreen?.();
    if (screenId === 'ratings')   ai.initRatingsScreen?.();
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
      async pos => { AppState.update('userLocation', pos.coords);
        const ai = await loadAI(); ai?.setUserCoords?.(pos.coords); },
      err => console.warn('Localização negada:', err));
  });
  decline?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
 
// ── Autenticação ──────────────────────────────────────────────────────────────
function setupAuth() {
  const modal = document.getElementById('authModal');
  const accountBtn = document.getElementById('accountButton');
  const tabLogin = document.getElementById('authTabLogin');
  const tabSignup = document.getElementById('authTabSignup');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
 
  const openModal = () => { modal?.classList.add('is-visible'); showTab('login'); };
  const closeModal = () => modal?.classList.remove('is-visible');
 
  const showTab = (which) => {
    if (loginForm) loginForm.style.display = which === 'login' ? 'block' : 'none';
    if (signupForm) signupForm.style.display = which === 'signup' ? 'block' : 'none';
    tabLogin?.classList.toggle('button-primary', which === 'login');
    tabLogin?.classList.toggle('button-secondary', which !== 'login');
    tabSignup?.classList.toggle('button-primary', which === 'signup');
    tabSignup?.classList.toggle('button-secondary', which !== 'signup');
  };
 
  // Botão de conta: abre modal (deslogado) ou faz logout (logado)
  accountBtn?.addEventListener('click', () => {
    if (Auth.currentUser()) {
      if (confirm('Sair da conta "' + Auth.currentUser() + '"?')) {
        Auth.logout(); refreshAccountUI(); reloadUserData(); openModal();
      }
    } else openModal();
  });
 
  tabLogin?.addEventListener('click', () => showTab('login'));
  tabSignup?.addEventListener('click', () => showTab('signup'));
  modal?.addEventListener('click', (e) => { if (e.target === modal && Auth.currentUser()) closeModal(); });
 
  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = Auth.login(document.getElementById('loginEmail').value,
                         document.getElementById('loginPass').value);
    const msg = document.getElementById('loginMsg');
    if (r.ok) { closeModal(); refreshAccountUI(); reloadUserData(); }
    else if (msg) msg.textContent = r.error;
  });
 
  signupForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = Auth.signup(document.getElementById('signupEmail').value,
                          document.getElementById('signupPass').value,
                          document.getElementById('signupConfirm').value);
    const msg = document.getElementById('signupMsg');
    if (r.ok) { closeModal(); refreshAccountUI(); reloadUserData(); }
    else if (msg) msg.textContent = r.error;
  });
 
  // Exige login na primeira visita
  if (!Auth.currentUser()) openModal();
}
 
function refreshAccountUI() {
  const label = document.getElementById('headerEventLabel');
  const user = Auth.currentUser();
  if (label) label.textContent = user ? ('Conectado: ' + user) : 'Evento não selecionado';
}
 
async function reloadUserData() {
  // Recarrega telas que dependem do usuário (dados separados)
  initialized.delete('home');
  initialized.delete('recommendations');
  const ai = await loadAI();
  ai?.renderFinal?.();
  ai?.renderSavedList?.();
}
