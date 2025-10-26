//import { test, request, expect } from "playwright/test";

/*
test('list users unauthorized', async ({ request }) => {
  const listUsersRes = await request.get('/api/user');
  expect(listUsersRes.status()).toBe(401);
});

test('list users', async ({ request }) => {
  const [user, userToken] = await registerUser(request);
  const listUsersRes = await request.get('/api/user', {
    headers: { 'Authorization': 'Bearer ' + userToken }
  });
  expect(listUsersRes.status()).toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth', { data: testUser });
  const body = await registerRes.json();
  body.user.password = testUser.password;

  return [body.user, body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}
*/