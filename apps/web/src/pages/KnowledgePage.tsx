import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, RefreshCw, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress.js";
import { Badge } from "@/components/ui/badge.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.js";
import { Card, CardContent } from "@/components/ui/card.js";
import { listDocuments, uploadDocument, deleteDocument, retryDocument } from "../lib/api.js";
import type { Document } from "../types/index.js";

const POLL_INTERVAL_MS = 3000;

const STATUS_CONFIG: Record<Document["status"], { label: string; className: string }> = {
  pending: { label: "待处理", className: "bg-gray-100 text-gray-600 border-transparent" },
  processing: {
    label: "处理中",
    className: "bg-blue-100 text-blue-700 border-transparent animate-pulse",
  },
  done: { label: "完成", className: "bg-green-100 text-green-700 border-transparent" },
  failed: { label: "失败", className: "bg-red-100 text-red-700 border-transparent" },
};

export function StatusBadge({ status }: { status: Document["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

export function KnowledgePage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const { data } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
    refetchInterval: (query) => {
      const hasActive = query.state.data?.data.some(
        (d) => d.status === "pending" || d.status === "processing",
      );
      return hasActive ? POLL_INTERVAL_MS : false;
    },
  });

  const upload = useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const remove = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const retry = useMutation({
    mutationFn: retryDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((f) => upload.mutate(f));
    },
    [upload],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const documents = data?.data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">知识库</h1>

      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors
          ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          拖拽文件到此处，或<span className="text-primary underline ml-1">点击选择文件</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">支持 .txt / .md，单文件 ≤ 10MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {upload.isPending && <p className="text-sm text-muted-foreground mb-4">上传中…</p>}
      {upload.isError && <p className="text-sm text-destructive mb-4">{String(upload.error)}</p>}

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">暂无文档，请上传</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4">文件名</TableHead>
                  <TableHead className="px-4">格式</TableHead>
                  <TableHead className="px-4">状态</TableHead>
                  <TableHead className="px-4">chunks</TableHead>
                  <TableHead className="px-4">上传时间</TableHead>
                  <TableHead className="px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onDelete={() => remove.mutate(doc.id)}
                    onRetry={() => retry.mutate(doc.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDelete={() => remove.mutate(doc.id)}
                onRetry={() => retry.mutate(doc.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  onDelete,
  onRetry,
}: {
  doc: Document;
  onDelete: () => void;
  onRetry: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate max-w-50" title={doc.filename}>
            {doc.filename}
          </span>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground uppercase text-xs">
        {doc.fileType}
      </TableCell>
      <TableCell className="px-4 py-3">
        <StatusBadge status={doc.status} />
        {doc.status === "processing" && doc.totalChunks != null && (
          <div className="mt-1 space-y-0.5">
            <Progress
              value={Math.round(((doc.processedChunks ?? 0) / doc.totalChunks) * 100)}
              className="h-1 w-32"
            />
            <span className="text-xs text-muted-foreground">
              {doc.processedChunks ?? 0}/{doc.totalChunks} chunks
            </span>
          </div>
        )}
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">{doc.totalChunks ?? "—"}</TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">
        {new Date(doc.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          {doc.status === "failed" && (
            <button
              onClick={onRetry}
              className="text-muted-foreground hover:text-foreground"
              title="重试"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function DocumentCard({
  doc,
  onDelete,
  onRetry,
}: {
  doc: Document;
  onDelete: () => void;
  onRetry: () => void;
}) {
  return (
    <Card className="gap-0 rounded-lg py-0 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm truncate">{doc.filename}</span>
          </div>
          <StatusBadge status={doc.status} />
        </div>
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-3">
          <span className="uppercase">{doc.fileType}</span>
          {doc.totalChunks != null && <span>{doc.totalChunks} chunks</span>}
          <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
        </div>
        {doc.status === "processing" && doc.totalChunks != null && (
          <div className="mt-2 space-y-0.5">
            <Progress
              value={Math.round(((doc.processedChunks ?? 0) / doc.totalChunks) * 100)}
              className="h-1 w-full"
            />
            <span className="text-xs text-muted-foreground">
              {doc.processedChunks ?? 0}/{doc.totalChunks} chunks
            </span>
          </div>
        )}
        <div className="mt-3 flex gap-2 justify-end">
          {doc.status === "failed" && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" /> 重试
            </button>
          )}
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> 删除
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
