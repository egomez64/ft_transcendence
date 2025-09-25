type LeaderItem = {
  id: number; username: string; elo: number;
  wins: number; losses: number; games_played: number; win_streak: number;
  winRate: number; rank: number;
};

async function fetchLeaderboard(params?: { sort?: 'elo'|'wins'|'winRate'; order?: 'asc'|'desc'; limit?: number; offset?: number; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.order) qs.set('order', params.order);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.search) qs.set('search', params.search);
  const res = await fetch(`/api/leaderboard?${qs.toString()}`, { credentials: 'include' });
  const data = await res.json() as { ok:boolean; total:number; items:LeaderItem[] };
  if (!data.ok) throw new Error('Leaderboard fetch failed');
  return data;
}

async function fetchMyRank() {
  const res = await fetch('/api/leaderboard/me', { credentials:'include' });
  const data = await res.json() as { ok:boolean; user: LeaderItem };
  if (!data.ok) throw new Error('Rank fetch failed');
  return data.user;
}
