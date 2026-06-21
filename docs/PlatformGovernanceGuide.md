# Platform Governance Guide

## Coding Standards

### Folder Structure
All future extensions must reside in designated directory structures:
- Frontend plugins: `frontend/src/plugins/<module_key>/`
- Backend plugins: `backend/plugins/<module_key>/`

### TypeScript Guidelines
- All extension interfaces must be explicitly typed using types from `EnterprisePlatformSDK`.
- Avoid direct DOM manipulation; use React components and refs.
- Never import internal shell components directly.

### Python Guidelines
- Follow PEP-8 standards.
- Ensure all repository queries enforce tenant filtering context: `db.query(Model).filter(Model.tenant_id == tenant_id)`.

---

## Testing Standards

Each module requires:
- **Unit Tests**: Minimum 70% line coverage for utility functions.
- **Integration Tests**: Verify database transaction rollbacks and API routes.
- **Permission Tests**: Confirm standard roles matrices block unauthorized requests.
- **Accessibility Verification**: Verify keyboard navigation focus indices and ARIA labels.
- **Performance Verification**: Switching views must stay under 50ms latency.

---

## Platform Freeze Policy

The following components are declared frozen and cannot be edited without formal architecture board review:
1. Enterprise Desktop Shell
2. Top Navigation module list
3. Ribbon action bars
4. Workspace manager splits
5. SDK Interfaces
