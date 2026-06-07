"""
  - Photon (autocomplete)        https://photon.komoot.io
  - Nominatim/OSM (geocoding)    https://nominatim.openstreetmap.org
  - OSRM (rotas)                 https://router.project-osrm.org
  - Overpass/OSM (locais)        https://overpass-api.de
Eventos: API-Football (Copa) + Ticketmaster.
IA opcional: Gemini (com fallback de lógica fixa).
"""

import httpx
import os
import json
import re
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

UA = {"User-Agent": "ACES-UrbanFlow/1.0 (event logistics)"}

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
        self.gemini_key       = env("GEMINI_KEY", "GOOGLE_API_KEY")

    def status(self):
        return {
            "gemini":           bool(self.gemini_key),
            "API_FOOTBALL_KEY": bool(self.football_key),
            "TICKETMASTER_KEY": bool(self.ticketmaster_key),
            "OPENWEATHER_KEY":  bool(self.weather_key),
            "location":         "OSM/Photon/OSRM (grátis, sem chave)",
        }

    # ── IA opcional (Gemini) ──────────────────────────────────────────────────
    async def generate_ai(self, prompt: str, max_tokens: int = 700):
        if not self.gemini_key:
            return None
        url = ("https://generativelanguage.googleapis.com/v1beta/models/"
               "gemini-1.5-flash:generateContent?key=" + self.gemini_key)
        payload = {"contents": [{"parts": [{"text": prompt}]}],
                   "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7}}
        try:
            async with httpx.AsyncClient(timeout=30.0) as c:
                r = await c.post(url, json=payload)
                if r.status_code != 200:
                    return None
                return r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            return None

    # ── AUTOCOMPLETE (Photon — grátis, com coordenadas) ───────────────────────
    async def places_autocomplete(self, q: str, kind: str = "geocode"):
        q = (q or "").strip()
        if len(q) < 2:
            return {"ok": True, "source": "empty", "data": []}
        params = {"q": q, "limit": 8}
        if kind == "city":
            params["osm_tag"] = "place:city"
        try:
            async with httpx.AsyncClient(timeout=15.0, headers=UA) as c:
                r = await c.get("https://photon.komoot.io/api/", params=params)
                data = r.json()
        except Exception:
            return {"ok": True, "source": "error", "data": []}

        out = []
        seen = set()
        for f in data.get("features", []):
            p = f.get("properties", {})
            coords = f.get("geometry", {}).get("coordinates", [None, None])
            parts = [p.get("name"), p.get("city"), p.get("state"), p.get("country")]
            label = ", ".join([x for x in parts if x])
            if not label or label in seen:
                continue
            seen.add(label)
            out.append({
                "label": label,
                "lat": coords[1] if len(coords) > 1 else None,
                "lng": coords[0] if coords else None,
                "country": p.get("country"),
                "city": p.get("city") or p.get("name"),
            })
        return {"ok": True, "source": "photon", "data": out}

    # ── GEOCODING (Nominatim — grátis) ────────────────────────────────────────
    async def geocode(self, query: str):
        if not query:
            return None
        # Já é "lat,lng"?
        m = re.match(r"^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$", query)
        if m:
            return {"lat": float(m.group(1)), "lng": float(m.group(2)), "address": query}
        try:
            async with httpx.AsyncClient(timeout=15.0, headers=UA) as c:
                r = await c.get("https://nominatim.openstreetmap.org/search",
                                params={"q": query, "format": "json", "limit": 1})
                arr = r.json()
            if arr:
                return {"lat": float(arr[0]["lat"]), "lng": float(arr[0]["lon"]),
                        "address": arr[0].get("display_name", query)}
        except Exception:
            pass
        return None

    # ── LOCAIS PRÓXIMOS (Overpass/OSM — grátis) ───────────────────────────────
    async def nearby_places(self, lat, lng, kind="hotel", limit=4):
        if lat is None or lng is None:
            return []
        tag = 'tourism"="hotel' if kind == "hotel" else 'amenity"="restaurant'
        query = (f'[out:json][timeout:15];('
                 f'node["{tag}"](around:3500,{lat},{lng});'
                 f'way["{tag}"](around:3500,{lat},{lng}););out center {limit*3};')
        try:
            async with httpx.AsyncClient(timeout=25.0, headers=UA) as c:
                r = await c.post("https://overpass-api.de/api/interpreter", data={"data": query})
                data = r.json()
        except Exception:
            return []
        out = []
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            name = tags.get("name")
            if not name:
                continue
            addr = ", ".join([x for x in [tags.get("addr:street"), tags.get("addr:housenumber")] if x])
            out.append({"nome": name, "endereco": addr or tags.get("addr:city", ""),
                        "rating": tags.get("stars")})
            if len(out) >= limit:
                break
        return out

    # ── ROTAS (geocode + OSRM — grátis) ───────────────────────────────────────
    async def get_directions(self, origin: str, destination: str, mode: str = "driving"):
        o = await self.geocode(origin)
        d = await self.geocode(destination)
        if not o or not d:
            return {"ok": False, "error": "Não foi possível localizar origem/destino."}
        try:
            async with httpx.AsyncClient(timeout=20.0, headers=UA) as c:
                url = (f"https://router.project-osrm.org/route/v1/driving/"
                       f"{o['lng']},{o['lat']};{d['lng']},{d['lat']}"
                       f"?overview=full&geometries=geojson&steps=true")
                r = await c.get(url)
                data = r.json()
        except Exception as e:
            return {"ok": False, "error": f"Exceção OSRM: {str(e)}"}

        if data.get("code") != "Ok" or not data.get("routes"):
            return {"ok": False, "error": "Rota não encontrada."}

        route = data["routes"][0]
        dist_km = route["distance"] / 1000.0
        car_min = route["duration"] / 60.0
        # Duração estimada por modo
        speeds = {"walking": 5, "bicycling": 15}
        if mode in speeds:
            dur_min = dist_km / speeds[mode] * 60
        elif mode == "transit":
            dur_min = car_min * 1.4
        else:
            dur_min = car_min

        def fmt(mins):
            h, m = int(mins // 60), int(mins % 60)
            return (f"{h} h {m} min" if h else f"{m} min")

        # geometry GeoJSON [lng,lat] → [lat,lng] para Leaflet
        geo = [[c[1], c[0]] for c in route.get("geometry", {}).get("coordinates", [])]

        # Passos simplificados
        steps = []
        for leg in route.get("legs", []):
            for s in leg.get("steps", [])[:12]:
                man = s.get("maneuver", {})
                nome = s.get("name") or ""
                t = man.get("type", "")
                instr = {"turn": "Vire", "depart": "Siga", "arrive": "Chegue ao destino",
                         "continue": "Continue", "roundabout": "Na rotatória",
                         "merge": "Entre", "fork": "Mantenha"}.get(t, "Siga")
                if nome:
                    instr += f" em {nome}"
                steps.append({"instrucao": instr,
                              "distancia": f"{s.get('distance',0)/1000:.1f} km", "duracao": ""})

        return {
            "ok": True, "mode": mode,
            "origin_address": o["address"], "destination_address": d["address"],
            "distance": f"{dist_km:.1f} km", "duration": fmt(dur_min),
            "start_location": {"lat": o["lat"], "lng": o["lng"]},
            "end_location": {"lat": d["lat"], "lng": d["lng"]},
            "geometry": geo, "steps": steps[:8],
        }

    # ── CLIMA ──────────────────────────────────────────────────────────────────
    async def get_weather(self, city: str):
        if not self.weather_key:
            return {"weather": [{"main": "N/A", "description": "indisponível"}]}
        try:
            async with httpx.AsyncClient(timeout=15.0) as c:
                r = await c.get("https://api.openweathermap.org/data/2.5/weather",
                                params={"q": city, "appid": self.weather_key,
                                        "units": "metric", "lang": "pt"})
                if r.status_code == 200:
                    return r.json()
        except Exception:
            pass
        return {"weather": [{"main": "N/A", "description": "indisponível"}]}

    # ── COPA 2026 (API-Football) ──────────────────────────────────────────────
    async def get_world_cup_fixtures(self, season: int = 2026):
        if not self.football_key:
            return {"ok": False, "error": "API_FOOTBALL_KEY ausente", "data": []}
        try:
            async with httpx.AsyncClient(timeout=20.0) as c:
                r = await c.get("https://v3.football.api-sports.io/fixtures",
                                headers={"x-apisports-key": self.football_key},
                                params={"league": 1, "season": season})
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
            home = teams.get("home", {}).get("name", "A definir")
            away = teams.get("away", {}).get("name", "A definir")
            di = fixture.get("date", "")
            city = (venue.get("city") or "").strip()
            coords = WC_VENUES.get(city.lower())
            events.append({
                "id": "fx" + str(fixture.get("id", "")),
                "cat": "Futebol", "evento": "Copa do Mundo FIFA 2026",
                "title": f"{home} x {away}", "home": home, "away": away,
                "date": di[:10] if di else "", "time": di[11:16] if len(di) > 16 else "",
                "city": city or "A definir", "country": "EUA / Canadá / México",
                "venue": venue.get("name") or (coords[2] if coords else "Estádio"),
                "lat": coords[0] if coords else None, "lng": coords[1] if coords else None,
                "phase": fx.get("league", {}).get("round", "Fase de grupos"),
            })
        return {"ok": True, "count": len(events), "data": events}

    # ── TICKETMASTER (com janela de datas) ────────────────────────────────────
    async def get_ticketmaster(self, city=None, country_code=None, keyword=None,
                               lat=None, lng=None, size=20, classification=None,
                               years_ahead=2):
        if not self.ticketmaster_key:
            return {"ok": False, "error": "TICKETMASTER_KEY ausente", "data": []}
        now = datetime.utcnow()
        end = now + timedelta(days=365 * years_ahead)
        params = {
            "apikey": self.ticketmaster_key, "size": size, "sort": "date,asc", "locale": "*",
            "startDateTime": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "endDateTime": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        if city:           params["city"] = city
        if country_code:   params["countryCode"] = country_code
        if keyword:        params["keyword"] = keyword
        if classification: params["classificationName"] = classification
        if lat and lng:
            params["latlong"] = f"{lat},{lng}"; params["radius"] = 150; params["unit"] = "km"
        try:
            async with httpx.AsyncClient(timeout=20.0) as c:
                r = await c.get("https://app.ticketmaster.com/discovery/v2/events.json", params=params)
                raw = r.json()
        except Exception as e:
            return {"ok": False, "error": str(e), "data": []}

        data = []
        for ev in (raw.get("_embedded", {}) or {}).get("events", []):
            venue = (ev.get("_embedded", {}).get("venues", [{}]) or [{}])[0]
            dates = ev.get("dates", {}).get("start", {})
            loc = venue.get("location", {}) or {}
            cls = (ev.get("classifications", [{}]) or [{}])[0]
            data.append({
                "id": "tm" + str(ev.get("id", "")),
                "cat": cls.get("segment", {}).get("name", "Evento"),
                "evento": ev.get("name", "Evento"), "title": ev.get("name", "Evento"),
                "home": ev.get("name", "Evento"), "away": "",
                "date": dates.get("localDate", ""), "time": (dates.get("localTime", "") or "")[:5],
                "city": venue.get("city", {}).get("name", city or ""),
                "country": venue.get("country", {}).get("name", ""),
                "venue": venue.get("name", ""),
                "lat": float(loc["latitude"]) if loc.get("latitude") else None,
                "lng": float(loc["longitude"]) if loc.get("longitude") else None,
                "phase": cls.get("genre", {}).get("name", "Show / Evento"),
                "url": ev.get("url", ""),
            })
        return {"ok": True, "count": len(data), "data": data}

    async def get_real_events(self, city=None, country_code=None, keyword=None, lat=None, lng=None):
        result = {"futebol": [], "outros": []}
        wc = await self.get_world_cup_fixtures()
        if wc.get("ok"):
            result["futebol"] = wc["data"]
        tm = await self.get_ticketmaster(city=city, country_code=country_code,
                                         keyword=keyword, lat=lat, lng=lng)
        if tm.get("ok"):
            result["outros"] = tm["data"]
        return result

    # ── RECOMENDAÇÕES (robusto, nunca vazio) ──────────────────────────────────
    async def get_recommendations(self, lat=None, lng=None):
        recs = []
        wc = await self.get_world_cup_fixtures()
        if wc.get("ok") and wc["data"]:
            recs += wc["data"][:3]
        # Grandes shows de música
        music = await self.get_ticketmaster(classification="Music", lat=lat, lng=lng, size=10)
        if music.get("ok"):
            recs += music["data"][:6]
        # Esportes em geral (se ainda pouco)
        if len(recs) < 4:
            sports = await self.get_ticketmaster(classification="Sports", lat=lat, lng=lng, size=8)
            if sports.get("ok"):
                recs += sports["data"][:5]
        # Fallback final: eventos quaisquer próximos
        if len(recs) < 3:
            any_ev = await self.get_ticketmaster(lat=lat, lng=lng, size=8)
            if any_ev.get("ok"):
                recs += any_ev["data"][:6]
        return {"ok": True, "count": len(recs), "data": recs}

    # ── ROTEIRO ────────────────────────────────────────────────────────────────
    async def build_itinerary(self, event: dict, origin: str = None):
        title = event.get("title") or event.get("evento", "Evento")
        city, venue = event.get("city", ""), event.get("venue", "")
        lat, lng = event.get("lat"), event.get("lng")
        if lat is None or lng is None:
            geo = await self.geocode(f"{venue}, {city}" if venue else city)
            if geo:
                lat, lng = geo["lat"], geo["lng"]

        hotels = await self.nearby_places(lat, lng, "hotel", 4)
        restaurants = await self.nearby_places(lat, lng, "restaurant", 4)
        travel = None
        if origin and lat is not None:
            travel = await self.get_directions(origin, f"{lat},{lng}", "transit")

        agenda = await self._agenda_ai(title, city, venue, event.get("time", "19:00"))
        if not agenda:
            agenda = self._agenda_fixed(event.get("time", "19:00"), venue or city)

        return {"ok": True,
                "event": {"title": title, "city": city, "venue": venue,
                          "date": event.get("date", ""), "time": event.get("time", ""),
                          "lat": lat, "lng": lng},
                "hotels": hotels, "restaurants": restaurants, "travel": travel,
                "agenda": agenda, "custo_medio": self._cost(city)}

    async def _agenda_ai(self, title, city, venue, t):
        txt = await self.generate_ai(
            f"Monte uma agenda de 1 dia para o evento '{title}' em {venue or city}, {city}, "
            f"início às {t}. Responda APENAS JSON array, sem markdown:\n"
            '[{"hora":"08:00","atividade":"...","detalhe":"...","tipo":"hotel|transporte|alimentacao|evento|turismo"}]', 700)
        if not txt:
            return None
        try:
            m = re.search(r"\[[\s\S]*\]", txt)
            return json.loads(m.group(0)) if m else None
        except Exception:
            return None

    def _agenda_fixed(self, t, venue):
        return [
            {"hora": "08:30", "atividade": "Café da manhã no hotel", "detalhe": "Comece bem o dia", "tipo": "hotel"},
            {"hora": "10:30", "atividade": "Passeio pela cidade", "detalhe": "Pontos turísticos próximos", "tipo": "turismo"},
            {"hora": "13:00", "atividade": "Almoço", "detalhe": "Restaurante local recomendado", "tipo": "alimentacao"},
            {"hora": "15:30", "atividade": "Descanso no hotel", "detalhe": "Prepare-se para o evento", "tipo": "hotel"},
            {"hora": "16:30", "atividade": f"Deslocamento até {venue}", "detalhe": "Saia com antecedência", "tipo": "transporte"},
            {"hora": (t or "19:00"), "atividade": "Evento", "detalhe": "Aproveite!", "tipo": "evento"},
        ]

    def _cost(self, city):
        caros = ["new york", "london", "londres", "los angeles", "san francisco", "tokyo", "tóquio", "zurich"]
        return "USD 250–450 / pessoa / dia" if any(c in (city or "").lower() for c in caros) else "USD 150–300 / pessoa / dia"
