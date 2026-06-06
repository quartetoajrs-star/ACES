/**
  Responsável por gerir a lista de eventos e a renderização da Análise de Risco na interface.
 */

import { ApiClient } from './api/client.js';
import { Elements } from './elements.js';
import { AppState } from './state.js';

export const EventsManager = {

    /**
     * Inicia o fluxo de descoberta de eventos para uma cidade.
     */
    async loadRegionalEvents(city) {
        // Mostra a animação de carregamento (Skeleton) enquanto espera pelo Python
        if (Elements.eventList) {
            Elements.eventList.innerHTML = `
                <div class="skeleton-card"><span></span><span></span><span></span></div>
                <div class="skeleton-card"><span></span><span></span><span></span></div>
            `;
        }

        const response = await ApiClient.discoverEvents(city);

        if (!response || !response.data || !response.data._embedded || !response.data._embedded.events) {
            Elements.eventList.innerHTML = '<div class="error-state">Não foi possível carregar os eventos. Tente mais tarde.</div>';
            return;
        }

        this.renderEventCards(response.data._embedded.events, city);
    },

    /**
     * Desenha os cartões de eventos no HTML, aplicando o CSS.
     */
    renderEventCards(eventsArray, city) {
        Elements.eventList.innerHTML = ''; // Limpa os skeletons

        // Limita a 4 eventos para não sobrecarregar o ecrã
        const topEvents = eventsArray.slice(0, 4);

        topEvents.forEach(event => {
            const card = document.createElement('div');
            // Utiliza as classes do 02-cards-badges.css e 12-copa-theme.css
            card.className = 'card event-card'; 
            
            // Extrai a data e formata
            const eventDate = event.dates?.start?.localDate || 'Data a definir';
            
            card.innerHTML = `
                <div class="card-topline">
                    <span class="badge">${event.classifications[0]?.segment?.name || 'Desporto'}</span>
                    <span>${eventDate}</span>
                </div>
                <h3>${event.name}</h3>
                <div class="mini-list">
                    <span>📍 ${event._embedded?.venues[0]?.name || city}</span>
                </div>
                <button class="button button-primary" style="margin-top: 1rem;">Analisar Risco</button>
            `;

            // Adiciona o evento de clique ao botão para chamar o Motor Preditivo (OpenAI)
            const analyzeBtn = card.querySelector('.button-primary');
            analyzeBtn.addEventListener('click', () => {
                this.requestRiskAnalysis(event.name, city);
            });

            Elements.eventList.appendChild(card);
        });
    },

    /**
     * Chama a rota de Inteligência Artificial para analisar o evento clicado.
     */
    async requestRiskAnalysis(eventName, city) {
        // 1. Capta a data/hora exata do dispositivo do utilizador (Sincronização de Data)
        const currentIsoDate = new Date().toISOString();
        
        console.log(`Solicitando análise de IA para: ${eventName} em ${city} (Data Utilizador: ${currentIsoDate})`);
        
        // 2. Chama a API
        const analysis = await ApiClient.analyzeEvent(eventName, city, currentIsoDate);
        
        if (analysis) {
            // Guarda no estado global para o mapa e dashboard poderem usar
            AppState.update('currentEventAnalysis', analysis);
            
            // Aqui podemos chamar uma função para abrir um Modal ou atualizar o painel lateral
            alert(`Análise da IA Concluída!\nRisco: ${analysis.intelligence.risk_level}\nConselho: ${analysis.intelligence.logistics_advice}`);
        } else {
            alert("A Análise falhou. Verifique se a sua API OpenAI está configurada.");
        }
    }
};