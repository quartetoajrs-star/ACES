import { AppState } from './state.js';
 
const initialized = new Set();
let AI = null;            // módulo ai-features carregado sob demanda
let aiLoadFailed = false;
 
// Carrega o módulo de IA apenas quando necessário, sem derrubar a navegação
async function loadAI() {
    if (AI || aiLoadFailed) return AI;
    try {
        AI = await import('./ai-features.js');
    } catch (e) {
        aiLoadFailed = true;
        console.error('[ACES] Falha ao carregar ai-features.js — navegação continua ativa.', e);
    }
    return AI;
}
 
document.addEventListener('DOMContentLoaded', () => {
    console.log("ACES-UrbanFlow carregado.");
    setupNavigation();
    setupMenuToggle();
    setupConsentModal();
    // Pré-carrega o módulo de IA em segundo plano (sem bloquear)
    loadAI();
});
 
/** Delegação global: captura qualquer clique em [data-screen-target] */
function setupNavigation() {
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-screen-target]');
        if (!btn) return;
        e.preventDefault();
        navigateTo(btn.dataset.screenTarget);
 
        const nav = document.getElementById('primaryNav');
        if (nav) nav.classList.remove('is-open');
        const toggle = document.getElementById('menuToggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
}
 
/** Troca de tela (sempre funciona) e tenta inicializar o módulo de IA */
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
    const target = document.getElementById(`screen-${screenId}`);
    if (target) target.classList.add('is-active');
 
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('is-active', link.dataset.screenTarget === screenId);
    });
 
    window.scrollTo({ top: 0, behavior: 'smooth' });
 
    // A parte de IA roda separada — se falhar, a tela já trocou de qualquer forma
    initScreenAI(screenId);
}
 
async function initScreenAI(screenId) {
    const ai = await loadAI();
    if (!ai) return; // módulo indisponível: tela funciona, só sem conteúdo de IA
 
    try {
        if (screenId === 'routes') { ai.initRoutesScreen?.(); }
 
        if (!initialized.has(screenId)) {
            initialized.add(screenId);
            switch (screenId) {
                case 'home':            ai.initEventsScreen?.();          break;
                case 'map':             ai.initMapScreen?.();             break;
                case 'recommendations': ai.initRecommendationsScreen?.(); break;
            }
        }
    } catch (e) {
        console.error('[ACES] Erro ao iniciar tela "' + screenId + '":', e);
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
    if (!modal) return;
 
    const close = () => modal.classList.remove('is-visible');
 
    acceptBtn?.addEventListener('click', async () => {
        close();
        navigator.geolocation?.getCurrentPosition(
            async pos => {
                AppState.update('userLocation', pos.coords);
                const ai = await loadAI();
                ai?.setUserCoords?.(pos.coords);
            },
            err => console.warn('Localização negada:', err)
        );
    });
 
    declineBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
