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
  commitAuthor?: string;
  commitEmail?: string;
  branch: string;
  releaseNotesSource?: string;
  releaseNotesTemplate?: string;
  changelog?: string;
  skipInstall: boolean;
  skipGithubRelease: boolean;
  skipPublish: boolean;
  skipBump: boolean;
  skipPush: boolean;
  skipCommit: boolean;
  githubToken?: string;
  draftRelease?: boolean;
  npmTag?: string;
  npmAccess?: string;
  otp?: string;
  releaseAssets?: string;
  pipeStdout: boolean;
  noVersionPrefix?: boolean;
}
