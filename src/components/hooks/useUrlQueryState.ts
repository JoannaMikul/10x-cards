import { useCallback, useEffect, useState } from "react";

type StateUpdater<TValue> = (prev: TValue) => TValue;

interface UseUrlQueryStateOptions<TValue> {
  initialValue: TValue;
  parse: (params: URLSearchParams) => TValue;
  serialize: (value: TValue) => URLSearchParams;
  replace?: boolean;
}

export function useUrlQueryState<TValue>(
  options: UseUrlQueryStateOptions<TValue>
): [TValue, (updater: StateUpdater<TValue>) => void] {
  const { initialValue, parse, serialize, replace = false } = options;

  const [value, setValue] = useState<TValue>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    return parse(new URLSearchParams(window.location.search));
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    const handlePopState = () => {
      setValue(parse(new URLSearchParams(window.location.search)));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [parse]);

  const updateValue = useCallback(
    (updater: StateUpdater<TValue>) => {
      setValue((prev) => {
        const next = updater(prev);

        if (typeof window !== "undefined") {
          const params = serialize(next);
          const url = new URL(window.location.href);
          url.search = params.toString();

          const method: "pushState" | "replaceState" = replace ? "replaceState" : "pushState";
          window.history[method]({}, "", url.toString());
        }

        return next;
      });
    },
    [replace, serialize]
  );

  return [value, updateValue];
}
