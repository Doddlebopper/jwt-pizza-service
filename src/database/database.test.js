const {DB} = require('./database/database.js');

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';

    await DB.addUser(user);
    user.password = 'toomanysecrets';

    return user;
}