import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Link2,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Info,
} from "lucide-react";

interface LinkRow {
  id: number;
  url: string;
  title: string;
  description: string | null;
  topicTags: string; // JSON string
  active: boolean;
  createdAt: Date;
}

interface LinkForm {
  url: string;
  title: string;
  description: string;
  topicTags: string; // comma-separated
  active: boolean;
}

const emptyForm = (): LinkForm => ({
  url: "",
  title: "",
  description: "",
  topicTags: "",
  active: true,
});

export default function VerifiedLinks() {
  const utils = trpc.useUtils();
  const { data: links = [], isLoading } = trpc.verifiedLinks.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LinkForm>(emptyForm());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = trpc.verifiedLinks.create.useMutation({
    onSuccess: () => {
      utils.verifiedLinks.list.invalidate();
      toast.success("Link added to verified list");
      setDialogOpen(false);
      setForm(emptyForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.verifiedLinks.update.useMutation({
    onSuccess: () => {
      utils.verifiedLinks.list.invalidate();
      toast.success("Link updated");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.verifiedLinks.delete.useMutation({
    onSuccess: () => {
      utils.verifiedLinks.list.invalidate();
      toast.success("Link removed");
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.verifiedLinks.toggleActive.useMutation({
    onSuccess: () => utils.verifiedLinks.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (link: LinkRow) => {
    setEditingId(link.id);
    const tags: string[] = JSON.parse(link.topicTags ?? "[]");
    setForm({
      url: link.url,
      title: link.title,
      description: link.description ?? "",
      topicTags: tags.join(", "),
      active: link.active,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const tags = form.topicTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (editingId !== null) {
      updateMutation.mutate({
        id: editingId,
        url: form.url,
        title: form.title,
        description: form.description || undefined,
        topicTags: tags,
        active: form.active,
      });
    } else {
      createMutation.mutate({
        url: form.url,
        title: form.title,
        description: form.description || undefined,
        topicTags: tags,
        active: form.active,
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            Verified Internal Links
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Only URLs in this list are allowed in generated blog posts. The AI
            is strictly forbidden from inventing or guessing any
            theurbanmonk.com URL not shown here. Hallucinated URLs are
            automatically scrubbed after generation.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Add Link
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
        <div>
          <strong>How this works:</strong> Before generating a blog post, the
          system injects the active links from this list (filtered by topic
          tags) into the AI prompt as the only allowed internal URLs. After
          generation, a scrubber scans the article and replaces any
          theurbanmonk.com link <em>not</em> in this list with a{" "}
          <code className="bg-black/30 px-1 rounded">[INTERNAL LINK: topic]</code>{" "}
          placeholder. Topic tags help the AI pick the most relevant links for
          each article — use keywords like <em>sleep, gut health, meditation</em>.
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm py-8 text-center">
          Loading verified links…
        </div>
      ) : links.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          <Link2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No verified links yet</p>
          <p className="text-sm mt-1">
            Add your first link to start controlling which URLs the AI can use.
          </p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Link
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">Active</TableHead>
                <TableHead>Title &amp; URL</TableHead>
                <TableHead>Topic Tags</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(links as LinkRow[]).map((link) => {
                const tags: string[] = (() => {
                  try {
                    return JSON.parse(link.topicTags ?? "[]");
                  } catch {
                    return [];
                  }
                })();
                return (
                  <TableRow key={link.id} className={link.active ? "" : "opacity-50"}>
                    <TableCell>
                      <Switch
                        checked={link.active}
                        onCheckedChange={(v) =>
                          toggleMutation.mutate({ id: link.id, active: v })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{link.title}</div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                      >
                        {link.url.length > 60
                          ? link.url.slice(0, 60) + "…"
                          : link.url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {link.description && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                          {link.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tags.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">
                            no tags — always included
                          </span>
                        ) : (
                          tags.map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-xs"
                            >
                              {t}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEdit(link)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(link.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId !== null ? "Edit Verified Link" : "Add Verified Link"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input
                placeholder="https://theurbanmonk.com/blog/sleep-optimization"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Link Title *</Label>
              <Input
                placeholder="How to Optimize Your Sleep for Peak Performance"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Brief description of what this page covers"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Topic Tags (comma-separated)</Label>
              <Input
                placeholder="sleep, circadian rhythm, recovery, cortisol"
                value={form.topicTags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, topicTags: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Tags help match this link to relevant blog articles. Leave blank
                to always include it.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="active-toggle"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
              <Label htmlFor="active-toggle">Active (included in AI prompts)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !form.url || !form.title}
            >
              {isSaving ? "Saving…" : editingId !== null ? "Save Changes" : "Add Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Verified Link?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This URL will no longer be available to the AI for internal linking.
            Existing blog posts are not affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteId !== null) deleteMutation.mutate({ id: deleteId });
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
