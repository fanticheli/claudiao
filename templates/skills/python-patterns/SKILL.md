---
name: python-patterns
description: Patterns e boilerplates Python prontos — Repository Pattern, Settings, FastAPI estruturado, pytest fixtures. Use quando iniciar módulos ou precisar de referência.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

# Python Patterns

Patterns e boilerplates Python de uso imediato. Exemplos assumem Python
3.12+, SQLAlchemy 2.x async, FastAPI e Pydantic v2.

## Quando ativar

- Criando novo módulo/serviço Python
- Configurando projeto FastAPI ou Django
- Implementando Repository Pattern com SQLAlchemy
- Criando fixtures de teste com pytest
- Configurando settings com Pydantic
- Precisando de handler de exceções, retry policy ou idempotency key

---

## Repository Pattern (SQLAlchemy 2.x + async)

Repository base com métodos essenciais. Herde e tipe pra cada modelo.

```python
# app/repositories/base.py
from __future__ import annotations

from typing import Any, Generic, Sequence, TypeVar

from sqlalchemy import Select, delete, select, update
from sqlalchemy.exc import IntegrityError, NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

ModelT = TypeVar("ModelT", bound=DeclarativeBase)


class RepositoryError(Exception):
    """Base para erros do repository (app-level)."""


class NotFoundError(RepositoryError):
    """Registro não encontrado quando esperado existir."""


class ConflictError(RepositoryError):
    """Violação de constraint (unique, FK, check)."""


class BaseRepository(Generic[ModelT]):
    """Repository base assíncrono.

    Herde e defina `model`:
        class AnimalRepository(BaseRepository[Animal]):
            model = Animal
    """

    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ---------- Read ----------

    async def get(self, id: Any) -> ModelT | None:
        return await self._session.get(self.model, id)

    async def get_or_raise(self, id: Any) -> ModelT:
        obj = await self._session.get(self.model, id)
        if obj is None:
            raise NotFoundError(f"{self.model.__name__} id={id} not found")
        return obj

    async def find_one(self, **filters: Any) -> ModelT | None:
        stmt = self._build_query(**filters)
        result = await self._session.execute(stmt.limit(1))
        return result.scalar_one_or_none()

    async def list(
        self,
        *,
        offset: int = 0,
        limit: int = 100,
        order_by: str | None = None,
        **filters: Any,
    ) -> Sequence[ModelT]:
        stmt = self._build_query(**filters).offset(offset).limit(limit)
        if order_by:
            desc = order_by.startswith("-")
            column = getattr(self.model, order_by.lstrip("-"))
            stmt = stmt.order_by(column.desc() if desc else column.asc())
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def count(self, **filters: Any) -> int:
        from sqlalchemy import func

        stmt = select(func.count()).select_from(self.model)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def exists(self, **filters: Any) -> bool:
        stmt = select(1).select_from(self.model).limit(1)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        result = await self._session.execute(stmt)
        return result.scalar() is not None

    # ---------- Write ----------

    async def create(self, **kwargs: Any) -> ModelT:
        obj = self.model(**kwargs)
        self._session.add(obj)
        try:
            await self._session.flush()
        except IntegrityError as err:
            await self._session.rollback()
            raise ConflictError(f"conflict creating {self.model.__name__}") from err
        return obj

    async def update(self, id: Any, **changes: Any) -> ModelT:
        """UPDATE ... RETURNING * em 1 round-trip."""
        if not changes:
            return await self.get_or_raise(id)
        stmt = (
            update(self.model)
            .where(self.model.id == id)
            .values(**changes)
            .returning(self.model)
        )
        try:
            result = await self._session.execute(stmt)
        except IntegrityError as err:
            await self._session.rollback()
            raise ConflictError(f"conflict updating {self.model.__name__}") from err
        obj = result.scalar_one_or_none()
        if obj is None:
            raise NotFoundError(f"{self.model.__name__} id={id} not found")
        return obj

    async def upsert(self, *, conflict_columns: list[str], **values: Any) -> ModelT:
        """INSERT ... ON CONFLICT DO UPDATE (Postgres-specific)."""
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        update_set = {k: v for k, v in values.items() if k not in conflict_columns}
        stmt = (
            pg_insert(self.model)
            .values(**values)
            .on_conflict_do_update(
                index_elements=conflict_columns,
                set_=update_set,
            )
            .returning(self.model)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def bulk_create(self, items: list[dict[str, Any]]) -> list[ModelT]:
        """INSERT em massa com RETURNING (uma round-trip pra N rows)."""
        if not items:
            return []
        from sqlalchemy import insert

        stmt = insert(self.model).values(items).returning(self.model)
        try:
            result = await self._session.execute(stmt)
        except IntegrityError as err:
            await self._session.rollback()
            raise ConflictError(f"conflict bulk creating {self.model.__name__}") from err
        return list(result.scalars().all())

    async def delete(self, id: Any) -> bool:
        stmt = delete(self.model).where(self.model.id == id)
        result = await self._session.execute(stmt)
        return result.rowcount > 0  # type: ignore[attr-defined]

    # ---------- Internals ----------

    def _build_query(self, **filters: Any) -> Select[tuple[ModelT]]:
        stmt: Select[tuple[ModelT]] = select(self.model)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        return stmt
```

