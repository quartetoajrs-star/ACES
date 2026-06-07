"""
api/integrations.py
Integração de dados externos (sem OpenAI):
- API-Football: jogos reais da Copa 2026
- Ticketmaster: eventos/shows do cotidiano
- Google Maps: rotas, geocoding, autocomplete, locais próximos
- Gemini: conteúdo inteligente (com fallback de lógica fixa)
"""
 
import httpx
import os
import json
import re
from dotenv import load_dotenv
 
load_dotenv()
 
# Coordenadas das sedes da Copa 2026 (para o mapa, sem custo de geocoding)
WC_VENUES = {
    "new york": (40.8128, -74.0742, "MetLife Stadium"),
    "east rutherford": (40.8128, -74.0742, "MetLife Stadium"),
    "los angeles": (33.9535, -118.3392, "SoFi Stadium"),
    "inglewood": (33.9535, -118.3392, "SoFi Stadium"),
    "dallas": (32.7473, -97.0945, "AT&T Stadium"),
    "arlington": (32.7473, -97.0945, "AT&T Stadium"),
    "miami": (25.9580, -80.2389, "Hard Rock Stadium"),
    "boston": (42.0909, -71.2643, "Gillette Stadium"),
    "foxborough": (42.0909, -71.2643, "Gillette Stadium"),
    "philadelphia": (39.9008, -75.1675, "Lincoln Financial Field"),
    "kansas city": (39.0489, -94.4839, "Arrowhead Stadium"),
    "seattle": (47.5952, -122.3316, "Lumen Field"),
    "san francisco": (37.4030, -121.9698, "Levi's Stadium"),
    "santa clara": (37.4030, -121.9698, "Levi's Stadium"),
    "atlanta": (33.7553, -84.4006, "Mercedes-Benz Stadium"),
    "houston": (29.6847, -95.4107, "NRG Stadium"),
    "toronto": (43.6332, -79.4185, "BMO Field"),
    "vancouver": (49.2768, -123.1119, "BC Place"),
    "mexico city": (19.3029, -99.1505, "Estadio Azteca"),
    "ciudad de mexico": (19.3029, -99.1505, "Estadio Azteca"),
    "guadalajara": (20.6818, -103.4626, "Estadio Akron"),
    "monterrey": (25.6692, -100.2444, "Estadio BBVA"),
}
 
# Lista offline de países (fallback do autocomplete)
COUNTRIES_PT = [
    "Brasil", "Estados Unidos", "Canadá", "México", "Argentina", "Portugal",
    "Espanha", "França", "Alemanha", "Itália", "Inglaterra", "Reino Unido",
    "Japão", "Coreia do Sul", "Austrália", "Uruguai", "Colômbia", "Chile",
    "Holanda", "Bélgica", "Croácia", "Marrocos", "Senegal", "Catar",
    "Arábia Saudita", "China", "Índia", "África do Sul", "Egito", "Nigéria",
    "Suíça", "Áustria", "Suécia", "Noruega", "Dinamarca", "Polônia",
    "Grécia", "Turquia", "Rússia", "Ucrânia", "Irlanda", "Escócia",
]
 
