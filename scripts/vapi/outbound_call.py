"""Start an outbound phone call via the Vapi REST API (local/dev helper).

Requires env:
  VAPI_PRIVATE_KEY
Optional:
  VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import requests

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None


def start_call(customer_number: str) -> dict:
    key = os.environ["VAPI_PRIVATE_KEY"]
    url = "https://api.vapi.ai/call"
    payload = {
        "assistantId": os.environ.get("VAPI_ASSISTANT_ID"),
        "phoneNumberId": os.environ.get("VAPI_PHONE_NUMBER_ID"),
        "customer": {"number": customer_number},
    }

    r = requests.post(
        url,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=payload,
        timeout=30,
    )

    if not r.ok:
        print("Status:", r.status_code, file=sys.stderr)
        print("Response:", r.text, file=sys.stderr)
    r.raise_for_status()
    return r.json()


def main() -> int:
    parser = argparse.ArgumentParser(description="Place an outbound call via Vapi.")
    parser.add_argument(
        "customer_number",
        help="Destination E.164, e.g. +14155552671",
    )
    args = parser.parse_args()

    if load_dotenv is not None:
        load_dotenv()

    result = start_call(args.customer_number)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
