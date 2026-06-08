import { AppState } from '../state.js';
import { ApiClient } from './api/client.js';

const mapCanvas = document.getElementById('mapCanvas');
const poiDetails = document.getElementById('poiDetails');

export async function loadMapForEvent() {
    const eventId = AppState.currentEvent.id;
    if (!eventId) {
        mapCanvas.innerHTML = '<div class="empty-state">Selecione um evento para ver o mapa.</div>';
        return;
    }

    // Limpa mapa e mostra skeleton enquanto busca dados
    mapCanvas.innerHTML = '<div class="skeleton-card"><span></span><span></span></div>';

    const pois = await ApiClient.getEventPois(eventId);

    if (!pois || pois.length === 0) {
        mapCanvas.innerHTML = '<div class="error-state">Nenhum ponto encontrado para este evento.</div>';
        return;
    }

    renderMarkers(pois);
}

function renderMarkers(pois) {
    mapCanvas.innerHTML = ''; // Limpa o skeleton

    pois.forEach(poi => {
        const marker = document.createElement('div');
        
        // Aplica a classe CSS dinâmica baseada na categoria (ex: marker-hospital)
        marker.className = `map-marker marker-${poi.category}`;
        marker.innerHTML = `
            <div class="marker-icon">
                <svg viewBox="0 0 24 24"><use href="#icon-${poi.category}"></use></svg>
            </div>
        `;

        // Posicionamento (assumindo que o seu objeto POI tenha coordenadas x/y percentuais)
        marker.style.left = `${poi.x}%`;
        marker.style.top = `${poi.y}%`;

        // Evento de clique para mostrar detalhes
        marker.addEventListener('click', () => {
            selectPoi(poi);
        });

        mapCanvas.appendChild(marker);
    });
}

function selectPoi(poi) {
    // Atualiza o estado global
    AppState.update('currentPoi', poi);

    // Renderiza os detalhes no painel lateral (.poi-details)
    poiDetails.innerHTML = `
        <h2>${poi.name}</h2>
        <p>${poi.description || 'Sem descrição disponível.'}</p>
        <div class="alert-inline">${poi.status || 'Status normal'}</div>
        <button class="button button-primary" onclick="window.openRoute('${poi.id}')">
            Ver Rota
        </button>
    `;
}