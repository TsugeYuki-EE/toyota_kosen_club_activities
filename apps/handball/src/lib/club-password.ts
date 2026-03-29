const CLUB_PASSWORD = "hand";

export function isValidClubPassword(password: string | null | undefined): boolean {
  return (password || "") === CLUB_PASSWORD;
}