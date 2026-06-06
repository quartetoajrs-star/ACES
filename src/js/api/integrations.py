"""
api/integrations.py
Módulo de Integração de Dados Externos e Inteligência Artificial.
Gere a recolha de informações do mundo real e processa o cruzamento de dados.
"""

import httpx
import os
import json
from dotenv import load_dotenv

# Carrega as variáveis de segurança do ficheiro .env para a memória
load_dotenv()

class ExternalAPI:
    def __init__(self):
        self.football_key = os.getenv("API_FOOTBALL_KEY")
        self.ticketmaster_key = os.getenv("TICKETMASTER_KEY")
        self.weather_key = os.getenv("OPENWEATHER_KEY")
        self.openai_key = os.getenv("OPENAI_KEY")

    async def get_weather(self, city: str):
        """Busca a previsão meteorológica operacional atual para a cidade-sede."""
        async with httpx.AsyncClient() as client:
            url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={self.weather_key}&units=metric&lang=pt"
            response = await client.get(url)
            
            if response.status_code == 200:
                return response.json()
            return {"weather": [{"main": "Desconhecido", "description": "Dados meteorológicos indisponíveis"}]}

    async def get_football_matches(self, league_id: int = 1, season: int = 2026):
        """Obtém a tabela de jogos oficiais (ex: Copa do Mundo) validada pela API-Sports."""
        async with httpx.AsyncClient() as client:
            headers = {"x-apisports-key": self.football_key}
            url = f"https://v3.football.api-sports.io/fixtures?league={league_id}&season={season}"
            response = await client.get(url, headers=headers)
            
            return response.json() if response.status_code == 200 else {}

    async def get_ticketmaster_events(self, city: str):
        """Mapeia grandes eventos paralelos na região (shows, festivais) que possam impactar o tráfego."""
        async with httpx.AsyncClient() as client:
            url = f"https://app.ticketmaster.com/discovery/v2/events.json?apikey={self.ticketmaster_key}&city={city}&size=10"
            response = await client.get(url)
            
            return response.json() if response.status_code == 200 else {}

    async def generate_predictive_risk(self, event_name: str, city: str, weather_data: dict, current_date: str):
        """
        O Motor Preditivo: Envia o contexto cruzado (Evento + Local + Clima + Data) 
        para a OpenAI, devolvendo um plano de contingência estruturado em JSON.
        """
        async with httpx.AsyncClient(timeout=20.0) as client:
            headers = {
                "Authorization": f"Bearer {self.openai_key}",
                "Content-Type": "application/json"
            }
            
            # Extração segura da descrição meteorológica
            weather_desc = weather_data.get('weather', [{}])[0].get('description', 'Condição desconhecida')
            temp = weather_data.get('main', {}).get('temp', 'N/A')
            
            prompt = f"""
            Atue como um sistema avançado de planeamento logístico urbano.
            Data atual de consulta: {current_date}
            Evento alvo: {event_name} na cidade de {city}.
            Condição meteorológica prevista: {weather_desc} com temperatura de {temp}°C.
            
            Gere uma análise de risco e precaução estrita em formato JSON com as seguintes chaves:
            - "risk_level": string ("Baixo", "Médio", "Alto" ou "Crítico").
            - "estimated_cost_impact": string (ex: "Aumento de 20% em transportes devido à chuva").
            - "logistics_advice": string (Um conselho principal de segurança e fluxo).
            - "recommendations": array de strings (3 dicas práticas de rotas, tempo de antecedência e precaução).
            """
            
            payload = {
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            }
            
            try:
                response = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
                if response.status_code == 200:
                    content = response.json()["choices"][0]["message"]["content"]
                    return json.loads(content)
                return {"error": f"Falha na IA HTTP: {response.status_code}"}
            except Exception as e:
                return {"error": f"Exceção na análise preditiva: {str(e)}"}