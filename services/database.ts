import * as SQLite from 'expo-sqlite';
import { File } from 'expo-file-system';

export interface Idea {
  id: number;
  title: string;
  audioPath: string;
  transcription?: string;
  createdAt: number;
  updatedAt: number;
}

const DATABASE_NAME = 'ideaflow.db';
const DATABASE_VERSION = 1;

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the database and run migrations if needed
 */
async function migrateDbIfNeeded(db: SQLite.SQLiteDatabase) {
  const currentDbVersion = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );

  if (currentDbVersion && currentDbVersion.user_version >= DATABASE_VERSION) {
    return;
  }

  if (!currentDbVersion || currentDbVersion.user_version === 0) {
    // Initial schema creation
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS ideas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        audioPath TEXT NOT NULL,
        transcription TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ideas_createdAt ON ideas(createdAt DESC);
    `);

    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  }

  // Add future migrations here
  // if (currentDbVersion.user_version === 1) {
  //   // Migration from v1 to v2
  // }
}

/**
 * Get the database instance (singleton pattern)
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await migrateDbIfNeeded(dbInstance);
    return dbInstance;
  } catch (error) {
    console.error('Failed to open database:', error);
    throw error;
  }
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}

/**
 * Create a new idea
 */
export async function createIdea(
  title: string,
  audioPath: string,
  transcription?: string
): Promise<Idea> {
  const db = await getDatabase();
  const now = Date.now();

  const result = await db.runAsync(
    'INSERT INTO ideas (title, audioPath, transcription, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    title,
    audioPath,
    transcription || null,
    now,
    now
  );

  return {
    id: result.lastInsertRowId,
    title,
    audioPath,
    transcription,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a single idea by ID
 */
export async function getIdeaById(id: number): Promise<Idea | null> {
  const db = await getDatabase();
  const idea = await db.getFirstAsync<Idea>(
    'SELECT * FROM ideas WHERE id = ?',
    id
  );
  return idea || null;
}

/**
 * Get all ideas, ordered by creation date (newest first)
 */
export async function getAllIdeas(): Promise<Idea[]> {
  const db = await getDatabase();
  const ideas = await db.getAllAsync<Idea>(
    'SELECT * FROM ideas ORDER BY createdAt DESC'
  );
  return ideas;
}

/**
 * Update an idea's title and/or transcription
 */
export async function updateIdea(
  id: number,
  updates: { title?: string; transcription?: string }
): Promise<boolean> {
  const db = await getDatabase();
  const now = Date.now();

  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    values.push(updates.title);
  }

  if (updates.transcription !== undefined) {
    setClauses.push('transcription = ?');
    values.push(updates.transcription);
  }

  if (setClauses.length === 0) {
    return false;
  }

  setClauses.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  const result = await db.runAsync(
    `UPDATE ideas SET ${setClauses.join(', ')} WHERE id = ?`,
    ...values
  );

  return result.changes > 0;
}

/**
 * Update an idea's title only
 */
export async function updateIdeaTitle(id: number, title: string): Promise<boolean> {
  return updateIdea(id, { title });
}

/**
 * Delete an idea by ID
 */
export async function deleteIdea(id: number): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM ideas WHERE id = ?', id);
  return result.changes > 0;
}

/**
 * Search ideas by title or transcription
 */
export async function searchIdeas(query: string): Promise<Idea[]> {
  const db = await getDatabase();
  const searchTerm = `%${query}%`;
  const ideas = await db.getAllAsync<Idea>(
    'SELECT * FROM ideas WHERE title LIKE ? OR transcription LIKE ? ORDER BY createdAt DESC',
    searchTerm,
    searchTerm
  );
  return ideas;
}

/**
 * Get ideas count
 */
export async function getIdeasCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ideas'
  );
  return result?.count || 0;
}

/**
 * Clean up orphaned ideas (where audio file doesn't exist or is empty/corrupted)
 * Returns the number of ideas removed
 */
export async function cleanupOrphanedIdeas(): Promise<number> {
  const db = await getDatabase();
  const allIdeas = await getAllIdeas();
  let deletedCount = 0;

  for (const idea of allIdeas) {
    const file = new File(idea.audioPath);
    if (!file.exists || file.size === 0) {
      await db.runAsync('DELETE FROM ideas WHERE id = ?', idea.id);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Delete all ideas from database
 * Returns the number of ideas deleted
 */
export async function deleteAllIdeas(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM ideas');
  return result.changes;
}