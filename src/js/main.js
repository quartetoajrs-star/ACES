import { initEventsScreen, initMapScreen, initRoutesScreen, initRecommendationsScreen, setUserCoords } from './ai-features.js';
import { AppState } from './state.js';
 
// Rastreia quais screens já foram inicializadas (evita chamadas duplas à IA)
const initialized = new Set();
 
document.addEventListener('DOMContentLoaded', () => {
    console.log("ACES-UrbanFlow carregado.");
    setupNavigation();
    setupMenuToggle();
    setupConsentModal();
    // Tela inicial já visível — inicializa no carregamento
    // (a tela welcome não precisa de IA)
});
 
/** Delegação global: captura qualquer clique em [data-screen-target] */
function setupNavigation() {
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-screen-target]');
        if (!btn) return;
 
        const screenId = btn.dataset.screenTarget;
        navigateTo(screenId);
 
        // Fecha o menu mobile
        const nav = document.getElementById('primaryNav');
        if (nav) nav.classList.remove('is-open');
        const toggle = document.getElementById('menuToggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
}
 
/** Troca de tela e inicializa o módulo de IA correspondente */
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
 
    const target = document.getElementById(`screen-${screenId}`);
    if (target) target.classList.add('is-active');
 
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('is-active', link.dataset.screenTarget === screenId);
    });
 
    window.scrollTo({ top: 0, behavior: 'smooth' });
 
    // Rotas: idempotente e leve — roda sempre para pré-preencher o destino
    if (screenId === 'routes') initRoutesScreen();

    // Telas com chamadas de IA: inicializa uma única vez
    if (!initialized.has(screenId)) {
        initialized.add(screenId);
        switch (screenId) {
            case 'home':             initEventsScreen();               break;
            case 'map':              initMapScreen();                  break;
            case 'recommendations':  initRecommendationsScreen();      break;
        }
    }
}
 
function setupMenuToggle() {
    const toggle = document.getElementById('menuToggle');
    const nav    = document.getElementById('primaryNav');
    if (!toggle || !nav) return;
 
    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
    });
}
 
function setupConsentModal() {
    const modal      = document.getElementById('consentModal');
    const acceptBtn  = document.getElementById('acceptConsentButton');
    const declineBtn = document.getElementById('declineConsentButton');
 
    acceptBtn?.addEventListener('click', () => {
        modal.classList.remove('is-visible');
        navigator.geolocation?.getCurrentPosition(
            pos  => { AppState.update('userLocation', pos.coords); setUserCoords(pos.coords); },
            err  => console.warn('Localização negada:', err)
        );
    });
 
    declineBtn?.addEventListener('click', () => modal.classList.remove('is-visible'));
}
