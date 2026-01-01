import { z } from "zod";
import { temperatureSchema } from "./generations.schema";

export const generatorFormSchema = z.object({
  raw_input_text: z.string().min(1, "Text is required"),
  model: z
    .string({
      required_error: "Model is required",
      invalid_type_error: "Model must be a string",
    })
    .min(1, "Model is required"),
  temperature: temperatureSchema,
});

export type GeneratorFormData = z.infer<typeof generatorFormSchema>;

export const DEFAULT_GENERATOR_FORM_DATA: GeneratorFormData = {
  raw_input_text: "",
  model: "",
  temperature: 0.7,
};
