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

export type FlashcardsSort = "created_at" | "-created_at" | "updated_at" | "next_review_at";

export interface FlashcardsFilters {
  search: string;
  categoryId?: number;
  contentSourceId?: number;
  tagIds: number[];
  origin?: Enums<"card_origin">;
  includeDeleted?: boolean;
  sort: FlashcardsSort;
}

export interface FlashcardsViewState {
  items: FlashcardDTO[];
  loading: boolean;
  error: ApiErrorResponse | null;
  nextCursor: string | null;
  hasMore: boolean;
  filters: FlashcardsFilters;
  aggregates?: FlashcardAggregatesDTO;
}

export type FlashcardFormMode = "create" | "edit";

export interface FlashcardFormValues {
  front: string;
  back: string;
  categoryId?: number;
  contentSourceId?: number;
  origin: Enums<"card_origin">;
  tagIds: number[];
  metadata?: FlashcardDTO["metadata"];
}

export interface FlashcardFormState {
  mode: FlashcardFormMode;
  cardId?: string;
  values: FlashcardFormValues;
  isOpen: boolean;
  isSubmitting: boolean;
  fieldErrors: string[];
  apiError?: ApiErrorResponse;
}

export interface FlashcardSelectionState {
  selectedIds: string[];
  mode: "all-filtered" | "manual" | "due-for-review" | "all-cards" | "due-for-review-fallback";
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

export type ReviewStatsDTO = ReviewStatsSnapshotDTO;

export type ReviewStatsListResponse = PaginatedResponse<ReviewStatsDTO>;

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

type UserRoleRow = Tables<"user_roles">;
type UserRoleInsert = TablesInsert<"user_roles">;

export interface UserRoleDTO {
  user_id: UserRoleRow["user_id"];
  role: UserRoleRow["role"];
  granted_at: IsoDateString;
}

export interface UserDTO {
  id: string;
  email: string;
  created_at: IsoDateString;
  last_sign_in_at?: IsoDateString | null;
}

export type UserRoleListResponse = PaginatedResponse<UserRoleDTO>;
export type UserListResponse = PaginatedResponse<UserDTO>;

export type UserRolesErrorCode =
  | "unauthorized"
  | "insufficient_permissions"
  | "invalid_body"
  | "invalid_path_params"
  | "role_exists"
  | "role_not_found"
  | "db_error"
  | "unexpected_error";

export interface CreateUserRoleCommand {
  user_id: UserRoleInsert["user_id"];
  role: UserRoleInsert["role"];
}

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

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  passwordConfirm: string;
}

export interface UpdatePasswordFormData {
  password: string;
}

export interface ResetPasswordFormData {
  email: string;
}

export interface ResetPasswordCommand {
  email: string;
}

export interface UpdatePasswordCommand {
  password: string;
  tokenHash?: string;
  token?: string;
}

export interface OpenRouterModelParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string[];
}

export interface OpenRouterMetadata {
  userId?: string;
  requestId?: string;
  featureName?: string;
  source?: string;
}

export interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenRouterTextResponse {
  text: string;
  usage: OpenRouterUsage;
  model: string;
  metadata?: OpenRouterMetadata;
}

export interface JsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
}

export interface FlashcardGenerationItem {
  front: string;
  back: string;
  explanation?: string;
  tag_ids?: number[];
}

export interface FlashcardsGenerationResult {
  cards: FlashcardGenerationItem[];
}

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | object;
}

export interface OpenRouterChoice {
  message: OpenRouterMessage;
  finish_reason: string;
}

export interface OpenRouterUsageResponse {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
  usage: OpenRouterUsageResponse;
  model: string;
  created: number;
}

export interface OpenRouterServiceConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  defaultParams?: OpenRouterModelParams;
  httpClient?: typeof fetch;
}

export type ReviewOutcomeUi = ReviewEventDTO["outcome"];

export type Grade0to5 = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReviewCardViewModel {
  card: FlashcardDTO;
  index: number;
}

export interface ReviewSessionEntryViewModel {
  cardId: string;
  outcome: ReviewOutcomeUi;
  grade: Grade0to5;
  responseTimeMs?: number;
  wasLearningStep?: boolean;
  payload?: Json;
}

export interface ReviewSessionState {
  sessionId: string;
  cards: ReviewCardViewModel[];
  currentIndex: number;
  startedAt: IsoDateString;
  completedAt?: IsoDateString;
  entries: ReviewSessionEntryViewModel[];
  status: "idle" | "in-progress" | "submitting" | "completed" | "error";
  error?: ApiErrorResponse;
}

export interface ReviewSessionConfig {
  selection?: FlashcardSelectionState;
  cards: FlashcardDTO[];
}

