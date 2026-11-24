type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<PageResult<T>>
): Promise<PageResult<T>> {
  const rows: T[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) return { data: null, error };

    const page = data || [];
    rows.push(...page);
    if (page.length < 1000) return { data: rows, error: null };
  }
}
