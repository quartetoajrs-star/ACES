/**
 * main.js
 * Ponto de entrada (Entry Point) da aplicação Aces-UrbanFlow.
 * Inicializa os módulos, capta a data do utilizador e arranca a interface.
 */

import { EventsManager } from './events.js';
import { AppState } from './state.js';

// Função de arranque principal
function initializeApp() {
    console.log("ACES-UrbanFlow: Inicializando o Sistema de Suporte à Decisão...");

    // 1. Sincronização Temporal do Utilizador
    const userLocalDate = new Date();
    AppState.update('sessionDate', userLocalDate.toISOString());
    console.log(`Contexto Temporal do Utilizador: ${userLocalDate.toLocaleString()}`);

    // 2. Definir Cidade de Arranque Padrão (Exemplo: Rio de Janeiro ou outra cidade-sede)
    const defaultCity = 'Rio de Janeiro';
    AppState.update('currentCity', defaultCity);

    // 3. Disparar a recolha de eventos para popular a interface imediatamente
    EventsManager.loadRegionalEvents(defaultCity);

    // 4. Configurar os botões de navegação lateral (se existirem no layout)
    setupNavigation();
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Remove a classe 'is-active' de todos
            navLinks.forEach(l => l.classList.remove('is-active'));
            // Adiciona ao clicado
            e.currentTarget.classList.add('is-active');
        });
    });
}

// Garante que o código só corre quando o HTML e o CSS estiverem totalmente desenhados no ecrã
document.addEventListener('DOMContentLoaded', initializeApp);