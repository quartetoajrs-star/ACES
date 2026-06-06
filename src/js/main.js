/**
 * Ponto de entrada (Entry Point) da aplicação ACES-UrbanFlow.
 * Responsável por gerir as interações iniciais (modais de permissão) e orquestrar o arranque do sistema.
 */

import { EventsManager } from './events.js';
import { AppState } from './state.js';

/**
 * 1. GESTÃO DOS MODAIS (Permissão e Notificações)
 * Esta função localiza os modais de sobreposição no ecrã e ativa os botões de decisão.
 */
function setupModals() {
    // Localiza o fundo escuro do modal e o contentor principal
    const modalBackdrop = document.getElementById('modalBackdrop');
    
    // Se não existir nenhum modal no HTML, ignora esta etapa e arranca o sistema
    if (!modalBackdrop) {
        initializeApp();
        return;
    }

    // Localiza todos os botões dentro das áreas de ação dos modais (ex: "Permitir", "Negar", "Fechar")
    const modalButtons = modalBackdrop.querySelectorAll('.modal-actions .button');

    modalButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            // Evita que o botão tente submeter um formulário ou recarregar a página
            event.preventDefault();

            const userAction = button.textContent.trim();
            console.log(`[Interação] O utilizador selecionou: ${userAction}`);

            // Esconde o modal visualmente (Cobre as duas abordagens: classes CSS ou estilos diretos)
            modalBackdrop.classList.remove('is-visible');
            modalBackdrop.style.display = 'none';

            // Regista no estado global se a localização foi permitida (opcional)
            if (userAction.toLowerCase().includes('permitir') || userAction.toLowerCase().includes('avaliar')) {
                AppState.update('locationPermissionGranted', true);
            }

            // Após o modal ser fechado e a permissão tratada, arrancamos o motor de dados
            initializeApp();
        });
    });
}

/**
 * 2. INICIALIZAÇÃO DO MOTOR DA APLICAÇÃO
 * Esta função só é executada APÓS o utilizador interagir com o modal inicial.
 */
function initializeApp() {
    console.log("ACES-UrbanFlow: Arrancando o Sistema de Suporte à Decisão...");

    // Sincronização Temporal: Capta o momento exato do dispositivo para o motor preditivo
    const userLocalDate = new Date();
    AppState.update('sessionDate', userLocalDate.toISOString());
    console.log(`[Sincronização] Contexto Temporal: ${userLocalDate.toLocaleString()}`);

    // Define a cidade de análise padrão para arranque
    const defaultCity = 'Rio de Janeiro';
    AppState.update('currentCity', defaultCity);

    // Dispara a recolha de dados nas APIs externas através do Gestor de Eventos
    if (typeof EventsManager.loadRegionalEvents === 'function') {
        EventsManager.loadRegionalEvents(defaultCity);
    } else {
        console.warn("Aviso: EventsManager.loadRegionalEvents não está disponível.");
    }

    // Configura a interatividade da barra de navegação lateral ou inferior
    setupNavigation();
}

/**
 * 3. GESTÃO DE NAVEGAÇÃO
 * Controla os cliques nos menus para alterar o separador ativo visualmente.
 */
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link, .brand');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            // Se for um link interno (inicia com #), gerimos a transição de ecrã
            const target = link.getAttribute('href');
            if (target && target.startsWith('#')) {
                // Remove a marcação de ativo de todos os links
                navLinks.forEach(l => l.classList.remove('is-active'));
                // Adiciona a marcação ao link selecionado
                event.currentTarget.classList.add('is-active');
            }
        });
    });
}

/**
 * 4. GATILHO DE ARRANQUE
 * Garante que o JavaScript só atua quando todo o HTML (DOM) estiver 100% carregado e desenhado.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Começa sempre por preparar e exibir os modais de permissão
    setupModals();
});
