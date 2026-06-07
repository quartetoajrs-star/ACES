import os
import json
import httpx
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from .integrations import ExternalAPI
 
app = FastAPI(title="ACES-UrbanFlow Decision Support Engine")
api = ExternalAPI()
 
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
 
app.mount("/src", StaticFiles(directory="src"), name="static")
 
 
@app.get("/")
async def serve_root():
    return FileResponse("index.html")
 
 
@app.get("/api/v1/diag")
async def diag():
    """Diagnóstico: quais chaves o servidor carregou (sem expor valores)."""
    return {"keys_loaded": api.status()}
 
 
# ─────────────────────────────────────────────────────────────────────────────
# IA — Gemini com fallback de lógica fixa
# ─────────────────────────────────────────────────────────────────────────────
 
class AIRequest(BaseModel):
    prompt: str
    max_tokens: int = 800
 
@app.post("/api/v1/ai/generate")
async def ai_generate(request: AIRequest):
    text = await api.generate_ai(request.prompt, request.max_tokens)
    if text:
        return {"text": text, "provider": "gemini"}
    # Fallback: sem IA disponível
    return {"text": None, "provider": "none",
            "note": "IA indisponível — usando lógica fixa no cliente."}
 
 
# ─────────────────────────────────────────────────────────────────────────────
# EVENTOS — Copa (API-Football) + Ticketmaster
# ─────────────────────────────────────────────────────────────────────────────
 
@app.get("/api/v1/events/worldcup")
async def events_worldcup():
    return await api.get_world_cup_fixtures()
 
@app.get("/api/v1/events/ticketmaster")
async def events_ticketmaster(
    city: str = None, countryCode: str = None, keyword: str = None,
    lat: float = None, lng: float = None, classification: str = None,
):
    return await api.get_ticketmaster(
        city=city, country_code=countryCode, keyword=keyword,
        lat=lat, lng=lng, classification=classification,
    )
 
@app.get("/api/v1/events/real")
async def events_real(city: str = None, countryCode: str = None,
                      keyword: str = None, lat: float = None, lng: float = None):
    return await api.get_real_events(city=city, country_code=countryCode,
                                     keyword=keyword, lat=lat, lng=lng)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# AUTOCOMPLETE / GEOCODING (todos os países e cidades)
# ─────────────────────────────────────────────────────────────────────────────
 
@app.get("/api/v1/places/autocomplete")
async def places_autocomplete(q: str, kind: str = "geocode"):
    return await api.places_autocomplete(q, kind)
 
@app.get("/api/v1/geocode")
async def geocode(q: str):
    res = await api.geocode(q)
    return res or {"error": "não encontrado"}
 
 
# ─────────────────────────────────────────────────────────────────────────────
# ROTEIRO (itinerário completo)
# ─────────────────────────────────────────────────────────────────────────────
 
class ItineraryRequest(BaseModel):
    event: dict
    origin: str = None
 
@app.post("/api/v1/itinerary")
async def itinerary(req: ItineraryRequest):
    return await api.build_itinerary(req.event, req.origin)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# GOOGLE MAPS — rota + imagem estática (proxy)
# ─────────────────────────────────────────────────────────────────────────────
 
@app.get("/api/v1/maps/route")
async def maps_route(origin: str, destination: str, mode: str = "driving"):
    result = await api.get_directions(origin, destination, mode)
    if result.get("ok") and result.get("polyline"):
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
    url = api.build_static_map_url(polyline, {"lat": slat, "lng": slng},
                                   {"lat": elat, "lng": elng})
    if not url:
        raise HTTPException(status_code=500, detail="Chave google-maps não configurada")
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url)
    return Response(content=resp.content, media_type="image/png")
 
 
# ─────────────────────────────────────────────────────────────────────────────
# CLIMA / análise legada (mantida)
# ─────────────────────────────────────────────────────────────────────────────
 
@app.get("/api/v1/weather")
async def weather(city: str):
    return await api.get_weather(city)
