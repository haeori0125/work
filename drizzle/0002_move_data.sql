-- 하루 한 행이던 출퇴근 기록을 근무 구간으로 옮긴다.
INSERT INTO "work_segments" ("user_id", "date", "clock_in", "clock_out")
SELECT "user_id", "date", "clock_in", "clock_out" FROM "attendance";
--> statement-breakpoint
-- 이전 데이터는 (사용자, 날짜)당 한 행이라 날짜로 짝을 찾는다.
INSERT INTO "segment_edits" ("segment_id", "edited_by", "at", "old_clock_in", "old_clock_out")
SELECT ws."id", e."edited_by", e."at", e."old_clock_in", e."old_clock_out"
FROM "attendance_edits" e
JOIN "attendance" a ON a."id" = e."attendance_id"
JOIN "work_segments" ws ON ws."user_id" = a."user_id" AND ws."date" = a."date";
--> statement-breakpoint
-- 개인 메모 한 장을 여러 장 메모의 첫 장으로 옮긴다.
INSERT INTO "notes" ("user_id", "body", "pinned", "created_at", "updated_at")
SELECT "user_id", "body", false, "updated_at", "updated_at" FROM "personal_memos" WHERE btrim("body") <> '';
