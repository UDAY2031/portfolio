// ─────────────────────────────────────────────────────────────────────────────
// Identity and narrative. Every biographical fact of the archive itself lives
// in /resources/milestones/*.json (see resources/README.md) and reaches the
// render layer only through the generated manifest — nothing here is a
// project, a metric or a date. Sourced only from the resume (resume-off.pdf),
// the previous portfolio, and documents the user placed in the repo.
// ─────────────────────────────────────────────────────────────────────────────

export const IDENTITY = {
  name: "Uday Kumar G",
  shortName: "UDAY KUMAR G",
  title: "AI & ML Engineer · Founder · Builder",
  location: "Bengaluru, India",
  email: "uday242004@gmail.com",
  links: {
    github: "https://github.com/UDAY2031",
    linkedin: "https://www.linkedin.com/in/udaykumar-g-b0a990264/",
    leetcode: "https://leetcode.com/u/Knight_2031/",
  },
};

// Original text, written for this project. Not quoted from any film.
export const NARRATIVE = {
  /** Phase 01 — three quiet lines before the drift begins */
  intro: ["somewhere beyond the stars", "a signal is waiting", IDENTITY.shortName],
  /** Phase 03 — the only moment the visitor's name appears */
  threshold: `The archive of ${IDENTITY.name} begins.`,
  /** Phase 05 — two closing lines, each held alone on black */
  closing: ["None of this has happened yet.", "It's still being built."],
};
