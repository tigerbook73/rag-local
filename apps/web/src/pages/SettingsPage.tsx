import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getSettings,
  updateSettings,
  listPromptTemplates,
  createPromptTemplate,
  updatePromptTemplate,
  deletePromptTemplate,
} from "@/lib/api";
import type { PromptTemplate, Settings } from "@/types/index";

// ── LLM Tab ──────────────────────────────────────────────────────────

function PromptTemplateDialog({
  template,
  open,
  onClose,
}: {
  template?: PromptTemplate;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(template?.name ?? "");
  const [content, setContent] = useState(template?.content ?? "");

  useEffect(() => {
    setName(template?.name ?? "");
    setContent(template?.content ?? "");
  }, [template, open]);

  const mutation = useMutation({
    mutationFn: () =>
      template
        ? updatePromptTemplate(template.id, { name, content })
        : createPromptTemplate({ name, content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prompt-templates"] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Concise QA"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-content">System Prompt</Label>
            <Textarea
              id="tpl-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="You are a helpful assistant..."
            />
          </div>
          {mutation.isError && <p className="text-xs text-destructive">Failed to save template.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim() || !content.trim()}
          >
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LlmTab() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  const { data: templatesRes, isLoading: tplLoading } = useQuery({
    queryKey: ["prompt-templates"],
    queryFn: listPromptTemplates,
  });

  const [provider, setProvider] = useState<"openai" | "deepseek">("deepseek");
  const [saved, setSaved] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | undefined>();

  useEffect(() => {
    if (settings) setProvider(settings.llmProvider);
  }, [settings]);

  const settingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings"], updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => updatePromptTemplate(id, { isActive: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompt-templates"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePromptTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompt-templates"] }),
  });

  if (settingsLoading || tplLoading) {
    return <div className="text-muted-foreground text-sm">Loading...</div>;
  }

  const templates = templatesRes?.data ?? [];

  return (
    <div className="space-y-8 max-w-md">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Provider</h3>
        <div className="space-y-1.5">
          <Label>LLM Provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as "openai" | "deepseek")}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deepseek">DeepSeek</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {provider === "deepseek"
              ? "Model: deepseek-chat · Reads DEEPSEEK_API_KEY"
              : "Model: gpt-4o · Reads OPENAI_API_KEY"}
          </p>
        </div>
        <Button
          onClick={() => settingsMutation.mutate({ llmProvider: provider })}
          disabled={settingsMutation.isPending || provider === settings?.llmProvider}
          className="w-24"
        >
          {settingsMutation.isPending ? "Saving..." : saved ? "Saved!" : "Save"}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Prompt Templates</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingTemplate(undefined);
              setDialogOpen(true);
            }}
          >
            + New
          </Button>
        </div>

        {templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No templates — the built-in default system prompt is used.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{tpl.name}</span>
                  {tpl.isActive && (
                    <Badge variant="default" className="shrink-0 text-xs">
                      active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {!tpl.isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => activateMutation.mutate(tpl.id)}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setEditingTemplate(tpl);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  {!tpl.isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(tpl.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PromptTemplateDialog
        template={editingTemplate}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

// ── Indexing Tab ──────────────────────────────────────────────────────

function IndexingTab() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const [form, setForm] = useState<Partial<Settings>>({});
  const [showReindexAlert, setShowReindexAlert] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings"], updated);
      setShowReindexAlert(updated.requiresReindex === true);
    },
  });

  if (isLoading || !settings) {
    return <div className="text-muted-foreground text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-md">
      <Alert>
        <AlertDescription className="text-xs">
          Changing these settings requires re-embedding all documents to take effect.
        </AlertDescription>
      </Alert>

      {showReindexAlert && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">
            Chunking parameters changed — please re-process existing documents for the new settings
            to apply.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Chunking Strategy</Label>
          <Select
            value={form.chunkingStrategy ?? "fixed"}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, chunkingStrategy: v as "fixed" | "semantic" }))
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed Size</SelectItem>
              <SelectItem value="semantic">Semantic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="chunkSize">Chunk Size</Label>
          <Input
            id="chunkSize"
            type="number"
            min={64}
            value={form.chunkSize ?? 512}
            onChange={(e) => setForm((f) => ({ ...f, chunkSize: Number(e.target.value) }))}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">Characters per chunk (min 64)</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="chunkOverlap">Chunk Overlap</Label>
          <Input
            id="chunkOverlap"
            type="number"
            min={0}
            value={form.chunkOverlap ?? 50}
            onChange={(e) => setForm((f) => ({ ...f, chunkOverlap: Number(e.target.value) }))}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">Overlap characters between chunks</p>
        </div>
      </div>

      <Button
        onClick={() =>
          mutation.mutate({
            chunkingStrategy: form.chunkingStrategy,
            chunkSize: form.chunkSize,
            chunkOverlap: form.chunkOverlap,
          })
        }
        disabled={mutation.isPending}
        className="w-24"
      >
        {mutation.isPending ? "Saving..." : "Save"}
      </Button>

      {mutation.isError && <p className="text-xs text-destructive">Failed to save settings.</p>}
    </div>
  );
}

