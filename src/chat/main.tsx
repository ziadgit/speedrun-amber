import { CopilotChat, CopilotKitProvider, useAgent } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createAttachments } from "./attachments";
import { createChangeTracker } from "./messages";

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

function App({ appOrigin }: { appOrigin: string }) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const attachments = useMemo(
    () =>
      createAttachments((message) => {
        setUploadError(message);
        setTimeout(() => setUploadError(null), 8000);
      }),
    [],
  );
  return (
    <CopilotKitProvider runtimeUrl="/api/copilotkit">
      <ChangeNotifier appOrigin={appOrigin} />
      <div style={{ height: "100%" }}>
        {uploadError && (
          <div role="alert" style={{ padding: "8px 12px", background: "#fee2e2", color: "#991b1b" }}>
            {uploadError}
          </div>
        )}
        <CopilotChat agentId="default" attachments={attachments} />
      </div>
    </CopilotKitProvider>
  );
}

const { appOrigin } = (await (await fetch("/chat/config.json")).json()) as { appOrigin: string };
createRoot(document.getElementById("root")!).render(<App appOrigin={appOrigin} />);
