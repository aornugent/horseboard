# Agent Guidelines

Instructions for AI agents working on this codebase.

## Quick Orientation

- **What:** Web-based information board (edit on phone, display on TV)
- **Stack:** Node.js, Express, SQLite, SSE, vanilla JS
- **Status:** See `IMPLEMENTATION_PLAN.md` for current phase
- **API:** See `TECHNICAL_SPECIFICATION.md` for endpoints and data formats

## Key Principles

1. **Simplicity first** - Vanilla JS, minimal dependencies
2. **Test-driven** - Write tests alongside implementation
3. **Docs stay current** - Update specs after building, not before

## Development Practices

### Start Simple, Add Complexity Later

- Prefer built-in tools (`node:test`) over frameworks (Vitest/Jest)
- Question every dependency - if Node can do it, don't add a package
- We test with just `supertest` - no test framework needed

### Build Tests Alongside Code

- Write tests as you implement, not after
- Run `npm test` frequently - catch issues early
- Fix failing tests immediately

### Keep Documentation in Sync

After completing work:
1. Re-read the technical specification
2. List discrepancies (missing endpoints, different formats)
3. Update the spec to match reality
4. Add discovered issues to "Future Considerations" in tech spec

### Commit Workflow

1. Implement a coherent chunk
2. Run tests
3. Write descriptive commit message
4. Push - don't accumulate uncommitted changes

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

**Patterns:**
- Use `:memory:` SQLite for integration tests
- Clean state in `beforeEach`, close connections in `after`
- Test success cases, error cases, and input validation

## Quick Commands

```bash
npm install           # Install dependencies
npm start             # Start server (port 3000)
npm run dev           # Start with auto-reload
npm test              # Run tests
```

## Documentation Map

| File | Read For |
|------|----------|
| `README.md` | Project overview, setup, current status |
| `TECHNICAL_SPECIFICATION.md` | API contracts, data formats, future backlog |
| `IMPLEMENTATION_PLAN.md` | Phased tasks, what's done, what's next |
| `TEST_SUITE.md` | Test structure and patterns |
