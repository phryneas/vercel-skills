/**
 * Tests for symlink support in skill discovery.
 *
 * Ensures that skills accessible through symlinks (e.g., symlinks in root skills/ directory
 * pointing to skills in other locations) are properly discovered.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { symlink, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { discoverSkills } from '../src/skills.ts';

describe('discoverSkills with symlinks', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'skills-symlink-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should discover skills through symlinks in priority search directories', async () => {
    // Create actual skill directories in packages/toolkit/skills/
    const packagesDir = join(testDir, 'packages', 'a', 'skills');
    await mkdir(packagesDir, { recursive: true });

    // Create a real skill directory
    const realSkillDir = join(packagesDir, 'real-skill');
    await mkdir(realSkillDir);
    await writeFile(
      join(realSkillDir, 'SKILL.md'),
      `---
name: real-skill
description: A real skill accessed via symlink
---

# Real Skill
`
    );

    // Create skills/ directory at repo root with symlink
    const skillsDir = join(testDir, 'skills');
    await mkdir(skillsDir);

    // Create symlink from skills/real-skill -> ../packages/toolkit/skills/real-skill
    const symlinkPath = join(skillsDir, 'real-skill');
    const relativePath = '../packages/toolkit/skills/real-skill';
    await symlink(relativePath, symlinkPath, 'dir');

    // Test discovery finds the skill through the symlink
    const skills = await discoverSkills(testDir);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('real-skill');
    expect(skills[0].description).toBe('A real skill accessed via symlink');
  });

  it('should discover multiple skills through symlinks in root skills/ directory', async () => {
    // Create real skills in different locations
    await mkdir(join(testDir, 'packages', 'a', 'skills', 'build'), { recursive: true });
    await mkdir(join(testDir, 'packages', 'a', 'skills', 'debug'), { recursive: true });
    await mkdir(join(testDir, 'packages', 'b', 'skills', 'api'), { recursive: true });

    // Create real skill files
    await writeFile(
      join(testDir, 'packages', 'a', 'skills', 'build', 'SKILL.md'),
      `---
name: build-skill
description: Build modern apps
---`
    );

    await writeFile(
      join(testDir, 'packages', 'a', 'skills', 'debug', 'SKILL.md'),
      `---
name: debug-skill  
description: Debug apps
---`
    );

    await writeFile(
      join(testDir, 'packages', 'b', 'skills', 'api', 'SKILL.md'),
      `---
name: api-skill
description: API management
---`
    );

    // Create skills/ directory with symlinks (similar to Redux Toolkit structure)
    const skillsDir = join(testDir, 'skills');
    await mkdir(skillsDir);

    await symlink('../packages/toolkit/skills/build', join(skillsDir, 'build-skill'), 'dir');
    await symlink('../packages/toolkit/skills/debug', join(skillsDir, 'debug-skill'), 'dir');
    await symlink('../packages/b/skills/api', join(skillsDir, 'api-skill'), 'dir');

    // Test discovery finds all skills through symlinks
    const skills = await discoverSkills(testDir);

    expect(skills).toHaveLength(3);

    const skillNames = skills.map((s) => s.name).sort();
    expect(skillNames).toEqual(['api-skill', 'build-skill', 'debug-skill']);
  });

  it('should handle broken symlinks gracefully', async () => {
    const skillsDir = join(testDir, 'skills');
    await mkdir(skillsDir);

    // Create a real skill
    const realSkillDir = join(testDir, 'packages', 'real');
    await mkdir(realSkillDir, { recursive: true });
    await writeFile(
      join(realSkillDir, 'SKILL.md'),
      `---
name: working-skill
description: This skill works
---`
    );

    // Create working symlink
    await symlink('../packages/real', join(skillsDir, 'working-skill'), 'dir');

    // Create broken symlink (points to non-existent directory)
    await symlink('../packages/nonexistent', join(skillsDir, 'broken-skill'), 'dir');

    // Should find working skill and ignore broken symlink
    const skills = await discoverSkills(testDir);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('working-skill');
  });

  it('should discover symlinked skills in recursive search when no priority directories exist', async () => {
    // Create skill deep in directory structure
    const deepDir = join(testDir, 'some', 'deep', 'nested', 'actual-skill');
    await mkdir(deepDir, { recursive: true });
    await writeFile(
      join(deepDir, 'SKILL.md'),
      `---
name: deep-skill
description: Deep nested skill
---`
    );

    // Create symlink in a different deep location
    const symlinkDir = join(testDir, 'other', 'location');
    await mkdir(symlinkDir, { recursive: true });
    await symlink('../../some/deep/nested/actual-skill', join(symlinkDir, 'linked-deep'), 'dir');

    // Should find both the original and symlinked version via recursive search
    const skills = await discoverSkills(testDir);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('deep-skill');
  });
});
