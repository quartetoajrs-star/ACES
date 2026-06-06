export const AppState = {
    userSession: {
        isLoggedIn: false,
        preferences: {
            maxBudget: null,
            transportMode: 'transit', // transit, driving, walking
            safetyPriority: 'high'    // Define a sensibilidade das recomendações
        }
    },
    currentEvent: {
        id: null,
        location: null,
        riskLevel: null
    },
    logisticsData: {
        pois: [],
        activeRoutes: []
    },

    // Função para atualizar o estado global e disparar atualizações visuais
    update(key, value) {
        if (this.hasOwnProperty(key)) {
            this[key] = value;
            console.log(`[Estado Atualizado]: ${key}`, this[key]);
            // Futuramente, aqui podemos acionar a renderização da tela
        }
    }
};