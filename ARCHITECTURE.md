# Admin Architecture

The Qivro operations application uses these layers:

- `src/app`: Next.js route entrypoints and route-level screens.
- `src/features`: domain-owned UI and workflows, starting with the overview domain.
- `src/components/layout`: authenticated shell and page framing.
- `src/components/navigation`: shared admin navigation behavior.
- `src/components/ui`: reusable states, feedback, and metric primitives.
- `src/config`: navigation and integration catalogs.
- `src/lib/api`: typed backend clients and contracts.

Route files may compose features and shared components. Features must not import from `src/app`, and API modules must remain independent from UI code.

Run `npm run check:architecture` after structural changes. It is also part of `npm run lint`.
