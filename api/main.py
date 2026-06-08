import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from .integrations import ExternalAPI
from .database import db

# Raiz do projeto = pasta que contém /api, /src e index.html (independe do CWD do Render)
BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="ACES-UrbanFlow Decision Support Engine")
api = ExternalAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

app.mount("/src", StaticFiles(directory=str(BASE_DIR / "src")), name="static")


@app.get("/")
async def serve_root():
    return FileResponse(str(BASE_DIR / "index.html"))

@app.get("/api/v1/diag")
async def diag():
    return {"keys_loaded": api.status()}

@app.post("/api/v1/roteiros")
async def salvar_roteiro(req: dict):
    return await db.salvar_roteiro(req["email"], req["titulo"], req["dados"])

@app.get("/api/v1/roteiros")
async def listar_roteiros(email: str):
    return await db.listar_roteiros(email)

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

# ── CATÁLOGO CURADO (grandes eventos + multi-sessão) ──────────────────────────
@app.get("/api/v1/events/catalog")
async def events_catalog():
    """Catálogo curado de grandes eventos (base confiável, com sessões)."""
    return {"ok": True, "data": api.curated()}

@app.get("/api/v1/events/find")
async def events_find(id: str):
    """Busca um evento ou sessão específica do catálogo (para montar roteiro)."""
    ev = api.curated_find(id)
    return ev or {"error": "não encontrado"}

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


# ── Diagnóstico de estáticos: confirma onde o servidor procura os arquivos ─────
@app.get("/api/v1/diag/static")
async def diag_static():
    css = BASE_DIR / "src" / "css" / "global.css"
    return {
        "base_dir": str(BASE_DIR),
        "cwd": os.getcwd(),
        "index_existe": (BASE_DIR / "index.html").exists(),
        "src_existe": (BASE_DIR / "src").exists(),
        "global_css_existe": css.exists(),
        "copa_theme_existe": (BASE_DIR / "src" / "css" / "pages" / "12-copa-theme.css").exists(),
        "estadio_png_existe": (BASE_DIR / "src" / "assets" / "img" / "estadio.png").exists(),
    }


# ── Fallback final: serve qualquer arquivo do projeto (favicon, assets soltos) ──
# Fica por ÚLTIMO para não capturar /api/* nem /src/* (já tratados acima).
@app.get("/{full_path:path}")
async def serve_any(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")
    candidate = (BASE_DIR / full_path).resolve()
    # Segurança: só serve dentro do projeto
    if str(candidate).startswith(str(BASE_DIR)) and candidate.is_file():
        return FileResponse(str(candidate))
    # Caso não exista, devolve o index (navegação client-side)
    return FileResponse(str(BASE_DIR / "index.html"))
