FROM node:22-slim AS builder
WORKDIR /app

RUN npm i -g bun@1.2.3

COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY packages/runtime/package.json packages/runtime/
COPY packages/agent-sdk/package.json packages/agent-sdk/
COPY packages/widget-dsl/package.json packages/widget-dsl/
RUN bun install --frozen-lockfile

COPY packages/runtime/ packages/runtime/
COPY packages/agent-sdk/ packages/agent-sdk/
COPY packages/widget-dsl/ packages/widget-dsl/

RUN cd packages/runtime && bun run build

FROM node:22-slim
WORKDIR /app

RUN npm i -g bun@1.2.3

COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/packages/runtime/package.json packages/runtime/
COPY --from=builder /app/packages/agent-sdk/package.json packages/agent-sdk/
COPY --from=builder /app/packages/widget-dsl/package.json packages/widget-dsl/
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/packages/runtime/dist packages/runtime/dist
COPY --from=builder /app/packages/runtime/drizzle packages/runtime/drizzle
COPY agents/ agents/

EXPOSE 4321
ENV NODE_ENV=production
ENV PORT=4321

CMD ["node", "packages/runtime/dist/main.js"]
