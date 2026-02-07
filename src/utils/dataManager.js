// Data Management Utilities for VocabMaster Pro

/**
 * Export user data to JSON file
 */
export const exportData = (words, stats) => {
  const data = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    words,
    stats,
    wordCount: words.length,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vocab master-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Import data from JSON file
 */
export const importData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Validate data structure
        if (!data.words || !Array.isArray(data.words)) {
          throw new Error("Invalid data format: missing words array");
        }

        // Merge SRS data if words exist
        resolve({
          words: data.words,
          stats: data.stats || {},
        });
      } catch (error) {
        reject(new Error(`Failed to import: ${error.message}`));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};

/**
 * Export to CSV format
 */
export const exportToCSV = (words) => {
  const headers = ["Term", "Definition", "Phonetic", "Part of Speech", "Examples", "Synonyms", "Category", "Lesson"];
  const rows = words.map(w => [
    w.term,
    w.definition,
    w.phonetic || "",
    w.partOfSpeech || "",
    (w.examples || []).join("; "),
    (w.synonyms || []).join(", "),
    w.category || "",
    w.lessonTitle || w.lesson || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vocabmaster-words-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Auto-backup to localStorage with timestamp
 */
export const autoBackup = (words, stats) => {
  const backupKey = `vm_backup_${new Date().toISOString().split('T')[0]}`;
  const backup = {
    timestamp: new Date().toISOString(),
    words,
    stats,
  };

  try {
    localStorage.setItem(backupKey, JSON.stringify(backup));

    // Keep only last 7 days of backups
    const allKeys = Object.keys(localStorage);
    const backupKeys = allKeys.filter(k => k.startsWith('vm_backup_')).sort();
    if (backupKeys.length > 7) {
      backupKeys.slice(0, backupKeys.length - 7).forEach(k => localStorage.removeItem(k));
    }
  } catch (error) {
    console.warn("Auto-backup failed:", error);
  }
};

/**
 * Get available backups
 */
export const getAvailableBackups = () => {
  const allKeys = Object.keys(localStorage);
  const backupKeys = allKeys.filter(k => k.startsWith('vm_backup_')).sort().reverse();

  return backupKeys.map(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      return {
        key,
        timestamp: data.timestamp,
        wordCount: data.words?.length || 0,
        date: key.replace('vm_backup_', ''),
      };
    } catch {
      return null;
    }
  }).filter(Boolean);
};

/**
 * Restore from backup
 */
export const restoreBackup = (backupKey) => {
  try {
    const data = JSON.parse(localStorage.getItem(backupKey));
    return {
      words: data.words,
      stats: data.stats,
    };
  } catch (error) {
    throw new Error(`Failed to restore backup: ${error.message}`);
  }
};
