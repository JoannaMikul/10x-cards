import { describe, it, expect } from "vitest";
import { createReviewSessionSchema, reviewEventsQuerySchema, reviewStatsQuerySchema } from "../review-sessions.schema";

describe("createReviewSessionSchema", () => {
  describe("session_id validation", () => {
    it("accepts valid UUID", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: [
          {
            card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            outcome: "good",
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data?.session_id).toBe("794d9f4a-3b8f-482f-a61c-0b4cce9b2f95");
    });

    it("rejects invalid UUID", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "invalid-uuid",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: [
          {
            card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            outcome: "good",
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Session ID must be a valid UUID.");
    });

    it("rejects empty session_id", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: [
          {
            card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            outcome: "good",
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Session ID must be a valid UUID.");
    });
  });

  describe("started_at validation", () => {
    it("accepts valid ISO datetime", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: [
          {
            card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            outcome: "good",
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data?.started_at).toBe("2024-01-01T10:00:00.000Z");
    });

    it("rejects invalid datetime", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "invalid-date",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: [
          {
            card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            outcome: "good",
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Started at must be a valid ISO date string.");
    });
  });

  describe("completed_at validation", () => {
    it("accepts valid ISO datetime", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: [
          {
            card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            outcome: "good",
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data?.completed_at).toBe("2024-01-01T10:30:00.000Z");
    });

    it("rejects invalid datetime", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "not-a-date",
        reviews: [
          {
            card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            outcome: "good",
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Completed at must be a valid ISO date string.");
    });
  });

  describe("reviews validation", () => {
    it("accepts valid reviews array", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: [
          {
            card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            outcome: "good",
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data?.reviews).toHaveLength(1);
    });

    it("accepts reviews with all optional fields", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: [
          {
            card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            outcome: "good",
            response_time_ms: 1500,
            prev_interval_days: 3,
            next_interval_days: 7,
            was_learning_step: false,
            payload: { metadata: "test" },
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(result.data?.reviews[0].response_time_ms).toBe(1500);
      expect(result.data?.reviews[0].prev_interval_days).toBe(3);
      expect(result.data?.reviews[0].next_interval_days).toBe(7);
      expect(result.data?.reviews[0].was_learning_step).toBe(false);
      expect(result.data?.reviews[0].payload).toEqual({ metadata: "test" });
    });

    it("rejects empty reviews array", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("At least one review is required.");
    });

    it("rejects more than 100 reviews", () => {
      const reviews = Array.from({ length: 101 }, (_, i) => ({
        card_id: `894d9f4a-3b8f-482f-a61c-0b4cce9b2f9${i % 10}`,
        outcome: "good" as const,
      }));

      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Cannot process more than 100 reviews at once.");
    });

    it("rejects non-array reviews", () => {
      const result = createReviewSessionSchema.safeParse({
        session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
        started_at: "2024-01-01T10:00:00.000Z",
        completed_at: "2024-01-01T10:30:00.000Z",
        reviews: "not-an-array",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Reviews must be an array of review objects.");
    });
  });

  describe("review item validation", () => {
    describe("card_id validation", () => {
      it("accepts valid UUID", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
            },
          ],
        });
        expect(result.success).toBe(true);
      });

      it("rejects invalid UUID", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "invalid-card-id",
              outcome: "good",
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Card ID must be a valid UUID.");
      });
    });

    describe("outcome validation", () => {
      it("accepts valid outcome", () => {
        const validOutcomes = ["fail", "hard", "good", "easy", "again"] as const;

        for (const outcome of validOutcomes) {
          const result = createReviewSessionSchema.safeParse({
            session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
            started_at: "2024-01-01T10:00:00.000Z",
            completed_at: "2024-01-01T10:30:00.000Z",
            reviews: [
              {
                card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
                outcome,
              },
            ],
          });
          expect(result.success).toBe(true);
        }
      });

      it("rejects invalid outcome", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "invalid",
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Outcome must be one of: fail, hard, good, easy, again.");
      });
    });

    describe("response_time_ms validation", () => {
      it("accepts positive integer", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              response_time_ms: 1500,
            },
          ],
        });
        expect(result.success).toBe(true);
        expect(result.data?.reviews[0].response_time_ms).toBe(1500);
      });

      it("rejects zero", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              response_time_ms: 0,
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Response time must be positive.");
      });

      it("rejects negative number", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              response_time_ms: -100,
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Response time must be positive.");
      });

      it("rejects non-integer", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              response_time_ms: 1.5,
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Response time must be an integer.");
      });
    });

    describe("prev_interval_days validation", () => {
      it("accepts non-negative integer", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              prev_interval_days: 5,
            },
          ],
        });
        expect(result.success).toBe(true);
        expect(result.data?.reviews[0].prev_interval_days).toBe(5);
      });

      it("accepts zero", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              prev_interval_days: 0,
            },
          ],
        });
        expect(result.success).toBe(true);
        expect(result.data?.reviews[0].prev_interval_days).toBe(0);
      });

      it("rejects negative number", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              prev_interval_days: -1,
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Previous interval cannot be negative.");
      });
    });

    describe("next_interval_days validation", () => {
      it("accepts non-negative integer", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              next_interval_days: 10,
            },
          ],
        });
        expect(result.success).toBe(true);
        expect(result.data?.reviews[0].next_interval_days).toBe(10);
      });

      it("accepts zero", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              next_interval_days: 0,
            },
          ],
        });
        expect(result.success).toBe(true);
        expect(result.data?.reviews[0].next_interval_days).toBe(0);
      });

      it("rejects negative number", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              next_interval_days: -5,
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Next interval cannot be negative.");
      });
    });

    describe("was_learning_step validation", () => {
      it("accepts boolean", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              was_learning_step: true,
            },
          ],
        });
        expect(result.success).toBe(true);
        expect(result.data?.reviews[0].was_learning_step).toBe(true);
      });

      it("rejects non-boolean", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              was_learning_step: "true",
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Was learning step must be a boolean.");
      });
    });

    describe("payload validation", () => {
      it("accepts valid JSON", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              payload: { key: "value", number: 42, nested: { array: [1, 2, 3] } },
            },
          ],
        });
        expect(result.success).toBe(true);
      });

      it("accepts null", () => {
        const result = createReviewSessionSchema.safeParse({
          session_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
          started_at: "2024-01-01T10:00:00.000Z",
          completed_at: "2024-01-01T10:30:00.000Z",
          reviews: [
            {
              card_id: "894d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
              outcome: "good",
              payload: null,
            },
          ],
        });
        expect(result.success).toBe(true);
      });
    });
  });
});

