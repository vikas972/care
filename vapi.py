import os
import requests

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv()


VAPI_KEY = os.environ["VAPI_PRIVATE_KEY"]
print(VAPI_KEY)
print(os.environ.get("VAPI_ASSISTANT_ID"))
print(os.environ.get("VAPI_PHONE_NUMBER_ID"))

def start_call(customer_number: str):
    url = "https://api.vapi.ai/call"
    payload = {
        "assistantId": os.environ.get("VAPI_ASSISTANT_ID"),
        "phoneNumberId": os.environ.get("VAPI_PHONE_NUMBER_ID"),
        "customer": {"number": customer_number},
    }

    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {VAPI_KEY}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )

    if not r.ok:
        print("Status:", r.status_code)
        print("Response text:", r.text)  # <- shows the actual validation error
    r.raise_for_status()
    return r.json()

print(start_call("+919136509352"))