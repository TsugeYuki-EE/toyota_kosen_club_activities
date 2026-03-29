const CLUB_PASSWORD = "ttc";

export function isValidClubPassword(password: string | null | undefined): boolean {
  return (password || "") === CLUB_PASSWORD;
}