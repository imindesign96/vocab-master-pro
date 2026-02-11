#!/usr/bin/env node
// Script to parse raw_words.txt and generate toeicVocab.js

const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, '..', 'raw_words.txt');
const outputPath = path.join(__dirname, '..', 'src', 'data', 'toeicVocab.js');

const raw = fs.readFileSync(rawPath, 'utf-8');
const lines = raw.trim().split('\n').filter(l => l.trim());

const words = lines.map((line, idx) => {
  const parts = line.split('|').map(s => s.trim());
  // Format: word | definition | phonetic | pos | examples(;) | synonyms(,) | category
  const [term, definition, phonetic, partOfSpeech, examplesRaw, synonymsRaw, category] = parts;

  // Parse examples - split by ; and clean up
  const examples = examplesRaw
    ? examplesRaw.split(';').map(e => e.trim()).filter(Boolean)
    : [];

  // Parse synonyms - split by , and clean up
  const synonyms = synonymsRaw
    ? synonymsRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return {
    term: term || '',
    definition: definition || '',
    phonetic: phonetic || '',
    partOfSpeech: partOfSpeech || '',
    examples,
    synonyms,
    category: (category || 'toeic').toLowerCase()
  };
});

// Organize into lessons of 50 words each
const WORDS_PER_LESSON = 50;
const lessons = [];
for (let i = 0; i < words.length; i += WORDS_PER_LESSON) {
  const chunk = words.slice(i, i + WORDS_PER_LESSON);
  const lessonNum = Math.floor(i / WORDS_PER_LESSON) + 1;

  // Lesson titles based on word content analysis
  const lessonTitles = [
    "Office & Business Essentials",
    "Business Operations & Procedures",
    "Human Resources & Employment",
    "General Business & Society",
    "Transportation & Legal Terms",
    "Finance & Economics",
    "Marketing & Sales",
    "Technology & Innovation",
    "Healthcare & Services",
    "Environment & Industry",
    "Communication & Media",
    "Real Estate & Property",
    "Manufacturing & Production",
    "International Trade",
    "Banking & Insurance",
    "Government & Public Policy",
    "Education & Training",
    "Hospitality & Tourism",
    "Science & Research",
    "Advanced Business Terms"
  ];

  lessons.push({
    id: `lesson-${lessonNum}`,
    title: `Lesson ${lessonNum}: ${lessonTitles[lessonNum - 1] || 'TOEIC Vocabulary'}`,
    description: `TOEIC vocabulary - Part ${lessonNum}`,
    words: chunk
  });
}

// Generate JS output
let output = `// TOEIC Essential Vocabulary - ${words.length} Words
// Auto-generated from raw_words.txt
// Organized into ${lessons.length} Lessons (${WORDS_PER_LESSON} words each)

export const TOEIC_LESSONS = [\n`;

lessons.forEach((lesson, li) => {
  output += `  {\n`;
  output += `    id: "${lesson.id}",\n`;
  output += `    title: "${lesson.title}",\n`;
  output += `    description: "${lesson.description}",\n`;
  output += `    words: [\n`;

  lesson.words.forEach((w, wi) => {
    const examples = w.examples.map(e => JSON.stringify(e)).join(', ');
    const synonyms = w.synonyms.map(s => JSON.stringify(s)).join(', ');
    output += `      { term: ${JSON.stringify(w.term)}, definition: ${JSON.stringify(w.definition)}, phonetic: ${JSON.stringify(w.phonetic)}, partOfSpeech: ${JSON.stringify(w.partOfSpeech)}, examples: [${examples}], synonyms: [${synonyms}], category: ${JSON.stringify(w.category)} }`;
    if (wi < lesson.words.length - 1) output += ',';
    output += '\n';
  });

  output += `    ]\n`;
  output += `  }`;
  if (li < lessons.length - 1) output += ',';
  output += '\n';
});

output += `];

// Helper function to get all words
export const getAllTOEICWords = () => {
  return TOEIC_LESSONS.flatMap(lesson =>
    lesson.words.map(word => ({
      ...word,
      id: \`toeic_\${lesson.id}_\${word.term.toLowerCase().replace(/[^a-z0-9]/g, '_')}\`,
      lesson: lesson.id,
      lessonTitle: lesson.title,
      srs: {} // Empty SRS data for new words
    }))
  );
};

// Get words by lesson
export const getWordsByLesson = (lessonId) => {
  const lesson = TOEIC_LESSONS.find(l => l.id === lessonId);
  return lesson ? lesson.words : [];
};

export default TOEIC_LESSONS;
`;

fs.writeFileSync(outputPath, output, 'utf-8');
console.log(`✅ Generated ${outputPath}`);
console.log(`   Total words: ${words.length}`);
console.log(`   Total lessons: ${lessons.length}`);
