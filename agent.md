# agent.md

Referencia operativa para este repo:

- No usar DAG en runtime de cálculo de créditos.
- El motor financiero vive en `backend/src/modules/credits/domain/calculation/` y el contrato público de cálculo es `data.calculation`.
- El motor debe responder siempre con `calculationProfileVersionId` activo y `policySnapshot` persistido en el préstamo.
- Revisa `AGENTS.md` para instrucciones de estructura, comandos, gotchas y convenciones de edición.
