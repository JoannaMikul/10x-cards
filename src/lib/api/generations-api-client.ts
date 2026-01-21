import { BaseApiClient } from "./base-api-client";
import type { GenerationDTO, CandidatesSummary, CreateGenerationCommand, UpdateGenerationCommand } from "../../types";

/**
 * Response from creating a generation
 */
interface CreateGenerationResponse {
  id: string;
  status: "pending";
  enqueued_at: string;
}

/**
 * Response from getting generation details
 */
interface GetGenerationResponse {
  generation: GenerationDTO;
  candidates_summary: CandidatesSummary;
}

/**
 * API Client for Generations operations
 */
export class GenerationsApiClient extends BaseApiClient {
  /**
   * Create a new generation request
   */
  async create(command: CreateGenerationCommand): Promise<CreateGenerationResponse> {
    return this.post<CreateGenerationResponse, CreateGenerationCommand>("/generations", command);
  }

  /**
   * Get generation details with candidates summary
   */
  async getById(id: string): Promise<GetGenerationResponse> {
    return this.get<GetGenerationResponse>(`/generations/${id}`);
  }

  /**
   * Update generation status (e.g., cancel)
   */
  async update(id: string, command: UpdateGenerationCommand): Promise<GenerationDTO> {
    return this.patch<GenerationDTO, UpdateGenerationCommand>(`/generations/${id}`, command);
  }

  /**
   * Trigger generation processing
   * Note: Extended timeout to accommodate large models (e.g., DeepSeek V3.2)
   * that may take up to 3 minutes to process
   */
  async process(): Promise<void> {
    await this.post<null>("/generations/process", undefined, {
      timeout: 240000, // 4 minutes (longer than backend's 3-minute timeout for large models)
    });
  }
}

export const generationsApiClient = new GenerationsApiClient();
