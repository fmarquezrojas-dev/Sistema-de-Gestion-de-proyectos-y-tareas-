# notification-service/email_service.py
import asyncio

async def send_due_task_reminder(payload):
    """
    Simula el envío de un correo electrónico.
    Aquí es donde luego configurarás SendGrid, Mailgun o SMTP.
    """
    # Simulamos un pequeño retraso de red
    await asyncio.sleep(1) 
    
    print(f"🚀 [Email Sent] {payload.alert_type.upper()}")
    print(f"📧 Para: {payload.user_name} <{payload.user_email}>")
    print(f"📝 Tarea: {payload.task_title}")
    print(f"📅 Fecha límite: {payload.due_date}")
    print(f"📁 Proyecto: {payload.project_name or 'N/A'}")
    print("-" * 30)
    
    return True