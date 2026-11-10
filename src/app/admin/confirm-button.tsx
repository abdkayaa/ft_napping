"use client";
import type { ReactNode } from "react";

/** Submit button that asks before running a destructive server action. */
export function ConfirmButton({
  action,
  message,
  className,
  disabled,
  children,
}: {
  action: (fd: FormData) => void | Promise<void>;
  message: string;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      formAction={action}
      formNoValidate
      disabled={disabled}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
