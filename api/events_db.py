"""
api/events_db.py
Banco de dados curado de grandes eventos mundiais (o "pulo do gato").
Garante que o site sempre tenha conteúdo real e relevante, mesmo quando as
APIs externas não retornam. Eventos com múltiplas sessões (Copa, festivais)
trazem a lista de sub-eventos selecionáveis.
"""

# ── Sedes/coordenadas da Copa 2026 ────────────────────────────────────────────
_WC = {
    "MetLife Stadium":            ("New York/New Jersey", "EUA",    40.8128, -74.0742),
    "SoFi Stadium":               ("Los Angeles", "EUA",            33.9535, -118.3392),
    "AT&T Stadium":               ("Dallas", "EUA",                 32.7473, -97.0945),
    "Hard Rock Stadium":          ("Miami", "EUA",                  25.9580, -80.2389),
    "Mercedes-Benz Stadium":      ("Atlanta", "EUA",                33.7553, -84.4006),
    "Lincoln Financial Field":    ("Philadelphia", "EUA",           39.9008, -75.1675),
    "Arrowhead Stadium":          ("Kansas City", "EUA",            39.0489, -94.4839),
    "Lumen Field":                ("Seattle", "EUA",                47.5952, -122.3316),
    "Levi's Stadium":             ("San Francisco", "EUA",          37.4030, -121.9698),
    "NRG Stadium":                ("Houston", "EUA",                29.6847, -95.4107),
    "Gillette Stadium":           ("Boston", "EUA",                 42.0909, -71.2643),
    "BMO Field":                  ("Toronto", "Canadá",             43.6332, -79.4185),
    "BC Place":                   ("Vancouver", "Canadá",           49.2768, -123.1119),
    "Estadio Azteca":             ("Cidade do México", "México",    19.3029, -99.1505),
    "Estadio Akron":              ("Guadalajara", "México",         20.6818, -103.4626),
    "Estadio BBVA":               ("Monterrey", "México",           25.6692, -100.2444),
}

# Jogos representativos da Copa 2026 (datas/sedes reais; confrontos ilustrativos
# pois o sorteio define os times). Cada um é uma SESSÃO selecionável.
_WC_MATCHES = [
    ("wc-01", "Jogo de Abertura — México vs Convidado", "2026-06-11", "20:00", "Estadio Azteca", "Grupo A"),
    ("wc-02", "Canadá vs Convidado",                     "2026-06-12", "18:00", "BMO Field", "Grupo B"),
    ("wc-03", "EUA vs Convidado",                        "2026-06-12", "20:00", "SoFi Stadium", "Grupo D"),
    ("wc-04", "Brasil vs Convidado",                     "2026-06-15", "21:00", "MetLife Stadium", "Grupo F"),
    ("wc-05", "Argentina vs Convidado",                  "2026-06-16", "18:00", "Hard Rock Stadium", "Grupo C"),
    ("wc-06", "França vs Convidado",                     "2026-06-17", "15:00", "Gillette Stadium", "Grupo E"),
    ("wc-07", "Inglaterra vs Convidado",                 "2026-06-18", "15:00", "Lincoln Financial Field", "Grupo G"),
    ("wc-08", "Espanha vs Convidado",                    "2026-06-19", "18:00", "Lumen Field", "Grupo H"),
    ("wc-09", "Alemanha vs Convidado",                   "2026-06-20", "21:00", "AT&T Stadium", "Grupo I"),
    ("wc-10", "Portugal vs Convidado",                   "2026-06-21", "15:00", "Mercedes-Benz Stadium", "Grupo J"),
    ("wc-11", "Oitavas de final — 1º A vs 2º B",         "2026-06-29", "16:00", "NRG Stadium", "Oitavas"),
    ("wc-12", "Oitavas de final — 1º C vs 2º D",         "2026-06-30", "20:00", "Arrowhead Stadium", "Oitavas"),
    ("wc-13", "Quartas de final",                        "2026-07-04", "17:00", "Levi's Stadium", "Quartas"),
    ("wc-14", "Quartas de final",                        "2026-07-05", "16:00", "AT&T Stadium", "Quartas"),
    ("wc-15", "Semifinal",                               "2026-07-14", "20:00", "Estadio Azteca", "Semifinal"),
    ("wc-16", "Semifinal",                               "2026-07-15", "20:00", "MetLife Stadium", "Semifinal"),
    ("wc-17", "Disputa de 3º lugar",                     "2026-07-18", "16:00", "Hard Rock Stadium", "3º lugar"),
    ("wc-18", "FINAL DA COPA DO MUNDO 2026",             "2026-07-19", "16:00", "MetLife Stadium", "Final"),
]

def _wc_sessions():
    out = []
    for sid, label, date, time, venue, phase in _WC_MATCHES:
        city, country, lat, lng = _WC[venue]
        out.append({
            "id": sid, "label": label, "date": date, "time": time,
            "venue": venue, "city": city, "country": country,
            "lat": lat, "lng": lng, "phase": phase, "cat": "Futebol",
        })
    return out


def _ev(eid, nome, cat, city, country, lat, lng, venue, date, time, img, desc, sessions=None):
    return {
        "id": eid, "evento": nome, "title": nome, "cat": cat,
        "home": nome, "away": "", "city": city, "country": country,
        "lat": lat, "lng": lng, "venue": venue, "date": date, "time": time,
        "image": img, "descricao": desc, "phase": "Evento",
        "sessions": sessions or [],
    }


