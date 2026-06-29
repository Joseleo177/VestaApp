import { useCallback, useEffect, useState } from "react";
import { Tower } from "@/types/domain";
import { towerService } from "../services/tower.service";

interface Result {
  towers: Tower[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useTowers(): Result {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setTowers(await towerService.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { towers, loading, refetch: fetch };
}
