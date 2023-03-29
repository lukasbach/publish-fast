#!/usr/bin/env node

import { Argument, program } from "commander";
import * as fs from "fs";
import * as path from "path";
import { inc } from "semver";
import simpleGit from "simple-git";
import { Bump, Options } from "./types";
import {
  bumpVersion,
  commitChanges,
  createGithubRelease,
  createTag,
  getGithubRepoAndUser,
  getGithubToken,
  getPackageManager,
  installDeps,
  loadPackageJson,
  loadReleaseConfig,
  loadReleaseNotes,
  log,
  npmPublish,
  preScripts,
  promptBump,
  pushChanges,
  updateChangelog,
  uploadReleaseAssets,
  verifyBranch,
  verifyGithubToken,
  verifyNoUncommittedChanges,
} from "./utils";

let cliVersion: string;
try {
  cliVersion = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), { encoding: "utf-8" })).version;
} catch (e) {
  cliVersion = "unknown";
}

program
  .version(cliVersion)
  .option("--verbose", "verbose output", false)
  .option("--dry-run", "dry run", false)
  .option("--package-manager <package-manager>", "package manager, detected from lock file by default", "auto")
  .option("--pre-scripts <pre-scripts>", "pre scripts seperated by commas (e.g. lint,test)", "lint,test")
  .option("--commit-message <commit-message>", "new version commit message", "chore(release): {version}")
  .option("--commit-author <commit-author>", "new version commit author")
  .option("--commit-email <commit-email>", "new version commit email")
  .option("--branch <branch>", "release branch, for verification", "main")
  .option(
    "--release-notes-source <release-notes-source>",
    "path to release notes source markdown file. Leave empty to use empty release notes."
  )
  .option(
    "--release-notes-template <release-notes-template>",
    "path to release notes template markdown file. Leave empty to not recreate the file after publishing."
  )
  .option(
    "--changelog <changelog>",
    "path to changelog file. Leave empty to not update changelog. Will automatically be skipped if file doesn't exist.",
    "CHANGELOG.md"
  )
  .option(
    "--github-token <github-token>",
    "github token for creating github release. If not provided, CLI will attempt to load through gh CLI, or alternatively interactively ask."
  )
  .option("--draft-release", "create github release as draft", false)
  .option("--npm-tag <npm-tag>", "npm tag to publish to", "latest")
  .option("--npm-access <npm-access>", "npm access level")
  .option("--otp <npm-otp>", "npm otp code")
  .option("--release-assets <glob>", "glob for release assets to upload to the github release")
  .option("--skip-install", "skip installing dependencies", false)
  .option("--skip-github-release", "skip creating github release", false)
  .option("--skip-publish", "skip publishing to npm", false)
  .option("--skip-bump", "skip bumping version", false)
  .option("--skip-push", "skip pushing changes", false)
  .option("--skip-commit", "skip committing changes", false)
  .addArgument(new Argument("bump").argParser((bump) => bump as Bump).argOptional());

program.parse(process.argv);
const packageJson = loadPackageJson();
export const options = { ...program.opts(), ...loadReleaseConfig(), ...(packageJson?.publish ?? {}) } as Options;
export const git = simpleGit(process.cwd());

process.on("SIGINT", () => {
  // eslint-disable-next-line no-console
  console.log("Caught interrupt signal");
  process.exit();
});

(async () => {
  const packageManager = getPackageManager();
  const { repoUser, repoName } = await getGithubRepoAndUser(packageJson);

  if (options.dryRun) {
    log("**Dry Run**");
  }

  const currentVersion = packageJson.version;
  const bump = (program.processedArgs[0] as Bump) ?? (await promptBump(currentVersion)).bumpType;
  const newVersion = inc(currentVersion, bump)!;

  log(`__github.com/${repoUser}/${repoName}, using ${packageManager}__`);
  log(`Bumping **${packageJson.name}** from **${currentVersion}** to **${newVersion}**`);

  const ghToken = await getGithubToken();
  await verifyGithubToken(ghToken);
  await verifyBranch();
  await verifyNoUncommittedChanges();
  await installDeps(packageManager);
  await preScripts(packageManager);
  await bumpVersion(bump);
  const releaseNotes = await loadReleaseNotes();
  await updateChangelog({ releaseNotes, newVersion, owner: repoUser, repo: repoName, oldVersion: currentVersion });
  await commitChanges(newVersion);
  await createTag(newVersion);
  await pushChanges();
  await npmPublish();
  const releaseId = await createGithubRelease({
    releaseNotes,
    owner: repoUser,
    repo: repoName,
    token: ghToken,
    version: newVersion,
  });
  await uploadReleaseAssets({
    owner: repoUser,
    repo: repoName,
    token: ghToken,
    releaseId,
  });
})();
