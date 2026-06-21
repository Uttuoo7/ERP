# Architecture Decision Records (ADRs)

## ADR-001: Core Layout Freeze

### Status
Adopted (Constitution v1.0)

### Context
The application desktop layout requires a fast, unified workspace lifecycle that isolates route switches.

### Decision
The top nav, mega menu, ribbon, and workspaces are declared complete and frozen. No future module should modify the desktop shell file structures.

### Consequences
Modules must register themselves exclusively through the `EnterprisePlatformSDK` and comply with the `ExtensionContracts` specifications.

---

## ADR-002: Code-Driven Plugin Manifests

### Status
Adopted

### Context
We initially considered storing manifests in the DB, but code-driven registrations enforce typescript static checking, prevent runtime DB bottlenecks, and provide version control.

### Decision
All plugin configurations are declared in typescript code files. Only runtime enabling/disabling configs and license flags reside in the DB.
