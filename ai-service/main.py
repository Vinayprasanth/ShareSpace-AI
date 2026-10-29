"""Optional Python agent service for extending ShareSpace AI.
The Node API currently runs deterministic, auditable agent tools directly so the demo works
without a separate Python process or paid API key. This service provides an independently
runnable health endpoint and structured agent-analysis endpoint for future orchestration.
"""
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Any

app = FastAPI(title="ShareSpace AI Agent Service", version="1.0.0")

class AgentRequest(BaseModel):
    task: str
    payload: dict[str, Any] = Field(default_factory=dict)

@app.get("/health")
def health():
    return {"ok": True, "service": "sharespace-agent-service", "mode": "deterministic-demo"}

@app.post("/analyze")
def analyze(req: AgentRequest):
    p = req.payload
    if req.task == "incident":
        text = " ".join(str(p.get(k, "")) for k in ("type", "description", "initialCondition", "finalCondition")).lower()
        keywords = [k for k in ("damage", "broken", "crack", "missing", "late", "overdue", "fault") if k in text]
        return {"agent": "Return & Incident Agent", "flags": keywords,
                "severity": "needs_review" if keywords else "routine_review",
                "summary": "Potential issue terms found; human review required." if keywords else "No predefined issue terms found; review remains recommended.",
                "decision": "human_review_required"}
    if req.task == "discovery":
        query = str(p.get("query", "")).strip()
        return {"agent": "Resource Discovery Agent", "query": query,
                "summary": "Use the main API's live resource catalogue to rank available resources.",
                "mode": "rules-based"}
    return {"agent": "Agent Orchestrator", "task": req.task,
            "recommendation": "manual_review", "summary": "Unknown or unsupported task; no action was taken."}
