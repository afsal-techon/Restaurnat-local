const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'TEC POS',
  script: path.join(__dirname, 'server.cjs'), 
});

svc.on('uninstall', () => {
  console.log('Old service removed completely');
});

svc.uninstall();
