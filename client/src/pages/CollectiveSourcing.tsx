import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ShoppingBag,
  Plus,
  Search,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  XCircle,
  Package,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type Candidate = {
  id: number;
  title: string;
  vendor: string | null;
  productType: string | null;
  description: string | null;
  price: string | null;
  imageUrl: string | null;
  tags: string | null;
  supplierName: string | null;
  supplierDomain: string | null;
  brandFitScore: number | null;
  brandFitReason: string | null;
  toxicFlags: string | null;
  status: string;
  notes: string | null;
  createdAt: number;
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge variant="outline" className="text-xs">Unscored</Badge>;
  if (score >= 70) return <Badge className="bg-emerald-600 text-white text-xs">{score} — Strong Fit</Badge>;
  if (score >= 40) return <Badge className="bg-amber-500 text-white text-xs">{score} — Borderline</Badge>;
  return <Badge className="bg-red-600 text-white text-xs">{score} — Poor Fit</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    candidate: "bg-slate-200 text-slate-700",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-700",
    imported: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function AddProductModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    title: "", vendor: "", productType: "", description: "",
    price: "", tags: "", supplierName: "", supplierDomain: "", imageUrl: "",
  });

  const addMutation = trpc.collective.addCandidate.useMutation({
    onSuccess: () => { toast.success("Product added to sourcing pipeline"); onAdded(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Product title is required"); return; }
    addMutation.mutate({
      title: form.title.trim(),
      vendor: form.vendor || undefined,
      productType: form.productType || undefined,
      description: form.description || undefined,
      price: form.price || undefined,
      tags: form.tags || undefined,
      supplierName: form.supplierName || undefined,
      supplierDomain: form.supplierDomain || undefined,
      imageUrl: form.imageUrl || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-slate-900">Add Collective Product</h2>
          <p className="text-sm text-slate-500 mt-1">
            Browse{" "}
            <a href="https://admin.shopify.com/apps/merchant-to-merchant" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">
              Shopify Collective
            </a>{" "}
            in your admin, then paste the product details here for AI brand-fit scoring.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Product Title *</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Organic Ashwagandha Root Extract" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Vendor / Brand</label>
              <Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="e.g. Sun Potion" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Product Type</label>
              <Input value={form.productType} onChange={e => setForm(f => ({ ...f, productType: e.target.value }))} placeholder="e.g. Adaptogen Supplement" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Paste the product description from Shopify Collective..." rows={4} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Price</label>
              <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. $45.00" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Supplier Domain</label>
              <Input value={form.supplierDomain} onChange={e => setForm(f => ({ ...f, supplierDomain: e.target.value }))} placeholder="e.g. sunpotion.com" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tags (comma-separated)</label>
            <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. adaptogen, organic, stress-relief, non-gmo" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Product Image URL (optional)</label>
            <Input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." className="mt-1" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={addMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {addMutation.isPending ? "Adding..." : "Add & Score"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductCard({ candidate, onRefresh }: { candidate: Candidate; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const scoreMutation = trpc.collective.scoreProduct.useMutation({
    onSuccess: () => { toast.success("Brand-fit score updated"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const statusMutation = trpc.collective.updateStatus.useMutation({
    onSuccess: (_, vars) => { toast.success(`Marked as ${vars.status}`); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const importMutation = trpc.collective.importToShopify.useMutation({
    onSuccess: (data) => { toast.success(data.message); window.open(data.shopifyAdminUrl, "_blank"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.collective.deleteCandidate.useMutation({
    onSuccess: () => { toast.success("Removed from pipeline"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const toxicFlags: string[] = (() => {
    try { return candidate.toxicFlags ? JSON.parse(candidate.toxicFlags) : []; }
    catch { return []; }
  })();

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${toxicFlags.length > 0 ? "border-red-200" : "border-slate-200"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {candidate.imageUrl ? (
            <img src={candidate.imageUrl} alt={candidate.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-slate-100" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm leading-tight">{candidate.title}</h3>
                {candidate.vendor && <p className="text-xs text-slate-500 mt-0.5">{candidate.vendor}{candidate.productType ? ` · ${candidate.productType}` : ""}</p>}
              </div>
              <StatusBadge status={candidate.status} />
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <ScoreBadge score={candidate.brandFitScore} />
              {candidate.price && <span className="text-xs text-slate-500">{candidate.price}</span>}
              {toxicFlags.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                  <AlertTriangle className="w-3 h-3" /> {toxicFlags.length} toxic flag{toxicFlags.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mt-3 transition-colors">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide details" : "Show details"}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 border-t pt-3">
            {candidate.description && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{candidate.description}</p>
              </div>
            )}
            {candidate.brandFitReason && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">AI Assessment</p>
                <p className="text-sm text-slate-700 leading-relaxed">{candidate.brandFitReason}</p>
              </div>
            )}
            {toxicFlags.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Toxic Flags</p>
                <div className="flex flex-wrap gap-1.5">
                  {toxicFlags.map((flag, i) => (
                    <span key={i} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">{flag}</span>
                  ))}
                </div>
              </div>
            )}
            {candidate.tags && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.tags.split(",").map((t, i) => (
                    <span key={i} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{t.trim()}</span>
                  ))}
                </div>
              </div>
            )}
            {candidate.supplierDomain && (
              <a href={`https://${candidate.supplierDomain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                <ExternalLink className="w-3 h-3" /> {candidate.supplierDomain}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => scoreMutation.mutate({ id: candidate.id })} disabled={scoreMutation.isPending} className="text-xs">
          <Sparkles className="w-3 h-3 mr-1" />
          {scoreMutation.isPending ? "Scoring..." : candidate.brandFitScore === null ? "Score with AI" : "Re-score"}
        </Button>
        {candidate.status === "candidate" && (
          <>
            <Button size="sm" onClick={() => statusMutation.mutate({ id: candidate.id, status: "approved" })} disabled={statusMutation.isPending} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: candidate.id, status: "rejected" })} disabled={statusMutation.isPending} className="text-xs text-red-600 border-red-200 hover:bg-red-50">
              <XCircle className="w-3 h-3 mr-1" /> Reject
            </Button>
          </>
        )}
        {candidate.status === "approved" && (
          <Button size="sm" onClick={() => importMutation.mutate({ id: candidate.id })} disabled={importMutation.isPending} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
            <ExternalLink className="w-3 h-3 mr-1" />
            {importMutation.isPending ? "Importing..." : "Import to Store"}
          </Button>
        )}
        {candidate.status === "rejected" && (
          <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: candidate.id, status: "candidate" })} disabled={statusMutation.isPending} className="text-xs">
            Restore
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate({ id: candidate.id })} disabled={deleteMutation.isPending} className="text-xs text-slate-400 hover:text-red-500 ml-auto">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export default function CollectiveSourcing() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "candidate" | "approved" | "rejected" | "imported">("all");
  const [minScore, setMinScore] = useState<number | undefined>(undefined);

  const { data: candidates = [], isLoading, refetch } = trpc.collective.getCandidates.useQuery({
    status: statusFilter,
    search: search || undefined,
    minScore,
  });

  const { data: stats } = trpc.collective.getStats.useQuery();

  const scoreAllMutation = trpc.collective.scoreAllUnscored.useMutation({
    onSuccess: (data) => { toast.success(`Scored ${data.scored} products`); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const unscoredCount = candidates.filter(c => c.brandFitScore === null).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-6 h-6 text-emerald-600" />
              <h1 className="text-2xl font-bold text-slate-900">Collective Sourcing</h1>
            </div>
            <p className="text-slate-500 text-sm">
              Source products from Shopify Collective that meet Urban Monk brand criteria: functional medicine, personal development, non-toxic.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://admin.shopify.com/apps/merchant-to-merchant" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100 transition-colors">
              <ExternalLink className="w-4 h-4" /> Browse Collective
            </a>
            <Button onClick={() => setShowAddModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-1.5" /> Add Product
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Total", value: stats.total, color: "text-slate-700" },
              { label: "Candidates", value: stats.candidates, color: "text-slate-500" },
              { label: "Approved", value: stats.approved, color: "text-emerald-700" },
              { label: "Imported", value: stats.imported, color: "text-blue-700" },
              { label: "Avg Score", value: stats.avgScore !== null ? `${stats.avgScore}/100` : "—", color: "text-amber-700" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg border border-slate-200 p-3 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-sm text-emerald-800">
          <strong>How to use:</strong> Browse{" "}
          <a href="https://admin.shopify.com/apps/merchant-to-merchant" target="_blank" rel="noopener noreferrer" className="underline font-medium">Shopify Collective</a>{" "}
          in your Shopify admin → find a product → click <strong>Add Product</strong> and paste the details → AI scores it against Urban Monk brand criteria → Approve or Reject → Import approved products to your store.
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products, vendors, tags..." className="pl-9" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700">
            <option value="all">All Statuses</option>
            <option value="candidate">Candidates</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="imported">Imported</option>
          </select>
          <select value={minScore ?? ""} onChange={e => setMinScore(e.target.value ? Number(e.target.value) : undefined)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700">
            <option value="">Any Score</option>
            <option value="70">≥ 70 (Strong Fit)</option>
            <option value="40">≥ 40 (Borderline+)</option>
          </select>
          {unscoredCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => scoreAllMutation.mutate()} disabled={scoreAllMutation.isPending} className="text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              {scoreAllMutation.isPending ? "Scoring..." : `Score All (${unscoredCount})`}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-slate-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
            Loading products...
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">No products yet</h3>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              Browse Shopify Collective in your admin and add products here to score them against Urban Monk brand criteria.
            </p>
            <div className="flex items-center justify-center gap-3">
              <a href="https://admin.shopify.com/apps/merchant-to-merchant" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 hover:bg-emerald-100 transition-colors">
                <ExternalLink className="w-4 h-4" /> Browse Collective
              </a>
              <Button onClick={() => setShowAddModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="w-4 h-4 mr-1.5" /> Add Product
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {candidates.map(c => (
              <ProductCard key={c.id} candidate={c} onRefresh={refetch} />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddProductModal onClose={() => setShowAddModal(false)} onAdded={() => refetch()} />
      )}
    </div>
  );
}
