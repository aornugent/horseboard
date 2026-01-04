import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

export default async function globalSetup() {
  // Clean the test database before running tests
  const dbPath = join(process.cwd(), 'data', 'horseboard.db');
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';

  // Remove database files if they exist
  [dbPath, walPath, shmPath].forEach(file => {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
        console.log(`Removed: ${file}`);
      } catch (e) {
        console.warn(`Could not remove ${file}:`, e);
      }
    }
  });

  console.log('Database cleaned for fresh test run');
}
