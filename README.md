### Hexlet tests and linter status:
[![Actions Status](https://github.com/hypnozer/python-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/hypnozer/python-project-386/actions)

# Calendar booking API contract

The application is designed contract-first. Its source of truth is the
[TypeSpec contract](./main.tsp); the generated OpenAPI document is written to
`openapi/openapi.yaml`.

## Commands

```bash
npm install
npm run compile
npm run check
```

`npm run check` compiles the contract without writing generated files. The
contract deliberately contains no authentication: `/owner` routes represent
the administrative UI for the single predefined owner, while the other routes
form the public guest flow.

The owner profile and its weekly availability are predefined. Available slots
are returned for 14 calendar dates (today and the following 13 dates) in the
owner's IANA time zone. See [the domain rules](./docs/domain.md) for the complete
behavior and assumptions.

## Frontend

The separate React + TypeScript application lives in `frontend/`. It generates
its API types from the OpenAPI document and uses `/api` as the local API base.
Vite proxies those requests to `http://localhost:8000` by default.

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` when the backend is available at another origin. Run
`npm run build` to regenerate the contract types, type-check the application,
and create a production bundle.

For UI development without a backend, `npm run mock` starts a small in-memory
API on port 8000 that follows the same OpenAPI routes. Run it in a second
terminal before `npm run dev`.