export interface AdminCategoryListItemVM {
  id: number;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  isDeletable: boolean;
}

export interface CategoriesAdminViewState {
  items: AdminCategoryListItemVM[];
  loading: boolean;
  error: ApiErrorResponse | null;
  search: string;
  sort: "name" | "created_at";
  nextCursor: string | null;
  hasMore: boolean;
  formState: CategoryFormState | null;
  deleteCandidateId?: number;
  deleting: boolean;
  authorizationError?: ApiErrorResponse;
}

export type CategoryFormMode = "create" | "edit";

export interface CategoryFormValues {
  name: string;
  slug: string;
  description?: string;
  color?: string;
}

export interface CategoryFormState {
  mode: CategoryFormMode;
  values: CategoryFormValues;
  categoryId?: number; // Only present in edit mode
  isSubmitting: boolean;
  fieldErrors: string[];
  apiError?: ApiErrorResponse;
}

export interface DeleteCategoryState {
  id?: number;
  isDeleting: boolean;
  error?: ApiErrorResponse;
}

export interface AdminUserRoleListItemVM {
  userId: string;
  role: string;
  grantedAt: string;
  isSelf?: boolean;
  isRevocable: boolean;
}

export interface AdminUserListItemVM {
  userId: string;
  email: string;
  createdAt: string;
  lastSignInAt?: string | null;
  hasAdminRole: boolean;
  grantedAt?: string;
  isSelf?: boolean;
  isRevocable: boolean;
}

export interface UserRolesAdminViewState {
  items: AdminUserRoleListItemVM[];
  loading: boolean;
  error: ApiErrorResponse<UserRolesErrorCode> | null;
  search: string;
  nextCursor: string | null;
  hasMore: boolean;
  revokeDialogState: RevokeAdminDialogState | null;
  authorizationError?: ApiErrorResponse<UserRolesErrorCode>;
  lastStatusCode?: number;
}

export interface AdminUsersViewState {
  items: AdminUserListItemVM[];
  loading: boolean;
  error: ApiErrorResponse<UserRolesErrorCode> | null;
  search: string;
  nextCursor: string | null;
  hasMore: boolean;
  revokeDialogState: RevokeAdminDialogState | null;
  authorizationError?: ApiErrorResponse<UserRolesErrorCode>;
  lastStatusCode?: number;
}

export interface RevokeAdminDialogState {
  open: boolean;
  userId: string;
  role: "admin";
  isSubmitting: boolean;
  apiError?: ApiErrorResponse<UserRolesErrorCode>;
  isSelf?: boolean;
}

export interface UseAdminUsersReturn {
  state: AdminUsersViewState;
  loadInitial: () => Promise<void>;
  searchUsers: (term: string) => void;
  autoGrantRole: (userId: string) => Promise<void>;
  openRevokeDialog: (userId: string) => void;
  confirmRevoke: () => Promise<void>;
  cancelRevoke: () => void;
}

export interface AdminGenerationErrorLogListItemVM {
  id: string;
  userId: string;
  model: string;
  errorCode: string;
  errorMessage: string;
  sourceTextHash: string;
  sourceTextLength: number;
  createdAt: IsoDateString;
  createdAtFormatted: string;
}

export interface AdminGenerationErrorLogsFilters {
  userId: string;
  model: string;
  from?: string;
  to?: string;
}

export interface AdminGenerationErrorLogsViewState {
  items: AdminGenerationErrorLogListItemVM[];
  loading: boolean;
  error: ApiErrorResponse | null;
  filters: AdminGenerationErrorLogsFilters;
  nextCursor: string | null;
  hasMore: boolean;
  authorizationError?: ApiErrorResponse | null;
  lastStatusCode?: number;
  validationErrors: string[];
  isExporting: boolean;
}

export type GenerationErrorLogsExportFormat = "csv" | "json";

export interface UseAdminGenerationErrorLogsReturn {
  state: AdminGenerationErrorLogsViewState;
  loadInitial: () => Promise<void>;
  applyFilters: () => Promise<void>;
  setFilters: (updater: (prev: AdminGenerationErrorLogsFilters) => AdminGenerationErrorLogsFilters) => void;
  resetFilters: () => Promise<void>;
  loadMore: () => Promise<void>;
  openDetails: (log: AdminGenerationErrorLogListItemVM) => void;
  closeDetails: () => void;
  exportLogs: (format: GenerationErrorLogsExportFormat) => Promise<void>;
}

export interface AdminGenerationErrorLogsDetailsState {
  open: boolean;
  selectedLog: AdminGenerationErrorLogListItemVM | null;
}
