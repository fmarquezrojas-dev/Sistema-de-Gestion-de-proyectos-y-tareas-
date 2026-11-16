import smtplib
import ssl
from email.message import EmailMessage
from email.policy import SMTP
from html import escape
from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator
from config import Settings

class Delivery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    kind: Literal["assigned", "due_soon", "overdue"]
    recipient: str
    recipientName: str = Field(max_length=200)
    title: str = Field(max_length=200)
    project: str = Field(max_length=200)
    projectId: int = Field(gt=0)
    dueDate: datetime | None
    messageId: str

    @field_validator("recipient")
    @classmethod
    def address(cls, value):
        return Settings.address(value)

    @field_validator("messageId")
    @classmethod
    def message_id(cls, value):
        import re
        if not re.fullmatch(r"<[0-9a-f-]{36}@synkro\.local>", value):
            raise ValueError("Message-ID inválido")
        return value


def message(payload: Delivery, config: Settings):
    labels = {"assigned": "Tarea asignada", "due_soon": "Tarea próxima a vencer", "overdue": "Tarea vencida"}
    label = labels[payload.kind]
    # El título se presenta en el cuerpo; ninguna entrada libre forma cabeceras.
    msg = EmailMessage(policy=SMTP)
    msg["Subject"] = f"SYNKRO · {label}"
    msg["From"] = config.smtp_from
    msg["To"] = payload.recipient
    msg["Message-ID"] = payload.messageId
    due = payload.dueDate.isoformat() if payload.dueDate else "Sin vencimiento"
    url = f"{config.frontend_url}/projects/{payload.projectId}"
    text = f"{label}\nProyecto: {payload.project}\nTarea: {payload.title}\nVencimiento: {due}\n{url}"
    msg.set_content(text)
    msg.add_alternative(f"<h2>{escape(label)}</h2><p>Proyecto: {escape(payload.project)}</p><p>Tarea: {escape(payload.title)}</p><p>Vencimiento: {escape(due)}</p><a href=\"{escape(url, quote=True)}\">Abrir proyecto</a>", subtype="html")
    return msg


def send(payload: Delivery, config: Settings):
    smtp = None
    transmitting = False
    try:
        content = message(payload, config).as_bytes()
        smtp = smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=config.timeout)
        smtp.ehlo_or_helo_if_needed()
        if config.smtp_starttls:
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        if config.smtp_user:
            smtp.login(config.smtp_user, config.smtp_password)
        for code, _ in [smtp.mail(config.smtp_from), smtp.rcpt(payload.recipient)]:
            if code >= 400:
                return ("temporary", "SMTP_TEMPORARY") if code < 500 else ("permanent", "SMTP_PERMANENT")
        transmitting = True
        code, _ = smtp.data(content)
        if code == 250:
            return "accepted", "SMTP_ACCEPTED"
        return ("temporary", "SMTP_TEMPORARY") if 400 <= code < 500 else ("permanent", "SMTP_PERMANENT")
    except smtplib.SMTPResponseException as exc:
        return ("temporary", "SMTP_TEMPORARY") if 400 <= exc.smtp_code < 500 else ("permanent", "SMTP_PERMANENT")
    except (OSError, smtplib.SMTPException):
        return ("unknown", "SMTP_UNCERTAIN") if transmitting else ("temporary", "SMTP_TEMPORARY")
    except (ValueError, UnicodeError):
        return "permanent", "INVALID_PAYLOAD"
    finally:
        # close no puede convertir una aceptación en un reintento por fallo de QUIT.
        if smtp:
            try:
                smtp.close()
            except OSError:
                pass
