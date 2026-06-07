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

async def _try_openai(prompt: str, max_tokens: int):
    """Tenta a OpenAI. Retorna texto ou levanta exceção."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_KEY"))
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.7,
    )
    return resp.choices[0].message.content

async def _try_gemini(prompt: str, max_tokens: int):
    """Fallback: Google Gemini (usa a mesma chave do Google Cloud)."""
    import httpx
    key = (
        os.getenv("GEMINI_KEY") or os.getenv("GOOGLE_API_KEY")
        or os.getenv("google-maps") or os.getenv("goolgle-maps")
        or os.getenv("GOOGLE_MAPS")
    )
    if not key:
        raise RuntimeError("Sem chave para Gemini")
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + key
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=payload)
        data = r.json()
    if r.status_code != 200:
        raise RuntimeError(f"Gemini HTTP {r.status_code}: {data}")
    return data["candidates"][0]["content"]["parts"][0]["text"]

@app.post("/api/v1/ai/generate")
async def ai_generate(request: AIRequest):
    """
    Proxy de IA com fallback automático:
    1) OpenAI (gpt-4o-mini)  2) Google Gemini (gemini-1.5-flash)
    Se ambos falharem, devolve o motivo de cada um.
    """
    errors = {}
    # 1) OpenAI
    try:
        text = await _try_openai(request.prompt, request.max_tokens)
        return {"text": text, "provider": "openai"}
    except Exception as e:
        errors["openai"] = f"{type(e).__name__}: {str(e)}"

    # 2) Gemini (fallback)
    try:
        text = await _try_gemini(request.prompt, request.max_tokens)
        return {"text": text, "provider": "gemini"}
    except Exception as e:
        errors["gemini"] = f"{type(e).__name__}: {str(e)}"

    raise HTTPException(status_code=500, detail={"message": "Todos os provedores de IA falharam", "errors": errors})
 

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


# DIAGNÓSTICO — quais chaves o servidor conseguiu carregar (sem expor valores)

@app.get("/api/v1/diag")
async def diag():
    return {"keys_loaded": api.status()}


# EVENTOS REAIS — API-Football (Copa) + Ticketmaster (eventos paralelos)

@app.get("/api/v1/events/real")
async def events_real(city: str = None):
    return await api.get_real_events(city)

 

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
