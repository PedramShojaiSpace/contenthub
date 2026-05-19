import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X, FileText, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export interface EnhancementDoc {
  name: string;
  text: string;
}

interface ChapterEnhancementPanelProps {
  chapterId: number;
  chapterTitle: string;
  onRegenerate: (opts: {
    enhancementInstructions: string;
    enhancementDocs: EnhancementDoc[];
    lengthPreset: string;
    proseStyle: string;
  }) => Promise<void>;
  isRegenerating: boolean;
}

const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5 MB per doc

export default function ChapterEnhancementPanel({
  chapterId,
  chapterTitle,
  onRegenerate,
  isRegenerating,
}: ChapterEnhancementPanelProps) {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [docs, setDocs] = useState<EnhancementDoc[]>([]);
  const [lengthPreset, setLengthPreset] = useState("standard");
  const [proseStyle, setProseStyle] = useState("narrative");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    const newDocs: EnhancementDoc[] = [];

    for (const file of files) {
      if (file.size > MAX_DOC_BYTES) {
        toast.error(`${file.name} is too large (max 5 MB)`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/ebook/upload-enhancement-doc", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          toast.error(`${file.name}: ${err.error ?? "Upload failed"}`);
          continue;
        }

        const { text } = await res.json();
        newDocs.push({ name: file.name, text });
        toast.success(`${file.name} added`);
      } catch {
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setDocs((prev) => [...prev, ...newDocs]);
    setUploading(false);
    // Reset file input so same file can be re-added
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeDoc = (index: number) => {
    setDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!instructions.trim() && docs.length === 0) {
      toast.error("Add enhancement instructions or upload at least one document.");
      return;
    }
    await onRegenerate({ enhancementInstructions: instructions, enhancementDocs: docs, lengthPreset, proseStyle });
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden mt-4">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium text-foreground"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Enhance this chapter with AI
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-background">
          {/* Instructions */}
          <div className="space-y-1.5">
            <Label htmlFor={`enhance-instructions-${chapterId}`} className="text-sm font-medium">
              Author directions
            </Label>
            <Textarea
              id={`enhance-instructions-${chapterId}`}
              placeholder={`e.g. "Make the tone more formal. Add two more examples about sleep deprivation. Include the 4-7-8 breathing protocol. Expand the section on cortisol."`}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              className="resize-none text-sm"
              disabled={isRegenerating}
            />
            <p className="text-xs text-muted-foreground">
              Describe exactly what you want changed — tone, examples, protocols, depth, structure, anything.
            </p>
          </div>

          {/* Reference documents */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Reference documents (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Upload transcripts, research papers, notes, or any source material. The AI will draw on them when rewriting.
              Accepted: PDF, TXT, MD, DOCX — up to 5 MB each.
            </p>

            {/* Uploaded docs list */}
            {docs.length > 0 && (
              <ul className="space-y-1.5">
                {docs.map((doc, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm bg-muted/30 rounded px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{doc.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {doc.text.split(/\s+/).length.toLocaleString()} words
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDoc(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      disabled={isRegenerating}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isRegenerating}
              className="gap-2"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Processing..." : "Add document"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.docx"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Length + Prose controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Chapter length</Label>
              <Select value={lengthPreset} onValueChange={setLengthPreset} disabled={isRegenerating}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise (500–700 w)</SelectItem>
                  <SelectItem value="standard">Standard (800–1,100 w)</SelectItem>
                  <SelectItem value="expansive">Expansive (1,200–1,600 w)</SelectItem>
                  <SelectItem value="immersive">Immersive (1,700–2,200 w)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Prose style</Label>
              <Select value={proseStyle} onValueChange={setProseStyle} disabled={isRegenerating}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct &amp; Punchy</SelectItem>
                  <SelectItem value="narrative">Narrative &amp; Story-driven</SelectItem>
                  <SelectItem value="academic">Academic &amp; Evidence-based</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isRegenerating || uploading}
            className="w-full gap-2"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Rewriting chapter…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Rewrite with enhancements
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
