#!/usr/bin/env node

import { Argument, program } from "commander";
import * as fs from "fs";
import * as path from "path";
import { inc } from "semver";
import { Bump, Options } from "./types";
import {
  bumpVersion,
  getGithubToken,
  getPackageManager,
  installDeps,
  loadPackageJson,
  loadReleaseNotes,
  log,
  preScripts,
} from "./utils";

program
  .version(JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), { encoding: "utf-8" })).version)
  .option("--verbose", "verbose output", false)
  .option("--dry-run", "dry run", false)
  .option("--package-manager <package-manager>", "package manager, detected from lock file by default", "auto")
  .option("--pre-scripts <pre-scripts>", "pre scripts seperated by commas (e.g. lint,test)", "lint,test")
  .option("--commit-message <commit-message>", "new version commit message", "chore(release): {version}")
  .option("--commit-author <commit-author>", "new version commit author", "bump")
  .option("--commit-email <commit-email>", "new version commit email", "bump@noreply.com")
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
    "--github-token <github-token>",
    "github token for creating github release. If not provided, CLI will attempt to load through gh CLI, or alternatively interactively ask."
  )
  .option("--skip-install", "skip installing dependencies", false)
  .option("--skip-github-release", "skip creating github release", false)
  .option("--skip-publish", "skip publishing to npm", false)
  .option("--skip-bump", "skip bumping version", false)
  .addArgument(
    new Argument("bump")
      .argParser(bump => bump as Bump)
      .argOptional()
      .default(Bump.Patch)
  );

program.parse(process.argv);
export const bump = program.processedArgs[0] as Bump;
export const options = program.opts() as Options;

(async () => {
  const packageManager = getPackageManager();

  const currentVersion = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "package.json"), { encoding: "utf-8" })
  ).version;

  const newVersion = inc(currentVersion, bump);

  const packageJson = await loadPackageJson();

  log(`__Using ${packageManager}__`);
  log(`Bumping **${packageJson.name}** from **${currentVersion}** to **${newVersion}**`);

  const ghToken = await getGithubToken();
  await installDeps(packageManager);
  await preScripts(packageManager);
  const releaseNotes = await loadReleaseNotes();
  await bumpVersion();
  console.log(ghToken);
})();
