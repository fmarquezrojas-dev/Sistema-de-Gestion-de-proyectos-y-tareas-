import os
from urllib.parse import urlsplit
from pydantic import BaseModel, Field, field_validator, model_validator

class Settings(BaseModel):
    node_api_url: str = "http://backend:3000"
    internal_secret: str = Field(min_length=32)
    frontend_url: str = "http://localhost:5173"
    smtp_host: str = "mailpit"
    smtp_port: int = Field(default=1025, ge=1, le=65535)
    smtp_from: str = "synkro@example.invalid"
    smtp_starttls: bool = False
    smtp_user: str = ""
    smtp_password: str = ""
    interval: float = Field(default=15, ge=1, le=300)
    timeout: float = Field(default=5, ge=1, le=10)

    @field_validator("node_api_url", "frontend_url")
    @classmethod
    def url(cls, value):
        parsed = urlsplit(value)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("URL HTTP(S) sin credenciales requerida")
        return value.rstrip("/")

    @field_validator("smtp_from")
    @classmethod
    def address(cls, value):
        import re
        if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", value):
            raise ValueError("Dirección inválida")
        return value

    @model_validator(mode="after")
    def credentials(self):
        if bool(self.smtp_user) != bool(self.smtp_password) or (self.smtp_user and not self.smtp_starttls):
            raise ValueError("Credenciales SMTP requieren STARTTLS")
        return self

    @classmethod
    def load(cls):
        mapping = {"node_api_url": "NODE_API_URL", "internal_secret": "NOTIFICATION_INTERNAL_SECRET", "frontend_url": "FRONTEND_URL", "interval": "NOTIFICATION_INTERVAL_SECONDS", "timeout": "NETWORK_TIMEOUT_SECONDS"}
        values = {name: os.environ[mapping.get(name, name.upper())] for name in cls.model_fields if mapping.get(name, name.upper()) in os.environ}
        try:
            return cls(**values)
        except ValueError:
            raise RuntimeError("Configuración de notificaciones inválida; revisa variables requeridas") from None