describe("reviewEventsQuerySchema", () => {
  describe("card_id validation", () => {
    it("accepts valid UUID", () => {
      const result = reviewEventsQuerySchema.safeParse({
        card_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
      });
      expect(result.success).toBe(true);
      expect(result.data?.card_id).toBe("794d9f4a-3b8f-482f-a61c-0b4cce9b2f95");
    });

    it("rejects invalid UUID", () => {
      const result = reviewEventsQuerySchema.safeParse({
        card_id: "invalid-uuid",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Card ID must be a valid UUID.");
    });
  });

  describe("from validation", () => {
    it("accepts valid ISO datetime", () => {
      const result = reviewEventsQuerySchema.safeParse({
        from: "2024-01-01T10:00:00.000Z",
      });
      expect(result.success).toBe(true);
      expect(result.data?.from).toBe("2024-01-01T10:00:00.000Z");
    });

    it("rejects invalid datetime", () => {
      const result = reviewEventsQuerySchema.safeParse({
        from: "not-a-date",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("From date must be a valid ISO date string.");
    });
  });

  describe("to validation", () => {
    it("accepts valid ISO datetime", () => {
      const result = reviewEventsQuerySchema.safeParse({
        to: "2024-01-02T10:00:00.000Z",
      });
      expect(result.success).toBe(true);
      expect(result.data?.to).toBe("2024-01-02T10:00:00.000Z");
    });

    it("rejects invalid datetime", () => {
      const result = reviewEventsQuerySchema.safeParse({
        to: "invalid-date",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("To date must be a valid ISO date string.");
    });
  });

  describe("limit validation", () => {
    it("accepts valid integer", () => {
      const result = reviewEventsQuerySchema.safeParse({
        limit: "50",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it("accepts string number", () => {
      const result = reviewEventsQuerySchema.safeParse({
        limit: "15",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(15);
    });

    it("defaults to 20 for empty string", () => {
      const result = reviewEventsQuerySchema.safeParse({
        limit: "",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });

    it("defaults to 20 when not provided", () => {
      const result = reviewEventsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });

    it("rejects non-integer", () => {
      const result = reviewEventsQuerySchema.safeParse({
        limit: "abc",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be between 1 and 100.");
    });

    it("rejects below minimum", () => {
      const result = reviewEventsQuerySchema.safeParse({
        limit: "0",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be between 1 and 100.");
    });

    it("rejects above maximum", () => {
      const result = reviewEventsQuerySchema.safeParse({
        limit: "101",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be between 1 and 100.");
    });
  });

  describe("cursor validation", () => {
    it("accepts string cursor", () => {
      const result = reviewEventsQuerySchema.safeParse({
        cursor: "cursor-string",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("cursor-string");
    });
  });
});

describe("reviewStatsQuerySchema", () => {
  describe("card_id validation", () => {
    it("accepts valid UUID", () => {
      const result = reviewStatsQuerySchema.safeParse({
        card_id: "794d9f4a-3b8f-482f-a61c-0b4cce9b2f95",
      });
      expect(result.success).toBe(true);
      expect(result.data?.card_id).toBe("794d9f4a-3b8f-482f-a61c-0b4cce9b2f95");
    });

    it("rejects invalid UUID", () => {
      const result = reviewStatsQuerySchema.safeParse({
        card_id: "invalid-uuid",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Card ID must be a valid UUID.");
    });
  });

  describe("next_review_before validation", () => {
    it("accepts valid ISO datetime", () => {
      const result = reviewStatsQuerySchema.safeParse({
        next_review_before: "2024-01-01T10:00:00.000Z",
      });
      expect(result.success).toBe(true);
      expect(result.data?.next_review_before).toBe("2024-01-01T10:00:00.000Z");
    });

    it("rejects invalid datetime", () => {
      const result = reviewStatsQuerySchema.safeParse({
        next_review_before: "not-a-date",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Next review before must be a valid ISO date string.");
    });
  });

  describe("limit validation", () => {
    it("accepts valid integer", () => {
      const result = reviewStatsQuerySchema.safeParse({
        limit: "50",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(50);
    });

    it("accepts string number", () => {
      const result = reviewStatsQuerySchema.safeParse({
        limit: "15",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(15);
    });

    it("defaults to 20 for empty string", () => {
      const result = reviewStatsQuerySchema.safeParse({
        limit: "",
      });
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });

    it("defaults to 20 when not provided", () => {
      const result = reviewStatsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });

    it("rejects non-integer", () => {
      const result = reviewStatsQuerySchema.safeParse({
        limit: "abc",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be between 1 and 100.");
    });

    it("rejects below minimum", () => {
      const result = reviewStatsQuerySchema.safeParse({
        limit: "0",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be between 1 and 100.");
    });

    it("rejects above maximum", () => {
      const result = reviewStatsQuerySchema.safeParse({
        limit: "101",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Limit must be between 1 and 100.");
    });
  });

  describe("cursor validation", () => {
    it("accepts string cursor", () => {
      const result = reviewStatsQuerySchema.safeParse({
        cursor: "cursor-string",
      });
      expect(result.success).toBe(true);
      expect(result.data?.cursor).toBe("cursor-string");
    });
  });
});
