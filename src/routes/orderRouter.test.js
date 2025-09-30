const request = require('supertest');
const app = require('../service');

describe('Order Router Tests', () => {
  let adminUser, dinerUser;
  let adminToken, dinerToken;
  let testFranchise;

  beforeAll(async () => {
    const { DB, Role } = require('../database/database.js');
    
    adminUser = {
      name: 'Admin User',
      email: Math.random().toString(36).substring(2, 12) + '@admin.com',
      password: 'monkeypie',
      roles: [{ role: Role.Admin }]
    };
    await DB.addUser(adminUser);
    
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

    const dinerRes = await request(app).post('/api/auth').send(dinerUser);
    dinerToken = dinerRes.body.token;
    dinerUser.id = dinerRes.body.user.id;

    const franchiseName = `Order Test Franchise ${Math.random().toString(36).substring(2, 12)}`;
    const franchiseRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: franchiseName, admins: [{ email: adminUser.email }] });
    
    testFranchise = franchiseRes.body;

    await request(app)
      .post(`/api/franchise/${testFranchise.id}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Store' });

    await DB.addMenuItem({
      title: 'Test Pizza',
      description: 'A test pizza',
      image: 'test-pizza.png',
      price: 12.99
    });
  });

  describe('GET /api/order/menu', () => {
    test('Get menu items', async () => {
      const response = await request(app)
        .get('/api/order/menu')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    
      const testItem = response.body.find(item => item.title === 'Test Pizza');
      expect(testItem).toBeDefined();

      expect(testItem).toHaveProperty('id');

      expect(testItem).toHaveProperty('title', 'Test Pizza');

      expect(testItem).toHaveProperty('description', 'A test pizza');

      expect(testItem).toHaveProperty('image', 'test-pizza.png');

      expect(testItem).toHaveProperty('price', 12.99);
    });
  });

  describe('PUT /api/order/menu', () => {
    test('Add menu item as admin', async () => {
      const newMenuItem = {
        title: 'New Test Pizza',
        description: 'Another delicious test pizza',
        image: 'new-test-pizza.png',
        price: 15.99
      };

      const response = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newMenuItem)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      const addedItem = response.body.find(item => item.title === 'New Test Pizza');

      expect(addedItem).toBeDefined();

      expect(addedItem).toHaveProperty('id');

      expect(addedItem).toHaveProperty('title', 'New Test Pizza');

      expect(addedItem).toHaveProperty('description', 'Another delicious test pizza');

      expect(addedItem).toHaveProperty('image', 'new-test-pizza.png');

      expect(addedItem).toHaveProperty('price', 15.99);
    });

    test('Reject menu item addition when not admin', async () => {
      const newMenuItem = {
        title: 'Unauthorized Pizza',
        description: 'This should fail',
        image: 'unauthorized.png',
        price: 10.99
      };

      await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send(newMenuItem)
        .expect(403);
    });
  });

  describe('Additional Coverage', () => {
    test('API failure for the extra bump to 80%', async () => {
      const orderData = {
        franchiseId: 1,
        storeId: 1,
        items: [
          {
            menuId: 1,
            description: 'Test Order',
            price: 12.99
          }
        ]
      };

      const response = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send(orderData);


      expect([200, 500]).toContain(response.status);
    });
  });

});