-- 서비스 관리자(세법 관리 권한). 그룹 ADMIN과 별개이며 지정·해제는 운영자가 DB에서 직접 한다(docs/deploy.md).
ALTER TABLE users ADD COLUMN service_admin BOOLEAN NOT NULL DEFAULT FALSE;
