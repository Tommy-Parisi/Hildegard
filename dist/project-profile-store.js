import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
export class ProjectProfileStore {
    profilesDir;
    constructor(profilesDir) {
        this.profilesDir = profilesDir;
    }
    async list() {
        const entries = await readdir(this.profilesDir, { withFileTypes: true });
        const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
        const profiles = await Promise.all(files.map(async (file) => this.loadFromFile(join(this.profilesDir, file.name))));
        return profiles.sort((a, b) => a.name.localeCompare(b.name));
    }
    async getById(profileId) {
        const profiles = await this.list();
        return profiles.find((profile) => profile.id === profileId) ?? null;
    }
    async loadFromFile(filePath) {
        const raw = await readFile(filePath, "utf8");
        return JSON.parse(raw);
    }
}
