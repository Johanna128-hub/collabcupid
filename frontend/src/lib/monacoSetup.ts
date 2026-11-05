import { loader } from "@monaco-editor/react";

// Serve Monaco's editor assets from our own /public folder instead of the
// jsdelivr CDN @monaco-editor/react defaults to -- keeps the app fully
// self-contained and working with no internet access at runtime.
loader.config({ paths: { vs: "/monaco-editor/vs" } });
