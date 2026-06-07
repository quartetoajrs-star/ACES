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
        # Aceita variações comuns do nome da variável de ambiente
        self.maps_key = (
            os.getenv("google-maps")
            or os.getenv("GOOGLE_MAPS")
            or os.getenv("GOOGLE_MAPS_KEY")
            or os.getenv("GOOGLE_MAPS_API_KEY")
        )

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
    async def get_directions(self, origin: str, destination: str, mode: str = "driving"):
        """
        Consulta a Google Maps Directions API e devolve rota real:
        distância, duração, passos e polilinha para desenhar o mapa.
        """
        if not self.maps_key:
            return {"ok": False, "error": "Chave google-maps não configurada no ambiente."}
 
        mode_map = {
            "drive": "driving", "driving": "driving",
            "walking": "walking", "transit": "transit", "bicycling": "bicycling",
        }
        g_mode = mode_map.get(mode, "driving")
 
        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                resp = await client.get(
                    "https://maps.googleapis.com/maps/api/directions/json",
                    params={
                        "origin": origin,
                        "destination": destination,
                        "mode": g_mode,
                        "language": "pt-BR",
                        "key": self.maps_key,
                    },
                )
                data = resp.json()
            except Exception as e:
                return {"ok": False, "error": f"Exceção Google Maps: {str(e)}"}
 
        status = data.get("status")
        if status != "OK" or not data.get("routes"):
            return {
                "ok": False,
                "status": status,
                "error": data.get("error_message", f"Rota não encontrada (status: {status})"),
            }
 
        route = data["routes"][0]
        leg = route["legs"][0]
 
        import re
        def strip_html(t):
            return re.sub(r"<[^>]+>", " ", t or "").replace("  ", " ").strip()
 
        steps = [
            {
                "instrucao": strip_html(s.get("html_instructions", "")),
                "distancia": s.get("distance", {}).get("text", ""),
                "duracao": s.get("duration", {}).get("text", ""),
            }
            for s in leg.get("steps", [])[:10]
        ]
 
        return {
            "ok": True,
            "mode": g_mode,
            "origin_address": leg.get("start_address", origin),
            "destination_address": leg.get("end_address", destination),
            "distance": leg.get("distance", {}).get("text", "N/A"),
            "duration": leg.get("duration", {}).get("text", "N/A"),
            "start_location": leg.get("start_location", {}),
            "end_location": leg.get("end_location", {}),
            "polyline": route.get("overview_polyline", {}).get("points", ""),
            "steps": steps,
        }
 
    def build_static_map_url(self, polyline: str, start: dict, end: dict):
        """Monta a URL da imagem estática do Google Maps com a rota desenhada."""
        if not self.maps_key:
            return None
        s = f"{start.get('lat')},{start.get('lng')}"
        e = f"{end.get('lat')},{end.get('lng')}"
        return (
            "https://maps.googleapis.com/maps/api/staticmap?size=640x320&scale=2&language=pt-BR"
            f"&markers=color:0x15803d|label:A|{s}"
            f"&markers=color:0xdc2626|label:B|{e}"
            f"&path=color:0x1a73e8C8|weight:5|enc:{polyline}"
            f"&key={self.maps_key}"
        )
