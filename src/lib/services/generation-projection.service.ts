import type { GenerationRecord } from "./generations.service.ts";

type GenerationResponseShape = Pick<
  GenerationRecord,
  | "id"
  | "model"
  | "status"
  | "temperature"
  | "prompt_tokens"
  | "sanitized_input_length"
  | "started_at"
  | "completed_at"
  | "created_at"
  | "updated_at"
  | "error_code"
  | "error_message"
>;

export function projectGeneration(generation: GenerationRecord): GenerationResponseShape {
  const {
    id,
    model,
    status,
    temperature,
    prompt_tokens,
    sanitized_input_length,
    started_at,
    completed_at,
    created_at,
    updated_at,
    error_code,
    error_message,
  } = generation;

  return {
    id,
    model,
    status,
    temperature,
    prompt_tokens,
    sanitized_input_length,
    started_at,
    completed_at,
    created_at,
    updated_at,
    error_code,
    error_message,
  };
}

export type { GenerationResponseShape };
