# Magically

**Your personal Agent OS.**

Magically is an operating system for AI agents. Not a chatbot. Not a developer tool. An OS — like iOS for your AI life.

You install agents like apps. They run in the background, do things for you, and show you what happened. A home screen with widgets shows you everything at a glance. A feed shows what your agents did while you were away. And Zeus — the kernel — orchestrates it all.

## Who is this for?

**Everyone.** The same way iOS is for everyone, not just app developers.

- You want an agent that posts to your Instagram on autopilot? Install it. Configure your account. Done.
- You want an agent that watches research papers in your field and sends you a daily digest? Install it.
- You want an agent that transcribes your voice memos and files them? Install it.
- You want to build your own agent? You can do that too.

The 95% who can't code don't need to. They browse the gallery, install what they need, and go about their day. The 5% who can code build the agents that the 95% use.

## How it works

**Agents are apps.** Each agent has:
- A **UI** — a full interactive experience (like opening an app)
- A **widget** — a glanceable snapshot on your home screen
- **Functions** — things it can do (fetch analytics, publish a post, generate a report)
- **Triggers** — when it runs automatically (every morning, when you get an email, on a schedule)

**Tools are capabilities.** Agents use tools:
- Instagram Publisher, Google Calendar, Weather Data, Web Search
- Tools are shared across agents — install once, any agent can use it

**Zeus is the kernel.** The orchestrator that ties everything together:
- Routes requests between you and your agents
- Manages your memory and preferences
- Enables agents to work together (Recipe Book + Grocery List = dinner planned)

## The analogy

| iOS | Magically |
|-----|-----------|
| Apps | Agents |
| App Store | Gallery |
| Siri | Zeus |
| Home screen widgets | Widget grid |
| Notification Center | Feed |
| System APIs (Camera, GPS, etc.) | Tools (Calendar, Email, Search, etc.) |
| You install apps, they work | You install agents, they work |

## What makes this different

**It's not a chat interface.** You don't type prompts to get things done. Your agents run autonomously — on schedules, on triggers, in the background. You check in when you want to, like checking your phone.

**It's not a developer platform.** You don't need to know what an API is. You install an agent, configure it through a guided setup, and it works. The complexity is hidden behind the same kind of experience you're used to from your phone.

**Agents are composable.** Your Recipe Book agent can talk to your Grocery List agent through Zeus. One agent finds the recipe, another builds the shopping list. You didn't wire them together — Zeus figures it out.

## Security Model

Zeus sees everything — all memory, all agent state, all user context. But agents are sandboxed:

- **Zeus** = knows everything, decides what to run, passes only declared secrets/config/tools to the agent
- **Compute layer** = isolated execution environment (container), separate from your device
- **Agent** = only sees what the manifest declared (secrets, config, tools). Can't access other agents' data, can't access Zeus's memory directly
- Same security model locally and in the cloud

## Status

This is early. The runtime works end-to-end, but the consumer experience (the home screen, the gallery, one-click install) is being built.

What works today:
- `magically publish` — validate, bundle, build Docker image remotely (GitHub Actions), push to GHCR + Fly registry
- `magically run` — execute agent functions on Fly Machines or Docker locally
- `magically status` — check build status of a published agent
- Async build pipeline — BullMQ + Redis, with structured error surfacing
- Validation pipeline — RxJS Observable checks at publish time (manifest, schema, functions, secrets)
- Container harness — JS functions using `module.exports` pattern are called correctly via injected `_harness.js`
- Authentication — Google OAuth, email/password, API keys, JWT
- Runtime on Fly.io, database on Neon, storage on Tigris, builds on GitHub Actions
- Web app on Vercel (basic shell)
- Multiple compute providers: Fly Machines (production), Docker (local dev), Daytona (future)

