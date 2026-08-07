import { notFound } from "next/navigation";

// Production hides the entire sandbox surface. Development is unchanged.
export default function SandboxLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
