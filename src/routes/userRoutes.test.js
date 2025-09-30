const request = require('supertest');
const app = require('../service');

describe('User Routes Tests', () => {
  let adminUser, regularUser;
  let adminToken, regularToken;

  beforeAll(async () => {
    const { DB, Role } = require('../database/database.js');
    
    adminUser = {
      name: 'Admin User',
      email: Math.random().toString(36).substring(2, 12) + '@admin.com',
      password: 'monkeypie',
      roles: [{ role: Role.Admin }]
    };
    await DB.addUser(adminUser);
    
    regularUser = {
      name: 'Regular User',
      email: Math.random().toString(36).substring(2, 12) + '@user.com',
      password: 'monkeypie',
      roles: [{ role: 'diner' }]
    };

    const adminRes = await request(app).put('/api/auth').send({
      email: adminUser.email,
      password: adminUser.password
    });
    adminToken = adminRes.body.token;
    adminUser.id = adminRes.body.user.id;

    const regularRes = await request(app).post('/api/auth').send(regularUser);
    regularToken = regularRes.body.token;
    regularUser.id = regularRes.body.user.id;
  });

  describe('GET /api/user/me', () => {
    test('Get authenticated user information', async () => {
      const response = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', regularUser.id);

      expect(response.body).toHaveProperty('name', regularUser.name);

      expect(response.body).toHaveProperty('email', regularUser.email);

      expect(response.body).toHaveProperty('roles');

      expect(Array.isArray(response.body.roles)).toBe(true);

      expect(response.body.roles[0]).toHaveProperty('role', 'diner');

      expect(response.body).not.toHaveProperty('password');
    });

    test('Get admin user information', async () => {
      const response = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', adminUser.id);

      expect(response.body).toHaveProperty('name', adminUser.name);

      expect(response.body).toHaveProperty('email', adminUser.email);

      expect(response.body).toHaveProperty('roles');

      expect(Array.isArray(response.body.roles)).toBe(true);

      expect(response.body.roles[0]).toHaveProperty('role', 'admin');

      expect(response.body).not.toHaveProperty('password');
    });

    test('Reject access without authentication', async () => {
      await request(app)
        .get('/api/user/me')
        .expect(401);
    });

    test('Reject access with invalid token', async () => {
      await request(app)
        .get('/api/user/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PUT /api/user/:userId', () => {
    test('Update user information', async () => {
      const response = await request(app)
        .put(`/api/user/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ 
          name: 'Updated User',
          email: regularUser.email
        });

      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('user');

      expect(response.body).toHaveProperty('token');
    });

    test('Update admin user information', async () => {
      const response = await request(app)
        .put(`/api/user/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          name: 'Updated Admin',
          email: adminUser.email
        });

      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('user');
      
      expect(response.body).toHaveProperty('token');
    });
  });
});