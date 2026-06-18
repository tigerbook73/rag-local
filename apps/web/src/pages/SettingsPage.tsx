import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getSettings, updateSettings } from "@/lib/api";
import type { Settings } from "@/types/index";
import { useState, useEffect } from "react";

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
            min={1}
            value={form.conversationHistoryWindow ?? 0}
            onChange={(e) =>
              setForm((f) => ({ ...f, conversationHistoryWindow: Number(e.target.value) }))
            }
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Number of past messages to include as context
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

export function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-6">Settings</h1>
      <Tabs defaultValue="query">
        <TabsList>
          <TabsTrigger value="llm">LLM</TabsTrigger>
          <TabsTrigger value="indexing">Indexing</TabsTrigger>
          <TabsTrigger value="query">Query</TabsTrigger>
        </TabsList>

        <TabsContent value="llm" className="mt-6">
          <div className="text-muted-foreground text-sm">LLM settings — coming in Phase 4</div>
        </TabsContent>

        <TabsContent value="indexing" className="mt-6">
          <div className="text-muted-foreground text-sm">Indexing settings — coming in Phase 4</div>
        </TabsContent>

        <TabsContent value="query" className="mt-6">
          <QueryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
