import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <CopilotKitProvider runtimeUrl="/api/copilotkit">
    <div style={{ height: "100%" }}>
      <CopilotChat agentId="default" />
    </div>
  </CopilotKitProvider>,
);
