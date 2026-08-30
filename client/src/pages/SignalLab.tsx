import { SignalLabWorkspace } from "@/components/SignalLabWorkspace";

export default function SignalLab() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 border-b border-border pb-5">
          <p className="text-sm font-medium text-violet-700">Honest Signals-inspired testing discipline</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Signal Lab</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Plan message/creative tests, review policy risk, track aggregate downstream outcomes, and record a human decision before any separate Meta setup is considered.</p>
        </div>
        <SignalLabWorkspace />
      </div>
    </main>
  );
}
