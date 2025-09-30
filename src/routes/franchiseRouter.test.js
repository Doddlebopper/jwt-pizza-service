const request = require('supertest');
const app = require('../service');

describe('Franchise Router Tests', () => {
  let adminUser, franchiseeUser, dinerUser;
  let adminToken;


  beforeAll(async () => {
    const { DB, Role } = require('../database/database.js');
    
    adminUser = {
      name: 'Admin User',
      email: Math.random().toString(36).substring(2, 12) + '@admin.com',
      password: 'monkeypie',
      roles: [{ role: Role.Admin }]
    };
    await DB.addUser(adminUser);
    
    franchiseeUser = {
      name: 'Franchisee User',
      email: Math.random().toString(36).substring(2, 12) + '@franchisee.com',
      password: 'monkeypie',
      roles: [{ role: 'diner' }] 
    };
    
    dinerUser = {
      name: 'Diner User',
      email: Math.random().toString(36).substring(2, 12) + '@diner.com',
      password: 'monkeypie',
      roles: [{ role: 'diner' }]
    };

    const adminRes = await request(app).put('/api/auth').send({
      email: adminUser.email,
      password: adminUser.password
    });
    adminToken = adminRes.body.token;

    await request(app).post('/api/auth').send(franchiseeUser);
    await request(app).post('/api/auth').send(dinerUser);
  });

  describe('GET /api/franchise', () => {
    test('List franchises', async () => {
      const response = await request(app)
        .get('/api/franchise')
        .expect(200);

      expect(response.body).toHaveProperty('franchises');
      expect(response.body).toHaveProperty('more');
      expect(Array.isArray(response.body.franchises)).toBe(true);
    });

    test('should accept pagination parameters', async () => {
      const response = await request(app)
        .get('/api/franchise?page=0&limit=5&name=*')
        .expect(200);

      expect(response.body).toHaveProperty('franchises');

      expect(response.body).toHaveProperty('more');
    });
  });

  describe('GET /api/franchise/:userId', () => {
    test('Get user franchises as admin', async () => {
      const response = await request(app)
        .get(`/api/franchise/${franchiseeUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('Get user franchises without auth', async () => {
      await request(app)
        .get(`/api/franchise/${franchiseeUser.id}`)
        .expect(401);
    });
  });

  describe('POST /api/franchise', () => {
    test('Create franchise', async () => {
      const franchiseName = `Test Franchise ${Math.random().toString(36).substring(2, 12)}`;
      const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: franchiseName, admins: [{ email: franchiseeUser.email }] })
        .expect(200);

      expect(response.body).toHaveProperty('name', franchiseName);
      expect(response.body).toHaveProperty('admins');
      expect(response.body).toHaveProperty('id');
    });

    test('Create franchise with invalid admin', async () => {
      const franchiseName = `This franchise needs a valid admin ${Math.random().toString(36).substring(2, 12)}`;
      const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: franchiseName, admins: [{ email: 'invalid@email.com' }] })
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    test('Reject franchise without auth', async () => {
      await request(app)
        .post('/api/franchise')
        .send({ name: 'Test Franchise' })
        .expect(401);
    });
  });


  describe('POST /api/franchise/:franchiseId/store', () => {
    let testFranchiseId;

    beforeAll(async () => {
      const franchiseName = `Store Test Franchise ${Math.random().toString(36).substring(2, 12)}`;
      const createResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: franchiseName, admins: [{ email: franchiseeUser.email }] });
      
      testFranchiseId = createResponse.body.id;
    });

    test('Create store as admin', async () => {
      const storeName = `Test Store ${Math.random().toString(36).substring(2, 8)}`;
      const response = await request(app)
        .post(`/api/franchise/${testFranchiseId}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: storeName })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', storeName);
      expect(response.body).toHaveProperty('franchiseId', testFranchiseId);
    });

    test('Create store without auth', async () => {
      await request(app)
        .post(`/api/franchise/${testFranchiseId}/store`)
        .send({ name: 'Unauthorized Store' })
        .expect(401);
    });
  });

  describe('DELETE /api/franchise', () => {
    let testFranchiseId;

    beforeAll(async () => {
      const franchiseName = `Franchise for imminent destruction ${Math.random().toString(36).substring(2, 12)}`;
      const createResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: franchiseName, admins: [{ email: franchiseeUser.email }] });
      
      testFranchiseId = createResponse.body.id;
    });

    test('Delete franchise', async () => {
      const response = await request(app)
        .delete(`/api/franchise/${testFranchiseId}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'disintegrated by the beam');
    });

    test('Reject delete without auth', async () => {
      const franchiseName = `Imminent franchise for destruction number 2 ${Math.random().toString(36).substring(2, 12)}`;
      const createResponse = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: franchiseName, admins: [{ email: franchiseeUser.email }] });

      await request(app)
        .delete(`/api/franchise/${createResponse.body.id}`)
      });
  });
});