Uso concreto:

```python
# app/repositories/animals.py
from sqlalchemy.orm import selectinload

from app.models import Animal
from app.repositories.base import BaseRepository


class AnimalRepository(BaseRepository[Animal]):
    model = Animal

    async def by_farm(self, farm_id: int) -> list[Animal]:
        """Query customizada com eager loading (evita N+1)."""
        stmt = (
            self._build_query(farm_id=farm_id)
            .options(selectinload(Animal.tags))
            .order_by(Animal.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
```

---

## Pydantic Settings (v2)

```python
# app/config.py
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "my-service"
    environment: Literal["dev", "staging", "prod"] = "dev"
    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # Database
    database_url: PostgresDsn
    db_pool_size: int = Field(default=10, ge=1, le=100)
    db_max_overflow: int = Field(default=5, ge=0, le=50)
    db_echo: bool = False

    # Redis
    redis_url: RedisDsn = RedisDsn("redis://localhost:6379/0")

    # Auth (Secret pra não vazar em repr/log)
    jwt_secret: SecretStr
    jwt_expiration_minutes: int = Field(default=15, ge=1)
    refresh_token_expiration_days: int = Field(default=7, ge=1)

    # External
    openai_api_key: SecretStr | None = None
    sentry_dsn: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Singleton cacheado — chame como Depends(get_settings) no FastAPI."""
    return Settings()  # type: ignore[call-arg]
```

---

## FastAPI App Structure

```python
# app/main.py
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import get_settings
from app.db.session import async_engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("starting", extra={"env": settings.environment})
    yield
    await async_engine.dispose()
    logger.info("stopped")


app = FastAPI(
    title="My Service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if get_settings().environment != "prod" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.example.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
```

```python
# app/api/deps.py
from typing import Annotated, AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.repositories.animals import AnimalRepository


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_animal_repo(session: SessionDep) -> AnimalRepository:
    return AnimalRepository(session)


AnimalRepoDep = Annotated[AnimalRepository, Depends(get_animal_repo)]
```

---

## Retry com tenacity (chamadas externas)

```python
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
import httpx


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    reraise=True,
)
async def fetch_external_data(url: str) -> dict:
    """Retry apenas em erros transientes. 4xx (exceto 429) não tem retry."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()
```

---

## Idempotency Key Pattern

```python
import hashlib
from typing import Any


def idempotency_key(*parts: Any) -> str:
    """Gera key determinística para operações idempotentes.

    Uso: cache de chamadas LLM/payment/webhook pra permitir retry seguro.
    """
    raw = ":".join(str(p) for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()


# Exemplo: processamento de entrevista
async def process_interview(interview_id: str, audio_sha: str, model: str) -> Analysis:
    key = idempotency_key(interview_id, audio_sha, model)

    cached = await cache_repo.find_one(idempotency_key=key)
    if cached and cached.status == "done":
        return cached.result  # já processado, retorna cache

    # processa...
    result = await analyzer.run(interview_id)
    await cache_repo.upsert(
        conflict_columns=["idempotency_key"],
        idempotency_key=key,
        status="done",
        result=result,
    )
    return result
```

---

## Pytest Fixtures (async + db)

```python
# conftest.py
import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.main import app
from app.db.base import Base
from app.db.session import get_session_maker


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine() -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_engine(
        "postgresql+asyncpg://test:test@localhost/test_db",
        poolclass=NullPool,  # evita conexão reutilizada entre testes
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Sessão por teste com rollback automático (tests isolados)."""
    connection = await engine.connect()
    transaction = await connection.begin()
    session_maker = get_session_maker(bind=connection)

    async with session_maker() as session:
        yield session

    await transaction.rollback()
    await connection.close()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client com override do session pra usar a mesma do test."""
    from app.api.deps import get_session

    async def _override():
        yield db_session

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

---

## Structured Logging (pt-BR mental, JSON no wire)

```python
# app/logging_config.py
import logging
import sys

import structlog


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


# Uso
logger = structlog.get_logger()
logger.info("user.login.success", user_id=user.id, method="password")
```

---

## Antipadrões Python a Evitar

| Antipadrão | Problema | Solução |
|---|---|---|
| `except Exception: pass` | Engole bugs silenciosamente | Catch específico + log estruturado |
| Mutable default args (`def f(x=[])`) | State shared entre calls | `def f(x=None): x = x or []` |
| `datetime.now()` sem `tz` | Comparação timezone-naive quebra | `datetime.now(tz=UTC)` sempre |
| Loop com `await` em cada item | Serial, lento | `asyncio.gather(*[task(x) for x in items])` |
| Pydantic `.dict()` em pydantic v2 | Deprecated, vira warn | `.model_dump()` |
| Pool SQLAlchemy sem `pool_pre_ping` | Conexão morta em RDS mata request | `pool_pre_ping=True` sempre |
| `any`/`dict[str, Any]` em domain model | Zero type safety | Pydantic model ou dataclass tipada |
| `os.environ['X']` espalhado | Config implícito, hard to test | `Settings` com `pydantic-settings` |
