import React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Slider } from "./ui/slider";
import { Field, FieldLabel, FieldError } from "./ui/field";

interface TemperatureSliderProps {
  min: number;
  max: number;
  step: number;
}

export function TemperatureSlider({ min, max, step }: TemperatureSliderProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const error = typeof errors.temperature?.message === "string" ? errors.temperature.message : undefined;

  const getTemperatureDescription = (temp: number) => {
    if (temp <= 0.3) return "Very conservative - predictable responses";
    if (temp <= 0.7) return "Balanced - good creativity balance";
    if (temp <= 1.2) return "Creative - more diverse responses";
    return "Very creative - maximum diversity";
  };

  return (
    <Controller
      name="temperature"
      control={control}
      render={({ field, fieldState }) => {
        const sliderValue = typeof field.value === "number" ? field.value : 0.7;
        return (
          <Field data-invalid={fieldState.invalid}>
            <div className="space-y-3">
              <div>
                <FieldLabel id="temperature-label" htmlFor="temperature-slider">
                  Temperature ({sliderValue.toFixed(1)})
                </FieldLabel>
                <span className="text-xs text-muted-foreground">{getTemperatureDescription(sliderValue)}</span>
              </div>
              <div className="space-y-2">
                <Slider
                  id="temperature-slider"
                  value={[sliderValue]}
                  onValueChange={(values) => field.onChange(Number(values[0]))}
                  min={min}
                  max={max}
                  step={step}
                  className="w-full"
                  aria-labelledby="temperature-label"
                  aria-invalid={fieldState.invalid}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low (0.0)</span>
                  <span>High (2.0)</span>
                </div>
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              {error && !fieldState.invalid && <FieldError>{error}</FieldError>}
            </div>
          </Field>
        );
      }}
    />
  );
}
