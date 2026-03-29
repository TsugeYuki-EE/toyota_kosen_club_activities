type SortableMember = {
  grade: string | null;
  nickname: string | null;
  name: string;
};

function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function gradeRank(grade: string | null): number {
  if (!grade) return Number.POSITIVE_INFINITY;

  const normalized = toHalfWidthDigits(grade.trim());
  const matched = normalized.match(/\d+/);
  if (matched) {
    return Number(matched[0]);
  }

  return Number.POSITIVE_INFINITY;
}

export function sortMembersByGradeAscending<T extends SortableMember>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const gradeDiff = gradeRank(a.grade) - gradeRank(b.grade);
    if (gradeDiff !== 0) return gradeDiff;

    const displayNameA = (a.nickname || a.name).trim();
    const displayNameB = (b.nickname || b.name).trim();
    return displayNameA.localeCompare(displayNameB, "ja");
  });
}
