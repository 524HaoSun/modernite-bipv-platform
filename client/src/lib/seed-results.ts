import { useEffect } from "react";
import { useDesignStore } from "../store/design-store";

export function useSeedResults() {
  const result = useDesignStore((s) => s.result);
  const calculateDemo = useDesignStore((s) => s.calculateDemo);
  useEffect(() => {
    if (!result) {
      void calculateDemo();
    }
  }, [result, calculateDemo]);
}
