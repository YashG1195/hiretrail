/**
 * services/atsAnalyzer.js
 *
 * ATS Resume Analyzer — Core NLP Engine
 *
 * Pipeline:
 *   1. Tokenize & clean both texts (lowercase, stopword removal)
 *   2. Build TF-IDF model using natural's TfIdf
 *   3. Extract top-30 keywords from job description
 *   4. Build TF-IDF vectors for both documents
 *   5. Compute cosine similarity (explicit math — no black-box import)
 *   6. Classify matched vs gap keywords
 *   7. Return atsScore (0–100), matchedKeywords, gapKeywords, similarity
 */

import natural from 'natural';

const { TfIdf, WordTokenizer } = natural;

// ─── Stopwords ────────────────────────────────────────────────────────────────
// Comprehensive English stopwords (superset of natural's built-in list)
// plus resume/JD domain noise words that add no signal.
const STOP_WORDS = new Set([
  // Articles / conjunctions / prepositions
  'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'so', 'yet', 'for',
  'in', 'on', 'at', 'to', 'of', 'by', 'as', 'up', 'if', 'is', 'it',
  'be', 'do', 'go', 'no', 'not', 'via', 'per', 'eg', 'ie', 'vs',
  // Pronouns
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'he', 'him', 'his', 'himself',
  'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'they', 'them', 'their', 'theirs', 'themselves',
  // Common verbs (low signal in resume context)
  'am', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had',
  'having', 'does', 'did', 'doing', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  // Demonstratives / quantifiers
  'this', 'that', 'these', 'those', 'all', 'both', 'each', 'every',
  'few', 'more', 'most', 'other', 'some', 'such', 'many', 'much',
  'any', 'own', 'same',
  // Adverbs / misc
  'very', 'just', 'also', 'only', 'too', 'then', 'than', 'so', 'how',
  'once', 'here', 'there', 'when', 'where', 'why', 'which', 'who',
  'whom', 'what', 'while', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'from',
  'out', 'off', 'over', 'under', 'again', 'further', 'with', 'without',
  'within', 'including', 'across', 'along', 'near', 'next', 'upon',
  // Resume noise
  'etc', 'nbsp', 'able', 'new', 'use', 'make', 'get', 'one', 'two',
  'three', 'like', 'used', 'using', 'well', 'also', 'good', 'strong',
]);

const tokenizer = new WordTokenizer();

// ─── Step 1: Tokenize & Clean ─────────────────────────────────────────────────

/**
 * Tokenize text: lowercase → word tokens → filter stopwords + short tokens.
 * @param {string} text
 * @returns {string[]} clean token array
 */
const cleanTokens = (text) => {
  if (!text || typeof text !== 'string') return [];

  return tokenizer
    .tokenize(text.toLowerCase())
    .filter(
      (token) =>
        token.length > 2 &&           // skip very short tokens (≤2 chars)
        /^[a-z]+$/.test(token) &&     // alphabetic only — no digits/symbols
        !STOP_WORDS.has(token)        // remove stopwords
    );
};

// ─── Explicit Cosine Similarity ───────────────────────────────────────────────

/**
 * Compute cosine similarity between two parallel numeric arrays.
 *
 * Formula:
 *   cosine_sim(A, B) = (A · B) / (‖A‖ × ‖B‖)
 *
 * Where:
 *   A · B  = Σᵢ (Aᵢ × Bᵢ)                dot product
 *   ‖A‖    = √(Σᵢ Aᵢ²)                   L2 norm (Euclidean magnitude) of A
 *   ‖B‖    = √(Σᵢ Bᵢ²)                   L2 norm of B
 *
 * Result is in [0, 1]:
 *   1.0 = identical direction (perfect match)
 *   0.0 = orthogonal (zero overlap)
 *
 * @param {number[]} vecA - TF-IDF vector for document A
 * @param {number[]} vecB - TF-IDF vector for document B
 * @returns {number} similarity in [0, 1]
 */
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0;   // A · B
  let sumSqA = 0;       // Σ Aᵢ²
  let sumSqB = 0;       // Σ Bᵢ²

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];  // accumulate dot product
    sumSqA += vecA[i] * vecA[i];      // accumulate squared norm A
    sumSqB += vecB[i] * vecB[i];      // accumulate squared norm B
  }

  const normA = Math.sqrt(sumSqA);   // ‖A‖
  const normB = Math.sqrt(sumSqB);   // ‖B‖

  // Guard against zero-length vectors (empty documents)
  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
};

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * analyzeResume — ATS scoring entry point.
 *
 * @param {string} resumeText      Full extracted text from the uploaded resume.
 * @param {string} jobDescription  Full job description text.
 *
 * @returns {{
 *   atsScore:        number,    Integer 0–100. Higher = better match.
 *   matchedKeywords: string[], Top-30 JD keywords found in the resume.
 *   gapKeywords:     string[], Top-30 JD keywords missing from the resume.
 *   similarity:      number,   Raw cosine similarity value (4 decimal places).
 * }}
 */
export const analyzeResume = (resumeText, jobDescription) => {
  // ── Step 1: Tokenize & clean ─────────────────────────────────────────────
  const resumeTokens = cleanTokens(resumeText);
  const jobTokens    = cleanTokens(jobDescription);

  // Early exit — nothing to score if either document is empty
  if (resumeTokens.length === 0 || jobTokens.length === 0) {
    return { atsScore: 0, matchedKeywords: [], gapKeywords: [], similarity: 0 };
  }

  // ── Step 2: Build TF-IDF model (natural's TfIdf) ─────────────────────────
  // Doc 0 = resume | Doc 1 = job description
  const tfidf = new TfIdf();
  tfidf.addDocument(resumeTokens.join(' ')); // index 0 — resume
  tfidf.addDocument(jobTokens.join(' '));    // index 1 — job description

  // ── Step 3: Extract top-30 JD keywords by TF-IDF score ───────────────────
  // natural's listTerms(docIndex) returns [{term, tfidf}] sorted by score desc
  const topKeywords = tfidf
    .listTerms(1 /* job description doc */)
    .sort((a, b) => b.tfidf - a.tfidf)
    .slice(0, 30)
    .map((item) => item.term);

  // ── Step 4: Build shared vocabulary across both documents ─────────────────
  const vocabulary = [...new Set([...resumeTokens, ...jobTokens])];

  // ── Step 5: Build TF-IDF vectors using natural's scores ───────────────────
  // Each vector is a parallel array indexed by vocabulary position.
  // tfidf.tfidf(term, docIndex) returns the TF-IDF weight for that term.
  const resumeVec = vocabulary.map((term) => tfidf.tfidf(term, 0));
  const jobVec    = vocabulary.map((term) => tfidf.tfidf(term, 1));

  // ── Step 6: Compute cosine similarity (explicit math above) ──────────────
  const similarity = cosineSimilarity(resumeVec, jobVec);

  // ── Step 7: Classify matched vs gap keywords ─────────────────────────────
  const resumeTokenSet = new Set(resumeTokens);
  const matchedKeywords = topKeywords.filter((kw) =>  resumeTokenSet.has(kw));
  const gapKeywords     = topKeywords.filter((kw) => !resumeTokenSet.has(kw));

  // ── Step 8: Compute final ATS score ──────────────────────────────────────
  // Scale cosine similarity [0,1] → integer [0,100], clamp to valid range.
  const atsScore = Math.min(100, Math.max(0, Math.round(similarity * 100)));

  return {
    atsScore,
    matchedKeywords,
    gapKeywords,
    similarity: parseFloat(similarity.toFixed(4)),
  };
};

export default analyzeResume;
