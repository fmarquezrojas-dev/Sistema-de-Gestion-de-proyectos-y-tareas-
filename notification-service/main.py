from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from email_service import send_due_task_reminder
from typing import Optional

app = FastAPI(title="SYNKRO Notification Service")

class TaskAlertPayload(BaseModel):
    user_email: str
    user_name:  str
    task_title: str
    task_id:    int
    project_name: Optional[str] = None
    due_date:   str
    alert_type: str  # "due_soon" | "overdue" | "assigned"

@app.post("/notify/task-alert")
async def send_task_alert(payload: TaskAlertPayload):
    try:
        await send_due_task_reminder(payload)
        return {"status": "sent", "to": payload.user_email}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}