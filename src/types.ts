export enum Bump {
  Major = "major",
  Minor = "minor",
  Patch = "patch",
  PreMajor = "premajor",
  PreMinor = "preminor",
  PrePatch = "prepatch",
  Prerelease = "prerelease",
}

export interface Options {
  verbose: boolean;
  dryRun: boolean;
  packageManager: string;
  preScripts: string;
  commitMessage: string;
  commitAuthor: string;
  commitEmail: string;
  branch: string;
  releaseNotesSource?: string;
  releaseNotesTemplate?: string;
  skipInstall: boolean;
  skipGithubRelease: boolean;
  skipPublish: boolean;
  skipBump: boolean;
  githubToken?: string;
}
