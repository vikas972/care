from typing import Any

from app.services.exotel import initiate_connect_call
from app.services.twilio_call import initiate_twilio_call


def initiate_provider_call(
    *,
    provider: str,
    customer_number: str,
    custom_field: dict[str, Any],
) -> tuple[str | None, str | None, str]:
    """
    Dispatch outbound voice to Exotel or Twilio. Returns (call_sid, error, provider_used).
    """
    p = (provider or "exotel").strip().lower()
    if p == "twilio":
        sid, err = initiate_twilio_call(customer_number=customer_number, custom_field=custom_field)
        return sid, err, "twilio"
    sid, err = initiate_connect_call(customer_number=customer_number, custom_field=custom_field)
    return sid, err, "exotel"
