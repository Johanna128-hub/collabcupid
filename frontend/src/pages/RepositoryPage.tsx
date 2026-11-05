import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { FolderOpen, Download, History, FileText, Save, Trash2, X } from "lucide-react";
import {
  listRepoFiles, uploadRepoFile, updateRepoFileContent,
  getRepoFileDownloadUrl, getRepoFileTextContent, deleteRepoFile,
} from "../lib/firestoreApi";
import { errorMessage } from "../lib/errors";
import { useAuth } from "../lib/AuthContext";
import Avatar from "../components/Avatar";
import type { RepositoryFile, FileVersion } from "../types";

const TEXT_EXT = new Set([
  "py", "js", "ts", "tsx", "jsx", "json", "md", "txt", "css", "html",
  "yml", "yaml", "java", "c", "cpp", "h", "go", "rb", "php", "sql", "xml", "sh",
]);

function langFor(path: string) {
  const ext = path.split(".").pop() || "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", json: "json", md: "markdown", css: "css", html: "html",
    yml: "yaml", yaml: "yaml", java: "java", c: "c", cpp: "cpp", go: "go",
    rb: "ruby", php: "php", sql: "sql", sh: "shell", xml: "xml", txt: "plaintext",
  };
  return map[ext] || "plaintext";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(ms: number) {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export default function RepositoryPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<RepositoryFile | null>(null);
  const [content, setContent] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setFiles(await listRepoFiles(id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const isTextFile = (path: string) => TEXT_EXT.has(path.split(".").pop()?.toLowerCase() || "");

  const openFile = async (file: RepositoryFile) => {
    setActiveFile(file);
    setShowHistory(false);
    if (isTextFile(file.path) && file.latestVersion) {
      try {
        setContent(await getRepoFileTextContent(file.latestVersion.storagePath));
      } catch (err) {
        setError(errorMessage(err));
        setContent("");
      }
    } else {
      setContent("");
    }
  };

  const uploadFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !id || !user) return;
    const file = fileList[0];
    setError(null);
    try {
      await uploadRepoFile(id, file.name, file, user);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveContent = async () => {
    if (!activeFile || !id || !user) return;
    setSaving(true);
    try {
      await updateRepoFileContent(id, activeFile.id, activeFile.path, content, user);
      const updated = await listRepoFiles(id);
      setFiles(updated);
      setActiveFile(updated.find((f) => f.id === activeFile.id) || null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = async (file: RepositoryFile, version?: FileVersion) => {
    const target = version || file.latestVersion;
    if (!target) return;
    try {
      const url = await getRepoFileDownloadUrl(target.storagePath);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.path.split("/").pop() || file.path;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteFile = async (file: RepositoryFile) => {
    if (!id) return;
    if (!confirm(`Remove "${file.path}" from the repository?`)) return;
    try {
      await deleteRepoFile(id, file.id);
      if (activeFile?.id === file.id) setActiveFile(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFile(e.dataTransfer.files);
  };

  const contributorCount = new Set(files.flatMap((f) => f.versions.map((v) => v.contributorId))).size;

  if (loading) return <p className="text-sm text-gray-400">Loading repository...</p>;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Repository</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Shared files for this project · {files.length} file{files.length === 1 ? "" : "s"}
          {contributorCount > 0 ? ` · ${contributorCount} contributor${contributorCount === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => uploadFile(e.target.files)} />
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`cursor-pointer border-2 border-dashed rounded-2xl text-center py-9 mb-6 transition-colors ${
          dragOver ? "border-brand-500 bg-brand-50" : "border-[#D8BFFA] bg-[#FBF9FF]"
        }`}
      >
        <FolderOpen size={26} className="mx-auto mb-2 text-brand-700" />
        <p className="text-sm font-semibold text-brand-900">Drag &amp; drop a file here, or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">Max 25 MB · re-uploading a file with the same name creates a new version</p>
      </div>

      <div className="bg-white border border-[#ECE8F5] rounded-2xl overflow-hidden mb-6">
        {files.length === 0 ? (
          <p className="text-sm text-gray-400 px-6 py-8 text-center">No files yet. Upload the first one!</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {["File", "Uploaded by", "Version", "Size", "Last modified", ""].map((h) => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wide text-gray-400 px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => openFile(f)}
                  className={`cursor-pointer border-t border-[#F1EEF8] group ${activeFile?.id === f.id ? "bg-brand-50/60" : "hover:bg-gray-50"}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5 font-semibold text-gray-900">
                      <span className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                        <FileText size={14} />
                      </span>
                      <span className="truncate">{f.path}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13.5px] text-gray-600">{f.latestVersion?.contributorName || "—"}</td>
                  <td className="px-5 py-3.5">
                    {f.latestVersion && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800">v{f.latestVersion.versionNumber}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[13.5px] text-gray-600">{f.latestVersion ? formatSize(f.latestVersion.sizeBytes) : "—"}</td>
                  <td className="px-5 py-3.5 text-[13.5px] text-gray-600">{timeAgo(f.updatedAtMs)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteFile(f); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {activeFile && (
        <div className="bg-white border border-[#ECE8F5] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <p className="font-semibold text-gray-900">{activeFile.path}</p>
              {activeFile.latestVersion && (
                <p className="text-xs text-gray-500 mt-0.5">
                  v{activeFile.latestVersion.versionNumber} · {formatSize(activeFile.latestVersion.sizeBytes)} · by {activeFile.latestVersion.contributorName}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowHistory((s) => !s)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E4DEF2] text-brand-700 hover:bg-brand-50">
                <History size={13} /> History
              </button>
              <button onClick={() => downloadFile(activeFile)} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E4DEF2] text-brand-700 hover:bg-brand-50">
                <Download size={13} /> Download
              </button>
              {isTextFile(activeFile.path) && (
                <button onClick={saveContent} disabled={saving} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg cc-gradient-btn text-white disabled:opacity-60">
                  <Save size={13} /> {saving ? "Saving..." : "Save"}
                </button>
              )}
              <button onClick={() => setActiveFile(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <X size={15} />
              </button>
            </div>
          </div>

          {showHistory ? (
            <div className="space-y-1.5">
              {activeFile.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={v.contributorName} size={24} />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">Version {v.versionNumber}</p>
                      <p className="text-xs text-gray-500 truncate">{v.contributorName} · {new Date(v.uploadedAtMs).toLocaleString()} · {formatSize(v.sizeBytes)}</p>
                    </div>
                  </div>
                  <button onClick={() => downloadFile(activeFile, v)} className="text-xs font-semibold text-brand-600 hover:underline shrink-0 ml-2">Download</button>
                </div>
              ))}
            </div>
          ) : isTextFile(activeFile.path) ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <Editor
                height="420px"
                language={langFor(activeFile.path)}
                value={content}
                onChange={(v) => setContent(v || "")}
                theme="light"
                options={{ minimap: { enabled: false }, fontSize: 13 }}
              />
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-6 text-center">
              This file type can't be previewed in the browser. Use Download to view it.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
