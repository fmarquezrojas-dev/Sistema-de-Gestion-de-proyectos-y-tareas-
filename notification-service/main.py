import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from config import Settings
from scheduler import Worker

@asynccontextmanager
async def lifespan(app: FastAPI):
    worker = Worker(Settings.load())
    app.state.worker = worker
    task = asyncio.create_task(worker.run())
    try:
        yield
    finally:
        worker.stop.set()
        # Terminar el ciclo actual antes de cerrar HTTP; SMTP tiene timeout acotado.
        await task
        await worker.close()

app = FastAPI(title="SYNKRO Notificaciones", lifespan=lifespan)

@app.get("/health/live")
def live():
    return {"status": "alive", "smtpVerified": False}

@app.get("/health/status")
def status():
    return {"lastCycleOk": app.state.worker.last_cycle_ok, "smtpVerified": False}
