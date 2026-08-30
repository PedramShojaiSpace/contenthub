import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Download, ExternalLink, FileCheck2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

const META_AUDIENCES_URL = "https://business.facebook.com/adsmanager/audiences?act=10207858653523297";

export default function ApolloManualAudienceUpload() {
  const downloadMutation = trpc.apolloManualAudienceExport.downloadApprovedInitialCsv.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${data.filename} downloaded — ${data.verifiedExclusiveEmails.toLocaleString()} verified exclusive business emails.`);
    },
    onError: error => toast.error(`Protected CSV could not be prepared: ${error.message}`),
  });

  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
        <div className="border-b border-stone-200 pb-7">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            Owner-only manual audience workflow
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
            Medical Doctors — Meta Customer List
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
            This is the first approved manual upload. The protected approved snapshot is delivered only to the authenticated owner, contains one
            <code className="mx-1 rounded bg-stone-200 px-1.5 py-0.5 text-sm text-stone-800">email</code>
            column, and never calls Meta from this page.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="border border-emerald-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
              <div>
                <h2 className="text-lg font-semibold text-stone-950">Approved cohort</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-6 border-b border-stone-100 pb-3">
                    <dt className="text-stone-500">Audience name</dt>
                    <dd className="text-right font-medium text-stone-900">UM Apollo — Medical Doctors</dd>
                  </div>
                  <div className="flex justify-between gap-6 border-b border-stone-100 pb-3">
                    <dt className="text-stone-500">Verified exclusive emails</dt>
                    <dd className="font-medium text-stone-900">989</dd>
                  </div>
                  <div className="flex justify-between gap-6 border-b border-stone-100 pb-3">
                    <dt className="text-stone-500">File schema</dt>
                    <dd className="font-mono text-stone-900">email</dd>
                  </div>
                  <div className="flex justify-between gap-6">
                    <dt className="text-stone-500">Data-source declaration</dt>
                    <dd className="max-w-[14rem] text-right font-medium text-stone-900">Partner/data-provider business contacts</dd>
                  </div>
                </dl>
              </div>
            </div>

            <Button
              className="mt-6 w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
              onClick={() => downloadMutation.mutate()}
              disabled={downloadMutation.isPending}
            >
              <Download className="h-4 w-4" />
              {downloadMutation.isPending ? "Preparing protected CSV…" : "Download Medical Doctors CSV"}
            </Button>
            <p className="mt-3 text-xs leading-5 text-stone-500">
              This action downloads only the approved local file. It does not create a Meta audience, upload contacts,
              create a lookalike, or alter ads, budgets, outreach, or the existing Health Intent Leads audience.
            </p>
          </section>

          <aside className="border border-stone-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
              <FileCheck2 className="h-4 w-4 text-emerald-700" />
              After the download
            </div>
            <ol className="mt-4 space-y-4 text-sm leading-6 text-stone-700">
              <li className="flex gap-3"><span className="font-semibold text-emerald-700">1.</span><span>Keep the downloaded CSV private and unchanged. Do not edit, forward, attach, or upload it anywhere except the designated Meta Customer List flow.</span></li>
              <li className="flex gap-3"><span className="font-semibold text-emerald-700">2.</span><span>In Meta, choose <strong>Create audience → Custom audience → Customer list</strong>, then choose <strong>Inclusions</strong>.</span></li>
              <li className="flex gap-3"><span className="font-semibold text-emerald-700">3.</span><span>Map the single column to <strong>Email</strong>; use the exact audience name shown on this page; select the accurate partner/data-provider source option if Meta asks.</span></li>
              <li className="flex gap-3"><span className="font-semibold text-emerald-700">4.</span><span>Stop before <strong>Import and create</strong> if Meta displays a declaration that is not true. Do not create ads, lookalikes, or audience sharing.</span></li>
            </ol>
            <a
              href={META_AUDIENCES_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 underline underline-offset-4"
            >
              Open Meta Audience Manager <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </aside>
        </div>

        <div className="mt-6 flex items-start gap-3 border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p>
            Upload confirmation applies to this one approved Medical Doctors cohort only. The next cohort must be separately
            confirmed before its protected file is made available.
          </p>
        </div>
      </section>
    </main>
  );
}
