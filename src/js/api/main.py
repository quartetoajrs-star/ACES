"""
api/main.py
Servidor Principal FastAPI.
Recebe os pedidos do Front-End, orquestra os dados externos e devolve a inteligência formatada.
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from api.integrations import ExternalAPI
# from api.database import db  # Será utilizado quando estruturarmos a escrita no Supabase

app = FastAPI(title="ACES-UrbanFlow Decision Support Engine")
api = ExternalAPI()

# Configuração rigorosa de CORS para permitir a comunicação com o browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def health_check():
    """Confirma que o servidor e o pipeline de dados estão ativos."""
    return {"status": "online", "system": "ACES-UrbanFlow Preditivo"}

@app.get("/api/v1/analyze-event/")
async def analyze_event_logistics(
    event_name: str = Query(..., description="O nome do evento ou jogo (ex: Final da Copa)"),
    city: str = Query(..., description="A cidade-sede onde ocorre o evento"),
    user_date: str = Query(..., description="Data atual do dispositivo do utilizador (ISO Format)")
):
    """
    Motor Central de Avaliação de Risco:
    1. Consulta o clima real da cidade.
    2. Submete o contexto à Inteligência Artificial.
    3. Devolve um relatório financeiro, de tempo e de rotas para o utilizador.
    """
    
    # Passo 1: Captura os dados físicos da cidade em tempo real
    weather = await api.get_weather(city)
    
    # Passo 2: Processamento Preditivo (Cálculo de contingência e tempo)
    risk_analysis = await api.generate_predictive_risk(
        event_name=event_name, 
        city=city, 
        weather_data=weather,
        current_date=user_date
    )
    
    # Passo 3: Compilação do pacote de dados para renderização no Front-End
    response_data = {
        "context": {
            "event": event_name,
            "city": city,
            "query_date": user_date
        },
        "environment": {
            "weather_main": weather.get("weather", [{}])[0].get("main", "N/A"),
            "temperature": weather.get("main", {}).get("temp", "N/A")
        },
        "intelligence": risk_analysis
    }
    
    # Futuramente: await db.save_event_analysis(response_data) para armazenar no histórico
    
    return response_data

@app.get("/api/v1/discover/")
async def discover_regional_events(city: str):
    """
    Cruza dados de APIs de bilhética (Ticketmaster) para encontrar
    eventos num raio de ação que justifique planeamento prévio.
    """
    ticketmaster_events = await api.get_ticketmaster_events(city)
    return {"source": "Ticketmaster", "data": ticketmaster_events}