CITIES_PT = [
    "Rio de Janeiro, Brasil", "São Paulo, Brasil", "Salvador, Brasil",
    "Brasília, Brasil", "Belo Horizonte, Brasil", "Feira de Santana, Brasil",
    "New York, EUA", "Los Angeles, EUA", "Miami, EUA", "Dallas, EUA",
    "Chicago, EUA", "Boston, EUA", "Seattle, EUA", "Atlanta, EUA",
    "Houston, EUA", "San Francisco, EUA", "Las Vegas, EUA", "Philadelphia, EUA",
    "Kansas City, EUA", "Toronto, Canadá", "Vancouver, Canadá", "Montreal, Canadá",
    "Cidade do México, México", "Guadalajara, México", "Monterrey, México",
    "Londres, Reino Unido", "Paris, França", "Madri, Espanha", "Barcelona, Espanha",
    "Lisboa, Portugal", "Roma, Itália", "Berlim, Alemanha", "Tóquio, Japão",
]
 
 
class ExternalAPI:
    def __init__(self):
        def env(*names):
            for n in names:
                v = os.getenv(n)
                if v:
                    return v
            return None
 
        self.football_key     = env("API_FOOTBALL_KEY", "FOOTBALL_KEY", "v3.football.api-sports.io")
        self.ticketmaster_key = env("TICKETMASTER_KEY", "TICKETMASTER")
        self.weather_key      = env("OPENWEATHER_KEY", "OPENWEATHER", "WEATHER_KEY")
        self.maps_key = env(
            "google-maps", "goolgle-maps", "GOOGLE_MAPS",
            "GOOGLE_MAPS_KEY", "GOOGLE_MAPS_API_KEY", "GOOGLE-MAPS",
        )
        # Gemini pode usar uma chave dedicada OU a mesma do Google Cloud
        self.gemini_key = env("GEMINI_KEY", "GOOGLE_API_KEY") or self.maps_key
 
    def status(self):
        return {
            "google-maps":      bool(self.maps_key),
            "gemini":           bool(self.gemini_key),
            "API_FOOTBALL_KEY": bool(self.football_key),
            "TICKETMASTER_KEY": bool(self.ticketmaster_key),
            "OPENWEATHER_KEY":  bool(self.weather_key),
        }
 
    # ── IA: Gemini com fallback ──────────────────────────────────────────────
    async def generate_ai(self, prompt: str, max_tokens: int = 800):
        """Gera texto via Gemini. Retorna None se indisponível (caller faz fallback)."""
        if not self.gemini_key:
            return None
        url = ("https://generativelanguage.googleapis.com/v1beta/models/"
               "gemini-1.5-flash:generateContent?key=" + self.gemini_key)
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7},
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(url, json=payload)
                if r.status_code != 200:
                    return None
                data = r.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            return None
 
    # ── Clima ────────────────────────────────────────────────────────────────
    async def get_weather(self, city: str):
        if not self.weather_key:
            return {"weather": [{"main": "N/A", "description": "indisponível"}]}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                url = (f"https://api.openweathermap.org/data/2.5/weather?q={city}"
                       f"&appid={self.weather_key}&units=metric&lang=pt")
                r = await client.get(url)
                if r.status_code == 200:
                    return r.json()
        except Exception:
            pass
        return {"weather": [{"main": "N/A", "description": "indisponível"}]}
 
    # ── Copa do Mundo 2026 (jogos reais) ──────────────────────────────────────
    async def get_world_cup_fixtures(self, season: int = 2026):
        if not self.football_key:
            return {"ok": False, "error": "API_FOOTBALL_KEY ausente", "data": []}
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    "https://v3.football.api-sports.io/fixtures",
                    headers={"x-apisports-key": self.football_key},
                    params={"league": 1, "season": season},
                )
                raw = r.json()
        except Exception as e:
            return {"ok": False, "error": f"Exceção API-Football: {str(e)}", "data": []}
 
        if not raw.get("response"):
            return {"ok": False, "error": raw.get("errors") or "Sem jogos", "data": []}
 
        events = []
        for fx in raw["response"]:
            fixture = fx.get("fixture", {})
            teams   = fx.get("teams", {})
            venue   = fixture.get("venue", {})
            home    = teams.get("home", {}).get("name", "A definir")
            away    = teams.get("away", {}).get("name", "A definir")
            date_iso = fixture.get("date", "")
            city    = (venue.get("city") or "").strip()
            coords  = WC_VENUES.get(city.lower())
            lat = coords[0] if coords else None
            lng = coords[1] if coords else None
            stadium = venue.get("name") or (coords[2] if coords else "Estádio")
            events.append({
                "id": "fx" + str(fixture.get("id", "")),
                "cat": "Futebol",
                "evento": "Copa do Mundo FIFA 2026",
                "title": f"{home} x {away}",
                "home": home, "away": away,
                "date": date_iso[:10] if date_iso else "",
                "time": date_iso[11:16] if len(date_iso) > 16 else "",
                "city": city or "A definir",
                "country": "EUA / Canadá / México",
                "venue": stadium,
                "lat": lat, "lng": lng,
                "phase": fx.get("league", {}).get("round", "Fase de grupos"),
            })
        return {"ok": True, "count": len(events), "data": events}
 
    # ── Ticketmaster (eventos do cotidiano) ───────────────────────────────────
    async def get_ticketmaster(self, city=None, country_code=None, keyword=None,
                               lat=None, lng=None, radius=None, size=20, classification=None):
        if not self.ticketmaster_key:
            return {"ok": False, "error": "TICKETMASTER_KEY ausente", "data": []}
        params = {
            "apikey": self.ticketmaster_key,
            "size": size,
            "sort": "date,asc",
            "locale": "*",
        }
        if city:           params["city"] = city
        if country_code:   params["countryCode"] = country_code
        if keyword:        params["keyword"] = keyword
        if classification: params["classificationName"] = classification
        if lat and lng:
            params["latlong"] = f"{lat},{lng}"
            params["radius"] = radius or 100
            params["unit"] = "km"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    "https://app.ticketmaster.com/discovery/v2/events.json",
                    params=params,
                )
                raw = r.json()
        except Exception as e:
            return {"ok": False, "error": str(e), "data": []}
 
        data = []
        for ev in (raw.get("_embedded", {}) or {}).get("events", []):
            venue = (ev.get("_embedded", {}).get("venues", [{}]) or [{}])[0]
            dates = ev.get("dates", {}).get("start", {})
            loc   = venue.get("location", {}) or {}
            cls   = (ev.get("classifications", [{}]) or [{}])[0]
            data.append({
                "id": "tm" + str(ev.get("id", "")),
                "cat": cls.get("segment", {}).get("name", "Evento"),
                "evento": ev.get("name", "Evento"),
                "title": ev.get("name", "Evento"),
                "home": ev.get("name", "Evento"), "away": "",
                "date": dates.get("localDate", ""),
                "time": (dates.get("localTime", "") or "")[:5],
                "city": venue.get("city", {}).get("name", city or ""),
                "country": venue.get("country", {}).get("name", ""),
                "venue": venue.get("name", ""),
                "lat": float(loc["latitude"]) if loc.get("latitude") else None,
                "lng": float(loc["longitude"]) if loc.get("longitude") else None,
                "phase": cls.get("genre", {}).get("name", "Show / Evento"),
                "url": ev.get("url", ""),
            })
        return {"ok": True, "count": len(data), "data": data}
 
    # ── Eventos combinados para o mapa/lista ──────────────────────────────────
    async def get_real_events(self, city=None, country_code=None, keyword=None,
                              lat=None, lng=None):
        result = {"futebol": [], "outros": []}
        wc = await self.get_world_cup_fixtures()
        if wc.get("ok"):
            result["futebol"] = wc["data"]
        tm = await self.get_ticketmaster(city=city, country_code=country_code,
                                         keyword=keyword, lat=lat, lng=lng)
        if tm.get("ok"):
            result["outros"] = tm["data"]
        return result
 
    # ── Google Places Autocomplete (com fallback offline) ─────────────────────
    async def places_autocomplete(self, q: str, kind: str = "geocode"):
        q = (q or "").strip()
        if not q:
            return {"ok": True, "source": "empty", "data": []}
 
        if self.maps_key:
            types = "(cities)" if kind == "city" else ("country" if kind == "country" else "geocode")
            params = {
                "input": q, "key": self.maps_key, "language": "pt-BR",
            }
            if kind in ("city", "country"):
                params["types"] = types
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    r = await client.get(
                        "https://maps.googleapis.com/maps/api/place/autocomplete/json",
                        params=params,
                    )
                    data = r.json()
                if data.get("status") in ("OK", "ZERO_RESULTS"):
                    return {
                        "ok": True, "source": "google",
                        "data": [
                            {"label": p["description"], "place_id": p.get("place_id")}
                            for p in data.get("predictions", [])
                        ],
                    }
            except Exception:
                pass
 
        # Fallback offline
        base = COUNTRIES_PT if kind == "country" else (CITIES_PT if kind == "city" else CITIES_PT + COUNTRIES_PT)
        ql = q.lower()
        matches = [{"label": x, "place_id": None} for x in base if ql in x.lower()][:8]
        return {"ok": True, "source": "offline", "data": matches}
 
    # ── Geocoding (lugar → lat/lng) ───────────────────────────────────────────
    async def geocode(self, query: str):
        if not self.maps_key or not query:
            return None
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.get(
                    "https://maps.googleapis.com/maps/api/geocode/json",
                    params={"address": query, "key": self.maps_key, "language": "pt-BR"},
                )
                data = r.json()
            if data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return {"lat": loc["lat"], "lng": loc["lng"],
                        "address": data["results"][0]["formatted_address"]}
        except Exception:
            pass
        return None
 
    # ── Locais próximos (hotéis, restaurantes) ────────────────────────────────
    async def nearby_places(self, lat, lng, place_type="lodging", limit=4):
        if not self.maps_key or lat is None or lng is None:
            return []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.get(
                    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                    params={
                        "location": f"{lat},{lng}", "radius": 4000,
                        "type": place_type, "key": self.maps_key, "language": "pt-BR",
                    },
                )
                data = r.json()
        except Exception:
            return []
        out = []
        for p in data.get("results", [])[:limit]:
            out.append({
                "nome": p.get("name", ""),
                "endereco": p.get("vicinity", ""),
                "rating": p.get("rating"),
                "nivel_preco": p.get("price_level"),
            })
        return out
 
    # ── Rotas (Google Directions) ─────────────────────────────────────────────
    async def get_directions(self, origin: str, destination: str, mode: str = "driving"):
        if not self.maps_key:
            return {"ok": False, "error": "Chave google-maps não configurada."}
        mode_map = {"drive": "driving", "driving": "driving", "walking": "walking",
                    "transit": "transit", "bicycling": "bicycling"}
        g_mode = mode_map.get(mode, "driving")
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(
                    "https://maps.googleapis.com/maps/api/directions/json",
                    params={"origin": origin, "destination": destination,
                            "mode": g_mode, "language": "pt-BR", "key": self.maps_key},
                )
                data = r.json()
        except Exception as e:
            return {"ok": False, "error": f"Exceção Google Maps: {str(e)}"}
 
        if data.get("status") != "OK" or not data.get("routes"):
            return {"ok": False, "status": data.get("status"),
                    "error": data.get("error_message", f"Rota não encontrada ({data.get('status')})")}
 
        route = data["routes"][0]
        leg = route["legs"][0]
        def strip_html(t): return re.sub(r"<[^>]+>", " ", t or "").replace("  ", " ").strip()
        steps = [{"instrucao": strip_html(s.get("html_instructions", "")),
                  "distancia": s.get("distance", {}).get("text", ""),
                  "duracao": s.get("duration", {}).get("text", "")}
                 for s in leg.get("steps", [])[:10]]
        return {
            "ok": True, "mode": g_mode,
            "origin_address": leg.get("start_address", origin),
            "destination_address": leg.get("end_address", destination),
            "distance": leg.get("distance", {}).get("text", "N/A"),
            "duration": leg.get("duration", {}).get("text", "N/A"),
            "duration_value": leg.get("duration", {}).get("value", 0),
            "start_location": leg.get("start_location", {}),
            "end_location": leg.get("end_location", {}),
            "polyline": route.get("overview_polyline", {}).get("points", ""),
            "steps": steps,
        }
 
    def build_static_map_url(self, polyline: str, start: dict, end: dict):
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
 
    # ── Motor de roteiro ──────────────────────────────────────────────────────
    async def build_itinerary(self, event: dict, origin: str = None):
        """
        Monta um roteiro completo: hotéis, restaurantes, agenda com tempos
        de deslocamento e custo médio estimado.
        """
        title = event.get("title") or event.get("evento", "Evento")
        city  = event.get("city", "")
        venue = event.get("venue", "")
        lat   = event.get("lat")
        lng   = event.get("lng")
 
        # Resolve coordenadas se não vierem
        if (lat is None or lng is None):
            geo = await self.geocode(f"{venue}, {city}" if venue else city)
            if geo:
                lat, lng = geo["lat"], geo["lng"]
 
        hotels      = await self.nearby_places(lat, lng, "lodging", 4)
        restaurants = await self.nearby_places(lat, lng, "restaurant", 4)
 
        # Tempo de deslocamento (origem → estádio) se origem informada
        travel = None
        if origin and (lat is not None):
            travel = await self.get_directions(origin, f"{lat},{lng}", "transit")
 
        # Agenda: tenta Gemini, senão template fixo
        agenda = await self._itinerary_agenda_ai(title, city, venue, event.get("time", "19:00"))
        if not agenda:
            agenda = self._itinerary_agenda_fixed(event.get("time", "19:00"), venue or city)
 
        return {
            "ok": True,
            "event": {"title": title, "city": city, "venue": venue,
                      "date": event.get("date", ""), "time": event.get("time", ""),
                      "lat": lat, "lng": lng},
            "hotels": hotels,
            "restaurants": restaurants,
            "travel": travel,
            "agenda": agenda,
            "custo_medio": self._cost_estimate(city),
        }
 
    async def _itinerary_agenda_ai(self, title, city, venue, event_time):
        prompt = (
            f"Monte uma agenda de 1 dia para quem vai ao evento '{title}' em {venue or city}, {city}, "
            f"com início às {event_time}. Responda APENAS JSON (array), sem markdown:\n"
            '[{"hora":"08:00","atividade":"...","detalhe":"...","tipo":"hotel|transporte|alimentacao|evento|turismo"}]'
        )
        txt = await self.generate_ai(prompt, 700)
        if not txt:
            return None
        try:
            m = re.search(r"\[[\s\S]*\]", txt)
            return json.loads(m.group(0)) if m else None
        except Exception:
            return None
 
    def _itinerary_agenda_fixed(self, event_time, venue):
        return [
            {"hora": "08:30", "atividade": "Café da manhã no hotel", "detalhe": "Comece bem o dia", "tipo": "hotel"},
            {"hora": "10:30", "atividade": "Passeio pela cidade", "detalhe": "Pontos turísticos próximos", "tipo": "turismo"},
            {"hora": "13:00", "atividade": "Almoço", "detalhe": "Restaurante local recomendado", "tipo": "alimentacao"},
            {"hora": "15:30", "atividade": "Retorno ao hotel / descanso", "detalhe": "Prepare-se para o evento", "tipo": "hotel"},
            {"hora": "16:30", "atividade": f"Deslocamento até {venue}", "detalhe": "Saia com antecedência", "tipo": "transporte"},
            {"hora": (event_time or "19:00"), "atividade": "Evento", "detalhe": "Aproveite!", "tipo": "evento"},
        ]
 
    def _cost_estimate(self, city):
        caros = ["new york", "london", "londres", "los angeles", "san francisco", "tóquio", "tokyo"]
        if any(c in (city or "").lower() for c in caros):
            return "USD 250–450 / pessoa / dia"
        return "USD 150–300 / pessoa / dia"
