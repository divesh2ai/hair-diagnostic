"use client";

import { useRef, type ReactNode } from "react";

// Tiny helper — wraps the existing /auth/signout form-POST endpoint so any
// client component can trigger sign-out via a function. The form lives in
// the DOM, hidden; the child renders whatever UI it likes and calls submit().

export function SignOutForm({
  children,
}: {
  children: (api: { submit: () => void }) => ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <form
        ref={formRef}
        action="/auth/signout"
        method="post"
        className="hidden"
      />
      {children({ submit: () => formRef.current?.submit() })}
    </>
  );
}
