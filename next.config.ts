import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 writes AGENTS.md + CLAUDE.md into the repo root on every build. This project keeps
  // its own instructions in README.md; the generated pair is untracked churn.
  agentRules: false,
};

export default nextConfig;
