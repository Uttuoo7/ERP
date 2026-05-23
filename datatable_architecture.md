# Enterprise DataTable Architecture

The ERP frontend has been upgraded with `@tanstack/react-table`, providing a headless, highly scalable grid infrastructure capable of handling massive datasets.

## The Architecture
Previously, listing pages (like `POList.tsx`) used hardcoded HTML `<table>` elements and manual `useEffect` loops. This limited scalability and made implementing advanced features (like column hiding, drag-and-drop, or server-side pagination) extremely difficult.

We have established a new paradigm:
1. **`<DataTable />` Component**: Located in `src/components/ui/DataTable.tsx`. This generic React component acts as the UI shell. It takes in `columns` and `data`, and handles the rendering, styling, sorting states, and row selection natively.
2. **TanStack Query Integration**: The table acts purely as a presentation layer. The actual fetching is handled by TanStack Query hooks (e.g., `usePurchaseOrders`), ensuring data is cached, deduplicated, and background-refetched automatically.
3. **Column Definitions (`columns.tsx`)**: The UI logic for rendering badges, links, and action menus is completely extracted from the page file into a dedicated `columns.tsx` file. This drastically simplifies the page component and makes the column schemas strongly typed.

## Why Headless?
Unlike component libraries that force you into a specific styling system (like Material-UI DataGrid), `@tanstack/react-table` is purely a logic engine. We maintain 100% control over the DOM. We can style the tables using Tailwind CSS to look exactly like Linear, Notion, or Airtable, without fighting library constraints.

## Migration Guide for New Grids
When building a new list view (e.g., `InventoryLedger.tsx`):
1. **Define your columns** in `pages/inventory/columns.tsx` using `ColumnDef<YourModel>`.
2. **Create your fetcher** in `hooks/queries/useInventory.ts`.
3. **Assemble** them in `InventoryLedger.tsx`:
```tsx
const { data, isLoading } = useInventory(filters);
return <DataTable columns={columns} data={data} isLoading={isLoading} />;
```

## Future Extensibility
Because we are using the core TanStack standard, we can easily add:
* Server-side pagination (by passing `pageIndex` and `pageSize` state from the table back into the Query hook).
* Virtualization (via `@tanstack/react-virtual`) for rendering 100,000+ rows instantly.
* Bulk actions via the existing `rowSelection` state array.
