const {DB, Role} = require('./database.js');

// Helper function to generate random names for testing
function randomName() {
    return 'TestUser' + Math.floor(Math.random() * 10000);
}

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';

    await DB.addUser(user);
    user.password = 'toomanysecrets';

    return user;
}

describe('Database Tests', () => {
    test('create admin user', async () => {
        const adminUser = await createAdminUser();
        expect(adminUser).toBeDefined();
        expect(adminUser.name).toBeDefined();
        expect(adminUser.email).toBeDefined();
        expect(adminUser.roles).toEqual([{role: Role.Admin}]);
    });

    test('should have admin role in created user', async () => {
        const adminUser = await createAdminUser();
        expect(adminUser.roles[0].role).toBe(Role.Admin);
    });
});

describe('test the menu in database', () => {
    test('should get menu items', async () => {
        const menu = await DB.getMenu();
        expect(Array.isArray(menu)).toBe(true);
    });

    test('should add menu item', async () => {
        const menuItem = {
            title: 'Test Pizza',
            description: 'A delicious test pizza',
            image: 'test-pizza.png',
            price: 12.99
        };

        const result = await DB.addMenuItem(menuItem);

        expect(result).toHaveProperty('id');

        expect(result).toHaveProperty('title', menuItem.title);

        expect(result).toHaveProperty('description', menuItem.description);

        expect(result).toHaveProperty('image', menuItem.image);

        expect(result).toHaveProperty('price', menuItem.price);
    });

    test('retrieve menu item', async () => {
        const menuItem = {
            title: 'Weird test pizza?',
            description: 'weird test pizza',
            image: 'weird-test-pizza.png',
            price: 15.99
        };

        const addedItem = await DB.addMenuItem(menuItem);
        const menu = await DB.getMenu();
        
        const foundItem = menu.find(item => item.id === addedItem.id);
        expect(foundItem).toBeDefined();
        expect(foundItem.title).toBe(menuItem.title);
    });
});