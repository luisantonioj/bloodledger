FROM python:3.13.11-slim@sha256:2b9c9803c6a287cafa0a8c917211dddd23dcd2016f049690ee5219f5d3f1636e

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /workspace
COPY requirements.lock pyproject.toml ./
RUN python -m pip install --no-cache-dir --require-hashes -r requirements.lock
COPY src ./src
RUN python -m pip install --no-cache-dir --no-build-isolation --no-deps .

USER 65532:65532
ENTRYPOINT ["bloodledger-forecasting"]
