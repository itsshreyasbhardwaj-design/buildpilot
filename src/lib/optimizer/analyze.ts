// CI Optimizer: static analysis over the workflow YAML text stored on
// Workflow.definition. Deliberately pattern-based, not a full YAML AST
// analysis — every finding here is traceable to a literal substring or
// structural pattern in the workflow file, which is what "diff, not
// opinion" means for this feature. Nothing is applied automatically; see
// docs/CI_OPTIMIZER.md and the Recommendation model's approval flow.

export interface OptimizerFinding {
  kind: "caching" | "parallelization" | "matrix" | "dependency" | "test-split" | "config" | "docker";
  title: string;
  description: string;
  diff: string;
  filePath: string;
  impactEstimate?: { metric: string; before: number; after: number };
}

function parseJobsNeeds(yamlText: string): Map<string, string[]> {
  const jobs = new Map<string, string[]>();
  let currentJob: string | null = null;
  for (const line of yamlText.split("\n")) {
    const jobMatch = line.match(/^ {2}(\w[\w-]*):\s*$/);
    if (jobMatch) {
      currentJob = jobMatch[1];
      jobs.set(currentJob, []);
      continue;
    }
    if (currentJob) {
      const needsMatch = line.match(/^ {4}needs:\s*(\w[\w-]*)\s*$/);
      if (needsMatch) jobs.get(currentJob)!.push(needsMatch[1]);
    }
  }
  return jobs;
}

function buildCacheDiff(setupAction: string, packageManager: string): string {
  const versionLine = setupAction.includes("setup-node") ? "      node-version: 20" : '      python-version: "3.12"';
  return [
    `   - uses: ${setupAction}`,
    "     with:",
    versionLine,
    `+      cache: '${packageManager}'`,
  ].join("\n");
}

export function analyzeWorkflowYaml(yamlText: string, filePath: string): OptimizerFinding[] {
  const findings: OptimizerFinding[] = [];
  const hasCacheParam = /cache:\s*['"]?(pnpm|npm|yarn|pip)['"]?/.test(yamlText);

  if (!hasCacheParam) {
    if (/actions\/setup-node@v\d+/.test(yamlText)) {
      const packageManager = /pnpm install/.test(yamlText) ? "pnpm" : /yarn install/.test(yamlText) ? "yarn" : "npm";
      findings.push({
        kind: "caching",
        title: `Cache ${packageManager} dependencies`,
        description:
          "No dependency caching is configured for actions/setup-node. Every job reinstalls dependencies from scratch — one of the most common sources of avoidable CI time.",
        filePath,
        diff: buildCacheDiff("actions/setup-node@v4", packageManager),
        impactEstimate: { metric: "install time (seconds, estimated)", before: 45, after: 8 },
      });
    }
    if (/actions\/setup-python@v\d+/.test(yamlText)) {
      findings.push({
        kind: "caching",
        title: "Cache pip dependencies",
        description: "No dependency caching is configured for actions/setup-python. `pip install -r requirements.txt` runs cold on every job.",
        filePath,
        diff: buildCacheDiff("actions/setup-python@v5", "pip"),
        impactEstimate: { metric: "install time (seconds, estimated)", before: 30, after: 6 },
      });
    }
  }

  const jobs = parseJobsNeeds(yamlText);
  const jobNames = [...jobs.keys()];
  if (jobNames.length >= 3) {
    // A single unbroken needs-chain across every job (job[i] needs job[i-1]).
    const isLinearChain = jobNames.slice(1).every((name, i) => jobs.get(name)?.includes(jobNames[i]));
    if (isLinearChain) {
      const [first, second] = jobNames;
      findings.push({
        kind: "parallelization",
        title: `Run "${first}" and "${second}" in parallel`,
        description: `${jobNames.join(" → ")} run strictly in sequence. If "${second}" doesn't consume "${first}"'s output (a lint job rarely needs a build's artifacts), removing the dependency lets them run concurrently.`,
        filePath,
        diff: [`   ${second}:`, `-    needs: ${first}`, "     runs-on: ubuntu-latest"].join("\n"),
      });
    }
  }

  const hasMatrix = /strategy:\s*\n\s*matrix:/.test(yamlText);
  if (!hasMatrix && (/actions\/setup-node@v\d+/.test(yamlText) || /actions\/setup-python@v\d+/.test(yamlText))) {
    findings.push({
      kind: "matrix",
      title: "Consider a version matrix",
      description:
        "This workflow tests against a single pinned runtime version. If this project needs to support more than one, a matrix strategy catches version-specific regressions that a single pinned version can't.",
      filePath,
      diff: ["   test:", "+    strategy:", "+      matrix:", "+        node-version: [18, 20, 22]", "     runs-on: ubuntu-latest"].join("\n"),
    });
  }

  return findings;
}
