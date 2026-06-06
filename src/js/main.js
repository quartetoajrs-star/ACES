/**
 * main.js - Abordagem por Delegação de Eventos
 */

import { EventsManager } from './events.js';
import { AppState } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistema ACES-UrbanFlow carregado com sucesso!");
    // ... o resto da sua lógica de botões aqui
});

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
