import asyncio
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
import os

# URL de tu API Node.js
NODE_API_URL  = os.getenv("NODE_API_URL", "http://localhost:3000")
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN")  # Token secreto para requests internos

async def check_upcoming_tasks():
    """Escanea tareas que vencen en las próximas 24 horas y envía alertas."""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{NODE_API_URL}/api/internal/tasks/due-soon",
            headers={"Authorization": f"Bearer {INTERNAL_TOKEN}"}
        )
        tasks = res.json().get("data", [])

        for task in tasks:
            await client.post(
                "http://localhost:8000/notify/task-alert",
                json={
                    "user_email":   task["assignee"]["email"],
                    "user_name":    task["assignee"]["name"],
                    "task_title":   task["title"],
                    "task_id":      task["id"],
                    "project_name": task.get("project", {}).get("name"),
                    "due_date":     task["dueDate"],
                    "alert_type":   "due_soon",
                }
            )

scheduler = AsyncIOScheduler()
scheduler.add_job(check_upcoming_tasks, "cron", hour=9, minute=0)  # Todos los días a las 9am
scheduler.start()