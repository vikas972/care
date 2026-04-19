from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

app = FastAPI()

@app.post("/vapi/webhook")
async def vapi_webhook(request: Request):
    body = await request.json()
    msg = body.get("message", {})

    if msg.get("type") == "tool-calls":
        tool_calls = msg.get("toolCallList", [])
        results = []
        for tc in tool_calls:
            results.append({
                "toolCallId": tc.get("id"),
                "result": {"ok": True}
            })
        return JSONResponse({"results": results})

    if msg.get("type") == "end-of-call-report":
        call = msg.get("call", {})
        artifact = call.get("artifact", {})
        transcript = artifact.get("transcript")
        analysis = call.get("analysis")
        reports_dir = Path("vapi_reports")
        reports_dir.mkdir(parents=True, exist_ok=True)

        call_id = call.get("id") or call.get("callId") or call.get("sid") or str(uuid4())
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        out_path = reports_dir / f"end_of_call_{ts}_{call_id}.tx"

        content_parts = []
        if transcript:
            content_parts.append(str(transcript))
        if analysis is not None:
            content_parts.append(json.dumps(analysis, ensure_ascii=False, indent=2))

        out_path.write_text("\n\n---\n\n".join(content_parts) + "\n", encoding="utf-8")
        return JSONResponse({"ok": True})

    return JSONResponse({"ok": True})