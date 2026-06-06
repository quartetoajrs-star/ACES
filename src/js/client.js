// Enquanto testa no seu computador, mantenha o localhost. 
// Para o deploy, substitua pelo URL do Render (ex: https://aces-urbanflow.onrender.com/api/v1)
const API_BASE_URL = 'https://aces-c4av.onrender.com';

export const ApiClient = {
    
    /**
     * Função base para fazer os pedidos e tratar erros automaticamente.
     */
    async fetch(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        try {
            console.log(`[API Request]: A comunicar com ${url}...`);
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            return await response.json();
            
        } catch (error) {
            console.error(`[API Falha] Servidor inacessível no endpoint ${endpoint}:`, error);
            return null; 
        }
    },

    /**
     * MÉTODOS DE INTELIGÊNCIA LOGÍSTICA
     */

    // 1. Pede à IA a análise de risco cruzando Evento + Clima + Data
    async analyzeEvent(eventName, city, userDate) {
        if (!eventName || !city) return null;
        
        // Codifica os parâmetros para garantir que espaços e caracteres especiais não quebram o URL
        const params = `?event_name=${encodeURIComponent(eventName)}&city=${encodeURIComponent(city)}&user_date=${encodeURIComponent(userDate)}`;
        return await this.fetch(`/api/v1/analyze-event/${params}`);
    },

    // 2. Descobre eventos regionais vindos da Ticketmaster / API-Football
    async discoverEvents(city) {
        if (!city) return null;
        return await this.fetch(`/api/v1/discover/?city=${encodeURIComponent(city)}`);
    }
};

