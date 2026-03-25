FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    nodejs npm \
    fonts-noto fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /agent
COPY . /agent/

RUN pip install --no-cache-dir \
    requests \
    Pillow \
    python-dotenv \
    playwright \
    && playwright install chromium --with-deps

CMD ["python", "insights.py", "--no-save"]
