import asyncio
import logging
import httpx
from pydantic import ValidationError
from config import Settings
from email_service import Delivery, send

log = logging.getLogger("synkro.worker")

class Worker:
    def __init__(self, config: Settings):
        self.config = config
        self.cursor = 0
        self.stop = asyncio.Event()
        self.last_cycle_ok = False
        self.client = httpx.AsyncClient(base_url=config.node_api_url, timeout=config.timeout,
            headers={"X-Synkro-Service": config.internal_secret})

    async def post(self, path, data):
        response = await self.client.post("/api/internal/notifications" + path, json=data)
        response.raise_for_status()
        return response.json()

    async def process(self, job):
        ident, token = job["id"], job["claimToken"]
        prepared = await self.post(f"/{ident}/prepare", {"claimToken": token})
        if prepared["data"] is None:
            return
        try:
            payload = Delivery.model_validate(prepared["data"])
            result, diagnostic = await asyncio.to_thread(send, payload, self.config)
        except ValidationError:
            result, diagnostic = "permanent", "INVALID_PAYLOAD"
        # Solo la confirmación se reintenta. Nunca repetir SMTP aquí.
        for attempt in range(3):
            try:
                await self.post(f"/{ident}/complete", {"claimToken": token, "result": result, "diagnostic": diagnostic})
                return
            except httpx.HTTPError:
                if attempt < 2:
                    await asyncio.sleep(0.25 * 2 ** attempt)
        log.warning("Confirmación pendiente; el lease se resolverá como unknown")

    async def cycle(self):
        self.cursor = (await self.post("/plan", {"afterId": self.cursor}))["nextCursor"]
        # Un trabajo por reclamo evita expirar lotes mientras espera SMTP.
        jobs = (await self.post("/claim", {"limit": 1}))["data"]
        for job in jobs:
            await self.process(job)

    async def run(self):
        while not self.stop.is_set():
            try:
                await self.cycle()
                self.last_cycle_ok = True
            except (httpx.HTTPError, ValueError, KeyError):
                self.last_cycle_ok = False
                log.warning("Ciclo no disponible; se conserva el registro durable")
            try:
                await asyncio.wait_for(self.stop.wait(), timeout=self.config.interval)
            except TimeoutError:
                pass

    async def close(self):
        await self.client.aclose()
