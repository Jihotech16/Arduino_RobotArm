import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RobotArmController } from "../app/RobotArmController";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RobotArmController />
  </StrictMode>,
);
