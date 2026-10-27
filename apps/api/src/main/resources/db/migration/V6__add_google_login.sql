-- 구글 로그인: 구글 계정의 고유 식별자(sub)를 저장한다. 구글로만 가입한 사용자는 비밀번호가 없다.
ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
