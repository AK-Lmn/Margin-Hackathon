"use client";

/** Height-animated panel. Hidden content is inert, so it leaves the tab order and a11y tree. */
export function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className="expander" data-open={open} inert={!open} aria-hidden={!open}>
      <div>{children}</div>
    </div>
  );
}
