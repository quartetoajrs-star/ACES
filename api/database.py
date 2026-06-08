import httpx
import os

# Estas variáveis virão do painel de controle do Render
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

class Database:
    def __init__(self):
        self.headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    async def fetch_events(self):
        """Busca todos os eventos da tabela 'events' no Supabase."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/events?select=*",
                headers=self.headers
            )
            return response.json() if response.status_code == 200 else []

    async def fetch_event_pois(self, event_id: str):
        """Busca os POIs associados a um evento específico."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/pois?event_id=eq.{event_id}&select=*",
                headers=self.headers
            )
            return response.json() if response.status_code == 200 else []
        async def salvar_roteiro(self, email, titulo, dados):
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/roteiros",
            headers=self.headers,
            json={"usuario_email": email, "titulo": titulo, "dados": dados},
        )
        return r.json()
    async def salvar_roteiro(self, email, titulo, dados):
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/roteiros",
            headers=self.headers,
            json={"usuario_email": email, "titulo": titulo, "dados": dados},
        )
        return r.json()

async def listar_roteiros(self, email):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/roteiros?usuario_email=eq.{email}&select=*",
            headers=self.headers,
        )
        return r.json() if r.status_code == 200 else []

# Instanciamos o objeto db para ser importado pelo main.py
db = Database()
