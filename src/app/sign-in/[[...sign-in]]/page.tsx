import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      <div className="glow-border p-1">
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-[var(--bg-surface)] shadow-none",
            },
          }}
        />
      </div>
    </main>
  );
}
