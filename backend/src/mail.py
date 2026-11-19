import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

from .alerts import DEFAULT_ALERT_EMAIL, Mail

logger = logging.getLogger("soulmap.watch")


def alert_recipient() -> str:
    return os.getenv("ALERT_EMAIL", DEFAULT_ALERT_EMAIL) or DEFAULT_ALERT_EMAIL


def send_mail(mail: Mail) -> bool:
    host = os.getenv("SMTP_HOST", "")
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    recipient = alert_recipient()
    sender = os.getenv("SMTP_FROM", "") or user or recipient
    port = int(os.getenv("SMTP_PORT", "587") or "587")
    if not host or not user or not password:
        logger.error("alert_email_skipped key=%s recipient=%s", mail.key, recipient)
        return False

    message = EmailMessage()
    message["Subject"] = mail.subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(mail.body)
    try:
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(user, password)
            smtp.send_message(message)
    except Exception as exc:
        logger.error("alert_email_failed key=%s error=%s", mail.key, type(exc).__name__)
        return False
    logger.info("alert_sent key=%s recipient=%s", mail.key, recipient)
    return True
