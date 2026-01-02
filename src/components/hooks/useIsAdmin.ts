import { useState, useEffect } from "react";

export function useIsAdmin(): { isAdmin: boolean | null; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIsAdmin = async () => {
      try {
        const response = await fetch("/api/admin/check", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        } else {
          // eslint-disable-next-line no-console
          console.error("[useIsAdmin] Failed to check admin status", response.status);
          setIsAdmin(false);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[useIsAdmin] Unexpected error", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    fetchIsAdmin();
  }, []);

  return { isAdmin, loading };
}
