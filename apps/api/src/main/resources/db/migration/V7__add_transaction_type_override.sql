-- 웹에서 바꾼 타입. 원본 type과 같으면 NULL로 둔다. 재 import는 이 값을 덮어쓰지 않는다.
ALTER TABLE transactions ADD COLUMN type_override VARCHAR(10) CHECK (type_override IN ('INCOME', 'EXPENSE', 'TRANSFER'));
