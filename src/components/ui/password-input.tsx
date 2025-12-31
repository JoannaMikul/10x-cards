import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  showToggle?: boolean;
  toggleTestId?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showToggle = true, toggleTestId, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative">
        <Input {...props} ref={ref} type={showPassword ? "text" : "password"} className="pr-10" />
        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            disabled={props.disabled}
            tabIndex={-1}
            data-testid={toggleTestId}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
