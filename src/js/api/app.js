import { AppState } from './state.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando ACES-UrbanFlow...");
    
    // 1. Verificar o estado da sessão (preparação para tela de login futura)
    if (!AppState.userSession.isLoggedIn) {
        console.warn("Utilizador não autenticado. A iniciar em modo restrito/convidado.");
        // A lógica da tela de login entrará aqui posteriormente
    }

    // 2. Inicializar a interface base
    setupEventListeners();
    
    console.log("Interface pronta. A aguardar entrada de dados logísticos.");
});

function setupEventListeners() {
    // Aqui vamos mapear os cliques nos botões do seu index.html
    // Exemplo: Botão de calcular rota, botão de avaliar risco, etc.
}