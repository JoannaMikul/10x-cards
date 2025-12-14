import type { Enums, Json, Tables, TablesInsert, TablesUpdate } from "./db/database.types";

type IsoDateString = string;
type UUID = string;

export interface CursorPage {
  next_cursor: string | null;
  has_more: boolean;
}

export interface PaginatedResponse<TData> {
  data: TData[];
  page: CursorPage;
}

export interface ApiErrorResponse<TCode extends string = string> {
  error: {
    code: TCode;
    message: string;
    details?: Json;
  };
}

/** Categories ***************************************************************/
type CategoryRow = Tables<"categories">;
type CategoryInsert = TablesInsert<"categories">;
type CategoryUpdate = TablesUpdate<"categories">;

export interface CategoryDTO {
  id: CategoryRow["id"];
  name: CategoryRow["name"];
  slug: CategoryRow["slug"];
  description: CategoryRow["description"];
  color: CategoryRow["color"];
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export type CategoryListResponse = PaginatedResponse<CategoryDTO>;

export interface CreateCategoryCommand {
  name: CategoryInsert["name"];
  slug: CategoryInsert["slug"];
  description?: CategoryInsert["description"];
  color?: CategoryInsert["color"];
}

export interface UpdateCategoryCommand {
  name?: CategoryUpdate["name"];
  slug?: CategoryUpdate["slug"];
  description?: CategoryUpdate["description"];
  color?: CategoryUpdate["color"];
}

/** Tags *********************************************************************/
type TagRow = Tables<"tags">;
type TagInsert = TablesInsert<"tags">;
type TagUpdate = TablesUpdate<"tags">;

export interface TagDTO {
  id: TagRow["id"];
  name: TagRow["name"];
  slug: TagRow["slug"];
  description: TagRow["description"];
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export type TagListResponse = PaginatedResponse<TagDTO>;

export interface CreateTagCommand {
  name: TagInsert["name"];
  slug: TagInsert["slug"];
  description?: TagInsert["description"];
}

export interface UpdateTagCommand {
  name?: TagUpdate["name"];
  slug?: TagUpdate["slug"];
  description?: TagUpdate["description"];
}

/** Sources ******************************************************************/
type SourceRow = Tables<"sources">;
type SourceInsert = TablesInsert<"sources">;
type SourceUpdate = TablesUpdate<"sources">;

export interface SourceDTO {
  id: SourceRow["id"];
  name: SourceRow["name"];
  slug: SourceRow["slug"];
  description: SourceRow["description"];
  kind: SourceRow["kind"];
  url: SourceRow["url"];
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export type SourceListResponse = PaginatedResponse<SourceDTO>;

export interface CreateSourceCommand {
  name: SourceInsert["name"];
  slug: SourceInsert["slug"];
  description?: SourceInsert["description"];
  kind: SourceInsert["kind"];
  url?: SourceInsert["url"];
}

export interface UpdateSourceCommand {
  name?: SourceUpdate["name"];
  slug?: SourceUpdate["slug"];
  description?: SourceUpdate["description"];
  kind?: SourceUpdate["kind"];
  url?: SourceUpdate["url"];
}

/** Flashcards ***************************************************************/
type FlashcardRow = Tables<"flashcards">;
type FlashcardInsert = TablesInsert<"flashcards">;
type FlashcardUpdate = TablesUpdate<"flashcards">;
type ReviewStatsRow = Tables<"review_stats">;

export interface ReviewStatsSnapshotDTO {
  card_id: ReviewStatsRow["card_id"];
  user_id: ReviewStatsRow["user_id"];
  total_reviews: ReviewStatsRow["total_reviews"];
  successes: ReviewStatsRow["successes"];
  consecutive_successes: ReviewStatsRow["consecutive_successes"];
  last_outcome: ReviewStatsRow["last_outcome"];
  last_interval_days: ReviewStatsRow["last_interval_days"];
  next_review_at: ReviewStatsRow["next_review_at"];
  last_reviewed_at: ReviewStatsRow["last_reviewed_at"];
  aggregates: ReviewStatsRow["aggregates"];
}

export interface FlashcardDTO {
  id: FlashcardRow["id"];
  front: FlashcardRow["front"];
  back: FlashcardRow["back"];
  origin: FlashcardRow["origin"];
  metadata: FlashcardRow["metadata"];
  category_id: FlashcardRow["category_id"];
  content_source_id: FlashcardRow["content_source_id"];
  owner_id: FlashcardRow["owner_id"];
  created_at: IsoDateString;
  updated_at: IsoDateString;
  deleted_at: IsoDateString | null;
  tags: TagDTO[];
  review_stats?: ReviewStatsSnapshotDTO;
}

export interface FlashcardAggregatesDTO {
  total: number;
  by_origin: Partial<Record<Enums<"card_origin">, number>>;
}

export interface FlashcardListResponse extends PaginatedResponse<FlashcardDTO> {
  aggregates?: FlashcardAggregatesDTO;
}

export interface CreateFlashcardCommand {
  front: FlashcardInsert["front"];
  back: FlashcardInsert["back"];
  category_id?: FlashcardInsert["category_id"];
  content_source_id?: FlashcardInsert["content_source_id"];
  origin: FlashcardInsert["origin"];
  metadata?: FlashcardInsert["metadata"];
  tag_ids?: number[];
}

export interface UpdateFlashcardCommand {
  front?: FlashcardUpdate["front"];
  back?: FlashcardUpdate["back"];
  category_id?: FlashcardUpdate["category_id"];
  content_source_id?: FlashcardUpdate["content_source_id"];
  origin?: FlashcardUpdate["origin"];
  metadata?: FlashcardUpdate["metadata"];
  deleted_at?: FlashcardUpdate["deleted_at"];
  tag_ids?: number[];
}

export interface SetFlashcardTagsCommand {
  tag_ids: number[];
}

/** Generations **************************************************************/
type GenerationRow = Tables<"generations">;
type GenerationInsert = TablesInsert<"generations">;
type GenerationUpdate = TablesUpdate<"generations">;

export interface GenerationDTO {
  id: GenerationRow["id"];
  user_id: GenerationRow["user_id"];
  model: GenerationRow["model"];
  status: GenerationRow["status"];
  temperature: GenerationRow["temperature"];
  prompt_tokens: GenerationRow["prompt_tokens"];
  sanitized_input_length: GenerationRow["sanitized_input_length"];
  sanitized_input_sha256: GenerationRow["sanitized_input_sha256"];
  sanitized_input_text: GenerationRow["sanitized_input_text"];
  started_at: GenerationRow["started_at"];
  completed_at: GenerationRow["completed_at"];
  created_at: IsoDateString;
  updated_at: IsoDateString;
  error_code: GenerationRow["error_code"];
  error_message: GenerationRow["error_message"];
}

export type GenerationListResponse = PaginatedResponse<GenerationDTO>;

export interface CreateGenerationCommand {
  model: GenerationInsert["model"];
  sanitized_input_text: GenerationInsert["sanitized_input_text"];
  temperature?: number;
}

export interface UpdateGenerationCommand {
  status: Extract<GenerationUpdate["status"], "cancelled">;
}

/** Generation Candidates ****************************************************/
type GenerationCandidateRow = Tables<"generation_candidates">;
type GenerationCandidateUpdate = TablesUpdate<"generation_candidates">;

export interface GenerationCandidateDTO {
  id: GenerationCandidateRow["id"];
  generation_id: GenerationCandidateRow["generation_id"];
  owner_id: GenerationCandidateRow["owner_id"];
  front: GenerationCandidateRow["front"];
  back: GenerationCandidateRow["back"];
  front_back_fingerprint: GenerationCandidateRow["front_back_fingerprint"];
  status: GenerationCandidateRow["status"];
  accepted_card_id: GenerationCandidateRow["accepted_card_id"];
  suggested_category_id: GenerationCandidateRow["suggested_category_id"];
  suggested_tags: GenerationCandidateRow["suggested_tags"];
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export type GenerationCandidateListResponse = PaginatedResponse<GenerationCandidateDTO>;

export interface UpdateGenerationCandidateCommand {
  front?: GenerationCandidateUpdate["front"];
  back?: GenerationCandidateUpdate["back"];
  status?: Extract<GenerationCandidateUpdate["status"], "edited">;
}

export interface AcceptGenerationCandidateCommand {
  category_id?: number;
  tag_ids?: number[];
  content_source_id?: number;
  origin?: Enums<"card_origin">;
}

export type RejectGenerationCandidateCommand = Record<string, never>;

/** Generation Error Logs ****************************************************/
type GenerationErrorLogRow = Tables<"generation_error_logs">;

export interface GenerationErrorLogDTO {
  id: GenerationErrorLogRow["id"];
  user_id: GenerationErrorLogRow["user_id"];
  model: GenerationErrorLogRow["model"];
  error_code: GenerationErrorLogRow["error_code"];
  error_message: GenerationErrorLogRow["error_message"];
  source_text_hash: GenerationErrorLogRow["source_text_hash"];
  source_text_length: GenerationErrorLogRow["source_text_length"];
  created_at: IsoDateString;
}

export type GenerationErrorLogListResponse = PaginatedResponse<GenerationErrorLogDTO>;

/** Review Events & Sessions *************************************************/
type ReviewEventRow = Tables<"review_events">;
type ReviewEventInsert = TablesInsert<"review_events">;

export interface ReviewEventDTO {
  id: ReviewEventRow["id"];
  card_id: ReviewEventRow["card_id"];
  user_id: ReviewEventRow["user_id"];
  outcome: ReviewEventRow["outcome"];
  payload: ReviewEventRow["payload"];
  prev_interval_days: ReviewEventRow["prev_interval_days"];
  next_interval_days: ReviewEventRow["next_interval_days"];
  response_time_ms: ReviewEventRow["response_time_ms"];
  reviewed_at: IsoDateString;
  was_learning_step: ReviewEventRow["was_learning_step"];
}

export type ReviewEventListResponse = PaginatedResponse<ReviewEventDTO>;

export interface ReviewSessionEntryCommand {
  card_id: ReviewEventInsert["card_id"];
  outcome: ReviewEventInsert["outcome"];
  response_time_ms?: ReviewEventInsert["response_time_ms"];
  prev_interval_days?: ReviewEventInsert["prev_interval_days"];
  next_interval_days?: ReviewEventInsert["next_interval_days"];
  was_learning_step?: ReviewEventInsert["was_learning_step"];
  payload?: ReviewEventInsert["payload"];
}

export interface CreateReviewSessionCommand {
  session_id: UUID;
  started_at: IsoDateString;
  completed_at: IsoDateString;
  reviews: ReviewSessionEntryCommand[];
}

/** Review Stats *************************************************************/
export type ReviewStatsDTO = ReviewStatsSnapshotDTO;

export type ReviewStatsListResponse = PaginatedResponse<ReviewStatsDTO>;

/** Analytics KPI (admin) ****************************************************/
export interface AnalyticsTrendPointDTO {
  date: IsoDateString;
  ai: number;
  manual: number;
  accepted_ai: number;
}

export interface AnalyticsTotalsDTO {
  ai: number;
  manual: number;
}

export interface AnalyticsKpiResponse {
  ai_acceptance_rate: number;
  ai_share: number;
  totals: AnalyticsTotalsDTO;
  trend: AnalyticsTrendPointDTO[];
}
/** User Roles ***************************************************************/
type UserRoleRow = Tables<"user_roles">;
type UserRoleInsert = TablesInsert<"user_roles">;

export interface UserRoleDTO {
  user_id: UserRoleRow["user_id"];
  role: UserRoleRow["role"];
  granted_at: IsoDateString;
}

export type UserRoleListResponse = PaginatedResponse<UserRoleDTO>;

export interface CreateUserRoleCommand {
  user_id: UserRoleInsert["user_id"];
  role: UserRoleInsert["role"];
}

/** Generation UI Types ********************************************************/

/**
 * Extended view model for the generation form that includes raw input text
 * before sanitization and additional UI state.
 */
export interface CreateGenerationViewModel {
  model: string;
  sanitized_input_text: string;
  temperature?: number;
  raw_input_text?: string;
}

export type GenerationStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface CandidatesSummary {
  total: number;
  by_status: Record<Enums<"candidate_status">, number>;
}

export interface FormValidationState {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerationPollingState {
  id?: string;
  status: GenerationStatus;
  error?: ApiErrorResponse;
}

/** Candidates View Types *****************************************************/

export interface CandidateEditState {
  candidateId: string;
  isEditing: boolean;
  tempFront: string;
  tempBack: string;
  errors: string[];
  categoryId?: number;
  tagIds?: number[];
}

export interface CandidatesViewState {
  candidates: GenerationCandidateDTO[];
  loading: boolean;
  error?: ApiErrorResponse;
  nextCursor: string | null;
  hasMore: boolean;
  filters: { status?: string[] };
}

/** Authentication Types *******************************************************/

export interface CurrentUserDTO {
  id: string;
  email: string;
  created_at: IsoDateString;
}

export interface AuthSessionDTO {
  user: CurrentUserDTO | null;
  expires_at: IsoDateString | null;
}

export interface LoginCommand {
  email: string;
  password: string;
}

export interface RegisterCommand {
  email: string;
  password: string;
}

export interface ResetPasswordCommand {
  email: string;
}

export interface UpdatePasswordCommand {
  password: string;
}
