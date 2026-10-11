import { CopilotChat, CopilotKitProvider, useAgent, useAgentContext } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createChangeTracker } from "./messages";
import { readResumeId, rememberResumeId, uploadCv } from "./resume";

/** Tells the embedding app which resource changed, only ever to appOrigin. */
function ChangeNotifier({ appOrigin }: { appOrigin: string }) {
  const { agent } = useAgent({ agentId: "default" });
  useEffect(() => {
    if (window.parent === window) return;
    const tracker = createChangeTracker((message) => window.parent.postMessage(message, appOrigin));
    const { unsubscribe } = agent.subscribe({
      onToolCallStartEvent: ({ event }) => tracker.started(event.toolCallId, event.toolCallName),
      onToolCallResultEvent: ({ event }) => tracker.result(event.toolCallId, event.content),
    });
    return unsubscribe;
  }, [agent, appOrigin]);
  return null;
}

/** Hands the agent the résumé id as `avicv_resume_id` (spec 08). */
function ResumeContext({ resumeId }: { resumeId: string | null }) {
  useAgentContext({
    description: "avicv_resume_id: the user's AviCV résumé id, empty when they have not uploaded a CV yet",
    value: { avicv_resume_id: resumeId ?? "" },
  });
  return null;
}

function UploadButton({ onUploaded }: { onUploaded: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadCv(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div style={{ padding: "8px 12px", display: "flex", gap: 12, alignItems: "center" }}>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : "Upload your CV to AviCV"}
      </button>
      {error && (
        <span role="alert" style={{ color: "#991b1b" }}>
          {error}
        </span>
      )}
    </div>
  );
}

function App({ appOrigin }: { appOrigin: string }) {
  const [resumeId, setResumeId] = useState(() => readResumeId(location.search, localStorageOrUndefined()));
  const uploaded = (id: string) => {
    rememberResumeId(id, localStorageOrUndefined());
    history.replaceState(null, "", `?resume=${id}`);
    setResumeId(id);
  };
  useEffect(() => {
    if (resumeId) rememberResumeId(resumeId, localStorageOrUndefined());
  }, [resumeId]);
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit">
      <ChangeNotifier appOrigin={appOrigin} />
      <ResumeContext resumeId={resumeId} />
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {!resumeId && <UploadButton onUploaded={uploaded} />}
        <div style={{ flex: 1, minHeight: 0 }}>
          <CopilotChat agentId="default" />
        </div>
      </div>
    </CopilotKitProvider>
  );
}

/** Reading `localStorage` itself can throw in a sandboxed frame. */
function localStorageOrUndefined(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const { appOrigin } = (await (await fetch("/chat/config.json")).json()) as { appOrigin: string };
createRoot(document.getElementById("root")!).render(<App appOrigin={appOrigin} />);
