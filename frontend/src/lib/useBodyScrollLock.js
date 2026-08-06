import { useEffect } from "react";

/**
 * Locks background page scroll while a full-screen (position:fixed,
 * inset:0) modal is mounted. Without this, the modal itself doesn't
 * move (it's fixed to the viewport) but the dashboard behind it can
 * still scroll, which reads as instability/'floatiness' even when the
 * modal's own layout is perfectly static.
 *
 * Usage: call unconditionally at the top of any modal component —
 *   useBodyScrollLock();
 * The effect only runs once per mount, so no need to gate it behind
 * an `open` prop for components that unmount when closed (the normal
 * pattern in this codebase — `{show && <Modal .../>}`).
 */
export function useBodyScrollLock() {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);
}
