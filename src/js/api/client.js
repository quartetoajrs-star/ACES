const API_BASE_URL = 'https://aces-c4av.onrender.com/api/v1';

export const ApiClient = {
    async fetch(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        try {
            console.log(`A tentar ligar a: ${url}`);
            const response = await fetch(url, {
                ...options,
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`Erro ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("ERRO DE CONEXÃO DETETADO:", error);
            // Aqui pode disparar um alerta visual para o utilizador
            return null;
        }
    }
};
