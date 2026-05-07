import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ProjectProfile } from "./domain.js";

export class ProjectProfileStore {
  constructor(private readonly profilesDir: string) {}

  async list(): Promise<ProjectProfile[]> {
    const entries = await readdir(this.profilesDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));

    const profiles = await Promise.all(
      files.map(async (file) => this.loadFromFile(join(this.profilesDir, file.name))),
    );

    return profiles.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(profileId: string): Promise<ProjectProfile | null> {
    const profiles = await this.list();
    return profiles.find((profile) => profile.id === profileId) ?? null;
  }

  private async loadFromFile(filePath: string): Promise<ProjectProfile> {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as ProjectProfile;
  }
}
