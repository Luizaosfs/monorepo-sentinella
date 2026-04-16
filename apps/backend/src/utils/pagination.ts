export function Paginated<T>() {
  abstract class PaginatedResponseClass {
    items!: T[];
    pagination!: PageInfo;
  }
  return PaginatedResponseClass;
}

export class PageInfo {
  perPage!: number;
  currentPage!: number;
  count!: number;
  pagesCount!: number;
}

export async function Paginate(
  count: number,
  perPage: number,
  currentPage: number,
) {
  const pagesCount = Math.ceil(count / perPage);
  return { perPage, currentPage, count, pagesCount };
}
