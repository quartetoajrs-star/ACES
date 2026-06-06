import { EventsManager } from './events.js';
import { AppState } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema ACES-UrbanFlow carregado com sucesso!");

    setupNavigation();
    setupMenuToggle();
    setupConsentModal();
    initializeApp();
});

/** Delegação de eventos: captura qualquer clique em [data-screen-target] na página inteira */
function setupNavigation() {
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('[data-screen-target]');
        if (!target) return;

        const screenId = target.dataset.screenTarget;
        navigateTo(screenId);

        // Fecha o menu mobile após navegar
        const nav = document.getElementById('primaryNav');
        if (nav) nav.classList.remove('is-open');
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    });
}

/** Ativa a tela correta e atualiza o estado da nav */
function navigateTo(screenId) {
    // Esconde todas as telas
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));

    // Mostra a tela de destino
    const target = document.getElementById(`screen-${screenId}`);
    if (target) target.classList.add('is-active');

    // Atualiza o link ativo na sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('is-active', link.dataset.screenTarget === screenId);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Abre/fecha o menu hambúrguer no mobile */
function setupMenuToggle() {
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('primaryNav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
    });
}

/** Controla o modal de consentimento de localização */
function setupConsentModal() {
    const modal = document.getElementById('consentModal');
    const acceptBtn = document.getElementById('acceptConsentButton');
    const declineBtn = document.getElementById('declineConsentButton');

    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            modal.classList.remove('is-visible');
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        console.log('Localização obtida:', pos.coords);
                        AppState.update('userLocation', pos.coords);
                    },
                    err => console.warn('Localização negada:', err)
                );
            }
        });
    }

    if (declineBtn) {
        declineBtn.addEventListener('click', () => {
            modal.classList.remove('is-visible');
        });
    }
}

/** Carrega o estado inicial da aplicação */
function initializeApp() {
    const defaultCity = 'Rio de Janeiro';
    AppState.update('currentCity', defaultCity);
    // EventsManager.loadRegionalEvents(defaultCity); // Descomentar após configurar as API keys no Render
}