# ── Banco curado ───────────────────────────────────────────────────────────────
CURATED = [
    # Copa do Mundo — multi-sessão (18 jogos selecionáveis)
    _ev("copa-2026", "Copa do Mundo FIFA 2026", "Futebol",
        "EUA / Canadá / México", "América do Norte", 39.8283, -98.5795,
        "16 estádios-sede", "2026-06-11", "20:00", "estadio",
        "A maior Copa da história: 48 seleções, 104 jogos em 16 cidades. Escolha um jogo para montar seu roteiro.",
        sessions=_wc_sessions()),

    # Festivais e cultura
    _ev("oktoberfest-2026", "Oktoberfest 2026", "Festival",
        "Munique", "Alemanha", 48.1314, 11.5497, "Theresienwiese",
        "2026-09-19", "10:00", "torcida",
        "O maior festival de cultura cervejeira do mundo. ~6 milhões de visitantes em Munique."),
    _ev("tomorrowland-2026", "Tomorrowland 2026", "Festival",
        "Boom", "Bélgica", 51.0890, 4.3420, "De Schorre",
        "2026-07-17", "12:00", "torcida",
        "Um dos maiores festivais de música eletrônica do planeta. ~400 mil pessoas de 200+ nacionalidades.",
        sessions=[
            {"id": "tml-w1", "label": "Fim de semana 1", "date": "2026-07-17", "time": "12:00",
             "venue": "De Schorre", "city": "Boom", "country": "Bélgica", "lat": 51.089, "lng": 4.342, "phase": "Weekend 1", "cat": "Festival"},
            {"id": "tml-w2", "label": "Fim de semana 2", "date": "2026-07-24", "time": "12:00",
             "venue": "De Schorre", "city": "Boom", "country": "Bélgica", "lat": 51.089, "lng": 4.342, "phase": "Weekend 2", "cat": "Festival"},
        ]),
    _ev("rockinrio-2026", "Rock in Rio 2026", "Festival",
        "Rio de Janeiro", "Brasil", -22.9100, -43.3960, "Parque Olímpico",
        "2026-09-04", "14:00", "torcida",
        "Um dos maiores festivais de música e entretenimento do mundo, no Rio de Janeiro.",
        sessions=[
            {"id": "rir-d1", "label": "Dia 1", "date": "2026-09-04", "time": "14:00", "venue": "Parque Olímpico", "city": "Rio de Janeiro", "country": "Brasil", "lat": -22.91, "lng": -43.396, "phase": "Dia 1", "cat": "Festival"},
            {"id": "rir-d2", "label": "Dia 2", "date": "2026-09-05", "time": "14:00", "venue": "Parque Olímpico", "city": "Rio de Janeiro", "country": "Brasil", "lat": -22.91, "lng": -43.396, "phase": "Dia 2", "cat": "Festival"},
            {"id": "rir-d3", "label": "Dia 3", "date": "2026-09-06", "time": "14:00", "venue": "Parque Olímpico", "city": "Rio de Janeiro", "country": "Brasil", "lat": -22.91, "lng": -43.396, "phase": "Dia 3", "cat": "Festival"},
        ]),
    _ev("carnaval-salvador-2026", "Carnaval de Salvador 2026", "Festival",
        "Salvador", "Brasil", -12.9777, -38.5016, "Circuitos da cidade",
        "2026-02-12", "18:00", "torcida",
        "Um dos maiores carnavais de rua do mundo, com trios elétricos e milhões de foliões."),
    _ev("carnaval-rio-2026", "Carnaval do Rio 2026", "Festival",
        "Rio de Janeiro", "Brasil", -22.9110, -43.1964, "Sambódromo da Marquês de Sapucaí",
        "2026-02-13", "21:00", "torcida",
        "Os desfiles das escolas de samba no Sambódromo e o carnaval de rua mais famoso do planeta."),

    # Conferências e feiras
    _ev("sxsw-2026", "South by Southwest (SXSW) 2026", "Conferência",
        "Austin", "EUA", 30.2672, -97.7431, "Austin Convention Center",
        "2026-03-13", "09:00", "estadio",
        "Principal encontro global de inovação, tecnologia, cinema e música, em Austin."),
    _ev("websummit-2026", "Web Summit 2026", "Conferência",
        "Lisboa", "Portugal", 38.7223, -9.1393, "Altice Arena",
        "2026-11-02", "09:00", "estadio",
        "Um dos maiores eventos de tecnologia e inovação do mundo. ~70 mil pessoas em Lisboa."),
    _ev("mwc-2026", "Mobile World Congress (MWC) 2026", "Conferência",
        "Barcelona", "Espanha", 41.3548, 2.1287, "Fira de Barcelona",
        "2026-03-02", "09:00", "estadio",
        "Maior feira de conectividade e tecnologia móvel do mundo. 100+ mil participantes."),

    # Peregrinação
    _ev("hajj-2026", "Hajj 2026", "Peregrinação",
        "Meca", "Arábia Saudita", 21.4225, 39.8262, "Masjid al-Haram",
        "2026-05-26", "00:00", "torcida",
        "O maior evento de mobilidade humana intencional do planeta: 2 a 3 milhões de peregrinos em Meca."),
]


def all_events():
    return CURATED

def find(eid):
    for e in CURATED:
        if e["id"] == eid:
            return e
        for s in e.get("sessions", []):
            if s["id"] == eid:
                # Devolve a sessão como um evento "cheio" para o roteiro
                return {**e, **s, "title": e["evento"] + " — " + s["label"],
                        "sessions": [], "image": e.get("image")}
    return None
