import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, RefreshCw, FileText } from "lucide-react";
import { listDocuments, uploadDocument, deleteDocument, retryDocument } from "../lib/api.js";
import type { Document } from "../types/api.js";

const POLL_INTERVAL_MS = 3000;

const STATUS_CONFIG: Record<Document["status"], { label: string; className: string }> = {
  pending: { label: "待处理", className: "bg-gray-100 text-gray-600" },
  processing: { label: "处理中", className: "bg-blue-100 text-blue-700 animate-pulse" },
  done: { label: "完成", className: "bg-green-100 text-green-700" },
  failed: { label: "失败", className: "bg-red-100 text-red-700" },
};

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
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">文件名</th>
                  <th className="text-left px-4 py-3 font-medium">格式</th>
                  <th className="text-left px-4 py-3 font-medium">状态</th>
                  <th className="text-left px-4 py-3 font-medium">chunks</th>
                  <th className="text-left px-4 py-3 font-medium">上传时间</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onDelete={() => remove.mutate(doc.id)}
                    onRetry={() => retry.mutate(doc.id)}
                  />
                ))}
              </tbody>
            </table>
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

function StatusBadge({ status }: { status: Document["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
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
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="truncate max-w-[200px]" title={doc.filename}>
          {doc.filename}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground uppercase text-xs">{doc.fileType}</td>
      <td className="px-4 py-3">
        <StatusBadge status={doc.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{doc.totalChunks ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {new Date(doc.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
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
      </td>
    </tr>
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
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-sm truncate">{doc.filename}</span>
        </div>
        <StatusBadge status={doc.status} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-3">
        <span className="uppercase">{doc.fileType}</span>
        {doc.totalChunks != null && <span>{doc.totalChunks} chunks</span>}
        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
      </div>
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
    </div>
  );
}
