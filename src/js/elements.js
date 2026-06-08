/**
 Centraliza a busca por elementos do DOM para evitar repetição.
 */

export const Elements = {
    // Containers
    main: document.getElementById('mainContent'),
    nav: document.getElementById('primaryNav'),
    
    // Inputs (para os formulários)
    search: document.getElementById('eventSearchInput'),
    
    // Containers de listagem (para popularem via API)
    eventList: document.getElementById('eventList'),
    agendaList: document.getElementById('agendaList'),
    
    // Modals
    consentModal: document.getElementById('consentModal')
};