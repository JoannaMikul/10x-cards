import { BaseApiClient } from "./base-api-client";
import type {
  GenerationCandidateDTO,
  GenerationCandidateListResponse,
  UpdateGenerationCandidateCommand,
  AcceptGenerationCandidateCommand,
} from "../../types";

/**
 * Response from accepting a candidate
 */
interface AcceptCandidateResponse {
  id: string;
  candidate: GenerationCandidateDTO;
}

/**
 * Response from updating a candidate
 */
interface UpdateCandidateResponse {
  candidate: GenerationCandidateDTO;
}

/**
 * API Client for Generation Candidates operations
 */
export class GenerationCandidatesApiClient extends BaseApiClient {
  /**
   * List generation candidates with filtering and pagination
   */
  async list(generationId: string, cursor?: string | null, limit = 20): Promise<GenerationCandidateListResponse> {
    const params: Record<string, string | number | boolean | string[]> = {
      generation_id: generationId,
      limit,
      status: ["proposed", "accepted", "rejected", "edited"],
    };

    if (cursor) {
      params.cursor = cursor;
    }

    return this.get<GenerationCandidateListResponse>("/generation-candidates", { params });
  }

  /**
   * Get a single candidate by ID
   */
  async getById(id: string): Promise<GenerationCandidateDTO> {
    return this.get<GenerationCandidateDTO>(`/generation-candidates/${id}`);
  }

  /**
   * Update a candidate (edit front/back text)
   */
  async update(id: string, command: UpdateGenerationCandidateCommand): Promise<GenerationCandidateDTO> {
    const response = await this.patch<UpdateCandidateResponse, UpdateGenerationCandidateCommand>(
      `/generation-candidates/${id}`,
      command
    );
    return response.candidate;
  }

  /**
   * Accept a candidate (convert to flashcard)
   */
  async accept(id: string, command?: AcceptGenerationCandidateCommand): Promise<AcceptCandidateResponse> {
    return this.post<AcceptCandidateResponse, AcceptGenerationCandidateCommand | Record<string, never>>(
      `/generation-candidates/${id}/accept`,
      command || {}
    );
  }

  /**
   * Reject a candidate
   */
  async reject(id: string): Promise<void> {
    await this.post<null>(`/generation-candidates/${id}/reject`, {});
  }
}

export const generationCandidatesApiClient = new GenerationCandidatesApiClient();
