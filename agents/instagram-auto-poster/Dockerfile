FROM python:3.12-slim
WORKDIR /agent
COPY . /agent/
RUN apt-get update && apt-get install -y chromium fonts-noto-cjk fonts-noto && rm -rf /var/lib/apt/lists/*
RUN pip install playwright Pillow requests && playwright install chromium --with-deps
