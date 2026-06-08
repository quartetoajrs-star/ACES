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
            "Prefer": "return=representation",
        }
 
    def _ok(self):
        """Só tenta usar o banco se as credenciais existirem."""
        return bool(SUPABASE_URL and SUPABASE_KEY)
 
    # ── Eventos (legado) ──────────────────────────────────────────────────────
    async def fetch_events(self):
        """Busca todos os eventos da tabela 'events' no Supabase."""
        if not self._ok():
            return []
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/events?select=*",
                headers=self.headers,
            )
            return response.json() if response.status_code == 200 else []
 
    async def fetch_event_pois(self, event_id: str):
        """Busca os POIs associados a um evento específico."""
        if not self._ok():
            return []
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/pois?event_id=eq.{event_id}&select=*",
                headers=self.headers,
            )
            return response.json() if response.status_code == 200 else []
 
    # ── Roteiros ──────────────────────────────────────────────────────────────
    async def salvar_roteiro(self, email, titulo, dados):
        """Grava um roteiro do usuário na tabela 'roteiros'."""
        if not self._ok():
            return {"error": "Supabase não configurado"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{SUPABASE_URL}/rest/v1/roteiros",
                headers=self.headers,
                json={"usuario_email": email, "titulo": titulo, "dados": dados},
            )
            return r.json() if r.status_code in (200, 201) else {"error": r.text}
 
    async def listar_roteiros(self, email):
        """Lista os roteiros de um usuário."""
        if not self._ok():
            return []
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"{SUPABASE_URL}/rest/v1/roteiros?usuario_email=eq.{email}&select=*",
                headers=self.headers,
            )
            return r.json() if r.status_code == 200 else []
 
    async def excluir_roteiro(self, roteiro_id):
        """Exclui um roteiro pelo id."""
        if not self._ok():
            return {"error": "Supabase não configurado"}
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.delete(
                f"{SUPABASE_URL}/rest/v1/roteiros?id=eq.{roteiro_id}",
                headers=self.headers,
            )
            return {"ok": r.status_code in (200, 204)}
 
 
# Instanciamos o objeto db para ser importado pelo main.py
db = Database()
