---
name: Shadcn Sheet width overrides
description: Why the shared Sheet component's variant widths must use max-width utilities, not fixed widths, so consumers can override.
---

The shared `sheet.tsx` `sheetVariants` for left/right sides previously hardcoded `sm:w-[400px]` (a fixed width). Consumers pass their own `className` (e.g. `sm:max-w-2xl`) into `SheetContent`, combined via `cn(sheetVariants({side}), className)`.

**Why:** Tailwind-merge (used inside `cn()`) only lets a later class win when it's in the *same utility group*. `w-[400px]` (width) and `max-w-2xl` (max-width) are different groups, so both applied — the fixed `w-[400px]` silently capped every consumer's sheet at 400px regardless of their `max-w-*` override. This caused a project-detail side panel to regress to a narrow width after an unrelated mobile-responsive change touched the shared component.

**How to apply:** When a shared UI primitive (Sheet, Dialog, Drawer, etc.) needs a default size that individual call sites can override via `className`, use `max-w-*`/`max-h-*` defaults (not `w-*`/`h-*`) paired with `w-full`/`h-full` for the mobile-fill behavior. That way a consumer's own `max-w-*` in the same utility group correctly wins through twMerge. Before changing shared component variants for a "mobile responsive" fix, check whether any consumer relies on overriding that same size prop.
