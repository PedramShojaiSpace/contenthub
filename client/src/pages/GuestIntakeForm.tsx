/**
 * GuestIntakeForm.tsx
 *
 * Public page — no authentication required.
 * Accessible at /podcast-intake/:token
 *
 * The guest's team fills out this form and submits it.
 * On submission the server saves the data and kicks off the BINGE report
 * generation in the background.
 */

import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, Mic } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldGroup({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-gray-800">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-gray-500 leading-relaxed">{hint}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuestIntakeForm() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  // Fetch the episode metadata so we can pre-fill the form and show context
  const { data: episode, isLoading, error } = trpc.podcast.getIntakeForm.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const submitMutation = trpc.podcast.submitIntakeForm.useMutation();

  // Form state — pre-filled from the episode once loaded
  const [guestName, setGuestName] = useState("");
  const [guestRole, setGuestRole] = useState("");
  const [guestCompany, setGuestCompany] = useState("");
  const [whyNow, setWhyNow] = useState("");
  const [backgroundUrls, setBackgroundUrls] = useState("");
  const [backgroundText, setBackgroundText] = useState("");
  const [episodeLengthMin, setEpisodeLengthMin] = useState(45);
  const [prefilled, setPrefilled] = useState(false);

  // Pre-fill once episode data arrives
  if (episode && !prefilled) {
    setGuestName(episode.guestName ?? "");
    setGuestRole(episode.guestRole ?? "");
    setGuestCompany(episode.guestCompany ?? "");
    setEpisodeLengthMin(episode.episodeLengthMin ?? 45);
    setPrefilled(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMutation.mutateAsync({
      token,
      guestName,
      guestRole: guestRole || undefined,
      guestCompany: guestCompany || undefined,
      whyNow: whyNow || undefined,
      backgroundUrls: backgroundUrls || undefined,
      backgroundText,
      episodeLengthMin,
    });
  };

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Loading your intake form…</p>
        </div>
      </div>
    );
  }

  // ─── Error / not found ─────────────────────────────────────────────────────

  if (error || !episode) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-red-200 bg-white shadow-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-lg mb-1">Link not found</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                This intake link is invalid or has expired. Please contact the show team for a new link.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Already submitted ─────────────────────────────────────────────────────

  if (episode.intakeStatus === "submitted" && !submitMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-green-200 bg-white shadow-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-lg mb-1">Already submitted</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Your intake form was already submitted on{" "}
                {episode.intakeSubmittedAt
                  ? new Date(episode.intakeSubmittedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "a previous date"}
                . The show team will be in touch soon.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Success state ─────────────────────────────────────────────────────────

  if (submitMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-green-200 bg-white shadow-sm">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-lg mb-1">
                Thank you, {guestName.split(" ")[0]}!
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                {submitMutation.data?.message ??
                  "Your information has been submitted. The show team will be in touch soon."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────

  const showName = episode.showName ?? "The Urban Monk Podcast";

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <header className="w-full bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#c8603a]/10 flex items-center justify-center">
            <Mic className="w-4 h-4 text-[#c8603a]" />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Guest Intake</p>
            <h1 className="text-sm font-semibold text-gray-900 leading-tight">{showName}</h1>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-2xl mx-auto px-6 py-10">
        <Card className="bg-white shadow-sm border-gray-100">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-serif text-gray-900">
              Podcast Guest Questionnaire
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 leading-relaxed">
              Please fill out this form so we can prepare the best possible conversation for your episode
              on <strong className="text-gray-700">{showName}</strong>. The more context you share, the
              more focused and valuable the interview will be for both you and our audience.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">

              {/* Section: About You */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
                  About You
                </h3>

                <FieldGroup label="Full name" htmlFor="guestName" required>
                  <Input
                    id="guestName"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Dr. Jane Smith"
                    required
                    className="bg-gray-50 border-gray-200"
                  />
                </FieldGroup>

                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Title / Role" htmlFor="guestRole">
                    <Input
                      id="guestRole"
                      value={guestRole}
                      onChange={(e) => setGuestRole(e.target.value)}
                      placeholder="Author & Longevity Coach"
                      className="bg-gray-50 border-gray-200"
                    />
                  </FieldGroup>
                  <FieldGroup label="Company / Organization" htmlFor="guestCompany">
                    <Input
                      id="guestCompany"
                      value={guestCompany}
                      onChange={(e) => setGuestCompany(e.target.value)}
                      placeholder="Cleveland Clinic"
                      className="bg-gray-50 border-gray-200"
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* Section: Your Story */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
                  Your Story & Message
                </h3>

                <FieldGroup
                  label="Why are you doing this interview right now?"
                  htmlFor="whyNow"
                  hint="New book, research, product launch, mission — what's the timely angle?"
                >
                  <Textarea
                    id="whyNow"
                    value={whyNow}
                    onChange={(e) => setWhyNow(e.target.value)}
                    placeholder="I just published my new book on metabolic health and want to share the core findings…"
                    rows={3}
                    className="bg-gray-50 border-gray-200 resize-none"
                  />
                </FieldGroup>

                <FieldGroup
                  label="Bio & background"
                  htmlFor="backgroundText"
                  required
                  hint="Paste your bio, a recent article, key talking points, or anything that helps us understand your work. The more detail, the better the interview prep."
                >
                  <Textarea
                    id="backgroundText"
                    value={backgroundText}
                    onChange={(e) => setBackgroundText(e.target.value)}
                    placeholder="Paste your bio, key research findings, book summary, or any background you'd like us to know…"
                    rows={7}
                    className="bg-gray-50 border-gray-200 resize-none"
                    required
                  />
                </FieldGroup>

                <FieldGroup
                  label="Relevant links"
                  htmlFor="backgroundUrls"
                  hint="Website, book page, recent podcast appearances, papers — one URL per line."
                >
                  <Textarea
                    id="backgroundUrls"
                    value={backgroundUrls}
                    onChange={(e) => setBackgroundUrls(e.target.value)}
                    placeholder={"https://yourwebsite.com\nhttps://yourbook.com\nhttps://pubmed.ncbi.nlm.nih.gov/..."}
                    rows={3}
                    className="bg-gray-50 border-gray-200 resize-none font-mono text-xs"
                  />
                </FieldGroup>
              </div>

              {/* Section: Episode Logistics */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
                  Episode Logistics
                </h3>

                <FieldGroup
                  label="Preferred episode length (minutes)"
                  htmlFor="episodeLengthMin"
                  hint="Typical episodes run 45–60 minutes. Let us know if you have a preference."
                >
                  <Input
                    id="episodeLengthMin"
                    type="number"
                    min={10}
                    max={180}
                    value={episodeLengthMin}
                    onChange={(e) => setEpisodeLengthMin(Number(e.target.value))}
                    className="bg-gray-50 border-gray-200 w-32"
                  />
                </FieldGroup>
              </div>

              {/* Submit */}
              {submitMutation.error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{submitMutation.error.message}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitMutation.isPending}
                className="w-full bg-[#c8603a] hover:bg-[#b5522f] text-white font-semibold h-11"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Questionnaire"
                )}
              </Button>

              <p className="text-xs text-center text-gray-400">
                Your information is used solely to prepare for your podcast episode and will not be shared with third parties.
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
      <footer className="text-center py-6">
        <a
          href="https://theurbanmonk.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          theurbanmonk.com
        </a>
      </footer>
    </div>
  );
}
