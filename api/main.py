import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from .integrations import ExternalAPI
from .database import db
 
app = FastAPI(title="ACES-UrbanFlow Decision Support Engine")
api = ExternalAPI()
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
app.mount("/src", StaticFiles(directory="src"), name="static")
 
@app.get("/")
async def serve_root():
    return FileResponse("index.html")
 

# PROXY DE IA — chama OpenAI a partir do backend (evita CORS no browser)

 
class AIRequest(BaseModel):
    prompt: str
    max_tokens: int = 800
 
@app.post("/api/v1/ai/generate")
async def ai_generate(request: AIRequest):
    """
    Proxy seguro para a OpenAI API.
    O frontend envia o prompt; o backend assina com a OPENAI_KEY do .env.
    """
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=os.getenv("OPENAI_KEY"))
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": request.prompt}],
            max_tokens=request.max_tokens,
            temperature=0.7,
        )
        return {"text": response.choices[0].message.content}
    except Exception as e:
        # Devolve o motivo real (chave inválida, sem crédito, etc.)
        raise HTTPException(status_code=500, detail=f"OpenAI: {type(e).__name__}: {str(e)}")


# DIAGNÓSTICO — verifica quais chaves o servidor conseguiu carregar


@app.get("/api/v1/diag")
async def diag():
    """Acesse /api/v1/diag para ver quais variáveis de ambiente foram lidas."""
    return {"keys_loaded": api.status()}


# EVENTOS REAIS — API-Football (Copa) + Ticketmaster (eventos paralelos)


@app.get("/api/v1/events/real")
async def events_real(city: str = None):
    """Devolve jogos reais da Copa 2026 + eventos paralelos da cidade."""
    return await api.get_real_events(city)
 

# ROTAS ORIGINAIS

 
@app.get("/api/v1/analyze-event/")
async def analyze_event_logistics(
    event_name: str = Query(...),
    city: str = Query(...),
    user_date: str = Query(...),
):
    weather = await api.get_weather(city)
    risk_analysis = await api.generate_predictive_risk(
        event_name=event_name,
        city=city,
        weather_data=weather,
        current_date=user_date,
    )
    return {
        "context":     {"event": event_name, "city": city, "query_date": user_date},
        "environment": {
            "weather_main": weather.get("weather", [{}])[0].get("main", "N/A"),
            "temperature":  weather.get("main", {}).get("temp", "N/A"),
        },
        "intelligence": risk_analysis,
    }
 
@app.get("/api/v1/discover/")
async def discover_regional_events(city: str):
    ticketmaster_events = await api.get_ticketmaster_events(city)
    return {"source": "Ticketmaster", "data": ticketmaster_events}
 

# GOOGLE MAPS — rota real + imagem estática (proxy para não expor a chave)

 
@app.get("/api/v1/maps/route")
async def maps_route(origin: str, destination: str, mode: str = "driving"):
    """Devolve rota real (distância, duração, passos) via Google Directions API."""
    result = await api.get_directions(origin, destination, mode)
    if result.get("ok") and result.get("polyline"):
        # Em vez da URL com a chave, devolve um endpoint-proxy local
        from urllib.parse import quote
        result["static_map"] = (
            "/api/v1/maps/static?polyline=" + quote(result["polyline"])
            + "&slat=" + str(result["start_location"].get("lat", ""))
            + "&slng=" + str(result["start_location"].get("lng", ""))
            + "&elat=" + str(result["end_location"].get("lat", ""))
            + "&elng=" + str(result["end_location"].get("lng", ""))
        )
    return result
 
@app.get("/api/v1/maps/static")
async def maps_static(polyline: str, slat: str, slng: str, elat: str, elng: str):
    """Proxy da imagem estática do Google Maps — mantém a chave no servidor."""
    import httpx
    from fastapi.responses import Response
    url = api.build_static_map_url(
        polyline,
        {"lat": slat, "lng": slng},
        {"lat": elat, "lng": elng},
    )
    if not url:
        raise HTTPException(status_code=500, detail="Chave google-maps não configurada")
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url)
    return Response(content=resp.content, media_type="image/png")
