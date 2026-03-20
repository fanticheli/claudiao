---
name: python-patterns
description: Patterns e boilerplates Python prontos — Repository Pattern, Settings, FastAPI estruturado, pytest fixtures. Use quando iniciar módulos ou precisar de referência.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

# Python Patterns

Patterns e boilerplates Python prontos para uso.

## Quando ativar

Ative quando o usuário estiver:
- Criando novo módulo/serviço Python
- Configurando projeto FastAPI ou Django
- Implementando Repository Pattern com SQLAlchemy
- Criando fixtures de teste com pytest
- Configurando settings com Pydantic

## Patterns

### Repository Pattern (SQLAlchemy 2.0 + async)

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

class BaseRepository[T]:
    def __init__(self, session: AsyncSession, model: type[T]) -> None:
        self._session = session
        self._model = model

    async def get_by_id(self, id: int) -> T | None:
        stmt = select(self._model).where(self._model.id == id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self, *, offset: int = 0, limit: int = 100) -> list[T]:
        stmt = select(self._model).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, entity: T) -> T:
        self._session.add(entity)
        await self._session.flush()
        return entity
```

### Pydantic Settings

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    app_name: str = "my-service"
    debug: bool = False
    log_level: str = "INFO"

    # Database
    database_url: str
    db_pool_size: int = 5
    db_max_overflow: int = 10

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Auth
    jwt_secret: str
    jwt_expiration_minutes: int = 60

settings = Settings()
```

### FastAPI App Structure

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown

app = FastAPI(title="My Service", lifespan=lifespan)

# app/api/deps.py
from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

SessionDep = Annotated[AsyncSession, Depends(get_session)]
```

### Pytest Fixtures

```python
# conftest.py
import pytest
from httpx import ASGITransport, AsyncClient

@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def db_session(engine):
    async with async_session_maker(bind=engine) as session:
        yield session
        await session.rollback()
```
