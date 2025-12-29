import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerApiSchema,
  registerSchema,
  resetPasswordSchema,
  updatePasswordSchema,
} from "../auth.schema";

describe("loginSchema", () => {
  describe("email validation", () => {
    it("accepts valid email", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
      expect(result.data?.email).toBe("test@example.com");
    });

    it("rejects empty email", () => {
      const result = loginSchema.safeParse({
        email: "",
        password: "password123",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Email is required");
    });

    it("rejects invalid email format", () => {
      const invalidEmails = ["invalid", "invalid@", "@example.com", "invalid.com"];

      invalidEmails.forEach((email) => {
        const result = loginSchema.safeParse({
          email,
          password: "password123",
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Please enter a valid email address");
      });
    });
  });

  describe("password validation", () => {
    it("accepts any non-empty password", () => {
      const passwords = ["password", "123", "p"];

      passwords.forEach((password) => {
        const result = loginSchema.safeParse({
          email: "test@example.com",
          password,
        });
        expect(result.success).toBe(true);
        expect(result.data?.password).toBe(password);
      });
    });

    it("rejects empty password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Password is required");
    });
  });
});

describe("registerApiSchema", () => {
  describe("email validation", () => {
    it("accepts valid email", () => {
      const result = registerApiSchema.safeParse({
        email: "test@example.com",
        password: "Password123",
      });
      expect(result.success).toBe(true);
      expect(result.data?.email).toBe("test@example.com");
    });

    it("rejects empty email", () => {
      const result = registerApiSchema.safeParse({
        email: "",
        password: "Password123",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Email is required");
    });

    it("rejects invalid email format", () => {
      const invalidEmails = ["invalid", "invalid@", "@example.com", "invalid.com"];

      invalidEmails.forEach((email) => {
        const result = registerApiSchema.safeParse({
          email,
          password: "Password123",
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Please enter a valid email address");
      });
    });
  });

  describe("password validation", () => {
    it("accepts valid password meeting all requirements", () => {
      const validPasswords = ["Password123", "MySecure456", "TestAbc789"];

      validPasswords.forEach((password) => {
        const result = registerApiSchema.safeParse({
          email: "test@example.com",
          password,
        });
        expect(result.success).toBe(true);
        expect(result.data?.password).toBe(password);
      });
    });

    it("rejects password shorter than 8 characters", () => {
      const shortPasswords = ["Pass1", "Pwd123", "Short7"];

      shortPasswords.forEach((password) => {
        const result = registerApiSchema.safeParse({
          email: "test@example.com",
          password,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Password must be at least 8 characters");
      });
    });

    it("rejects password without uppercase letter", () => {
      const passwordsWithoutUppercase = ["password123", "lowercase456", "nouppercase789"];

      passwordsWithoutUppercase.forEach((password) => {
        const result = registerApiSchema.safeParse({
          email: "test@example.com",
          password,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Password should contain at least one uppercase letter");
      });
    });

    it("rejects password without lowercase letter", () => {
      const passwordsWithoutLowercase = ["PASSWORD123", "UPPERCASE456", "NOLOWERCASE789"];

      passwordsWithoutLowercase.forEach((password) => {
        const result = registerApiSchema.safeParse({
          email: "test@example.com",
          password,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Password should contain at least one lowercase letter");
      });
    });

    it("rejects password without digit", () => {
      const passwordsWithoutDigit = ["Password", "NoDigitsHere", "LettersOnly"];

      passwordsWithoutDigit.forEach((password) => {
        const result = registerApiSchema.safeParse({
          email: "test@example.com",
          password,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Password should contain at least one digit");
      });
    });

    it("rejects password longer than 128 characters", () => {
      const longPassword = "A".repeat(129) + "1a"; // 131 characters total

      const result = registerApiSchema.safeParse({
        email: "test@example.com",
        password: longPassword,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Password must not exceed 128 characters");
    });

    it("accepts password exactly 128 characters long", () => {
      const exactly128Password = "A".repeat(126) + "1a"; // 126 A's + 1 + a = 128 characters

      const result = registerApiSchema.safeParse({
        email: "test@example.com",
        password: exactly128Password,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("registerSchema", () => {
  describe("password confirmation validation", () => {
    it("accepts matching passwords", () => {
      const result = registerSchema.safeParse({
        email: "test@example.com",
        password: "Password123",
        passwordConfirm: "Password123",
      });
      expect(result.success).toBe(true);
      expect(result.data?.password).toBe("Password123");
      expect(result.data?.passwordConfirm).toBe("Password123");
    });

    it("rejects non-matching passwords", () => {
      const result = registerSchema.safeParse({
        email: "test@example.com",
        password: "Password123",
        passwordConfirm: "DifferentPassword456",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Passwords must match");
      expect(result.error?.issues[0]?.path).toEqual(["passwordConfirm"]);
    });

    it("rejects empty password confirmation", () => {
      const result = registerSchema.safeParse({
        email: "test@example.com",
        password: "Password123",
        passwordConfirm: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Password confirmation is required");
    });
  });

  describe("inherits base schema validation", () => {
    it("validates email and password requirements", () => {
      const result = registerSchema.safeParse({
        email: "invalid-email",
        password: "weak",
        passwordConfirm: "weak",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues).toHaveLength(4); // email invalid + password too short + no uppercase + no lowercase + no digit
    });
  });
});

describe("resetPasswordSchema", () => {
  describe("email validation", () => {
    it("accepts valid email", () => {
      const result = resetPasswordSchema.safeParse({
        email: "test@example.com",
      });
      expect(result.success).toBe(true);
      expect(result.data?.email).toBe("test@example.com");
    });

    it("rejects empty email", () => {
      const result = resetPasswordSchema.safeParse({
        email: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Email is required");
    });

    it("rejects invalid email format", () => {
      const invalidEmails = ["invalid", "invalid@", "@example.com"];

      invalidEmails.forEach((email) => {
        const result = resetPasswordSchema.safeParse({
          email,
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Please enter a valid email address");
      });
    });
  });
});

describe("updatePasswordSchema", () => {
  describe("password validation", () => {
    it("accepts valid password meeting all requirements", () => {
      const result = updatePasswordSchema.safeParse({
        password: "NewPassword123",
      });
      expect(result.success).toBe(true);
      expect(result.data?.password).toBe("NewPassword123");
    });

    it("rejects password shorter than 8 characters", () => {
      const result = updatePasswordSchema.safeParse({
        password: "Short1",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Password must be at least 8 characters");
    });

    it("rejects password without uppercase letter", () => {
      const result = updatePasswordSchema.safeParse({
        password: "newpassword123",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Password should contain at least one uppercase letter");
    });

    it("rejects password without lowercase letter", () => {
      const result = updatePasswordSchema.safeParse({
        password: "NEWPASSWORD123",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Password should contain at least one lowercase letter");
    });

    it("rejects password without digit", () => {
      const result = updatePasswordSchema.safeParse({
        password: "NewPassword",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Password should contain at least one digit");
    });

    it("rejects password longer than 128 characters", () => {
      const longPassword = "A".repeat(129) + "1a"; // 131 characters total

      const result = updatePasswordSchema.safeParse({
        password: longPassword,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Password must not exceed 128 characters");
    });

    it("accepts password exactly 128 characters long", () => {
      const exactly128Password = "A".repeat(126) + "1a"; // 126 A's + 1 + a = 128 characters

      const result = updatePasswordSchema.safeParse({
        password: exactly128Password,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("token validation", () => {
    it("accepts password with optional tokens", () => {
      const result = updatePasswordSchema.safeParse({
        password: "ValidPassword123",
        tokenHash: "hash123",
        token: "token456",
      });
      expect(result.success).toBe(true);
      expect(result.data?.tokenHash).toBe("hash123");
      expect(result.data?.token).toBe("token456");
    });

    it("accepts password without tokens", () => {
      const result = updatePasswordSchema.safeParse({
        password: "ValidPassword123",
      });
      expect(result.success).toBe(true);
      expect(result.data?.tokenHash).toBeUndefined();
      expect(result.data?.token).toBeUndefined();
    });
  });
});
