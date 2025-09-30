const request = require('supertest');
const app = require('./service');

describe('Service Tests', () => {
  describe('GET /', () => {
    test('Welcome message', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'welcome to JWT Pizza');
      expect(response.body).toHaveProperty('version');
      expect(typeof response.body.version).toBe('string');
    });
  });

  describe('GET /api/docs', () => {
    test('API documentation', async () => {
      const response = await request(app)
        .get('/api/docs')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('config');
      expect(Array.isArray(response.body.endpoints)).toBe(true);
      expect(response.body.config).toHaveProperty('factory');
      expect(response.body.config).toHaveProperty('db');
    });
  });

  describe('CORS Headers', () => {
    test('CORS headers', async () => {
      const response = await request(app)
        .get('/')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-methods']).toContain('PUT');
      expect(response.headers['access-control-allow-methods']).toContain('DELETE');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
      expect(response.headers).toHaveProperty('access-control-allow-credentials');
    });

    test('should use wildcard origin when no origin header', async () => {
      const response = await request(app)
        .get('/');

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('404', () => {
    test('404 because unknown endpoint', async () => {
      const response = await request(app)
        .get('/unknown-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('message', 'unknown endpoint');
    });

    test('should return 404 for unknown API endpoint', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(response.body).toHaveProperty('message', 'unknown endpoint');
    });
  });
});
