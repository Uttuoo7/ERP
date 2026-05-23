# Enterprise Frontend Architecture Guide

This document outlines the modern frontend architecture of the P2P ERP system, which has been refactored to use **TanStack Query** for server state and **Zustand** for client state.

## Folder Structure Paradigm
To ensure scalability across thousands of components, we have established the following strict directory pattern:

```text
src/
├── store/                 # Zustand global client state
│   ├── authStore.ts       # Manages user session and JWT
│   └── uiStore.ts         # Manages Sidebar, Theme, Modals
├── hooks/
│   ├── queries/           # TanStack Query GET hooks
│   │   └── useUser.ts
│   └── mutations/         # TanStack Query POST/PUT/DELETE hooks
│       └── useLoginMutation.ts
├── lib/                   # API abstractions and utilities
│   └── api.ts             # Axios instance with interceptors
├── components/            # Dumb presentation components
└── pages/                 # Smart route components
```

## 1. Server State (TanStack Query)
Previously, components used `useEffect` and local `useState` to fetch data. This caused waterfall loading, race conditions, and zero caching.

**The New Paradigm:**
All server interactions MUST go through a TanStack hook.
* **Queries:** Use `useQuery` for fetching data. Queries are cached globally. If a user navigates from "PO List" to "Dashboard" and back to "PO List", the data is instantly served from cache while a background refetch ensures it's fresh.
* **Mutations:** Use `useMutation` for creating/updating data. Mutations automatically handle loading states (`isPending`) and should call `queryClient.invalidateQueries` on success to refresh the UI.

## 2. Client State (Zustand)
Previously, the app relied on React Context (`AuthContext`). Context causes entire component trees to re-render whenever any value changes.

**The New Paradigm:**
We use **Zustand** hooks for global UI and Auth state.
* `const role = useAuthStore(state => state.user?.role)`
* Zustand is atomic. By selecting exactly the state you need, the component will ONLY re-render if that specific slice of state changes.

## 3. Optimistic Updates
Because we use TanStack Query, mutations can now optimistically update the cache before the server responds. 
For example, when a user clicks "Approve PO":
1. The mutation intercepts the click.
2. It immediately updates the cached PO list to show "Approved" (Instant UI feedback).
3. It sends the API request in the background.
4. If the request fails, TanStack Query automatically rolls back the UI to the previous state.

## Migration Strategy for Developers
We are migrating incrementally. The authentication flow and global layout have been updated. 
When working on a new feature or refactoring an old page (e.g., `PRList.tsx`):
1. Delete the `useEffect` block.
2. Create `src/hooks/queries/usePurchaseRequests.ts`.
3. Import the hook into `PRList.tsx` and destructure `{ data, isLoading, error }`.
