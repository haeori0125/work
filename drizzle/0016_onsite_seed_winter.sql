-- 1–2월 고3N수 현장강의 기본 스케줄(지점명만, 출근할 사람은 관리자 화면에서 지정)
WITH p AS (
  INSERT INTO "onsite_periods" ("name", "start_date", "end_date", "created_at")
  VALUES ('1–2월 고3N수 현장강의', '2027-01-01', '2027-02-28', now())
  RETURNING "id"
)
INSERT INTO "onsite_period_titles" ("period_id", "weekday", "slot", "title")
SELECT p."id", v.weekday, v.slot, v.title FROM p, (VALUES
  (6, 'pm', 'MEXX'),
  (0, 'eve', 'MEXX'),
  (1, 'eve', '최상위권 러셀 기숙'),
  (3, 'eve', '러셀 강남'),
  (4, 'eve', '러셀 대치'),
  (5, 'pm', '러셀 분당'),
  (5, 'eve', '러셀 영통')
) AS v(weekday, slot, title);
