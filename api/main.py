import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from .integrations import ExternalAPI

app = FastAPI(title="ACES-UrbanFlow Decision Support Engine")
api = ExternalAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.mount("/src", StaticFiles(directory="src"), name="static")


@app.get("/")
async def serve_root():
    return FileResponse("index.html")

@app.get("/api/v1/diag")
async def diag():
    return {"keys_loaded": api.status()}

# ── IA (Gemini + fallback) ────────────────────────────────────────────────────
class AIRequest(BaseModel):
    prompt: str
    max_tokens: int = 800

@app.post("/api/v1/ai/generate")
async def ai_generate(req: AIRequest):
    text = await api.generate_ai(req.prompt, req.max_tokens)
    return {"text": text, "provider": "gemini" if text else "none"}

# ── EVENTOS ────────────────────────────────────────────────────────────────────
@app.get("/api/v1/events/worldcup")
async def events_worldcup():
    return await api.get_world_cup_fixtures()

@app.get("/api/v1/events/ticketmaster")
async def events_ticketmaster(city: str = None, countryCode: str = None, keyword: str = None,
                              lat: float = None, lng: float = None, classification: str = None,
                              years_ahead: int = 2):
    return await api.get_ticketmaster(city=city, country_code=countryCode, keyword=keyword,
                                      lat=lat, lng=lng, classification=classification,
                                      years_ahead=years_ahead)

@app.get("/api/v1/events/real")
async def events_real(city: str = None, countryCode: str = None, keyword: str = None,
                      lat: float = None, lng: float = None):
    return await api.get_real_events(city=city, country_code=countryCode, keyword=keyword,
                                     lat=lat, lng=lng)

@app.get("/api/v1/recommendations")
async def recommendations(lat: float = None, lng: float = None):
    return await api.get_recommendations(lat=lat, lng=lng)

# ── LOCALIZAÇÃO (gratuita) ─────────────────────────────────────────────────────
@app.get("/api/v1/places/autocomplete")
async def places_autocomplete(q: str, kind: str = "geocode"):
    return await api.places_autocomplete(q, kind)

@app.get("/api/v1/geocode")
async def geocode(q: str):
    return await api.geocode(q) or {"error": "não encontrado"}

@app.get("/api/v1/maps/route")
async def maps_route(origin: str, destination: str, mode: str = "driving"):
    return await api.get_directions(origin, destination, mode)

# ── ROTEIRO ────────────────────────────────────────────────────────────────────
class ItineraryRequest(BaseModel):
    event: dict
    origin: str = None

@app.post("/api/v1/itinerary")
async def itinerary(req: ItineraryRequest):
    return await api.build_itinerary(req.event, req.origin)

# ── CLIMA ──────────────────────────────────────────────────────────────────────
@app.get("/api/v1/weather")
async def weather(city: str):
    return await api.get_weather(city)
