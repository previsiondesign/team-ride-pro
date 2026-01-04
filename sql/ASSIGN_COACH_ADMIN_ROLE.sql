-- Assign Coach-Admin Role to a User
-- Replace 'e2dc9786-38f0-4d95-b158-766b16095f9c' with your actual User UUID
-- Find your User UUID in: Authentication → Users → Click your email → Copy UUID

INSERT INTO user_roles (user_id, role)
VALUES ('e2dc9786-38f0-4d95-b158-766b16095f9c', 'coach-admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'coach-admin';


