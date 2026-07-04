# Menu Card Weekday Schedule SQL

Manual steps:

1. Run the `INFORMATION_SCHEMA.COLUMNS` check in `docs/sql/menu_card_weekday_schedule.sql`.
2. Run only the missing `ADD COLUMN` statements from `docs/sql/menu_card_weekday_schedule.sql` manually in MySQL Workbench.
3. Run `npx prisma db pull`.
4. Run `npx prisma generate`.
5. Continue with the next Codex prompt.

Notes:

- `ACTIVE_DAYS_JSON` stores weekday keys as JSON text, for example `["monday","tuesday","friday"]`.
- Daily unlimited cards use `IS_UNLIMITED = 1`, `VALID_TO = NULL`, and every weekday in `ACTIVE_DAYS_JSON`.
- This SQL does not delete existing data and does not enforce a unique active menu.