// ── Query Tab ─────────────────────────────────────────────────────────

function QueryTab() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const [form, setForm] = useState<Partial<Settings>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings"], updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading || !settings) {
    return <div className="text-muted-foreground text-sm">Loading...</div>;
  }

  function handleSave() {
    mutation.mutate({
      hydeEnabled: form.hydeEnabled,
      rerankingEnabled: form.rerankingEnabled,
      onlineEvaluationEnabled: form.onlineEvaluationEnabled,
      topK: form.topK,
      conversationHistoryWindow: form.conversationHistoryWindow,
    });
  }

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">HyDE</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generate a hypothetical answer before retrieval
            </p>
          </div>
          <Switch
            checked={form.hydeEnabled ?? false}
            onCheckedChange={(v) => setForm((f) => ({ ...f, hydeEnabled: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Re-ranking</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Re-rank retrieved chunks with a cross-encoder
            </p>
          </div>
          <Switch
            checked={form.rerankingEnabled ?? false}
            onCheckedChange={(v) => setForm((f) => ({ ...f, rerankingEnabled: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Online Evaluation</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically evaluate answers with LLM-as-judge
            </p>
          </div>
          <Switch
            checked={form.onlineEvaluationEnabled ?? false}
            onCheckedChange={(v) => setForm((f) => ({ ...f, onlineEvaluationEnabled: v }))}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="topK">Top-K</Label>
          <Input
            id="topK"
            type="number"
            min={1}
            value={form.topK ?? 5}
            onChange={(e) => setForm((f) => ({ ...f, topK: Number(e.target.value) }))}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">Number of chunks to retrieve</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="historyWindow">Conversation History Window</Label>
          <Input
            id="historyWindow"
            type="number"
            min={0}
            value={form.conversationHistoryWindow ?? 0}
            onChange={(e) =>
              setForm((f) => ({ ...f, conversationHistoryWindow: Number(e.target.value) }))
            }
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Number of past rounds to include as context (0 = disabled)
          </p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={mutation.isPending} className="w-24">
        {mutation.isPending ? "Saving..." : saved ? "Saved!" : "Save"}
      </Button>

      {mutation.isError && <p className="text-xs text-destructive">Failed to save settings.</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-6">Settings</h1>
      <Tabs defaultValue="llm">
        <TabsList>
          <TabsTrigger value="llm">LLM</TabsTrigger>
          <TabsTrigger value="indexing">Indexing</TabsTrigger>
          <TabsTrigger value="query">Query</TabsTrigger>
        </TabsList>

        <TabsContent value="llm" className="mt-6">
          <LlmTab />
        </TabsContent>

        <TabsContent value="indexing" className="mt-6">
          <IndexingTab />
        </TabsContent>

        <TabsContent value="query" className="mt-6">
          <QueryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
