import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";

export async function prepareMcpConfig(
  githubToken: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  try {
    // mcpConfig is initialized with the action's default/required servers
    const mcpConfig = {
      mcpServers: {
        github: {
          command: "docker",
          args: [
            "run",
            "-i",
            "--rm",
            "-e",
            "GITHUB_PERSONAL_ACCESS_TOKEN",
            "ghcr.io/anthropics/github-mcp-server:sha-7382253",
          ],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: githubToken,
          },
        },
        github_file_ops: {
          command: "bun",
          args: [
            "run",
            `${process.env.GITHUB_ACTION_PATH}/src/mcp/github-file-ops-server.ts`,
          ],
          env: {
            GITHUB_TOKEN: githubToken,
            REPO_OWNER: owner,
            REPO_NAME: repo,
            BRANCH_NAME: branch,
          },
        },
      },
    };

    const mcpFilePath = path.join(process.cwd(), ".mcp.json");

    if (fs.existsSync(mcpFilePath)) {
      core.info(`Found .mcp.json at ${mcpFilePath}. Attempting to merge.`);
      try {
        const fileContents = fs.readFileSync(mcpFilePath, "utf-8");
        const fileConfig = JSON.parse(fileContents);

        if (fileConfig && typeof fileConfig.mcpServers === 'object' && fileConfig.mcpServers !== null) {
          // Merge fileConfig.mcpServers into mcpConfig.mcpServers.
          // The action's default servers (initially in mcpConfig.mcpServers)
          // take precedence over those from fileConfig.mcpServers.
          mcpConfig.mcpServers = {
            ...fileConfig.mcpServers, // Load servers from file first
            ...mcpConfig.mcpServers,  // Then overlay action's default servers, ensuring they take precedence
          };
          core.info("Successfully merged .mcp.json configuration.");
        } else {
          core.warning(
            `.mcp.json found but does not contain a valid 'mcpServers' object. Using action default MCP configuration.`,
          );
        }
      } catch (err) {
        core.warning(
          `Error reading or parsing .mcp.json: ${err instanceof Error ? err.message : String(err)}. Using action default MCP configuration.`,
        );
      }
    } else {
      core.info(".mcp.json not found. Using action default MCP configuration.");
    }

    return JSON.stringify(mcpConfig, null, 2);
  } catch (error) {
    core.setFailed(`Install MCP server failed with error: ${error}`);
    process.exit(1);
  }
}
