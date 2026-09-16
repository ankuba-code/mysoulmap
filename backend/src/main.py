from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .atlas import PLACES, Place, filter_places, get_place_by_id
from .chat import handle_chat
from .models_chat import ChatRequest, ChatResponse

app = FastAPI(title="Soulmap API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.mithertz.online"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def error_payload(code: str, message: str, details: dict | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        }
    }


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=error_payload(
            "VALIDATION_ERROR",
            "Die Anfrage ist ungültig.",
            {
                "errors": [
                    {"loc": list(item["loc"]), "type": item["type"]}
                    for item in exc.errors()
                ]
            },
        ),
    )


@app.get("/health")
def health():
    return {"status": "ok", "places_loaded": len(PLACES)}


@app.get("/atlas/places")
def list_places(
    element: str | None = Query(default=None),
    archetyp: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
) -> dict[str, list[Place]]:
    return {
        "places": filter_places(
            PLACES,
            element=element,
            archetyp=archetyp,
            keyword=keyword,
        )
    }


@app.get("/atlas/places/{place_id}", response_model=Place)
def get_place(place_id: str):
    place = get_place_by_id(PLACES, place_id)
    if place is None:
        return JSONResponse(
            status_code=404,
            content=error_payload(
                "PLACE_NOT_FOUND",
                "Der angeforderte Atlas-Ort existiert nicht.",
                {"id": place_id},
            ),
        )
    return place


@app.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    return await handle_chat(body, PLACES)
