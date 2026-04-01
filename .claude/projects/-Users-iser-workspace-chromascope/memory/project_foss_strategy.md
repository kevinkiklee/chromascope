---
name: FOSS strategy
description: Chromascope will be fully FOSS except hosted cloud AI — users can connect local models or bring their own API keys
type: project
---

Chromascope will go fully FOSS. Only the hosted cloud AI backend on Vercel remains as a commercial convenience service.

**Why:** Strategic decision by the owner — open-source everything, let users self-host.

**How to apply:**
- Don't gate non-AI features behind licenses in new code
- Keep the `ModelProvider` interface as the abstraction boundary (cloud/local/BYOK all implement it)
- The `createProvider('local')` stub in `provider.ts` is the future extension point — don't remove it
- License tiers (trial/pro/pro_ai) will only apply to the hosted Vercel instance, not self-hosted
- Documented in `docs/superpowers/plans/2026-03-29-plan6-ai-backend.md` under "Future: FOSS + BYOM"
