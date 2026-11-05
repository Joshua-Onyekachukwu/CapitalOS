# Repository instructions

## Commits and authorship

- **Never add AI attribution.** No `Co-Authored-By`, no "Generated with
  Codebuff", no tool trailer of any kind. A commit message ends with its own
  last line.
- **Commit as the repository owner**, Joshua Onyekachukwu
  `<onyekachukwujoshua39@gmail.com>`. Do not commit as an agent or bot identity.
- Before committing, confirm `git config --local user.name` and
  `git config --local user.email` resolve to the owner, and use
  `git commit --amend --reset-author` if a commit already carries the wrong
  author.

## Landing page claims

`src/components/Landing/*` makes claims about the investor corpus. Every number
there must match a measured value in `docs/23-wave1-investor-data-findings.md`
and `docs/30-completion-tracker.md`:

- The corpus is 18,995 **firms** from SEC 13F / Form D and IAPD filings, US only.
- 4,921 have an email address; none is email-verified, so never write "verified
  contactable emails".
- Cheque size exists on 14 records, thesis text on 26, portfolio companies on 0.
  Never claim those fields are complete, and never claim UK/EU coverage.

When the underlying counts change, update the copy in the same commit.
