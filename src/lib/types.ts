export type SourceKind =
  | "pdf"
  | "url"
  | "youtube"
  | "audio"
  | "text"
  | "markdown"
  | "csv"
  | "docx"
  | "pptx"
  | "image"
  | "epub"
  | "assignment"
  | "paste";

export interface Source {
  id: string;
  notebookId: string;
  kind: SourceKind;
  title: string;
  url?: string;
  /** Extracted text content used for grounding. */
  content: string;
  /** AI-generated summary for the source. */
  summary?: string;
  /** Topics extracted by Perplexity for chip display. */
  topics?: string[];
  /** Original mime type if uploaded. */
  mime?: string;
  /** Size in bytes for uploads. */
  bytes?: number;
  /** Whether this source is enabled and included in chat grounding. */
  enabled: boolean;
  /**
   * For image sources: data URI (data:image/png;base64,...) sent to the
   * Perplexity multimodal endpoint so the model can actually see the image.
   */
  imageDataUri?: string;
  /**
   * For "assignment" sources: structured rubric / solution metadata so we
   * can run a graded practice workflow against the source content.
   */
  assignment?: AssignmentSpec;
  createdAt: number;
}

export interface AssignmentSpec {
  /** Subject area, e.g. "math", "physics", "literature" — free-form. */
  subject?: string;
  /** Difficulty tier; informs the AI grader's expectations. */
  difficulty?: "easy" | "medium" | "hard";
  /** What a correct answer should demonstrate (for grading). */
  rubric?: string;
  /** Cached canonical solution generated once via /api/practice?mode=solve. */
  solution?: string;
}

export type ChatRole = "user" | "assistant";

export interface Citation {
  index: number;
  sourceId: string;
  snippet: string;
  /** Approximate character offset into the source content. */
  offset?: number;
}

export interface ChatMessage {
  id: string;
  notebookId: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
  style?: ConversationalStyle;
  createdAt: number;
}

export type ConversationalStyle = "default" | "learning-guide";

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  /** If true, this note was saved from a chat response and is read-only. */
  fromChat: boolean;
  pinned: boolean;
  createdAt: number;
}

export type StudioArtifactKind =
  | "report"
  | "faq"
  | "study-guide"
  | "briefing"
  | "data-table"
  | "mindmap"
  | "flashcards"
  | "quiz"
  | "slides"
  | "infographic"
  | "audio-overview"
  | "video-overview"
  | "practice";

export interface StudioArtifact {
  id: string;
  notebookId: string;
  kind: StudioArtifactKind;
  title: string;
  /** Raw text/markdown body, or JSON-encoded payload depending on kind. */
  body: string;
  /** Prompt used to generate this artifact (visible to user). */
  prompt?: string;
  /** Custom options the user chose (length, style, language, etc.). */
  options?: Record<string, string | number | boolean>;
  createdAt: number;
}

export interface Notebook {
  id: string;
  title: string;
  emoji: string;
  /** Whether the emoji was manually picked by the user. */
  emojiPinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NotebookData {
  notebook: Notebook;
  sources: Source[];
  messages: ChatMessage[];
  notes: Note[];
  artifacts: StudioArtifact[];
}
