/**
 * main.js - Abordagem por Delegação de Eventos
 */

import { EventsManager } from './events.js';
import { AppState } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    // Delegação de Eventos: O Body escuta TUDO
    document.body.addEventListener('click', (event) => {
        
        // 1. Caso: Clique nos Botões do Modal
        if (event.target.matches('.modal-actions .button')) {
            const modal = document.getElementById('modalBackdrop');
            if (modal) modal.style.display = 'none';
            console.log("Modal fechado via delegação.");
            initializeApp();
        }

        // 2. Caso: Clique no botão "Analisar Risco" dentro dos cards
        if (event.target.matches('.event-card .button-primary')) {
            const eventName = event.target.closest('.event-card').querySelector('h3').textContent;
            console.log("A analisar risco para:", eventName);
            // Chama a função do EventsManager diretamente
            EventsManager.requestRiskAnalysis(eventName, AppState.get('currentCity'));
        }
    });
});

function initializeApp() {
    const defaultCity = 'Rio de Janeiro';
    AppState.update('currentCity', defaultCity);
    EventsManager.loadRegionalEvents(defaultCity);
}
