import { useCallback, useEffect, useState } from "react";
import { User } from "@/types/domain";
import { userService } from "../services/user.service";

interface Result {
  users: User[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/** Lista de usuarios del sistema (admin). El estado vive local al feature. */
export function useUsers(): Result {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await userService.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { users, loading, refetch: fetch };
}
